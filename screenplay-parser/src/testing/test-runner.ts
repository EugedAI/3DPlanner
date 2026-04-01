import type { TestScript, TestResult, TestResults, ParseResult } from '../core/types';
import { compareWithGolden } from '../learning/validation';
import { Logger } from '../utils/logging';

/**
 * Built-in test runner for screenplay parser accuracy testing.
 * Compares parser output against golden reference files.
 */
export class TestRunner {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /** Run a full test suite */
  async runSuite(
    testScripts: TestScript[],
    parseFn: (buffer: ArrayBuffer, fileName: string) => Promise<ParseResult>
  ): Promise<TestResults> {
    this.logger.info(`Running test suite: ${testScripts.length} tests`);
    const startTime = Date.now();

    const results: TestResult[] = [];
    const byFormat: Record<string, { total: number; passed: number }> = {};

    for (const test of testScripts) {
      const result = await this.runSingle(test, parseFn);
      results.push(result);

      // Track by format
      if (!byFormat[test.format]) byFormat[test.format] = { total: 0, passed: 0 };
      byFormat[test.format].total++;
      if (result.passed) byFormat[test.format].passed++;

      this.logger.info(
        `Test ${test.id}: ${result.passed ? 'PASS' : 'FAIL'} (accuracy: ${(result.accuracy * 100).toFixed(1)}%)`
      );
    }

    const passed = results.filter((r) => r.passed).length;
    const overallAccuracy =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
        : 0;

    const formatAccuracy: Record<string, number> = {};
    for (const [format, stats] of Object.entries(byFormat)) {
      formatAccuracy[format] = stats.total > 0 ? stats.passed / stats.total : 0;
    }

    const duration = Date.now() - startTime;
    const report = this.generateReport(results, testScripts, overallAccuracy, formatAccuracy, duration);

    return {
      totalTests: testScripts.length,
      passed,
      failed: testScripts.length - passed,
      overallAccuracy,
      byFormat: formatAccuracy,
      timestamp: new Date(),
      report,
    };
  }

  /** Run a single test */
  async runSingle(
    test: TestScript,
    parseFn: (buffer: ArrayBuffer, fileName: string) => Promise<ParseResult>
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const parseResult = await parseFn(test.fileBuffer, test.filename);
      const comparison = compareWithGolden(parseResult, test.goldenReference);

      const executionTime = Date.now() - startTime;
      const passed = comparison.accuracy >= 0.80;

      return {
        testId: test.id,
        passed,
        accuracy: comparison.accuracy,
        precision: comparison.precision,
        recall: comparison.recall,
        issues: comparison.errors.map((e) => e.message),
        executionTime,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        testId: test.id,
        passed: false,
        accuracy: 0,
        precision: 0,
        recall: 0,
        issues: [`Parse error: ${message}`],
        executionTime: Date.now() - startTime,
      };
    }
  }

  /** Generate a human-readable test report */
  private generateReport(
    results: TestResult[],
    tests: TestScript[],
    overallAccuracy: number,
    formatAccuracy: Record<string, number>,
    duration: number
  ): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════');
    lines.push('  SCREENPLAY PARSER - TEST REPORT');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`Duration: ${(duration / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push('─── SUMMARY ───────────────────────────────────────');
    lines.push(`Total Tests: ${results.length}`);
    lines.push(`Passed: ${results.filter((r) => r.passed).length}`);
    lines.push(`Failed: ${results.filter((r) => !r.passed).length}`);
    lines.push(`Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    lines.push('');

    // By format
    lines.push('─── BY FORMAT ─────────────────────────────────────');
    for (const [format, accuracy] of Object.entries(formatAccuracy)) {
      lines.push(`  ${format}: ${(accuracy * 100).toFixed(1)}%`);
    }
    lines.push('');

    // Individual results
    lines.push('─── INDIVIDUAL TESTS ──────────────────────────────');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const t = tests[i];
      const status = r.passed ? 'PASS' : 'FAIL';
      lines.push(`  [${status}] ${t.filename}`);
      lines.push(`         Accuracy: ${(r.accuracy * 100).toFixed(1)}% | Precision: ${(r.precision * 100).toFixed(1)}% | Recall: ${(r.recall * 100).toFixed(1)}%`);
      lines.push(`         Time: ${r.executionTime}ms`);

      if (r.issues.length > 0) {
        lines.push(`         Issues (${r.issues.length}):`);
        for (const issue of r.issues.slice(0, 5)) {
          lines.push(`           - ${issue}`);
        }
        if (r.issues.length > 5) {
          lines.push(`           ... and ${r.issues.length - 5} more`);
        }
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }
}
