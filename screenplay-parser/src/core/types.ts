// ============================================================
// CORE TYPES - Screenplay Parser Library
// ============================================================

/** Screenplay element types */
export type ElementType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'titlePage'
  | 'pageBreak'
  | 'dualDialogue'
  | 'note'
  | 'section'
  | 'synopsis'
  | 'lyric'
  | 'unknown';

/** Known screenplay software formats */
export type ScriptFormat =
  | 'final_draft'
  | 'celtx'
  | 'highland'
  | 'fade_in'
  | 'fountain'
  | 'plain_text'
  | 'pdf_standard'
  | 'pdf_ocr'
  | 'unknown';

/** Supported input file types */
export type InputFileType = 'pdf' | 'text' | 'image' | 'docx' | 'fountain' | 'fdx';

/** Log levels */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/** Claude model identifiers */
export type ClaudeModel = 'claude-opus-4-6' | 'claude-sonnet-4-20250514' | 'claude-haiku-4-5';

/** Feedback type from user */
export type FeedbackType = 'correct' | 'partial' | 'incorrect';

/** Parse mode used */
export type ParseMode = 'claude' | 'heuristic' | 'hybrid';

// ============================================================
// PARSED OUTPUT
// ============================================================

/** A single parsed element from a screenplay */
export interface ParsedElement {
  /** Index in the parsed output */
  index: number;
  /** Element type */
  type: ElementType;
  /** Raw text content */
  text: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Page number (if available) */
  page?: number;
  /** Line number in source */
  lineNumber?: number;
  /** Whether this element was flagged for review */
  flagged: boolean;
  /** Reason for flagging */
  flagReason?: string;
  /** Dual dialogue partner index */
  dualDialoguePartner?: number;
  /** Character extensions (V.O., O.S., CONT'D) */
  extension?: string;
  /** Metadata from pattern matching */
  metadata?: Record<string, unknown>;
}

/** Complete result of parsing a screenplay */
export interface ParseResult {
  /** Unique parse identifier */
  id: string;
  /** Detected script title */
  title: string;
  /** All parsed elements in order */
  elements: ParsedElement[];
  /** Detected script format */
  format: ScriptFormat;
  /** Parse mode used */
  mode: ParseMode;
  /** Overall confidence 0-1 */
  confidence: number;
  /** Total pages detected */
  pageCount: number;
  /** Characters found */
  characters: string[];
  /** Scene headings found */
  scenes: string[];
  /** Elements flagged for review */
  flaggedElements: ParsedElement[];
  /** Parse duration in milliseconds */
  duration: number;
  /** Timestamp of parse */
  timestamp: Date;
  /** Warnings generated during parse */
  warnings: string[];
  /** Raw extracted text (before parsing) */
  rawText: string;
  /** OCR confidence (if OCR was used) */
  ocrConfidence?: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

/** Storage adapter interface - must be implemented by consumers */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

/** Main parser configuration */
export interface ParserConfig {
  /** Storage adapter for patterns and learning data */
  storage: StorageAdapter;

  /** Enable learning from corrections */
  enableLearning: boolean;
  /** Minimum confidence to apply a learned pattern */
  minPatternConfidence: number;
  /** Minimum successful applications before trusting a pattern */
  minPatternApplications: number;
  /** Maximum failures before disabling a pattern */
  maxPatternFails: number;

  /** Claude API key (optional) */
  claudeKey?: string;
  /** Claude model to use */
  claudeModel: ClaudeModel;
  /** Enable Claude-assisted parsing */
  enableClaudeMode: boolean;

  /** Tesseract OCR language */
  tesseractLanguage: string;
  /** Custom Tesseract worker path */
  tesseractWorkerPath?: string;
  /** Custom PDF.js worker path */
  pdfWorkerPath?: string;
  /** OCR confidence threshold */
  ocrConfidenceThreshold: number;

  /** Enable test mode */
  enableTestMode: boolean;
  /** Enable debug mode */
  debugMode: boolean;
  /** Log level */
  logLevel: LogLevel;

  /** Enable result caching */
  cacheEnabled: boolean;
  /** Maximum cache entries */
  maxCacheSize: number;
}

/** Default configuration values */
export const DEFAULT_CONFIG: ParserConfig = {
  storage: null as unknown as StorageAdapter,
  enableLearning: true,
  minPatternConfidence: 0.85,
  minPatternApplications: 5,
  maxPatternFails: 2,
  claudeModel: 'claude-sonnet-4-20250514',
  enableClaudeMode: false,
  tesseractLanguage: 'eng',
  ocrConfidenceThreshold: 0.7,
  enableTestMode: false,
  debugMode: false,
  logLevel: 'warn',
  cacheEnabled: true,
  maxCacheSize: 100,
};

// ============================================================
// LEARNING & FEEDBACK
// ============================================================

/** User correction to a parsed element */
export interface Correction {
  /** Index of the element that was corrected */
  elementIndex: number;
  /** Original element type assigned by parser */
  originalType: ElementType;
  /** User-corrected element type */
  correctedType: ElementType;
  /** Original text */
  originalText: string;
  /** User-corrected text (if changed) */
  correctedText?: string;
  /** Type of feedback */
  userFeedback: FeedbackType;
  /** Timestamp */
  timestamp: Date;
  /** Parse mode that produced the original */
  mode: ParseMode;
  /** Format of the script */
  scriptFormat: ScriptFormat;
}

/** General user feedback on a parse result */
export interface UserFeedback {
  /** Overall assessment */
  feedback: FeedbackType;
  /** Timestamp */
  timestamp: Date;
  /** Optional notes */
  notes?: string;
}

/** A learned pattern extracted from corrections */
export interface Pattern {
  /** Unique pattern ID */
  patternId: string;
  /** Human-readable name */
  name: string;
  /** Element type this pattern detects */
  category: ElementType;
  /** Description of the rule */
  rule: string;
  /** Regex pattern (if applicable) */
  regex?: string;
  /** Heuristic function name (if applicable) */
  heuristic?: string;
  /** Confidence score of this pattern */
  confidence: number;
  /** Where this pattern came from */
  source: 'user_correction' | 'claude_parse' | 'built_in' | 'imported';
  /** Number of times this pattern was applied */
  appliedCount: number;
  /** Number of successful applications */
  successCount: number;
  /** Number of failed applications */
  failureCount: number;
  /** Success rate (successCount / appliedCount) */
  successRate: number;
  /** Parse IDs where this pattern was learned from */
  learnedFrom: string[];
  /** Date pattern was created */
  createdDate: Date;
  /** Date pattern was last validated */
  lastValidated: Date;
  /** Whether this pattern is currently active */
  active: boolean;
}

/** Exportable set of patterns */
export interface PatternSet {
  /** Library version that created these patterns */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** All patterns */
  patterns: Pattern[];
  /** Metadata */
  metadata: {
    totalPatterns: number;
    activePatterns: number;
    averageConfidence: number;
    sourceBreakdown: Record<string, number>;
  };
}

// ============================================================
// VALIDATION
// ============================================================

/** Validation error for a parse result */
export interface ValidationError {
  /** Element index */
  elementIndex: number;
  /** Error type */
  type: 'misclassification' | 'missing_element' | 'extra_element' | 'text_mismatch' | 'confidence_low';
  /** Error message */
  message: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================
// TESTING
// ============================================================

/** A test script with expected output */
export interface TestScript {
  /** Unique test ID */
  id: string;
  /** Filename of the script */
  filename: string;
  /** Format category */
  format: 'standard' | 'ocr' | 'edge-case' | 'dual-dialogue' | 'other';
  /** File buffer to parse */
  fileBuffer: ArrayBuffer;
  /** Expected (golden reference) parse result */
  goldenReference: GoldenReference;
  /** Test notes */
  notes: string;
}

/** Golden reference for test comparison */
export interface GoldenReference {
  /** Expected title */
  title: string;
  /** Expected elements */
  elements: Array<{
    type: ElementType;
    text: string;
  }>;
}

/** Result from a single test */
export interface TestResult {
  /** Test ID */
  testId: string;
  /** Whether the test passed */
  passed: boolean;
  /** Overall accuracy 0-1 */
  accuracy: number;
  /** Precision 0-1 */
  precision: number;
  /** Recall 0-1 */
  recall: number;
  /** Issues found */
  issues: string[];
  /** Execution time in ms */
  executionTime: number;
}

/** Aggregate test results */
export interface TestResults {
  /** Total tests run */
  totalTests: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Overall accuracy */
  overallAccuracy: number;
  /** Accuracy by format */
  byFormat: Record<string, number>;
  /** Timestamp */
  timestamp: Date;
  /** Human-readable report */
  report: string;
}

// ============================================================
// METRICS
// ============================================================

/** Parser performance metrics */
export interface ParserMetrics {
  /** Total parses performed */
  totalParses: number;
  /** Average confidence */
  averageConfidence: number;
  /** Average parse time in ms */
  averageParseTime: number;
  /** Corrections received */
  totalCorrections: number;
  /** Feedback received */
  totalFeedback: number;
  /** Active learned patterns */
  activePatterns: number;
  /** Accuracy breakdown by format */
  accuracyByFormat: Record<ScriptFormat, number>;
  /** Accuracy breakdown by element type */
  accuracyByElement: Record<ElementType, number>;
  /** Parses by mode */
  parsesByMode: Record<ParseMode, number>;
}

/** Accuracy breakdown */
export interface AccuracyBreakdown {
  /** Accuracy by script format */
  byFormat: Record<string, { accuracy: number; count: number }>;
  /** Accuracy by element type */
  byElementType: Record<string, { accuracy: number; count: number }>;
  /** Accuracy by parse mode */
  byMode: Record<string, { accuracy: number; count: number }>;
}

// ============================================================
// PLUGIN INTERFACE
// ============================================================

/** Parser plugin interface for modular architecture */
export interface ParserPlugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Supported input formats */
  supportedFormats: InputFileType[];

  /** Core parsing method */
  parse(input: ParsingInput): Promise<ParseResult>;

  /** Extract patterns from text for a given element type */
  extractPatterns(text: string, elementType: ElementType): Promise<Pattern[]>;

  /** Validate a parse result */
  validateParse(result: ParseResult): Promise<ValidationError[]>;

  /** Get plugin configuration */
  getConfig(): PluginConfig;

  /** Update plugin configuration */
  updateConfig(config: Partial<PluginConfig>): void;
}

/** Input to a parser plugin */
export interface ParsingInput {
  /** Raw text content */
  text: string;
  /** File type */
  fileType: InputFileType;
  /** File name */
  fileName?: string;
  /** OCR confidence (if OCR was used) */
  ocrConfidence?: number;
  /** Existing patterns to apply */
  patterns?: Pattern[];
  /** Configuration */
  config: ParserConfig;
}

/** Plugin-specific configuration */
export interface PluginConfig {
  /** Plugin name */
  name: string;
  /** Element types this plugin can detect */
  elementTypes: ElementType[];
  /** Default confidence threshold */
  defaultConfidenceThreshold: number;
  /** Plugin-specific settings */
  settings: Record<string, unknown>;
}

// ============================================================
// OCR
// ============================================================

/** OCR extraction result */
export interface OcrResult {
  /** Extracted text */
  text: string;
  /** OCR confidence 0-1 */
  confidence: number;
  /** Pages extracted */
  pages: OcrPage[];
  /** OCR engine used */
  engine: 'pdfjs' | 'tesseract';
  /** Duration in ms */
  duration: number;
}

/** A single page from OCR */
export interface OcrPage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Page text */
  text: string;
  /** Page confidence */
  confidence: number;
  /** Page dimensions */
  width?: number;
  height?: number;
}
