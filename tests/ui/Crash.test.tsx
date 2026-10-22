import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../../src/App'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY, shortCode, type SaveData } from '../../src/sim/save'
import { BACKUP_KEY } from '../../src/store'
import { AppErrorBoundary } from '../../src/ui/screens/CrashScreen'

function Boom(): never {
  throw new Error('render crash')
}

const saved = (): SaveData => ({ ...emptySave(), plant: { ...newPlant('bean'), day: 4 }, lastDayKey: '2026-10-22', dex: ['balsam'] })

beforeEach(() => {
  localStorage.clear()
  // React logs the caught error; keep the test output clean
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

test('a render crash shows a friendly screen instead of a blank page', () => {
  render(
    <AppErrorBoundary>
      <Boom />
    </AppErrorBoundary>,
  )
  expect(screen.getByRole('heading', { name: '앗, 문제가 생겼어요' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '기록 지키기' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '처음부터 다시 하기' })).toBeTruthy()
})

test('기록 지키기 opens the backup panel with the code of the save in storage', () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved()))
  render(
    <AppErrorBoundary>
      <Boom />
    </AppErrorBoundary>,
  )
  fireEvent.click(screen.getByRole('button', { name: '기록 지키기' }))
  expect(screen.getByLabelText('짧은 기록 코드').textContent).toBe(shortCode(saved()).replace(/-/g, ''))
  fireEvent.click(screen.getByRole('button', { name: '돌아가기' }))
  expect(screen.getByRole('heading', { name: '앗, 문제가 생겼어요' })).toBeTruthy()
})

test('an unreadable save is still shown as it is, so it can be copied', () => {
  localStorage.setItem(SAVE_KEY, '{"v":1,"plant":{broken')
  render(
    <AppErrorBoundary>
      <Boom />
    </AppErrorBoundary>,
  )
  fireEvent.click(screen.getByRole('button', { name: '기록 지키기' }))
  expect((screen.getByLabelText('저장된 기록 그대로') as HTMLTextAreaElement).value).toBe('{"v":1,"plant":{broken')
})

test('처음부터 다시 asks first; yes keeps a backup copy, clears the save and reloads', () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved()))
  const reload = vi.fn()
  render(
    <AppErrorBoundary onReload={reload}>
      <Boom />
    </AppErrorBoundary>,
  )
  fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 하기' }))
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '그만두기' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
  expect(reload).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 하기' }))
  fireEvent.click(screen.getByRole('button', { name: '지우고 다시 하기' }))
  expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  expect(JSON.parse(localStorage.getItem(BACKUP_KEY)!).plant.day).toBe(4)
  expect(reload).toHaveBeenCalledTimes(1)
})

test('a device that cannot save says so once, over the screen', () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: () => null,
    removeItem: (k: string) => void store.delete(k),
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
  })
  render(<App />)
  const note = screen.getByRole('alert')
  expect(note.textContent).toContain('이 기기에는 기록을 저장할 수 없어요.')
  fireEvent.click(screen.getByRole('button', { name: '알겠어요' }))
  expect(screen.queryByRole('alert')).toBeNull()
})
