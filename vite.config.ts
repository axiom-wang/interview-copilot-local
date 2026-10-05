import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { astProbeDevPlugin } from './vite/astProbePlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isWebBuild = mode === 'web'

  return {
    plugins: [
      astProbeDevPlugin(),
      react(),
      tailwindcss(),
      ...(isWebBuild
        ? []
        : [
            electron({
              main: {
                entry: 'electron/main.ts',
                vite: {
                  build: {
                    rollupOptions: {
                      external: ['ws'],
                    },
                  },
                },
              },
              preload: {
                input: 'electron/preload.ts',
              },
            }),
          ]),
    ],
  }
})
