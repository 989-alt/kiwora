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
