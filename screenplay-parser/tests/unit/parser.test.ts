import { describe, it, expect } from 'vitest';
import { CoreParser } from '../../src/core/parser';
import { InMemoryAdapter } from '../../src/learning/storage-adapter';

const SAMPLE_SCREENPLAY = `
FADE IN:

INT. COFFEE SHOP - MORNING

Sarah sits at a small table by the window, stirring her coffee absently.

SARAH
I can't do this anymore.

JOHN (V.O.)
You don't have a choice.

(beat)

Sarah looks up. Her eyes are red.

SARAH (CONT'D)
Watch me.

She stands, knocking her cup over. Coffee spills across the table.

CUT TO:

EXT. CITY STREET - DAY

Sarah walks briskly through the crowd.
`;

describe('CoreParser', () => {
  const parser = new CoreParser({
    storage: new InMemoryAdapter(),
    enableLearning: false,
    enableClaudeMode: false,
    logLevel: 'silent',
  });

  describe('parseText', () => {
    it('should parse a screenplay into structured elements', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should detect scene headings', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);
      const sceneHeadings = result.elements.filter((e) => e.type === 'sceneHeading');

      expect(sceneHeadings.length).toBe(2);
      expect(sceneHeadings[0].text).toContain('INT. COFFEE SHOP');
      expect(sceneHeadings[1].text).toContain('EXT. CITY STREET');
    });

    it('should detect character names', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);
      const characters = result.elements.filter((e) => e.type === 'character');

      expect(characters.length).toBeGreaterThanOrEqual(2);
      expect(result.characters).toContain('SARAH');
      expect(result.characters).toContain('JOHN');
    });

    it('should detect dialogue', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);
      const dialogue = result.elements.filter((e) => e.type === 'dialogue');

      expect(dialogue.length).toBeGreaterThanOrEqual(2);
      expect(dialogue.some((d) => d.text.includes("can't do this anymore"))).toBe(true);
    });

    it('should detect transitions', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);
      const transitions = result.elements.filter((e) => e.type === 'transition');

      expect(transitions.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect action lines', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);
      const actions = result.elements.filter((e) => e.type === 'action');

      expect(actions.length).toBeGreaterThanOrEqual(1);
    });

    it('should populate scenes list', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);

      expect(result.scenes.length).toBe(2);
      expect(result.scenes[0]).toContain('INT. COFFEE SHOP');
    });

    it('should assign confidence scores to all elements', async () => {
      const result = await parser.parseText(SAMPLE_SCREENPLAY);

      for (const el of result.elements) {
        expect(el.confidence).toBeGreaterThan(0);
        expect(el.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle empty input', async () => {
      const result = await parser.parseText('');

      expect(result.elements.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle plain prose (non-screenplay)', async () => {
      const prose = 'This is just a regular paragraph of text that has no screenplay formatting whatsoever.';
      const result = await parser.parseText(prose);

      expect(result.elements.length).toBeGreaterThan(0);
      // Most things should be classified as action
      const actionCount = result.elements.filter((e) => e.type === 'action').length;
      expect(actionCount).toBeGreaterThan(0);
    });
  });

  describe('parseText - edge cases', () => {
    it('should handle character with V.O. extension', async () => {
      const text = `
INT. OFFICE - DAY

BOB (V.O.)
I never thought it would end this way.
`;
      const result = await parser.parseText(text);
      const chars = result.elements.filter((e) => e.type === 'character');

      expect(chars.length).toBeGreaterThanOrEqual(1);
      expect(result.characters).toContain('BOB');
    });

    it('should handle forced scene heading (.prefix)', async () => {
      const text = `
.SMITH RESIDENCE - BACK YARD

The dogs are playing.
`;
      const result = await parser.parseText(text);
      const headings = result.elements.filter((e) => e.type === 'sceneHeading');
      expect(headings.length).toBe(1);
    });

    it('should handle Fountain-style title page', async () => {
      const text = `Title: My Great Script
Credit: Written by
Author: Jane Doe

INT. ROOM - DAY

Stuff happens.
`;
      const result = await parser.parseText(text);
      const titleElements = result.elements.filter((e) => e.type === 'titlePage');
      expect(titleElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
