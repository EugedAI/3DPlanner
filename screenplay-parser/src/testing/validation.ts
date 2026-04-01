import type { TestScript, GoldenReference, ElementType } from '../core/types';

/**
 * Validates test scripts and golden references before running tests.
 */

/** Validate a test script is well-formed */
export function validateTestScript(test: TestScript): string[] {
  const errors: string[] = [];

  if (!test.id || test.id.trim().length === 0) {
    errors.push('Test script must have an "id"');
  }

  if (!test.filename || test.filename.trim().length === 0) {
    errors.push('Test script must have a "filename"');
  }

  if (!test.fileBuffer || test.fileBuffer.byteLength === 0) {
    errors.push('Test script must have a non-empty "fileBuffer"');
  }

  if (!test.goldenReference) {
    errors.push('Test script must have a "goldenReference"');
  } else {
    errors.push(...validateGoldenReference(test.goldenReference));
  }

  const validFormats = ['standard', 'ocr', 'edge-case', 'dual-dialogue', 'other'];
  if (!validFormats.includes(test.format)) {
    errors.push(`Invalid format "${test.format}". Must be one of: ${validFormats.join(', ')}`);
  }

  return errors;
}

/** Validate a golden reference is well-formed */
export function validateGoldenReference(golden: GoldenReference): string[] {
  const errors: string[] = [];

  if (!golden.elements || !Array.isArray(golden.elements)) {
    errors.push('Golden reference must have an "elements" array');
    return errors;
  }

  if (golden.elements.length === 0) {
    errors.push('Golden reference must have at least one element');
  }

  const validTypes: ElementType[] = [
    'sceneHeading', 'action', 'character', 'dialogue', 'parenthetical',
    'transition', 'titlePage', 'pageBreak', 'dualDialogue', 'note',
    'section', 'synopsis', 'lyric', 'unknown',
  ];

  for (let i = 0; i < golden.elements.length; i++) {
    const el = golden.elements[i];

    if (!el.type) {
      errors.push(`Element ${i}: missing "type"`);
    } else if (!validTypes.includes(el.type)) {
      errors.push(`Element ${i}: invalid type "${el.type}"`);
    }

    if (el.text === undefined || el.text === null) {
      errors.push(`Element ${i}: missing "text"`);
    }
  }

  return errors;
}

/** Validate a batch of test scripts */
export function validateTestSuite(tests: TestScript[]): {
  valid: TestScript[];
  invalid: Array<{ test: TestScript; errors: string[] }>;
} {
  const valid: TestScript[] = [];
  const invalid: Array<{ test: TestScript; errors: string[] }> = [];

  for (const test of tests) {
    const errors = validateTestScript(test);
    if (errors.length === 0) {
      valid.push(test);
    } else {
      invalid.push({ test, errors });
    }
  }

  return { valid, invalid };
}
