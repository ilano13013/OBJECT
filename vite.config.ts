/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// `vite build --mode artifact` produces one self-contained HTML file (JS, CSS,
// fonts and images inlined) for sandboxed previews that cannot load sibling
// files. The normal build stays code-split for real hosting.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    plugins: [react(), tailwindcss(), ...(artifact ? [viteSingleFile()] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { 'import.meta.env.VITE_MEMORY_ROUTER': JSON.stringify(artifact) },
    build: {
      target: 'es2022',
      outDir: artifact ? 'dist-artifact' : 'dist',
      chunkSizeWarningLimit: artifact ? 8000 : 1400,
      assetsInlineLimit: artifact ? 100_000_000 : 4096,
      rollupOptions: artifact
        ? {}
        : {
            output: {
              manualChunks(id: string) {
                if (/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react'
                if (id.includes('node_modules/three/') || id.includes('@react-three') || id.includes('@pmndrs')) return 'three'
                if (id.includes('node_modules/gsap')) return 'gsap'
              },
            },
          },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
