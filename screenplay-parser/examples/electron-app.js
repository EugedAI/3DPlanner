/**
 * Electron main process example for Screenplay Parser.
 *
 * Usage:
 *   Use this in your Electron app's main process.
 *   Renderer communicates via IPC.
 */

import { app, ipcMain, dialog } from 'electron';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ScreenplayParser, InMemoryAdapter } from '@screenplay-parser/core';

// Create parser with filesystem-friendly storage
// In production, use a FileSystemAdapter or SQLite adapter
const parser = new ScreenplayParser({
  storage: new InMemoryAdapter(), // Replace with persistent adapter
  enableLearning: true,
  enableClaudeMode: false,
  logLevel: 'info',
});

// Handle file open dialog
ipcMain.handle('open-script', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Screenplays', extensions: ['pdf', 'txt', 'fountain', 'fdx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Handle script parsing
ipcMain.handle('parse-script', async (_event, filePath) => {
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );

  return parser.parseFile(arrayBuffer, filePath.split('/').pop());
});

// Handle text parsing
ipcMain.handle('parse-text', async (_event, text) => {
  return parser.parseText(text);
});

// Handle metrics
ipcMain.handle('get-metrics', async () => {
  return parser.getMetrics();
});

// Handle pattern export
ipcMain.handle('export-patterns', async () => {
  return parser.exportPatterns();
});

// Handle corrections
ipcMain.handle('record-correction', async (_event, parseId, correction) => {
  return parser.recordCorrection(parseId, correction);
});
