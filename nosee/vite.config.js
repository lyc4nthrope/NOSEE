import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    loader: 'jsx',
    include: /(\.jsx?|\.(tests?|spec?)\/.*\.jsx?)$/,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    // ES2020+ genera bundles ~10-15% más pequeños — cubre >96% de navegadores actuales
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':       ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase':    ['@supabase/supabase-js'],
          'vendor-state':       ['zustand'],
          'vendor-virtualizer': ['@tanstack/react-virtual'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    plugins: [react()],
    setupFiles: ['./tests/setup.js'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      // Archivos a incluir en la cobertura
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/**/*.test.{js,jsx}',
        'src/**/__mocks__/**',
        'node_modules/**',
      ],
      // Meta mínima de cobertura (RNF 4.6 — Verificabilidad)
      thresholds: {
        lines:       60,
        functions:   60,
        branches:    50,
        statements:  60,
      },
    },
  },
})
