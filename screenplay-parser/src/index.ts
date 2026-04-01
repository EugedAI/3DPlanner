import type {
  ParseResult,
  ParserConfig,
  Correction,
  UserFeedback,
  Pattern,
  PatternSet,
  ParserMetrics,
  AccuracyBreakdown,
  TestScript,
  TestResult,
  TestResults,
  StorageAdapter,
} from './core/types';
import { DEFAULT_CONFIG } from './core/types';
import { CoreParser } from './core/parser';
import { FeedbackHandler } from './learning/feedback';
import { extractPatternsFromClaudeParse } from './learning/extraction';
import { validateParseResult } from './learning/validation';
import { OcrHandler } from './ocr/handlers';
import { TestRunner } from './testing/test-runner';
import { MetricsTracker } from './testing/metrics';
import { Logger } from './utils/logging';
import { detectFileType, bufferToString } from './utils/file-handlers';
import { normalizeText } from './utils/formatting';

// Re-export storage adapters
export {
  InMemoryAdapter,
  LocalStorageAdapter,
  IndexedDBAdapter,
  HttpAdapter,
  createStorageAdapter,
} from './learning/storage-adapter';

// Re-export types
export type {
  ParseResult,
  ParsedElement,
  ParserConfig,
  Correction,
  UserFeedback,
  Pattern,
  PatternSet,
  ParserMetrics,
  AccuracyBreakdown,
  TestScript,
  TestResult,
  TestResults,
  StorageAdapter,
  ValidationError,
  GoldenReference,
  ElementType,
  ScriptFormat,
  InputFileType,
  ParseMode,
  ParserPlugin,
  PluginConfig,
  ParsingInput,
  OcrResult,
  OcrPage,
} from './core/types';

export { DEFAULT_CONFIG } from './core/types';

// Re-export utilities
export { validateParseResult } from './learning/validation';
export { toJson, toCsv, toText } from './testing/reporters';

// ============================================================
// MAIN PUBLIC API
// ============================================================

export class ScreenplayParser {
  private config: ParserConfig;
  private logger: Logger;
  private coreParser: CoreParser;
  private feedback: FeedbackHandler;
  private ocrHandler: OcrHandler;
  private testRunner: TestRunner;
  private metrics: MetricsTracker;
  private initialized = false;

  constructor(config: Partial<ParserConfig> & { storage: StorageAdapter }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(this.config.logLevel, 'ScreenplayParser');
    this.coreParser = new CoreParser(this.config);
    this.feedback = new FeedbackHandler(this.config.storage, this.logger);
    this.ocrHandler = new OcrHandler(this.config, this.logger);
    this.testRunner = new TestRunner(this.logger);
    this.metrics = new MetricsTracker(this.config.storage);
  }

  // ============================================================
  // CORE PARSING
  // ============================================================

  /** Parse a file (File object in browser, or ArrayBuffer) */
  async parseFile(file: File | ArrayBuffer, fileName?: string): Promise<ParseResult> {
    await this.ensureInitialized();

    let buffer: ArrayBuffer;
    let name: string;

    if (file instanceof ArrayBuffer) {
      buffer = file;
      name = fileName ?? 'unknown';
    } else {
      buffer = await file.arrayBuffer();
      name = fileName ?? file.name;
    }

    const fileType = detectFileType(buffer, name);
    this.logger.info(`Parsing file: ${name} (type: ${fileType})`);

    let text: string;
    let ocrConfidence: number | undefined;

    switch (fileType) {
      case 'pdf': {
        const ocrResult = await this.ocrHandler.extractFromPdf(buffer);
        text = ocrResult.text;
        ocrConfidence = ocrResult.confidence;
        break;
      }
      case 'image': {
        const ocrResult = await this.ocrHandler.extractFromImage(buffer);
        text = ocrResult.text;
        ocrConfidence = ocrResult.confidence;
        break;
      }
      case 'text':
      case 'fountain':
      case 'fdx':
      default: {
        const parsed = await this.coreParser.parseBuffer(buffer, name);
        text = parsed.text;
        break;
      }
    }

    const result = await this.coreParser.parseText(text, name);
    if (ocrConfidence !== undefined) {
      result.ocrConfidence = ocrConfidence;
    }

    // Record metrics
    await this.metrics.recordParse({
      confidence: result.confidence,
      duration: result.duration,
      format: result.format,
      mode: result.mode,
      elementCounts: this.countElementTypes(result),
    });

    // Extract patterns from Claude parses
    if (result.mode === 'claude' && this.config.enableLearning) {
      const patterns = extractPatternsFromClaudeParse(result);
      for (const p of patterns) {
        await this.feedback.savePattern(p);
      }
    }

    return result;
  }

  /** Parse raw text (no file handling needed) */
  async parseText(text: string): Promise<ParseResult> {
    await this.ensureInitialized();

    const result = await this.coreParser.parseText(text);

    await this.metrics.recordParse({
      confidence: result.confidence,
      duration: result.duration,
      format: result.format,
      mode: result.mode,
      elementCounts: this.countElementTypes(result),
    });

    return result;
  }

  /** Parse a file from a URL */
  async parseFileUrl(url: string): Promise<ParseResult> {
    this.logger.info(`Fetching file from URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fileName = url.split('/').pop() ?? 'downloaded-file';

    return this.parseFile(buffer, fileName);
  }

  // ============================================================
  // FEEDBACK & LEARNING
  // ============================================================

  /** Record a correction to a parsed element */
  async recordCorrection(parseId: string, correction: Correction): Promise<void> {
    await this.feedback.recordCorrection(parseId, correction);
    await this.reloadPatterns();
  }

  /** Record general feedback on a parse */
  async recordFeedback(parseId: string, feedback: UserFeedback): Promise<void> {
    await this.feedback.recordFeedback(parseId, feedback);
  }

  // ============================================================
  // PATTERN MANAGEMENT
  // ============================================================

  /** Get all learned patterns */
  async getPatterns(): Promise<Pattern[]> {
    return this.feedback.getPatterns();
  }

  /** Export patterns for sharing/backup */
  async exportPatterns(): Promise<PatternSet> {
    return this.feedback.exportPatterns();
  }

  /** Import patterns from an exported set */
  async importPatterns(patterns: PatternSet): Promise<void> {
    await this.feedback.importPatterns(patterns);
    await this.reloadPatterns();
  }

  /** Clear all learned patterns */
  async clearPatterns(): Promise<void> {
    await this.feedback.clearPatterns();
    this.coreParser.setLearnedPatterns([]);
  }

  // ============================================================
  // TESTING
  // ============================================================

  /** Run the full test suite */
  async runTestSuite(testScripts: TestScript[]): Promise<TestResults> {
    return this.testRunner.runSuite(testScripts, (buffer, fileName) =>
      this.parseFile(buffer, fileName)
    );
  }

  /** Run a single test */
  async runSingleTest(testScript: TestScript): Promise<TestResult> {
    return this.testRunner.runSingle(testScript, (buffer, fileName) =>
      this.parseFile(buffer, fileName)
    );
  }

  // ============================================================
  // METRICS
  // ============================================================

  /** Get parser metrics */
  async getMetrics(): Promise<ParserMetrics> {
    return this.metrics.getMetrics();
  }

  /** Get accuracy breakdown by format/mode */
  async getAccuracyByFormat(): Promise<AccuracyBreakdown> {
    return this.metrics.getAccuracyBreakdown();
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  /** Update parser configuration */
  updateConfig(config: Partial<ParserConfig>): void {
    this.config = { ...this.config, ...config };
    this.coreParser.updateConfig(this.config);
    this.logger.setLevel(this.config.logLevel);
  }

  /** Get current configuration */
  getConfig(): ParserConfig {
    return { ...this.config };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /** Initialize by loading learned patterns from storage */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (this.config.enableLearning) {
      await this.reloadPatterns();
    }

    this.initialized = true;
    this.logger.info('ScreenplayParser initialized');
  }

  /** Reload learned patterns from storage into the core parser */
  private async reloadPatterns(): Promise<void> {
    const patterns = await this.feedback.getPatterns();
    this.coreParser.setLearnedPatterns(patterns);
    this.logger.debug(`Loaded ${patterns.length} learned patterns`);
  }

  /** Count element types in a parse result */
  private countElementTypes(result: ParseResult): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const el of result.elements) {
      counts[el.type] = (counts[el.type] ?? 0) + 1;
    }
    return counts;
  }
}

// ============================================================
// CONVENIENCE EXPORTS
// ============================================================

/** Quick parse text without constructing a full parser instance */
export async function parseScreenplayText(text: string): Promise<ParseResult> {
  const { InMemoryAdapter } = await import('./learning/storage-adapter');
  const parser = new ScreenplayParser({
    storage: new InMemoryAdapter(),
    enableLearning: false,
  });
  return parser.parseText(text);
}
