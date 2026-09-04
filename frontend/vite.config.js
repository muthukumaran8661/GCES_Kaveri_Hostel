import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) {
              return 'jspdf';
            }
            if (id.includes('xlsx')) {
              return 'xlsx';
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode')) {
              return 'qrcode';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
          }
        }
      }
    }
  }
});
