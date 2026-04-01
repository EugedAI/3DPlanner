import type { ParseResult, ParsedElement, ValidationError, GoldenReference, ElementType } from '../core/types';

/**
 * Validates parse results against expected output and checks for common issues.
 */

/** Validate a parse result for internal consistency */
export function validateParseResult(result: ParseResult): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for orphaned dialogue (dialogue without preceding character)
  for (let i = 0; i < result.elements.length; i++) {
    const el = result.elements[i];

    if (el.type === 'dialogue' && i > 0) {
      const prev = result.elements[i - 1];
      if (prev.type !== 'character' && prev.type !== 'parenthetical' && prev.type !== 'dialogue') {
        errors.push({
          elementIndex: i,
          type: 'misclassification',
          message: `Dialogue at index ${i} has no preceding character (preceded by "${prev.type}")`,
          severity: 'warning',
          suggestion: `Check if element at index ${i - 1} should be classified as "character"`,
        });
      }
    }

    // Orphaned parenthetical
    if (el.type === 'parenthetical' && i > 0) {
      const prev = result.elements[i - 1];
      if (prev.type !== 'character' && prev.type !== 'dialogue') {
        errors.push({
          elementIndex: i,
          type: 'misclassification',
          message: `Parenthetical at index ${i} has no preceding character or dialogue`,
          severity: 'warning',
          suggestion: `Check context around element ${i}`,
        });
      }
    }

    // Low confidence elements
    if (el.confidence < 0.50) {
      errors.push({
        elementIndex: i,
        type: 'confidence_low',
        message: `Very low confidence (${(el.confidence * 100).toFixed(0)}%) for "${el.type}" at index ${i}`,
        severity: 'warning',
        suggestion: 'Review this element manually',
      });
    }
  }

  // Check for suspiciously long action blocks
  let actionRun = 0;
  for (const el of result.elements) {
    if (el.type === 'action') {
      actionRun++;
    } else {
      if (actionRun > 20) {
        errors.push({
          elementIndex: el.index,
          type: 'misclassification',
          message: `${actionRun} consecutive action elements may indicate a parsing issue`,
          severity: 'info',
          suggestion: 'Some action elements may be misclassified dialogue or character names',
        });
      }
      actionRun = 0;
    }
  }

  return errors;
}

/** Compare parse result against a golden reference */
export function compareWithGolden(
  result: ParseResult,
  golden: GoldenReference
): {
  accuracy: number;
  precision: number;
  recall: number;
  errors: ValidationError[];
  typeAccuracy: Record<string, { correct: number; total: number; accuracy: number }>;
} {
  const errors: ValidationError[] = [];
  const typeStats: Record<string, { correct: number; total: number }> = {};

  const maxLen = Math.max(result.elements.length, golden.elements.length);
  let correctCount = 0;

  // Element-by-element comparison
  for (let i = 0; i < maxLen; i++) {
    const parsed = result.elements[i];
    const expected = golden.elements[i];

    if (!expected && parsed) {
      errors.push({
        elementIndex: i,
        type: 'extra_element',
        message: `Extra element at index ${i}: "${parsed.type}" - "${parsed.text.substring(0, 50)}"`,
        severity: 'error',
      });
      continue;
    }

    if (!parsed && expected) {
      errors.push({
        elementIndex: i,
        type: 'missing_element',
        message: `Missing element at index ${i}: expected "${expected.type}" - "${expected.text.substring(0, 50)}"`,
        severity: 'error',
      });
      // Track in type stats
      if (!typeStats[expected.type]) typeStats[expected.type] = { correct: 0, total: 0 };
      typeStats[expected.type].total++;
      continue;
    }

    if (parsed && expected) {
      // Track type stats
      if (!typeStats[expected.type]) typeStats[expected.type] = { correct: 0, total: 0 };
      typeStats[expected.type].total++;

      const typeMatch = parsed.type === expected.type;
      const textMatch = normalizeForComparison(parsed.text) === normalizeForComparison(expected.text);

      if (typeMatch) {
        typeStats[expected.type].correct++;
        correctCount++;
      } else {
        errors.push({
          elementIndex: i,
          type: 'misclassification',
          message: `Type mismatch at index ${i}: got "${parsed.type}", expected "${expected.type}" for "${expected.text.substring(0, 50)}"`,
          severity: 'error',
        });
      }

      if (!textMatch && typeMatch) {
        errors.push({
          elementIndex: i,
          type: 'text_mismatch',
          message: `Text mismatch at index ${i}: got "${parsed.text.substring(0, 40)}", expected "${expected.text.substring(0, 40)}"`,
          severity: 'warning',
        });
      }
    }
  }

  // Calculate metrics
  const accuracy = maxLen > 0 ? correctCount / maxLen : 0;

  // Precision: of elements we classified, how many were correct
  const precision = result.elements.length > 0 ? correctCount / result.elements.length : 0;

  // Recall: of expected elements, how many did we find correctly
  const recall = golden.elements.length > 0 ? correctCount / golden.elements.length : 0;

  // Per-type accuracy
  const typeAccuracy: Record<string, { correct: number; total: number; accuracy: number }> = {};
  for (const [type, stats] of Object.entries(typeStats)) {
    typeAccuracy[type] = {
      ...stats,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
    };
  }

  return { accuracy, precision, recall, errors, typeAccuracy };
}

/** Normalize text for comparison (ignore whitespace, case) */
function normalizeForComparison(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
