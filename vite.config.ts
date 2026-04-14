import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    rollupOptions: {
      input: './app.html',
    },
  },
  server: {
    port: 5173,
    // serve app.html as the default when accessing /
    open: '/app.html',
  },
})
