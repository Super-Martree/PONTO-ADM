import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3335';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '192.168.18.75',
    proxy: {
      '/api': apiProxyTarget,
    },
  },
  preview: {
    host: '192.168.18.75',
  },
});
