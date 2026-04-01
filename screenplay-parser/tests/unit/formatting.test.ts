import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  isAllCaps,
  looksLikeSceneHeading,
  looksLikeTransition,
  looksLikeParenthetical,
  extractCharacterExtension,
  getIndentation,
  generateId,
} from '../../src/utils/formatting';

describe('Formatting Utilities', () => {
  describe('normalizeText', () => {
    it('should normalize line endings', () => {
      expect(normalizeText('hello\r\nworld')).toBe('hello\nworld');
      expect(normalizeText('hello\rworld')).toBe('hello\nworld');
    });

    it('should collapse excessive blank lines', () => {
      const result = normalizeText('a\n\n\n\n\nb');
      expect(result).toBe('a\n\nb');
    });

    it('should trim trailing whitespace', () => {
      expect(normalizeText('hello   ')).toBe('hello');
    });
  });

  describe('isAllCaps', () => {
    it('should return true for all caps', () => {
      expect(isAllCaps('SARAH')).toBe(true);
      expect(isAllCaps('JOHN DOE')).toBe(true);
    });

    it('should return false for mixed case', () => {
      expect(isAllCaps('Sarah')).toBe(false);
      expect(isAllCaps('hello world')).toBe(false);
    });

    it('should return false for no letters', () => {
      expect(isAllCaps('123')).toBe(false);
      expect(isAllCaps('---')).toBe(false);
    });
  });

  describe('looksLikeSceneHeading', () => {
    it('should detect INT. headings', () => {
      expect(looksLikeSceneHeading('INT. COFFEE SHOP - DAY')).toBe(true);
    });

    it('should detect EXT. headings', () => {
      expect(looksLikeSceneHeading('EXT. PARK - NIGHT')).toBe(true);
    });

    it('should detect INT/EXT. headings', () => {
      expect(looksLikeSceneHeading('INT/EXT. CAR - MOVING')).toBe(true);
    });

    it('should not match regular text', () => {
      expect(looksLikeSceneHeading('Sarah walks in.')).toBe(false);
    });
  });

  describe('looksLikeTransition', () => {
    it('should detect CUT TO:', () => {
      expect(looksLikeTransition('CUT TO:')).toBe(true);
    });

    it('should detect FADE IN:', () => {
      expect(looksLikeTransition('FADE IN:')).toBe(true);
    });

    it('should not match regular text', () => {
      expect(looksLikeTransition('Sarah cuts the cake.')).toBe(false);
    });
  });

  describe('looksLikeParenthetical', () => {
    it('should detect parentheticals', () => {
      expect(looksLikeParenthetical('(whispering)')).toBe(true);
      expect(looksLikeParenthetical('(beat)')).toBe(true);
    });

    it('should not match non-parentheticals', () => {
      expect(looksLikeParenthetical('She whispers.')).toBe(false);
    });
  });

  describe('extractCharacterExtension', () => {
    it('should extract V.O.', () => {
      const result = extractCharacterExtension('JOHN (V.O.)');
      expect(result.name).toBe('JOHN');
      expect(result.extension).toBe('V.O.');
    });

    it('should extract O.S.', () => {
      const result = extractCharacterExtension('SARAH (O.S.)');
      expect(result.name).toBe('SARAH');
      expect(result.extension).toBe('O.S.');
    });

    it("should extract CONT'D", () => {
      const result = extractCharacterExtension("SARAH (CONT'D)");
      expect(result.name).toBe('SARAH');
      expect(result.extension).toBe("CONT'D");
    });

    it('should handle names without extensions', () => {
      const result = extractCharacterExtension('BOB');
      expect(result.name).toBe('BOB');
      expect(result.extension).toBeUndefined();
    });
  });

  describe('getIndentation', () => {
    it('should count leading spaces', () => {
      expect(getIndentation('    hello')).toBe(4);
      expect(getIndentation('hello')).toBe(0);
      expect(getIndentation('  hello')).toBe(2);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(5);
    });
  });
});
