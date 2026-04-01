import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: '/parser/',
  build: {
    outDir: resolve(__dirname, '../../parser'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../src/core'),
      '@learning': resolve(__dirname, '../src/learning'),
      '@ocr': resolve(__dirname, '../src/ocr'),
      '@testing': resolve(__dirname, '../src/testing'),
      '@utils': resolve(__dirname, '../src/utils'),
    },
  },
  server: {
    open: true,
  },
});
