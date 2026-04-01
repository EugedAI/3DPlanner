import type {
  Correction,
  UserFeedback,
  Pattern,
  StorageAdapter,
  ParseResult,
} from '../core/types';
import { extractPatternFromCorrection } from '../core/patterns';
import { Logger } from '../utils/logging';

const STORAGE_KEYS = {
  corrections: 'corrections',
  feedback: 'feedback',
  patterns: 'patterns',
  metrics: 'parse_metrics',
};

/**
 * Handles user corrections and feedback, extracting patterns
 * and persisting them via the storage adapter.
 */
export class FeedbackHandler {
  private storage: StorageAdapter;
  private logger: Logger;

  constructor(storage: StorageAdapter, logger: Logger) {
    this.storage = storage;
    this.logger = logger;
  }

  /** Record a user correction to a parsed element */
  async recordCorrection(parseId: string, correction: Correction): Promise<Pattern | null> {
    this.logger.info(`Recording correction for parse ${parseId}, element ${correction.elementIndex}`);

    // Persist correction
    const corrections = await this.getCorrections();
    corrections.push({ parseId, ...correction });
    await this.storage.set(STORAGE_KEYS.corrections, JSON.stringify(corrections));

    // Extract pattern from correction
    const pattern = extractPatternFromCorrection(
      correction.originalText,
      correction.originalType,
      correction.correctedType,
      parseId
    );

    if (pattern) {
      await this.savePattern(pattern);
      this.logger.info(`Extracted pattern: ${pattern.name} (${pattern.patternId})`);
    }

    // Update metrics
    await this.incrementMetric('totalCorrections');

    return pattern;
  }

  /** Record general feedback on a parse result */
  async recordFeedback(parseId: string, feedback: UserFeedback): Promise<void> {
    this.logger.info(`Recording feedback for parse ${parseId}: ${feedback.feedback}`);

    const allFeedback = await this.getFeedback();
    allFeedback.push({ parseId, ...feedback });
    await this.storage.set(STORAGE_KEYS.feedback, JSON.stringify(allFeedback));

    await this.incrementMetric('totalFeedback');

    // If feedback is "correct", boost confidence of patterns used in this parse
    if (feedback.feedback === 'correct') {
      await this.boostPatternsForParse(parseId);
    }
  }

  /** Get all learned patterns */
  async getPatterns(): Promise<Pattern[]> {
    const raw = await this.storage.get(STORAGE_KEYS.patterns);
    if (!raw) return [];
    try {
      const patterns = JSON.parse(raw) as Pattern[];
      return patterns.map((p) => ({
        ...p,
        createdDate: new Date(p.createdDate),
        lastValidated: new Date(p.lastValidated),
      }));
    } catch {
      this.logger.error('Failed to parse stored patterns');
      return [];
    }
  }

  /** Save a new pattern or update existing */
  async savePattern(pattern: Pattern): Promise<void> {
    const patterns = await this.getPatterns();
    const existing = patterns.findIndex((p) => p.patternId === pattern.patternId);

    if (existing >= 0) {
      patterns[existing] = pattern;
    } else {
      // Check for duplicate rules
      const duplicate = patterns.find(
        (p) => p.category === pattern.category && p.regex === pattern.regex && p.regex !== undefined
      );
      if (duplicate) {
        // Merge: increment counts
        duplicate.appliedCount += pattern.appliedCount;
        duplicate.successCount += pattern.successCount;
        duplicate.successRate = duplicate.successCount / duplicate.appliedCount;
        duplicate.learnedFrom.push(...pattern.learnedFrom);
        duplicate.lastValidated = new Date();
      } else {
        patterns.push(pattern);
      }
    }

    await this.storage.set(STORAGE_KEYS.patterns, JSON.stringify(patterns));
  }

  /** Export all patterns as a portable set */
  async exportPatterns(): Promise<{
    version: string;
    exportedAt: Date;
    patterns: Pattern[];
    metadata: {
      totalPatterns: number;
      activePatterns: number;
      averageConfidence: number;
      sourceBreakdown: Record<string, number>;
    };
  }> {
    const patterns = await this.getPatterns();
    const active = patterns.filter((p) => p.active);

    const sourceBreakdown: Record<string, number> = {};
    for (const p of patterns) {
      sourceBreakdown[p.source] = (sourceBreakdown[p.source] ?? 0) + 1;
    }

    return {
      version: '1.0.0',
      exportedAt: new Date(),
      patterns,
      metadata: {
        totalPatterns: patterns.length,
        activePatterns: active.length,
        averageConfidence:
          patterns.length > 0
            ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
            : 0,
        sourceBreakdown,
      },
    };
  }

  /** Import patterns from an exported set */
  async importPatterns(patternSet: { patterns: Pattern[] }): Promise<{ imported: number; skipped: number }> {
    const existing = await this.getPatterns();
    const existingIds = new Set(existing.map((p) => p.patternId));

    let imported = 0;
    let skipped = 0;

    for (const pattern of patternSet.patterns) {
      if (existingIds.has(pattern.patternId)) {
        skipped++;
        continue;
      }
      pattern.source = 'imported';
      pattern.active = true;
      existing.push(pattern);
      imported++;
    }

    await this.storage.set(STORAGE_KEYS.patterns, JSON.stringify(existing));
    this.logger.info(`Imported ${imported} patterns, skipped ${skipped} duplicates`);

    return { imported, skipped };
  }

  /** Clear all learned patterns */
  async clearPatterns(): Promise<void> {
    await this.storage.set(STORAGE_KEYS.patterns, JSON.stringify([]));
    this.logger.info('Cleared all patterns');
  }

  /** Record that a pattern was applied (success or failure) */
  async recordPatternApplication(
    patternId: string,
    success: boolean
  ): Promise<void> {
    const patterns = await this.getPatterns();
    const pattern = patterns.find((p) => p.patternId === patternId);

    if (!pattern) return;

    pattern.appliedCount++;
    if (success) {
      pattern.successCount++;
    } else {
      pattern.failureCount++;
    }
    pattern.successRate = pattern.successCount / pattern.appliedCount;
    pattern.lastValidated = new Date();

    // Auto-disable patterns with too many failures
    if (pattern.failureCount > (pattern.appliedCount * 0.15) && pattern.appliedCount >= 5) {
      pattern.active = false;
      this.logger.warn(`Disabled pattern ${patternId} due to high failure rate (${(pattern.successRate * 100).toFixed(0)}%)`);
    }

    await this.storage.set(STORAGE_KEYS.patterns, JSON.stringify(patterns));
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async getCorrections(): Promise<Array<Record<string, unknown>>> {
    const raw = await this.storage.get(STORAGE_KEYS.corrections);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async getFeedback(): Promise<Array<Record<string, unknown>>> {
    const raw = await this.storage.get(STORAGE_KEYS.feedback);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async boostPatternsForParse(parseId: string): Promise<void> {
    const patterns = await this.getPatterns();
    let updated = false;

    for (const pattern of patterns) {
      if (pattern.learnedFrom.includes(parseId)) {
        pattern.confidence = Math.min(pattern.confidence + 0.02, 0.98);
        pattern.lastValidated = new Date();
        updated = true;
      }
    }

    if (updated) {
      await this.storage.set(STORAGE_KEYS.patterns, JSON.stringify(patterns));
    }
  }

  private async incrementMetric(key: string): Promise<void> {
    const raw = await this.storage.get(STORAGE_KEYS.metrics);
    const metrics: Record<string, number> = raw ? JSON.parse(raw) : {};
    metrics[key] = (metrics[key] ?? 0) + 1;
    await this.storage.set(STORAGE_KEYS.metrics, JSON.stringify(metrics));
  }
}
