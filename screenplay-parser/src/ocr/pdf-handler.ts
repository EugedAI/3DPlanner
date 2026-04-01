import type { OcrResult, ParserConfig } from '../core/types';
import { Logger } from '../utils/logging';

/**
 * Dedicated PDF handler with advanced text extraction.
 * Handles both text-based and scanned PDFs.
 */
export class PdfHandler {
  private config: ParserConfig;
  private logger: Logger;

  constructor(config: ParserConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /** Check if a PDF contains text or is scanned (image-based) */
  async isScannedPdf(buffer: ArrayBuffer): Promise<boolean> {
    try {
      const pdfjsLib = await import('pdfjs-dist');

      if (this.config.pdfWorkerPath) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.config.pdfWorkerPath;
      }

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();

      // If first page has very little text, it's likely scanned
      const textLength = content.items
        .map((item: { str?: string }) => item.str ?? '')
        .join('')
        .trim().length;

      return textLength < 50;
    } catch {
      // If PDF.js fails, assume it's scanned
      return true;
    }
  }

  /** Get the number of pages in a PDF */
  async getPageCount(buffer: ArrayBuffer): Promise<number> {
    try {
      const pdfjsLib = await import('pdfjs-dist');

      if (this.config.pdfWorkerPath) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.config.pdfWorkerPath;
      }

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      return pdf.numPages;
    } catch {
      return 0;
    }
  }
}
