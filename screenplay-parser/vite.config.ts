import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ScreenplayParser',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        const formatMap: Record<string, string> = {
          es: 'screenplay-parser.esm.js',
          cjs: 'screenplay-parser.cjs.js',
          umd: 'screenplay-parser.umd.js',
        };
        return formatMap[format] ?? `screenplay-parser.${format}.js`;
      },
    },
    rollupOptions: {
      external: ['pdfjs-dist', 'tesseract.js', 'fs', 'path'],
      output: {
        globals: {
          'pdfjs-dist': 'pdfjsLib',
          'tesseract.js': 'Tesseract',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@learning': resolve(__dirname, 'src/learning'),
      '@ocr': resolve(__dirname, 'src/ocr'),
      '@testing': resolve(__dirname, 'src/testing'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/core/types.ts'],
    },
  },
});
