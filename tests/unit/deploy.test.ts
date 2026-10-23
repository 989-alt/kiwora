import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf-8')

test('.vercelignore keeps the 86 MB raw art, docs, tests and local build output out of the upload', () => {
  expect(existsSync('.vercelignore')).toBe(true)
  const lines = read('.vercelignore')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  for (const p of [
    'node_modules', 'dist', 'assets/raw', 'assets/review', 'docs', '.superpowers', 'test-results',
    'playwright-report', '.pytest_cache', 'scripts/__pycache__', 'tests',
  ]) {
    expect(lines).toContain(p)
  }
  // the build reads these, so they must go up
  for (const keep of ['src', 'public', 'assets', 'assets/approved.json', 'package.json']) expect(lines).not.toContain(keep)
})

test('the manifest lets a tablet turn either way', () => {
  expect(JSON.parse(read('public/manifest.webmanifest')).orientation).toBe('any')
})

test('the service worker does not precache the unused 1 MB stand-in picture', () => {
  expect(read('vite.config.ts')).toMatch(/globIgnores:\s*\[[^\]]*plants\/standin\.png/)
})

test('the clay magnifier frame and its lens numbers are in public/ and precached (webp and json globs)', () => {
  expect(existsSync('public/props/magnifier-lens.webp')).toBe(true)
  const lens = JSON.parse(read('public/lens.json'))
  for (const k of ['w', 'h', 'cx', 'cy', 'r']) expect(typeof lens[k]).toBe('number')
  const globs = /globPatterns:\s*\[([^\]]*)\]/.exec(read('vite.config.ts'))![1]
  expect(globs).toMatch(/\bwebp\b/)
  expect(globs).toMatch(/\bjson\b/)
  expect(read('vite.config.ts')).not.toMatch(/globIgnores:\s*\[[^\]]*(magnifier|lens)/)
})

test('Jua and Gowun Dodum are self-hosted (no Google Fonts), so the app is fully offline after the first load', () => {
  for (const f of ['index.html', 'vite.config.ts', 'src/main.tsx', 'src/styles/tokens.css']) {
    expect(read(f), f).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  }
  const main = read('src/main.tsx')
  expect(main).toMatch(/import '@fontsource\/jua\/400\.css'/)
  expect(main).toMatch(/import '@fontsource\/gowun-dodum\/400\.css'/)
  const pkg = JSON.parse(read('package.json'))
  expect(pkg.dependencies['@fontsource/jua']).toBeTruthy()
  expect(pkg.dependencies['@fontsource/gowun-dodum']).toBeTruthy()
  // the service worker precaches the woff2 files (the .woff copies are only for browsers without woff2)
  const globs = /globPatterns:\s*\[([^\]]*)\]/.exec(read('vite.config.ts'))![1]
  expect(globs).toContain('woff2')
  expect(globs).not.toMatch(/woff,/)
  // fontsource's own @font-face rules say font-display: swap
  expect(read('node_modules/@fontsource/jua/400.css')).toContain('font-display: swap')
  expect(read('node_modules/@fontsource/gowun-dodum/400.css')).toContain('font-display: swap')
})
