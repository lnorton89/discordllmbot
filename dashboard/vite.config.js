import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  // Use API_PROXY_TARGET if set, otherwise try localhost:3000 for local dev
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000'

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
        ignored: ['**/node_modules', '**/.git', '**/dist'],
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
        '/socket.io': {
          target: apiTarget,
          ws: true,
          secure: false,
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
