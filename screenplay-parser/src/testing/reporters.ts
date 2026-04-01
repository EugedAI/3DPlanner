import type { TestResults, TestResult } from '../core/types';

/**
 * Output formatters for test results: JSON, CSV, and text.
 */

/** Export test results as JSON */
export function toJson(results: TestResults): string {
  return JSON.stringify(results, null, 2);
}

/** Export test results as CSV */
export function toCsv(results: TestResults & { details?: TestResult[] }): string {
  const headers = ['Test ID', 'Passed', 'Accuracy', 'Precision', 'Recall', 'Execution Time (ms)', 'Issues'];
  const rows: string[] = [headers.join(',')];

  if (results.details) {
    for (const r of results.details) {
      rows.push([
        r.testId,
        r.passed ? 'true' : 'false',
        r.accuracy.toFixed(4),
        r.precision.toFixed(4),
        r.recall.toFixed(4),
        r.executionTime.toString(),
        `"${r.issues.join('; ').replace(/"/g, '""')}"`,
      ].join(','));
    }
  }

  // Summary row
  rows.push('');
  rows.push(`Summary,${results.passed}/${results.totalTests} passed,${results.overallAccuracy.toFixed(4)},,,,`);

  return rows.join('\n');
}

/** Export test results as plain text report */
export function toText(results: TestResults): string {
  return results.report;
}

/** Format accuracy as a colored bar (for terminal output) */
export function formatAccuracyBar(accuracy: number, width = 20): string {
  const filled = Math.round(accuracy * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = (accuracy * 100).toFixed(1);

  let indicator: string;
  if (accuracy >= 0.85) indicator = '[GOOD]';
  else if (accuracy >= 0.70) indicator = '[OK]';
  else indicator = '[LOW]';

  return `${bar} ${pct}% ${indicator}`;
}
