import { describe, it, expect } from 'vitest';
import {
  buildLineContext,
  classifyLine,
  extractPatternFromCorrection,
  getBuiltInPatterns,
} from '../../src/core/patterns';

describe('Pattern Matching', () => {
  describe('classifyLine', () => {
    it('should classify scene headings', () => {
      const lines = ['', 'INT. COFFEE SHOP - MORNING', '', 'Sarah walks in.'];
      const ctx = buildLineContext(lines, 1);
      const result = classifyLine(ctx);

      expect(result.type).toBe('sceneHeading');
      expect(result.confidence).toBeGreaterThan(0.90);
    });

    it('should classify EXT. scene headings', () => {
      const lines = ['', 'EXT. PARKING LOT - NIGHT', ''];
      const ctx = buildLineContext(lines, 1);
      const result = classifyLine(ctx);

      expect(result.type).toBe('sceneHeading');
    });

    it('should classify transitions', () => {
      const lines = ['She walks away.', '', 'CUT TO:', ''];
      const ctx = buildLineContext(lines, 2);
      const result = classifyLine(ctx);

      expect(result.type).toBe('transition');
      expect(result.confidence).toBeGreaterThan(0.90);
    });

    it('should classify FADE IN:', () => {
      const lines = ['FADE IN:', '', 'INT. ROOM - DAY'];
      const ctx = buildLineContext(lines, 0);
      const result = classifyLine(ctx);

      expect(result.type).toBe('transition');
    });

    it('should classify character names', () => {
      const lines = ['', 'SARAH', 'I need to go.'];
      const ctx = buildLineContext(lines, 1);
      const result = classifyLine(ctx);

      expect(result.type).toBe('character');
      expect(result.confidence).toBeGreaterThan(0.80);
    });

    it('should classify dialogue after character', () => {
      const lines = ['', 'JOHN', 'Where are you going?'];
      const ctx = buildLineContext(lines, 2, 'character');
      const result = classifyLine(ctx);

      expect(result.type).toBe('dialogue');
    });

    it('should classify parentheticals', () => {
      const lines = ['SARAH', '(whispering)', 'Come here.'];
      const ctx = buildLineContext(lines, 1, 'character');
      const result = classifyLine(ctx);

      expect(result.type).toBe('parenthetical');
    });

    it('should classify action as default', () => {
      const lines = ['The room is dark and quiet.'];
      const ctx = buildLineContext(lines, 0);
      const result = classifyLine(ctx);

      expect(result.type).toBe('action');
    });

    it('should classify empty lines as unknown', () => {
      const lines = ['', ''];
      const ctx = buildLineContext(lines, 0);
      const result = classifyLine(ctx);

      expect(result.type).toBe('unknown');
    });

    it('should classify notes in double brackets', () => {
      const lines = ['[[This is a note]]'];
      const ctx = buildLineContext(lines, 0);
      const result = classifyLine(ctx);

      expect(result.type).toBe('note');
    });

    it('should classify lyrics starting with ~', () => {
      const lines = ['~Happy birthday to you'];
      const ctx = buildLineContext(lines, 0);
      const result = classifyLine(ctx);

      expect(result.type).toBe('lyric');
    });
  });

  describe('extractPatternFromCorrection', () => {
    it('should extract a character pattern', () => {
      const pattern = extractPatternFromCorrection(
        'JOHN',
        'action',
        'character',
        'parse-001'
      );

      expect(pattern).not.toBeNull();
      expect(pattern!.category).toBe('character');
      expect(pattern!.source).toBe('user_correction');
      expect(pattern!.confidence).toBe(0.70);
      expect(pattern!.active).toBe(true);
    });

    it('should extract a transition pattern', () => {
      const pattern = extractPatternFromCorrection(
        'SMASH CUT TO:',
        'action',
        'transition',
        'parse-002'
      );

      expect(pattern).not.toBeNull();
      expect(pattern!.category).toBe('transition');
    });
  });

  describe('getBuiltInPatterns', () => {
    it('should return an array of built-in patterns', () => {
      const patterns = getBuiltInPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every((p) => p.source === 'built_in')).toBe(true);
      expect(patterns.every((p) => p.active)).toBe(true);
    });
  });
});
