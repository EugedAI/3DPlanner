import { Logger } from '../utils/logging';

/**
 * Image pre-processing for better OCR results.
 * Handles orientation detection and quality assessment.
 */
export class ImageProcessor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /** Assess image quality for OCR */
  assessQuality(buffer: ArrayBuffer): ImageQuality {
    const size = buffer.byteLength;

    // Very small files are likely low quality
    if (size < 10_000) {
      return {
        score: 0.3,
        recommendation: 'Image is very small. OCR results may be poor.',
        isAdequate: false,
      };
    }

    // Very large files might be high-res scans
    if (size > 10_000_000) {
      return {
        score: 0.9,
        recommendation: 'Image appears to be high resolution.',
        isAdequate: true,
      };
    }

    // Medium files — reasonable quality
    return {
      score: 0.7,
      recommendation: 'Image quality appears adequate for OCR.',
      isAdequate: true,
    };
  }

  /** Detect image format from buffer */
  detectFormat(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer.slice(0, 4));

    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif';
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'webp';

    // Check for TIFF
    if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) {
      return 'tiff';
    }

    return 'unknown';
  }
}

export interface ImageQuality {
  score: number;
  recommendation: string;
  isAdequate: boolean;
}
