import type { OcrResult, ParserConfig } from '../core/types';
import { Logger } from '../utils/logging';

/**
 * Tesseract.js wrapper for OCR on images and scanned PDFs.
 */
export class TesseractHandler {
  private config: ParserConfig;
  private logger: Logger;

  constructor(config: ParserConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /** Perform OCR on an image buffer */
  async recognize(buffer: ArrayBuffer): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker(this.config.tesseractLanguage);

      const uint8 = new Uint8Array(buffer);
      const blob = new Blob([uint8]);
      const result = await worker.recognize(blob);

      await worker.terminate();

      const duration = Date.now() - startTime;
      const confidence = result.data.confidence / 100;

      return {
        text: result.data.text,
        confidence,
        pages: [{
          pageNumber: 1,
          text: result.data.text,
          confidence,
        }],
        engine: 'tesseract',
        duration,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Tesseract OCR failed: ${message}`);
    }
  }

  /** Check if Tesseract.js is available */
  async isAvailable(): Promise<boolean> {
    try {
      await import('tesseract.js');
      return true;
    } catch {
      return false;
    }
  }
}
