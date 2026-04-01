import type {
  ParseResult,
  ParsedElement,
  ParserConfig,
  Pattern,
  ElementType,
  ScriptFormat,
  ParseMode,
  InputFileType,
} from './types';
import { DEFAULT_CONFIG } from './types';
import {
  buildLineContext,
  classifyLine,
  applyLearnedPatterns,
  getBuiltInPatterns,
} from './patterns';
import {
  computeOverallConfidence,
  flagLowConfidenceElements,
  adjustContextualConfidence,
} from './confidence';
import {
  normalizeText,
  removeHeadersFooters,
  splitIntoLines,
  extractCharacterExtension,
  generateId,
} from '../utils/formatting';
import { detectFileType, bufferToString } from '../utils/file-handlers';
import { Logger } from '../utils/logging';

// ============================================================
// MAIN PARSER
// ============================================================

export class CoreParser {
  private config: ParserConfig;
  private logger: Logger;
  private learnedPatterns: Pattern[] = [];
  private builtInPatterns: Pattern[];

  constructor(config: Partial<ParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(this.config.logLevel, 'CoreParser');
    this.builtInPatterns = getBuiltInPatterns();
  }

  /** Set learned patterns (loaded from storage) */
  setLearnedPatterns(patterns: Pattern[]): void {
    this.learnedPatterns = patterns;
    this.logger.debug(`Loaded ${patterns.length} learned patterns`);
  }

  /** Parse raw text into screenplay elements */
  async parseText(text: string, fileName?: string): Promise<ParseResult> {
    const startTime = Date.now();
    const parseId = `parse-${generateId()}`;

    this.logger.info(`Starting parse ${parseId} (text mode)`);

    // Normalize
    let normalized = normalizeText(text);
    normalized = removeHeadersFooters(normalized);

    // Detect format
    const format = this.detectScriptFormat(normalized);
    this.logger.debug(`Detected format: ${format}`);

    // Attempt Claude mode first if enabled
    let elements: ParsedElement[];
    let mode: ParseMode = 'heuristic';

    if (this.config.enableClaudeMode && this.config.claudeKey) {
      try {
        elements = await this.parseWithClaude(normalized, parseId);
        mode = 'claude';
        this.logger.info('Claude parse succeeded');
      } catch (err) {
        this.logger.warn('Claude parse failed, falling back to heuristic', err);
        elements = this.parseWithHeuristics(normalized, parseId);
        mode = 'heuristic';
      }
    } else {
      elements = this.parseWithHeuristics(normalized, parseId);
    }

    // Post-processing
    elements = adjustContextualConfidence(elements);
    elements = flagLowConfidenceElements(elements);

    // Extract metadata
    const characters = this.extractCharacters(elements);
    const scenes = this.extractScenes(elements);
    const flaggedElements = elements.filter((e) => e.flagged);
    const confidence = computeOverallConfidence(elements);

    const duration = Date.now() - startTime;

    const result: ParseResult = {
      id: parseId,
      title: this.extractTitle(normalized, elements),
      elements,
      format,
      mode,
      confidence,
      pageCount: this.estimatePageCount(elements),
      characters,
      scenes,
      flaggedElements,
      duration,
      timestamp: new Date(),
      warnings: this.generateWarnings(elements, confidence),
      rawText: text,
    };

    this.logger.info(
      `Parse complete: ${elements.length} elements, confidence ${(confidence * 100).toFixed(1)}%, ${duration}ms`
    );

    return result;
  }

  /** Parse from a file buffer */
  async parseBuffer(
    buffer: ArrayBuffer,
    fileName?: string
  ): Promise<{ text: string; fileType: InputFileType; ocrConfidence?: number }> {
    const fileType = detectFileType(buffer, fileName);
    this.logger.info(`Detected file type: ${fileType} for ${fileName ?? 'unknown'}`);

    switch (fileType) {
      case 'text':
      case 'fountain':
        return { text: bufferToString(buffer), fileType };

      case 'fdx':
        return { text: this.parseFdxBuffer(buffer), fileType };

      case 'pdf':
      case 'image':
      case 'docx':
        // These require OCR handlers — return placeholder
        // Actual OCR is handled at the ScreenplayParser level
        throw new Error(
          `File type "${fileType}" requires OCR processing. Use ScreenplayParser.parseFile() instead.`
        );

      default:
        return { text: bufferToString(buffer), fileType: 'text' };
    }
  }

  // ============================================================
  // HEURISTIC PARSING
  // ============================================================

  /** Parse text using built-in heuristics + learned patterns */
  private parseWithHeuristics(text: string, parseId: string): ParsedElement[] {
    const lines = splitIntoLines(text);
    const elements: ParsedElement[] = [];
    let prevType: ElementType | undefined;
    let elementIndex = 0;
    let currentPage = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines (they're structural separators)
      if (trimmed.length === 0) continue;

      // Build context
      const ctx = buildLineContext(lines, i, prevType);

      // Try learned patterns first
      const allPatterns = [...this.builtInPatterns, ...this.learnedPatterns];
      const learnedResult = applyLearnedPatterns(ctx, allPatterns);

      let type: ElementType;
      let confidence: number;
      let extension: string | undefined;

      if (learnedResult && learnedResult.confidence > 0.80) {
        type = learnedResult.type;
        confidence = learnedResult.confidence;
      } else {
        const heuristic = classifyLine(ctx);
        type = heuristic.type;
        confidence = heuristic.confidence;
        extension = heuristic.extension;
      }

      // Skip unknown type (blank lines)
      if (type === 'unknown') continue;

      // Track page breaks
      if (type === 'pageBreak') {
        currentPage++;
        continue;
      }

      // Extract character extension if not already extracted
      if (type === 'character' && !extension) {
        const extracted = extractCharacterExtension(trimmed);
        extension = extracted.extension;
      }

      const element: ParsedElement = {
        index: elementIndex++,
        type,
        text: trimmed,
        confidence,
        page: currentPage,
        lineNumber: i + 1,
        flagged: false,
        extension,
      };

      elements.push(element);
      prevType = type;
    }

    return elements;
  }

  // ============================================================
  // CLAUDE-ASSISTED PARSING
  // ============================================================

  /** Parse text using Claude API */
  private async parseWithClaude(text: string, parseId: string): Promise<ParsedElement[]> {
    if (!this.config.claudeKey) {
      throw new Error('Claude API key not configured');
    }

    const prompt = this.buildClaudePrompt(text);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.claudeModel,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Empty response from Claude API');
    }

    return this.parseClaudeResponse(content, parseId);
  }

  /** Build the Claude prompt for screenplay parsing */
  private buildClaudePrompt(text: string): string {
    return `Parse this screenplay text into structured elements. For each line/block, identify its type.

Element types: sceneHeading, action, character, dialogue, parenthetical, transition, titlePage, note, section, synopsis, lyric

Return ONLY a JSON array of objects with "type" and "text" fields. Example:
[
  {"type": "sceneHeading", "text": "INT. COFFEE SHOP - MORNING"},
  {"type": "action", "text": "Sarah sits at a table, stirring her coffee."},
  {"type": "character", "text": "SARAH"},
  {"type": "dialogue", "text": "I can't do this anymore."}
]

Screenplay text to parse:
---
${text.substring(0, 15000)}
---

Return ONLY the JSON array, no markdown formatting, no explanation.`;
  }

  /** Parse Claude's JSON response into ParsedElements */
  private parseClaudeResponse(content: string, parseId: string): ParsedElement[] {
    // Try to extract JSON from the response
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: Array<{ type: string; text: string }>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('Failed to parse Claude response as JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Claude response is not an array');
    }

    return parsed.map((item, index) => ({
      index,
      type: (item.type as ElementType) || 'unknown',
      text: item.text || '',
      confidence: 0.92, // Claude parses are generally high confidence
      flagged: false,
      lineNumber: undefined,
    }));
  }

  // ============================================================
  // FORMAT DETECTION
  // ============================================================

  /** Detect which screenplay software produced this text */
  private detectScriptFormat(text: string): ScriptFormat {
    // Final Draft XML markers
    if (text.includes('<?xml') && text.includes('FinalDraft')) {
      return 'final_draft';
    }

    // Fountain markers
    if (text.includes('Title:') && text.includes('Credit:')) {
      return 'fountain';
    }

    // Celtx markers
    if (text.includes('celtx') || text.includes('Celtx')) {
      return 'celtx';
    }

    // Highland markers
    if (text.includes('Highland')) {
      return 'highland';
    }

    // Fade In markers
    if (text.includes('Fade In')) {
      return 'fade_in';
    }

    // Check for standard screenplay formatting (indentation-based)
    const lines = text.split('\n');
    let sceneHeadingCount = 0;
    let characterCount = 0;

    for (const line of lines.slice(0, 100)) {
      if (/^(INT\.|EXT\.)\s+/i.test(line.trim())) sceneHeadingCount++;
      if (/^[A-Z][A-Z\s.''-]+$/.test(line.trim()) && line.trim().length > 2) characterCount++;
    }

    if (sceneHeadingCount >= 2 && characterCount >= 3) {
      return 'pdf_standard';
    }

    return 'unknown';
  }

  // ============================================================
  // METADATA EXTRACTION
  // ============================================================

  /** Extract unique character names */
  private extractCharacters(elements: ParsedElement[]): string[] {
    const characters = new Set<string>();
    for (const el of elements) {
      if (el.type === 'character') {
        const { name } = extractCharacterExtension(el.text);
        characters.add(name.trim().toUpperCase());
      }
    }
    return Array.from(characters).sort();
  }

  /** Extract scene headings */
  private extractScenes(elements: ParsedElement[]): string[] {
    return elements.filter((e) => e.type === 'sceneHeading').map((e) => e.text);
  }

  /** Try to extract the script title */
  private extractTitle(text: string, elements: ParsedElement[]): string {
    // Check title page elements
    const titleEl = elements.find((e) => e.type === 'titlePage' && /^title:/i.test(e.text));
    if (titleEl) {
      return titleEl.text.replace(/^title:\s*/i, '').trim();
    }

    // Check first few lines for a centered title-like element
    const firstAction = elements.find((e) => e.type === 'action' || e.type === 'sceneHeading');
    if (firstAction && firstAction.index < 3) {
      // If the first element is short text, it might be a title
      if (firstAction.type === 'action' && firstAction.text.length < 60) {
        return firstAction.text;
      }
    }

    return 'Untitled';
  }

  /** Estimate page count from elements */
  private estimatePageCount(elements: ParsedElement[]): number {
    const lastPage = elements.reduce((max, el) => Math.max(max, el.page ?? 1), 1);
    return lastPage;
  }

  /** Generate warnings for parse issues */
  private generateWarnings(elements: ParsedElement[], confidence: number): string[] {
    const warnings: string[] = [];

    if (confidence < 0.70) {
      warnings.push(`Overall confidence is low (${(confidence * 100).toFixed(0)}%). Results may need manual review.`);
    }

    const flagged = elements.filter((e) => e.flagged);
    if (flagged.length > 0) {
      warnings.push(`${flagged.length} element(s) flagged for review due to low confidence.`);
    }

    if (elements.length === 0) {
      warnings.push('No screenplay elements detected. The input may not be a screenplay.');
    }

    const actionRatio = elements.filter((e) => e.type === 'action').length / Math.max(elements.length, 1);
    if (actionRatio > 0.8) {
      warnings.push('Very high ratio of action elements. Format detection may have failed.');
    }

    return warnings;
  }

  // ============================================================
  // FDX PARSING
  // ============================================================

  /** Parse Final Draft XML buffer */
  private parseFdxBuffer(buffer: ArrayBuffer): string {
    const text = bufferToString(buffer);

    // Simple XML extraction of paragraph text
    // Full FDX parsing would use a proper XML parser
    const paragraphs: string[] = [];
    const regex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>[\s\S]*?<Text[^>]*>([\s\S]*?)<\/Text>[\s\S]*?<\/Paragraph>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const type = match[1];
      const content = match[2].replace(/<[^>]+>/g, '').trim();
      if (content) {
        paragraphs.push(content);
      }
    }

    return paragraphs.join('\n\n');
  }

  /** Update parser config */
  updateConfig(config: Partial<ParserConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.setLevel(this.config.logLevel);
  }

  /** Get current config */
  getConfig(): ParserConfig {
    return { ...this.config };
  }
}
