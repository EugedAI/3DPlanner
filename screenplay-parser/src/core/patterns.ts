import type { ElementType, Pattern, ParsedElement } from './types';
import {
  isAllCaps,
  looksLikeSceneHeading,
  looksLikeTransition,
  looksLikeParenthetical,
  getIndentation,
  extractCharacterExtension,
} from '../utils/formatting';
import { generateId } from '../utils/formatting';

// ============================================================
// BUILT-IN HEURISTIC PATTERNS
// ============================================================

/** Standard screenplay indentation ranges (in spaces) */
const INDENT = {
  action: { min: 0, max: 5 },
  character: { min: 20, max: 45 },
  dialogue: { min: 10, max: 20 },
  parenthetical: { min: 15, max: 25 },
  transition: { min: 45, max: 70 },
  sceneHeading: { min: 0, max: 5 },
};

/** Scene heading prefixes */
const SCENE_HEADING_PREFIXES = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\s+/i;

/** Transition keywords */
const TRANSITION_PATTERNS = /^(FADE IN:|FADE OUT\.|FADE TO BLACK\.|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|WIPE TO:|TIME CUT:|INTERCUT:?)\s*$/i;

/** Character name pattern (all caps, possibly with extension) */
const CHARACTER_PATTERN = /^[A-Z][A-Z\s.''-]+(\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT'D|CONTINUED)\))?$/;

/** Page break indicators */
const PAGE_BREAK_PATTERN = /^[-=_]{3,}\s*$/;

/** Title page indicators */
const TITLE_PAGE_KEYS = /^(Title|Credit|Author|Source|Draft date|Contact|Copyright):/i;

// ============================================================
// PATTERN MATCHING ENGINE
// ============================================================

export interface LineContext {
  line: string;
  trimmed: string;
  indent: number;
  lineIndex: number;
  prevLine?: string;
  nextLine?: string;
  prevType?: ElementType;
  isEmpty: boolean;
  prevEmpty: boolean;
  nextEmpty: boolean;
}

/** Build context for a line given its surrounding lines */
export function buildLineContext(
  lines: string[],
  index: number,
  prevType?: ElementType
): LineContext {
  const line = lines[index];
  const trimmed = line.trim();
  return {
    line,
    trimmed,
    indent: getIndentation(line),
    lineIndex: index,
    prevLine: index > 0 ? lines[index - 1] : undefined,
    nextLine: index < lines.length - 1 ? lines[index + 1] : undefined,
    prevType,
    isEmpty: trimmed.length === 0,
    prevEmpty: index > 0 ? lines[index - 1].trim().length === 0 : true,
    nextEmpty: index < lines.length - 1 ? lines[index + 1].trim().length === 0 : true,
  };
}

/** Classify a line using built-in heuristics */
export function classifyLine(ctx: LineContext): { type: ElementType; confidence: number; extension?: string } {
  if (ctx.isEmpty) {
    return { type: 'unknown', confidence: 1.0 };
  }

  // Page break
  if (PAGE_BREAK_PATTERN.test(ctx.trimmed)) {
    return { type: 'pageBreak', confidence: 0.95 };
  }

  // Title page elements
  if (TITLE_PAGE_KEYS.test(ctx.trimmed)) {
    return { type: 'titlePage', confidence: 0.90 };
  }

  // Scene heading (strongest signal: prefix-based)
  if (SCENE_HEADING_PREFIXES.test(ctx.trimmed)) {
    const conf = isAllCaps(ctx.trimmed) ? 0.97 : 0.93;
    return { type: 'sceneHeading', confidence: conf };
  }

  // Forced scene heading (leading .)
  if (ctx.trimmed.startsWith('.') && ctx.trimmed.length > 1 && !ctx.trimmed.startsWith('..')) {
    return { type: 'sceneHeading', confidence: 0.85 };
  }

  // Transition
  if (TRANSITION_PATTERNS.test(ctx.trimmed)) {
    return { type: 'transition', confidence: 0.95 };
  }

  // Forced transition (trailing >)
  if (ctx.trimmed.endsWith('>') && isAllCaps(ctx.trimmed.replace(/>$/, ''))) {
    return { type: 'transition', confidence: 0.80 };
  }

  // Parenthetical (must come after character or dialogue)
  if (looksLikeParenthetical(ctx.trimmed) && (ctx.prevType === 'character' || ctx.prevType === 'dialogue')) {
    return { type: 'parenthetical', confidence: 0.95 };
  }

  // Character name detection
  if (isCharacterName(ctx)) {
    const { extension } = extractCharacterExtension(ctx.trimmed);
    return {
      type: 'character',
      confidence: computeCharacterConfidence(ctx),
      extension,
    };
  }

  // Dialogue (follows character or parenthetical)
  if (ctx.prevType === 'character' || ctx.prevType === 'parenthetical') {
    return { type: 'dialogue', confidence: 0.90 };
  }

  // Dialogue continuation (follows dialogue, same or less indent, not blank before)
  if (ctx.prevType === 'dialogue' && !ctx.prevEmpty) {
    return { type: 'dialogue', confidence: 0.80 };
  }

  // Lyric (line starts with ~)
  if (ctx.trimmed.startsWith('~')) {
    return { type: 'lyric', confidence: 0.90 };
  }

  // Note (double brackets)
  if (ctx.trimmed.startsWith('[[') && ctx.trimmed.endsWith(']]')) {
    return { type: 'note', confidence: 0.95 };
  }

  // Section heading (starts with #)
  if (ctx.trimmed.startsWith('#')) {
    return { type: 'section', confidence: 0.90 };
  }

  // Synopsis (starts with =)
  if (ctx.trimmed.startsWith('=') && !ctx.trimmed.startsWith('===')) {
    return { type: 'synopsis', confidence: 0.85 };
  }

  // Default: action
  return { type: 'action', confidence: 0.75 };
}

/** Determine if line looks like a character name */
function isCharacterName(ctx: LineContext): boolean {
  const { trimmed, prevEmpty, nextLine } = ctx;

  // Must be preceded by an empty line (or start of document)
  if (!prevEmpty && ctx.lineIndex > 0) return false;

  // Must have a next line (dialogue follows)
  if (!nextLine || nextLine.trim().length === 0) return false;

  // Character names are typically ALL CAPS
  if (!isAllCaps(trimmed)) {
    // Exception: forced character (starts with @)
    if (trimmed.startsWith('@')) return true;
    return false;
  }

  // Character name pattern match
  const nameOnly = trimmed.replace(/\s*\(.*\)\s*$/, ''); // Remove extension
  if (nameOnly.length < 2 || nameOnly.length > 50) return false;

  // Should not be a scene heading or transition
  if (looksLikeSceneHeading(trimmed)) return false;
  if (looksLikeTransition(trimmed)) return false;

  return CHARACTER_PATTERN.test(trimmed);
}

/** Compute confidence for a character name detection */
function computeCharacterConfidence(ctx: LineContext): number {
  let confidence = 0.85;

  // Bonus: has extension like (V.O.)
  if (/\(V\.O\.|O\.S\.|CONT'D\)/i.test(ctx.trimmed)) {
    confidence += 0.05;
  }

  // Bonus: indent is in character range
  if (ctx.indent >= INDENT.character.min && ctx.indent <= INDENT.character.max) {
    confidence += 0.05;
  }

  // Bonus: next line looks like dialogue (not all caps, indented)
  if (ctx.nextLine) {
    const nextTrimmed = ctx.nextLine.trim();
    if (nextTrimmed.length > 0 && !isAllCaps(nextTrimmed)) {
      confidence += 0.03;
    }
  }

  return Math.min(confidence, 0.98);
}

// ============================================================
// LEARNED PATTERN APPLICATION
// ============================================================

/** Apply learned patterns to classify a line */
export function applyLearnedPatterns(
  ctx: LineContext,
  patterns: Pattern[]
): { type: ElementType; confidence: number } | null {
  const activePatterns = patterns.filter((p) => p.active && p.successRate >= 0.85);

  for (const pattern of activePatterns) {
    if (pattern.regex) {
      const regex = new RegExp(pattern.regex, 'i');
      if (regex.test(ctx.trimmed)) {
        return {
          type: pattern.category,
          confidence: pattern.confidence * pattern.successRate,
        };
      }
    }
  }

  return null;
}

// ============================================================
// PATTERN EXTRACTION
// ============================================================

/** Extract a new pattern from a user correction */
export function extractPatternFromCorrection(
  originalText: string,
  originalType: ElementType,
  correctedType: ElementType,
  parseId: string
): Pattern | null {
  const trimmed = originalText.trim();

  // Try to find distinguishing features
  let rule = '';
  let regex: string | undefined;

  if (correctedType === 'character' && isAllCaps(trimmed)) {
    rule = 'ALL_CAPS text classified as character name';
    regex = `^${escapeRegex(trimmed)}$`;
  } else if (correctedType === 'sceneHeading') {
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      rule = `Text starting with "${words[0]}" classified as scene heading`;
      regex = `^${escapeRegex(words[0])}\\s+`;
    }
  } else if (correctedType === 'transition') {
    rule = `Text "${trimmed}" classified as transition`;
    regex = `^${escapeRegex(trimmed)}$`;
  } else if (correctedType === 'parenthetical' && looksLikeParenthetical(trimmed)) {
    rule = 'Text in parentheses classified as parenthetical';
    regex = `^\\(.*\\)$`;
  } else {
    rule = `Text "${trimmed.substring(0, 30)}..." misclassified as ${originalType}, should be ${correctedType}`;
  }

  return {
    patternId: `pat-${generateId()}`,
    name: `Correction: ${originalType} → ${correctedType}`,
    category: correctedType,
    rule,
    regex,
    confidence: 0.70, // Start low, builds with validation
    source: 'user_correction',
    appliedCount: 1,
    successCount: 1,
    failureCount: 0,
    successRate: 1.0,
    learnedFrom: [parseId],
    createdDate: new Date(),
    lastValidated: new Date(),
    active: true,
  };
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Get all built-in patterns */
export function getBuiltInPatterns(): Pattern[] {
  return [
    {
      patternId: 'builtin-scene-heading',
      name: 'Scene heading prefix (INT./EXT.)',
      category: 'sceneHeading',
      rule: 'Lines starting with INT., EXT., INT/EXT., I/E.',
      regex: '^(INT\\.|EXT\\.|INT\\/EXT\\.|I\\/E\\.)\\s+',
      confidence: 0.95,
      source: 'built_in',
      appliedCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1.0,
      learnedFrom: [],
      createdDate: new Date(),
      lastValidated: new Date(),
      active: true,
    },
    {
      patternId: 'builtin-transition',
      name: 'Standard transitions (CUT TO:, FADE IN:, etc.)',
      category: 'transition',
      rule: 'Lines matching standard transition keywords',
      regex: '^(FADE IN:|FADE OUT\\.|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:)\\s*$',
      confidence: 0.95,
      source: 'built_in',
      appliedCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1.0,
      learnedFrom: [],
      createdDate: new Date(),
      lastValidated: new Date(),
      active: true,
    },
    {
      patternId: 'builtin-parenthetical',
      name: 'Parenthetical (text in parens)',
      category: 'parenthetical',
      rule: 'Lines wrapped in parentheses after character/dialogue',
      regex: '^\\(.*\\)$',
      confidence: 0.90,
      source: 'built_in',
      appliedCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1.0,
      learnedFrom: [],
      createdDate: new Date(),
      lastValidated: new Date(),
      active: true,
    },
  ];
}
