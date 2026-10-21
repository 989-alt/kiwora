import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { expect, test } from '@playwright/test'

// Chromium only: Playwright's WebKit does not run service workers reliably.
test.skip(({ browserName }) => browserName !== 'chromium', 'service worker check runs on Chromium only')

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
let base = ''

test.beforeAll(async () => {
  test.setTimeout(240_000)
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore', shell: true })
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: true,
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return
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

test('works offline after first load', async ({ page, context }) => {
  await page.goto(base)
  await expect(page.locator('main')).toBeVisible()

  // wait until the service worker controls the page and the precache is filled
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const name = (await caches.keys()).find((k) => k.includes('precache'))
        return name ? (await (await caches.open(name)).keys()).length : 0
      }),
    )
    .toBeGreaterThan(5)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('main')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length))
    .toBeGreaterThan(0)
})
