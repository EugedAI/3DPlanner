import { describe, it, expect } from 'vitest';
import { ScreenplayParser, InMemoryAdapter } from '../../src/index';

const FULL_SCREENPLAY = `Title: The Last Cup
Credit: Written by
Author: Jane Doe

FADE IN:

INT. COFFEE SHOP - MORNING

A quiet coffee shop. Morning light streams through large windows.
SARAH (30s, tired but determined) sits alone at a corner table.

SARAH
(to herself)
One more day.

The BARISTA (20s, cheerful) approaches.

BARISTA
Your usual?

SARAH
Make it a double today.

The Barista nods and walks away. Sarah pulls out a worn notebook
and begins writing.

EXT. CITY STREET - CONTINUOUS

Through the window, we see JOHN (40s) approach the coffee shop.
He hesitates at the door.

JOHN (V.O.)
I should have called first.

He pushes the door open.

INT. COFFEE SHOP - CONTINUOUS

John enters. Sarah looks up, surprised.

SARAH
John? What are you doing here?

JOHN
We need to talk.

(beat)

Sarah closes her notebook.

SARAH (CONT'D)
Sit down.

CUT TO:

EXT. PARK - LATER

Sarah and John walk through a park. Leaves crunch underfoot.

SARAH
So that's it then?

JOHN
That's it.

FADE OUT.
`;

describe('Full Flow Integration', () => {
  it('should parse a complete screenplay end-to-end', async () => {
    const parser = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: true,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    const result = await parser.parseText(FULL_SCREENPLAY);

    // Basic structure
    expect(result.id).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(10);
    expect(result.confidence).toBeGreaterThan(0.5);

    // Scene headings
    expect(result.scenes.length).toBeGreaterThanOrEqual(3);
    expect(result.scenes.some((s) => s.includes('COFFEE SHOP'))).toBe(true);
    expect(result.scenes.some((s) => s.includes('CITY STREET'))).toBe(true);
    expect(result.scenes.some((s) => s.includes('PARK'))).toBe(true);

    // Characters
    expect(result.characters).toContain('SARAH');
    expect(result.characters).toContain('JOHN');
    expect(result.characters).toContain('BARISTA');

    // Element types present
    const types = new Set(result.elements.map((e) => e.type));
    expect(types.has('sceneHeading')).toBe(true);
    expect(types.has('character')).toBe(true);
    expect(types.has('dialogue')).toBe(true);
    expect(types.has('action')).toBe(true);
  });

  it('should handle corrections and learn patterns', async () => {
    const parser = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: true,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    const result = await parser.parseText(FULL_SCREENPLAY);

    // Record a correction
    await parser.recordCorrection(result.id, {
      elementIndex: 0,
      originalType: 'action',
      correctedType: 'character',
      originalText: 'TEST NAME',
      userFeedback: 'correction',
      timestamp: new Date(),
      mode: 'heuristic',
      scriptFormat: result.format,
    });

    // Check patterns were saved
    const patterns = await parser.getPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it('should export and import patterns', async () => {
    const parser = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: true,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    const result = await parser.parseText(FULL_SCREENPLAY);

    await parser.recordCorrection(result.id, {
      elementIndex: 0,
      originalType: 'action',
      correctedType: 'character',
      originalText: 'CUSTOM CHAR',
      userFeedback: 'correction',
      timestamp: new Date(),
      mode: 'heuristic',
      scriptFormat: result.format,
    });

    const exported = await parser.exportPatterns();
    expect(exported.metadata.totalPatterns).toBeGreaterThanOrEqual(1);

    // Create new parser and import
    const parser2 = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: true,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    await parser2.importPatterns(exported);
    const patterns = await parser2.getPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide metrics', async () => {
    const parser = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: false,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    await parser.parseText(FULL_SCREENPLAY);
    await parser.parseText('INT. ROOM - DAY\n\nBOB\nHello.\n');

    const metrics = await parser.getMetrics();
    expect(metrics.totalParses).toBe(2);
    expect(metrics.averageConfidence).toBeGreaterThan(0);
  });

  it('should run test suite', async () => {
    const parser = new ScreenplayParser({
      storage: new InMemoryAdapter(),
      enableLearning: false,
      enableClaudeMode: false,
      logLevel: 'silent',
    });

    const encoder = new TextEncoder();
    const testScript = {
      id: 'test-001',
      filename: 'basic.txt',
      format: 'standard' as const,
      fileBuffer: encoder.encode(
        'INT. ROOM - DAY\n\nBOB\nHello there.\n\nALICE\nHi Bob.\n'
      ).buffer,
      goldenReference: {
        title: 'Untitled',
        elements: [
          { type: 'sceneHeading' as const, text: 'INT. ROOM - DAY' },
          { type: 'character' as const, text: 'BOB' },
          { type: 'dialogue' as const, text: 'Hello there.' },
          { type: 'character' as const, text: 'ALICE' },
          { type: 'dialogue' as const, text: 'Hi Bob.' },
        ],
      },
      notes: 'Basic test',
    };

    const results = await parser.runTestSuite([testScript]);
    expect(results.totalTests).toBe(1);
    expect(results.overallAccuracy).toBeGreaterThan(0);
    expect(results.report).toBeTruthy();
  });
});
