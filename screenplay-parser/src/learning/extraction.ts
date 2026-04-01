import type { Pattern, ParseResult, ElementType, Correction } from '../core/types';
import { generateId } from '../utils/formatting';
import { Logger } from '../utils/logging';

/**
 * Advanced pattern extraction from corrections and successful parses.
 * Analyzes groups of corrections to identify broader patterns.
 */

/** Extract patterns from a batch of corrections */
export function extractPatternsFromBatch(
  corrections: Array<Correction & { parseId: string }>,
  logger?: Logger
): Pattern[] {
  const patterns: Pattern[] = [];
  const grouped = groupCorrectionsByType(corrections);

  for (const [key, group] of Object.entries(grouped)) {
    if (group.length < 2) continue; // Need multiple examples

    const pattern = analyzeGroup(key, group);
    if (pattern) {
      patterns.push(pattern);
      logger?.debug(`Extracted batch pattern: ${pattern.name}`);
    }
  }

  return patterns;
}

/** Group corrections by original→corrected type pair */
function groupCorrectionsByType(
  corrections: Array<Correction & { parseId: string }>
): Record<string, Array<Correction & { parseId: string }>> {
  const groups: Record<string, Array<Correction & { parseId: string }>> = {};

  for (const c of corrections) {
    const key = `${c.originalType}→${c.correctedType}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  return groups;
}

/** Analyze a group of same-type corrections to find a common pattern */
function analyzeGroup(
  key: string,
  group: Array<Correction & { parseId: string }>
): Pattern | null {
  const [originalType, correctedType] = key.split('→') as [ElementType, ElementType];
  const texts = group.map((c) => c.originalText.trim());

  // Try to find common features
  const features = analyzeTextFeatures(texts);

  if (!features.commonPattern) return null;

  return {
    patternId: `batch-${generateId()}`,
    name: `Batch: ${originalType} → ${correctedType} (${group.length} corrections)`,
    category: correctedType,
    rule: features.description,
    regex: features.commonPattern,
    confidence: Math.min(0.75 + group.length * 0.02, 0.95),
    source: 'user_correction',
    appliedCount: group.length,
    successCount: group.length,
    failureCount: 0,
    successRate: 1.0,
    learnedFrom: group.map((c) => c.parseId),
    createdDate: new Date(),
    lastValidated: new Date(),
    active: true,
  };
}

/** Analyze common features across multiple text samples */
function analyzeTextFeatures(texts: string[]): {
  commonPattern: string | null;
  description: string;
} {
  if (texts.length === 0) return { commonPattern: null, description: '' };

  // Check: all uppercase?
  const allUpperCase = texts.every((t) => t === t.toUpperCase() && /[A-Z]/.test(t));
  if (allUpperCase) {
    return {
      commonPattern: "^[A-Z][A-Z\\s.\\-']+$",
      description: 'All-caps text pattern',
    };
  }

  // Check: common prefix?
  const prefixes = texts.map((t) => t.split(/\s+/)[0]);
  const commonPrefix = findCommonString(prefixes);
  if (commonPrefix && commonPrefix.length >= 3) {
    return {
      commonPattern: `^${escapeRegex(commonPrefix)}`,
      description: `Text starting with "${commonPrefix}"`,
    };
  }

  // Check: common suffix?
  const suffixes = texts.map((t) => {
    const parts = t.split(/\s+/);
    return parts[parts.length - 1];
  });
  const commonSuffix = findCommonString(suffixes);
  if (commonSuffix && commonSuffix.length >= 3) {
    return {
      commonPattern: `${escapeRegex(commonSuffix)}$`,
      description: `Text ending with "${commonSuffix}"`,
    };
  }

  // Check: similar length range?
  const lengths = texts.map((t) => t.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const stdDev = Math.sqrt(lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length);
  if (stdDev < 5 && avgLen < 30) {
    return {
      commonPattern: null,
      description: `Short text (~${Math.round(avgLen)} chars)`,
    };
  }

  return { commonPattern: null, description: 'No common pattern found' };
}

/** Find common string among an array of strings */
function findCommonString(strings: string[]): string | null {
  if (strings.length === 0) return null;
  if (strings.length === 1) return strings[0];

  const unique = [...new Set(strings)];
  if (unique.length === 1) return unique[0];

  // Check if most strings are the same (>70%)
  const counts: Record<string, number> = {};
  for (const s of strings) {
    counts[s] = (counts[s] ?? 0) + 1;
  }

  const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (mostCommon[1] / strings.length >= 0.7) {
    return mostCommon[0];
  }

  return null;
}

/** Extract patterns from a successful Claude parse result */
export function extractPatternsFromClaudeParse(result: ParseResult): Pattern[] {
  const patterns: Pattern[] = [];

  // Extract character name patterns
  const characters = result.elements.filter((e) => e.type === 'character');
  for (const char of characters) {
    const name = char.text.trim();
    if (name.length >= 2 && name === name.toUpperCase()) {
      const existing = patterns.find((p) => p.regex === `^${escapeRegex(name)}(\\s*\\(.*\\))?$`);
      if (!existing) {
        patterns.push({
          patternId: `claude-${generateId()}`,
          name: `Character: ${name}`,
          category: 'character',
          rule: `"${name}" is a character name`,
          regex: `^${escapeRegex(name)}(\\s*\\(.*\\))?$`,
          confidence: 0.88,
          source: 'claude_parse',
          appliedCount: 1,
          successCount: 1,
          failureCount: 0,
          successRate: 1.0,
          learnedFrom: [result.id],
          createdDate: new Date(),
          lastValidated: new Date(),
          active: true,
        });
      }
    }
  }

  return patterns;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
