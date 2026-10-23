import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../src/App'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY, type SaveData } from '../../src/sim/save'
import { BACKUP_KEY } from '../../src/store'

const btn = (name: string) => screen.getByRole('button', { name })
const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY)!) as SaveData
/** Past the dialogs' tap guard (a tap right after opening is ignored). */
const pastGuard = () => act(() => void vi.advanceTimersByTime(500))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

function seedPlant() {
  const plant = { ...newPlant('bean', { mode: 'daily', weatherSeed: 0 }), careDone: 1 }
  const save = { ...emptySave(), plant, dex: ['corn'], settings: { sound: false, tutorialSeen: true } }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  localStorage.setItem(BACKUP_KEY, '{old')
}

describe('title screen', () => {
  test('first visit: 이어하기 is off with a note; 새로 시작하기 goes to the pick screen; picking saves at once', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('식물 한살이')
    const go = btn('이어하기')
    expect(go.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('아직 저장된 기록이 없어요')).toBeTruthy()
    fireEvent.click(go)
    expect(screen.queryByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeNull()
    fireEvent.click(btn('새로 시작하기'))
    // no save: no question first
    expect(screen.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeTruthy()
    expect(btn('메인화면으로')).toBeTruthy()
  })

  test('with a save: 이어하기 goes back to the plant', () => {
    seedPlant()
    render(<App />)
    const go = btn('이어하기')
    expect(go.getAttribute('aria-disabled')).toBe('false')
    expect(screen.queryByText('아직 저장된 기록이 없어요')).toBeNull()
    fireEvent.click(go)
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toContain('강낭콩')
  })

  test('새로 시작하기 with a save asks first; 취소 keeps it, 새로 시작하기 wipes everything', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    seedPlant()
    render(<App />)
    fireEvent.click(btn('새로 시작하기'))
    expect(screen.getByRole('alertdialog').textContent).toContain('지금까지의 기록이 모두 지워져요. 새로 시작할까요?')
    pastGuard()
    fireEvent.click(btn('취소'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(saved().plant?.speciesId).toBe('bean')

    fireEvent.click(btn('새로 시작하기'))
    pastGuard()
    fireEvent.click(screen.getAllByRole('button', { name: '새로 시작하기' }).find((b) => b.closest('[role=alertdialog]'))!)
    expect(screen.getByRole('heading', { name: '어떤 식물을 키워 볼까요?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /씨 도감/ }).textContent).toContain('0/9')
    expect(saved().plant).toBeNull()
    expect(saved().dex).toEqual([])
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })
})

describe('메인화면으로 in the header', () => {
  test('keep the records: back on the title screen with 이어하기 on', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    seedPlant()
    render(<App />)
    fireEvent.click(btn('이어하기'))
    fireEvent.click(btn('메인화면으로'))
    expect(screen.getByRole('dialog').textContent).toContain('메인화면으로 갈까요?')
    // a second tap right away (double tap) chooses nothing
    fireEvent.click(btn('기록 유지하고 메인 화면으로'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    pastGuard()
    fireEvent.click(btn('기록 유지하고 메인 화면으로'))
    expect(btn('이어하기').getAttribute('aria-disabled')).toBe('false')
    expect(saved().plant?.speciesId).toBe('bean')
    fireEvent.click(btn('이어하기'))
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('aria-label')).toContain('강낭콩')
  })

  test('Escape and 취소 close it; 기록 초기화하기 asks again, then wipes and goes to the title screen', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    seedPlant()
    render(<App />)
    fireEvent.click(btn('이어하기'))
    fireEvent.click(btn('메인화면으로'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(btn('메인화면으로'))
    pastGuard()
    fireEvent.click(btn('기록 초기화하기'))
    expect(screen.getByRole('alertdialog').textContent).toContain('기록이 모두 지워져요. 정말 초기화할까요?')
    pastGuard()
    fireEvent.click(btn('취소'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(saved().plant?.speciesId).toBe('bean')

    fireEvent.click(btn('메인화면으로'))
    pastGuard()
    fireEvent.click(btn('기록 초기화하기'))
    pastGuard()
    fireEvent.click(btn('초기화하기'))
    expect(btn('이어하기').getAttribute('aria-disabled')).toBe('true')
    expect(saved().plant).toBeNull()
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  test('is on the dex, journal and backup screens too', () => {
    seedPlant()
    render(<App />)
    fireEvent.click(btn('이어하기'))
    for (const name of ['관찰 일지', '씨 도감', '기록 지키기']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
      expect(btn('메인화면으로'), name).toBeTruthy()
      fireEvent.click(btn('메인화면으로'))
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      fireEvent.click(screen.getAllByRole('button', { name: /돌아가기/ })[0])
    }
  })
})
