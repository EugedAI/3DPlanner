/**
 * Text normalization and formatting utilities for screenplay parsing.
 */

/** Normalize line endings to \n */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Remove excessive blank lines (3+ consecutive → 2) */
export function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

/** Trim trailing whitespace from each line */
export function trimTrailingWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

/** Remove page numbers (common in PDFs) */
export function removePageNumbers(text: string): string {
  return text.replace(/^\s*\d+\.\s*$/gm, '');
}

/** Full text normalization pipeline */
export function normalizeText(text: string): string {
  let result = normalizeLineEndings(text);
  result = trimTrailingWhitespace(result);
  result = removePageNumbers(result);
  result = collapseBlankLines(result);
  return result.trim();
}

/** Check if a line is all uppercase */
export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/** Check if text looks like a scene heading */
export function looksLikeSceneHeading(text: string): boolean {
  const trimmed = text.trim();
  return /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/i.test(trimmed);
}

/** Check if text looks like a transition */
export function looksLikeTransition(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(FADE IN:|FADE OUT\.|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|WIPE TO:)\s*$/i.test(trimmed) ||
    /TO:$/i.test(trimmed)
  );
}

/** Check if text looks like a parenthetical */
export function looksLikeParenthetical(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')');
}

/** Extract character extension (V.O., O.S., CONT'D, etc.) */
export function extractCharacterExtension(text: string): { name: string; extension: string | undefined } {
  const match = text.match(/^(.+?)\s*\((V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT'D|CONTINUED)\)\s*$/i);
  if (match) {
    return { name: match[1].trim(), extension: match[2].toUpperCase() };
  }
  return { name: text.trim(), extension: undefined };
}

/** Split text into lines, preserving meaningful whitespace */
export function splitIntoLines(text: string): string[] {
  return text.split('\n');
}

/** Calculate indentation level (number of leading spaces) */
export function getIndentation(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/** Remove common screenplay headers/footers */
export function removeHeadersFooters(text: string): string {
  const lines = text.split('\n');
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      // Remove common headers like "CONTINUED:" or "(CONTINUED)"
      if (/^\(CONTINUED\)$/i.test(trimmed)) return false;
      if (/^CONTINUED:$/i.test(trimmed)) return false;
      // Remove "MORE" indicators
      if (/^\(MORE\)$/i.test(trimmed)) return false;
      return true;
    })
    .join('\n');
}

/** Generate a unique ID */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
