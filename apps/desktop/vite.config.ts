import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, repoRoot, ''), ...loadEnv(mode, appRoot, '') }
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value
  }
  return {
    root: appRoot,
    envDir: appRoot,
    publicDir: fileURLToPath(new URL('../../shared/ui/public', import.meta.url)),
    define: Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_')).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    server: { port: 5173, strictPort: true, fs: { allow: [repoRoot] } },
    base: './',
    plugins: [react(), tailwindcss(), electron({
      main: {
        entry: fileURLToPath(new URL('./electron/main.ts', import.meta.url)),
        vite: { build: { rollupOptions: { external: ['ws'] } } },
      },
      preload: { input: fileURLToPath(new URL('./electron/preload.ts', import.meta.url)) },
    })],
  }
})
