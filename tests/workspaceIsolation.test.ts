import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    if (['node_modules', 'dist', 'dist-electron'].includes(entry.name)) return []
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(path) ? [path] : []
  })

const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(
  /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g,
)].map((match) => match[1])

const graph = (entrypoints: string[]) => {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const specifier of imports(file)) {
      if (!specifier.startsWith('.')) { packages.add(specifier); continue }
      const candidate = resolve(dirname(file), specifier)
      const target = ['', '.ts', '.tsx', '/index.ts'].map((suffix) => candidate + suffix)
        .find((path) => existsSync(path) && /\.(ts|tsx)$/.test(path))
      if (target) visit(target)
    }
  }
  entrypoints.map((entry) => resolve(root, entry)).forEach(visit)
  return { files: [...files].map((file) => relative(root, file)), packages }
}

test('web entry, build, functions and realtime service do not import desktop code', () => {
  const result = graph(['apps/web/main.ts', 'apps/web/vite.config.ts',
    'apps/web/netlify/functions/analysis.ts', 'apps/web/netlify/functions/ast-probe.ts',
    'apps/web/realtime/server.ts'])
  assert.ok(result.files.some((file) => file.startsWith('shared/ui/')))
  assert.ok(result.files.some((file) => file.startsWith('shared/analysis/')))
  assert.ok(!result.files.some((file) => file.startsWith('apps/desktop/')))
  assert.ok(!result.packages.has('electron'))
  assert.ok(!result.packages.has('vite-plugin-electron/simple'))
})

test('desktop entry and Electron process do not import web or Netlify code', () => {
  const result = graph(['apps/desktop/renderer/main.ts', 'apps/desktop/electron/main.ts',
    'apps/desktop/electron/preload.ts', 'apps/desktop/vite.config.ts'])
  assert.ok(result.files.some((file) => file.endsWith('codexClient.ts')))
  assert.ok(!result.files.some((file) => file.startsWith('apps/web/')))
  assert.ok(![...result.packages].some((specifier) => specifier.startsWith('@netlify/')))
})

test('shared modules remain independent of either application', () => {
  const result = graph(sourceFiles(join(root, 'shared')).map((file) => relative(root, file)))
  assert.ok(!result.files.some((file) => file.startsWith('apps/')))
  assert.ok(!result.packages.has('electron'))
})
