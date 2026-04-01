import type { ParsedElement, ParseResult, ElementType } from './types';

// ============================================================
// CONFIDENCE SCORING ENGINE
// ============================================================

/** Confidence thresholds */
export const CONFIDENCE_THRESHOLDS = {
  /** Elements below this are flagged for review */
  flagThreshold: 0.70,
  /** Elements below this are marked as uncertain */
  uncertainThreshold: 0.50,
  /** Minimum overall confidence for a "good" parse */
  goodParseThreshold: 0.80,
};

/** Compute overall confidence for a parse result */
export function computeOverallConfidence(elements: ParsedElement[]): number {
  if (elements.length === 0) return 0;

  const validElements = elements.filter((e) => e.type !== 'unknown');
  if (validElements.length === 0) return 0;

  // Weighted average: longer elements matter more
  let totalWeight = 0;
  let weightedSum = 0;

  for (const el of validElements) {
    const weight = Math.max(1, el.text.length);
    weightedSum += el.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Flag elements that need review based on confidence */
export function flagLowConfidenceElements(elements: ParsedElement[]): ParsedElement[] {
  return elements.map((el) => {
    if (el.confidence < CONFIDENCE_THRESHOLDS.flagThreshold && el.type !== 'unknown') {
      return {
        ...el,
        flagged: true,
        flagReason: `Low confidence (${(el.confidence * 100).toFixed(0)}%) for type "${el.type}"`,
      };
    }
    return el;
  });
}

/** Apply contextual confidence adjustments based on element sequence */
export function adjustContextualConfidence(elements: ParsedElement[]): ParsedElement[] {
  return elements.map((el, i) => {
    let adjustment = 0;

    // Character followed by dialogue = good sign
    if (el.type === 'character' && i < elements.length - 1) {
      const next = elements[i + 1];
      if (next.type === 'dialogue' || next.type === 'parenthetical') {
        adjustment += 0.05;
      }
    }

    // Dialogue preceded by character = good sign
    if (el.type === 'dialogue' && i > 0) {
      const prev = elements[i - 1];
      if (prev.type === 'character' || prev.type === 'parenthetical') {
        adjustment += 0.05;
      }
    }

    // Parenthetical between character and dialogue = good sign
    if (el.type === 'parenthetical' && i > 0 && i < elements.length - 1) {
      const prev = elements[i - 1];
      const next = elements[i + 1];
      if (prev.type === 'character' && next.type === 'dialogue') {
        adjustment += 0.05;
      }
    }

    // Scene heading at start of block (after blank) = good sign
    if (el.type === 'sceneHeading') {
      adjustment += 0.02;
    }

    // Penalize action sequences that are too long without breaks
    if (el.type === 'action') {
      let actionRun = 0;
      for (let j = i; j >= 0 && elements[j].type === 'action'; j--) {
        actionRun++;
      }
      if (actionRun > 10) {
        adjustment -= 0.05;
      }
    }

    const newConfidence = Math.max(0, Math.min(1, el.confidence + adjustment));
    return { ...el, confidence: newConfidence };
  });
}

/** Get confidence breakdown by element type */
export function getConfidenceByType(
  elements: ParsedElement[]
): Record<ElementType, { avg: number; min: number; max: number; count: number }> {
  const groups: Record<string, number[]> = {};

  for (const el of elements) {
    if (el.type === 'unknown') continue;
    if (!groups[el.type]) groups[el.type] = [];
    groups[el.type].push(el.confidence);
  }

  const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

  for (const [type, values] of Object.entries(groups)) {
    result[type] = {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  return result as Record<ElementType, { avg: number; min: number; max: number; count: number }>;
}

/** Calibrate confidence scores to align with actual accuracy */
export function calibrateConfidence(
  predicted: number,
  historicalAccuracy: number,
  sampleSize: number
): number {
  // If we don't have enough data, return predicted confidence
  if (sampleSize < 10) return predicted;

  // Blend predicted with historical, weighted by sample size
  const weight = Math.min(sampleSize / 100, 0.8);
  return predicted * (1 - weight) + historicalAccuracy * weight;
}
