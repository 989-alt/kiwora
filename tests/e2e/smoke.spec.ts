import { expect, test } from '@playwright/test'

test('main is visible and body disables text selection', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toBeAttached()
  const userSelect = await page.evaluate(
    () => getComputedStyle(document.body).userSelect,
  )
  expect(userSelect).toBe('none')
})
