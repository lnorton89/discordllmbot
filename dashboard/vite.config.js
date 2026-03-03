import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// URL Constants (mirroring @shared/constants for build config)
const URLS = {
    DEV: {
        API: 'http://localhost:3000',
    },
    DOCKER: {
        API: 'http://bot:3000',
    },
} as const;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  // Use API_PROXY_TARGET if set (from Docker env or .env), otherwise try VITE_API_URL or localhost:3000
  // Priority: process.env.API_PROXY_TARGET > env.API_PROXY_TARGET > VITE_API_URL (with localhost->bot replacement in Docker) > localhost:3000
  let apiTarget = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET;
  if (!apiTarget) {
    const viteApiUrl = env.VITE_API_URL || process.env.VITE_API_URL;
    if (viteApiUrl) {
      // In Docker environment, replace localhost with 'bot' service name
      apiTarget = viteApiUrl.replace('/api', '').replace('localhost', 'bot');
    } else {
      apiTarget = URLS.DEV.API;
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@constants": path.resolve(__dirname, "./src/constants"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
        "@services": path.resolve(__dirname, "./src/services"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@context": path.resolve(__dirname, "./src/context"),
        "@theme": path.resolve(__dirname, "./src/theme"),
        "@types": path.resolve(__dirname, "./src/types"),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: false,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/dist',
          '**/tests',
          '**/test',
          '**/__tests__',
          '**/*.test.*',
          '**/*.spec.*',
          '**/fixtures',
          '**/playwright-report',
          '**/test-results',
        ],
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 5000,
          proxyTimeout: 10000,
        },
      },
      // Allow connections from outside the container
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        external: [],
      },
    },
  }
})
