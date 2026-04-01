import type { OcrResult, OcrPage, ParserConfig } from '../core/types';
import { Logger } from '../utils/logging';

/**
 * Unified OCR interface that delegates to PDF.js or Tesseract.js
 * depending on the file type.
 */
export class OcrHandler {
  private config: ParserConfig;
  private logger: Logger;

  constructor(config: ParserConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /** Extract text from a PDF buffer */
  async extractFromPdf(buffer: ArrayBuffer): Promise<OcrResult> {
    const startTime = Date.now();
    this.logger.info('Starting PDF text extraction');

    try {
      // Dynamic import to avoid bundling issues when not used
      const pdfjsLib = await import('pdfjs-dist');

      if (this.config.pdfWorkerPath) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.config.pdfWorkerPath;
      }

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages: OcrPage[] = [];
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: { str?: string }) => item.str ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Reconstruct lines from text items using y-position
        const lines = this.reconstructLines(content.items as TextItem[]);

        pages.push({
          pageNumber: i,
          text: lines,
          confidence: 0.95, // PDF.js text extraction is generally high quality
          width: page.view[2],
          height: page.view[3],
        });

        fullText += (fullText ? '\n\n' : '') + lines;
      }

      const duration = Date.now() - startTime;
      this.logger.info(`PDF extraction complete: ${pdf.numPages} pages in ${duration}ms`);

      return {
        text: fullText,
        confidence: 0.95,
        pages,
        engine: 'pdfjs',
        duration,
      };
    } catch (err) {
      this.logger.warn('PDF.js extraction failed, attempting OCR fallback', err);
      return this.extractWithTesseract(buffer);
    }
  }

  /** Extract text from an image buffer using Tesseract.js */
  async extractFromImage(buffer: ArrayBuffer): Promise<OcrResult> {
    return this.extractWithTesseract(buffer);
  }

  /** OCR using Tesseract.js */
  private async extractWithTesseract(buffer: ArrayBuffer): Promise<OcrResult> {
    const startTime = Date.now();
    this.logger.info('Starting Tesseract OCR extraction');

    try {
      const Tesseract = await import('tesseract.js');

      const workerOptions: Record<string, string> = {};
      if (this.config.tesseractWorkerPath) {
        workerOptions.workerPath = this.config.tesseractWorkerPath;
      }

      const worker = await Tesseract.createWorker(this.config.tesseractLanguage);

      // Convert ArrayBuffer to format Tesseract accepts
      const uint8 = new Uint8Array(buffer);
      const blob = new Blob([uint8]);

      const result = await worker.recognize(blob);
      await worker.terminate();

      const duration = Date.now() - startTime;
      const confidence = result.data.confidence / 100;

      this.logger.info(
        `Tesseract OCR complete: confidence ${(confidence * 100).toFixed(1)}% in ${duration}ms`
      );

      return {
        text: result.data.text,
        confidence,
        pages: [
          {
            pageNumber: 1,
            text: result.data.text,
            confidence,
          },
        ],
        engine: 'tesseract',
        duration,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tesseract OCR failed: ${message}`);
      throw new Error(`OCR extraction failed: ${message}`);
    }
  }

  /** Reconstruct text lines from PDF.js text items using y-positions */
  private reconstructLines(items: TextItem[]): string {
    if (items.length === 0) return '';

    // Sort by y position (descending, since PDF y=0 is bottom), then x position
    const sorted = [...items].sort((a, b) => {
      const yDiff = (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0);
      if (Math.abs(yDiff) > 2) return yDiff;
      return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
    });

    const lines: string[] = [];
    let currentLine = '';
    let lastY = sorted[0]?.transform?.[5] ?? 0;

    for (const item of sorted) {
      const y = item.transform?.[5] ?? 0;
      const x = item.transform?.[4] ?? 0;

      if (Math.abs(y - lastY) > 2) {
        // New line
        if (currentLine.trim()) {
          // Preserve indentation by adding spaces based on x position
          const indent = Math.max(0, Math.floor(x / 6));
          lines.push(' '.repeat(indent) + currentLine.trim());
        }
        currentLine = item.str ?? '';
        lastY = y;
      } else {
        currentLine += (item.str ?? '');
      }
    }

    // Don't forget last line
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines.join('\n');
  }
}

/** Minimal type for PDF.js text content items */
interface TextItem {
  str?: string;
  transform?: number[];
}
