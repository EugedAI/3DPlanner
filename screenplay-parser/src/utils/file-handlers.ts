import type { InputFileType } from '../core/types';

/** File type signatures (magic bytes) */
const FILE_SIGNATURES: Array<{ bytes: number[]; type: InputFileType }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], type: 'pdf' },           // %PDF
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: 'image' },         // PNG
  { bytes: [0xff, 0xd8, 0xff], type: 'image' },                // JPEG
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: 'docx' },          // ZIP (DOCX)
];

/** Detect file type from buffer */
export function detectFileType(buffer: ArrayBuffer, fileName?: string): InputFileType {
  const bytes = new Uint8Array(buffer.slice(0, 8));

  // Check magic bytes
  for (const sig of FILE_SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) {
      // Differentiate DOCX from other ZIP files
      if (sig.type === 'docx' && fileName && !fileName.endsWith('.docx')) {
        continue;
      }
      return sig.type;
    }
  }

  // Fall back to extension-based detection
  if (fileName) {
    return detectFromExtension(fileName);
  }

  // Check if it looks like text
  if (isLikelyText(buffer)) {
    return 'text';
  }

  return 'text';
}

/** Detect file type from file extension */
export function detectFromExtension(fileName: string): InputFileType {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'txt':
    case 'text':
      return 'text';
    case 'fountain':
    case 'spmd':
      return 'fountain';
    case 'fdx':
      return 'fdx';
    case 'docx':
      return 'docx';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'tiff':
    case 'tif':
    case 'bmp':
    case 'webp':
      return 'image';
    default:
      return 'text';
  }
}

/** Check if a buffer looks like text content */
function isLikelyText(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 512));
  let textChars = 0;
  for (const byte of bytes) {
    // Printable ASCII, newline, carriage return, tab
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d || byte === 0x09) {
      textChars++;
    }
  }
  return textChars / bytes.length > 0.85;
}

/** Convert ArrayBuffer to string (UTF-8) */
export function bufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(buffer);
}

/** Convert string to ArrayBuffer */
export function stringToBuffer(text: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

/** Get file size in human-readable format */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
