import { expect, test } from './fixtures'

test('main is visible and body disables text selection', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()
  const userSelect = await page.evaluate(
    () => getComputedStyle(document.body).userSelect,
  )
  expect(userSelect).toBe('none')
})
