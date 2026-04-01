import type { ParserMetrics, AccuracyBreakdown, StorageAdapter, ScriptFormat, ElementType, ParseMode } from '../core/types';

const METRICS_KEY = 'parse_metrics';
const PARSE_HISTORY_KEY = 'parse_history';

/**
 * Tracks parser performance metrics over time.
 */
export class MetricsTracker {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /** Record a completed parse for metrics */
  async recordParse(data: {
    confidence: number;
    duration: number;
    format: ScriptFormat;
    mode: ParseMode;
    elementCounts: Record<string, number>;
  }): Promise<void> {
    const metrics = await this.getMetrics();

    metrics.totalParses++;
    metrics.averageConfidence =
      (metrics.averageConfidence * (metrics.totalParses - 1) + data.confidence) / metrics.totalParses;
    metrics.averageParseTime =
      (metrics.averageParseTime * (metrics.totalParses - 1) + data.duration) / metrics.totalParses;

    // Track by mode
    metrics.parsesByMode[data.mode] = (metrics.parsesByMode[data.mode] ?? 0) + 1;

    await this.saveMetrics(metrics);

    // Save parse to history for accuracy tracking
    const history = await this.getParseHistory();
    history.push({
      timestamp: new Date().toISOString(),
      confidence: data.confidence,
      duration: data.duration,
      format: data.format,
      mode: data.mode,
    });

    // Keep only last 500 entries
    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }

    await this.storage.set(PARSE_HISTORY_KEY, JSON.stringify(history));
  }

  /** Get current metrics */
  async getMetrics(): Promise<ParserMetrics> {
    const raw = await this.storage.get(METRICS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // Fall through to default
      }
    }

    return {
      totalParses: 0,
      averageConfidence: 0,
      averageParseTime: 0,
      totalCorrections: 0,
      totalFeedback: 0,
      activePatterns: 0,
      accuracyByFormat: {} as Record<ScriptFormat, number>,
      accuracyByElement: {} as Record<ElementType, number>,
      parsesByMode: {} as Record<ParseMode, number>,
    };
  }

  /** Get accuracy breakdown */
  async getAccuracyBreakdown(): Promise<AccuracyBreakdown> {
    const history = await this.getParseHistory();

    const byFormat: Record<string, { total: number; sum: number }> = {};
    const byMode: Record<string, { total: number; sum: number }> = {};

    for (const entry of history) {
      // By format
      if (!byFormat[entry.format]) byFormat[entry.format] = { total: 0, sum: 0 };
      byFormat[entry.format].total++;
      byFormat[entry.format].sum += entry.confidence;

      // By mode
      if (!byMode[entry.mode]) byMode[entry.mode] = { total: 0, sum: 0 };
      byMode[entry.mode].total++;
      byMode[entry.mode].sum += entry.confidence;
    }

    const formatResult: Record<string, { accuracy: number; count: number }> = {};
    for (const [k, v] of Object.entries(byFormat)) {
      formatResult[k] = { accuracy: v.sum / v.total, count: v.total };
    }

    const modeResult: Record<string, { accuracy: number; count: number }> = {};
    for (const [k, v] of Object.entries(byMode)) {
      modeResult[k] = { accuracy: v.sum / v.total, count: v.total };
    }

    return {
      byFormat: formatResult,
      byElementType: {}, // Requires per-element tracking (future)
      byMode: modeResult,
    };
  }

  /** Reset metrics */
  async reset(): Promise<void> {
    await this.storage.delete(METRICS_KEY);
    await this.storage.delete(PARSE_HISTORY_KEY);
  }

  private async saveMetrics(metrics: ParserMetrics): Promise<void> {
    await this.storage.set(METRICS_KEY, JSON.stringify(metrics));
  }

  private async getParseHistory(): Promise<Array<{
    timestamp: string;
    confidence: number;
    duration: number;
    format: string;
    mode: string;
  }>> {
    const raw = await this.storage.get(PARSE_HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
