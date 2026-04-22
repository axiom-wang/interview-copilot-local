import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isWebBuild = mode === 'web'

  return {
    plugins: [
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
