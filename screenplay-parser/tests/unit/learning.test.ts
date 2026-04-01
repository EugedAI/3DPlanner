import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackHandler } from '../../src/learning/feedback';
import { InMemoryAdapter } from '../../src/learning/storage-adapter';
import { Logger } from '../../src/utils/logging';

describe('Learning System', () => {
  let feedback: FeedbackHandler;

  beforeEach(() => {
    const storage = new InMemoryAdapter();
    const logger = new Logger('silent');
    feedback = new FeedbackHandler(storage, logger);
  });

  describe('FeedbackHandler', () => {
    it('should record a correction and extract a pattern', async () => {
      const pattern = await feedback.recordCorrection('parse-001', {
        elementIndex: 0,
        originalType: 'action',
        correctedType: 'character',
        originalText: 'JOHN',
        userFeedback: 'correction',
        timestamp: new Date(),
        mode: 'heuristic',
        scriptFormat: 'unknown',
      });

      expect(pattern).not.toBeNull();
      expect(pattern!.category).toBe('character');
    });

    it('should store and retrieve patterns', async () => {
      await feedback.recordCorrection('parse-001', {
        elementIndex: 0,
        originalType: 'action',
        correctedType: 'character',
        originalText: 'ALICE',
        userFeedback: 'correction',
        timestamp: new Date(),
        mode: 'heuristic',
        scriptFormat: 'unknown',
      });

      const patterns = await feedback.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should export and import patterns', async () => {
      await feedback.recordCorrection('parse-001', {
        elementIndex: 0,
        originalType: 'action',
        correctedType: 'character',
        originalText: 'BOB',
        userFeedback: 'correction',
        timestamp: new Date(),
        mode: 'heuristic',
        scriptFormat: 'unknown',
      });

      const exported = await feedback.exportPatterns();
      expect(exported.patterns.length).toBeGreaterThanOrEqual(1);
      expect(exported.version).toBe('1.0.0');

      // Clear and re-import
      await feedback.clearPatterns();
      let patterns = await feedback.getPatterns();
      expect(patterns.length).toBe(0);

      const result = await feedback.importPatterns(exported);
      expect(result.imported).toBeGreaterThanOrEqual(1);

      patterns = await feedback.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should clear all patterns', async () => {
      await feedback.recordCorrection('parse-001', {
        elementIndex: 0,
        originalType: 'action',
        correctedType: 'character',
        originalText: 'EVE',
        userFeedback: 'correction',
        timestamp: new Date(),
        mode: 'heuristic',
        scriptFormat: 'unknown',
      });

      await feedback.clearPatterns();
      const patterns = await feedback.getPatterns();
      expect(patterns.length).toBe(0);
    });

    it('should record feedback', async () => {
      // Should not throw
      await feedback.recordFeedback('parse-001', {
        feedback: 'correct',
        timestamp: new Date(),
      });
    });
  });
});
