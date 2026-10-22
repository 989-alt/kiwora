import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { expect, test } from '@playwright/test'
import { saveWith, useSave } from './fixtures'

// The GitHub Pages build lives under /kiwora/. Chromium only (service workers).
test.skip(({ browserName }) => browserName !== 'chromium', 'GitHub Pages base-path check runs on Chromium only')

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })

let preview: ChildProcess | undefined
let origin = ''
let site = ''

test.beforeAll(async () => {
  test.setTimeout(240_000)
  execFileSync('npm', ['run', 'build:pages'], { stdio: 'ignore', shell: true })
  const port = await freePort()
  origin = `http://127.0.0.1:${port}`
  site = `${origin}/kiwora/`
  preview = spawn('npx', ['vite', 'preview', '--base', '/kiwora/', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: true,
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(site)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview did not start')
})

test.afterAll(() => {
  if (!preview?.pid) return
  try {
    execFileSync('taskkill', ['/PID', String(preview.pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    preview.kill()
  }
})

test('the app works under /kiwora/', async ({ page }) => {
  const failed: string[] = []
  page.on('response', (r) => {
    if (r.url().startsWith(origin) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
  })

  // start a plant so the pot and the plant pictures are on screen
  await useSave(page, saveWith({ bugs: 2 }))
  await page.goto(site)
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('img[data-layer="pot-back"]')).toBeVisible()

  for (const layer of ['pot-back', 'plant']) {
    const img = page.locator(`img[data-layer="${layer}"]`).first()
    await expect(img).toBeVisible()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  }

  // every picture on screen (pot, plant, background, tools, bugs) loaded
  await expect
    .poll(() => page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length))
    .toBe(0)

  // pictures are fetched from /kiwora/..., not from the site root
  const sources = await page.evaluate(() => [...document.images].map((i) => i.currentSrc))
  expect(sources.length).toBeGreaterThan(0)
  expect(sources.filter((s) => !s.includes('/kiwora/'))).toEqual([])

  // the manifest link resolves under the base, and so do its start_url, scope and icons
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifestUrl = new URL(href!, page.url()).href
  expect(manifestUrl).toBe(`${site}manifest.webmanifest`)
  const res = await page.request.get(manifestUrl)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(new URL(manifest.start_url, manifestUrl).href).toBe(site)
  expect(new URL(manifest.scope, manifestUrl).href).toBe(site)
  for (const icon of manifest.icons) {
    expect((await page.request.get(new URL(icon.src, manifestUrl).href)).ok()).toBe(true)
  }

  // the service worker registers with a scope under the base
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toBe(site)
  expect(scope.endsWith('/kiwora/')).toBe(true)

  expect(failed).toEqual([])
})
