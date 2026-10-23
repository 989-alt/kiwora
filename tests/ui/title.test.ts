import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { emptySave, SAVE_KEY, type JournalEntry, type SaveData } from '../../src/sim/save'
import { BACKUP_KEY, boot, hasProgress, keepView, reducer, useApp, type AppState } from '../../src/store'

const D1 = '2026-10-21'

const entry: JournalEntry = {
  day: 9,
  dateKey: D1,
  stage: 'seedDone',
  heightCm: 20,
  leaves: 9,
  actions: { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk' },
  statuses: {
    water: { level: 4, dir: null },
    light: { level: 4, dir: null },
    temp: { level: 4, dir: null },
    nutrient: { level: 4, dir: null },
    pest: { level: 4, dir: null },
  },
}

function fakeStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init))
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

/** A v1 plant (no mode / care / weather fields) as an older version saved it. */
function v1Plant(): Record<string, unknown> {
  const { mode: _m, careDone: _c, weatherSeed: _w, weatherFrom: _f, ...rest } = newPlant('bean')
  return rest
}

describe('hasProgress', () => {
  it('is false for an empty save and true for any plant or kept record', () => {
    expect(hasProgress(emptySave())).toBe(false)
    // only settings changed (sound off, tutorial seen): still nothing to go back to
    expect(hasProgress({ ...emptySave(), settings: { sound: false, tutorialSeen: true } })).toBe(false)
    expect(hasProgress({ ...emptySave(), plant: newPlant('bean') })).toBe(true)
    expect(hasProgress({ ...emptySave(), plant: v1Plant() as unknown as SaveData['plant'] })).toBe(true)
    expect(hasProgress({ ...emptySave(), plant: { ...newPlant('bean'), dead: true } })).toBe(true)
    expect(hasProgress({ ...emptySave(), dex: ['bean'] })).toBe(true)
    expect(hasProgress({ ...emptySave(), finished: { bean: { journal: [entry] } } })).toBe(true)
    expect(hasProgress({ ...emptySave(), pastTries: [{ speciesId: 'bean', days: 3, stage: 'sprout', cause: '물' }] })).toBe(true)
  })
})

describe('title screen in the reducer', () => {
  const withPlant = (): AppState => reducer(boot(emptySave(), D1), { type: 'pick', id: 'bean' }, D1)

  it('home opens the title screen and keeps everything', () => {
    const s = withPlant()
    const t = reducer(s, { type: 'open', screen: 'title' }, D1)
    expect(t.screen).toBe('title')
    expect(t.plant).toEqual(s.plant)
  })

  it('continue goes where the save says', () => {
    const s = reducer(withPlant(), { type: 'open', screen: 'title' }, D1)
    expect(reducer(s, { type: 'continue' }, D1).screen).toBe('grow')
    const dead = { ...s, plant: { ...s.plant!, dead: true } }
    expect(reducer(dead, { type: 'continue' }, D1).screen).toBe('dead')
    const recordsOnly = { ...s, plant: null, dex: ['bean' as const] }
    expect(reducer(recordsOnly, { type: 'continue' }, D1).screen).toBe('pick')
  })

  it('reset wipes every record (keeps the sound setting) and goes to the pick or title screen', () => {
    const s: AppState = {
      ...withPlant(),
      dex: ['balsam'],
      finished: { balsam: { journal: [entry] } },
      pastTries: [{ speciesId: 'bean', days: 3, stage: 'sprout', cause: '물' }],
      journal: [entry],
      morningShownFor: D1,
      settings: { sound: false, tutorialSeen: true },
    }
    for (const to of ['pick', 'title'] as const) {
      const r = reducer(s, { type: 'reset', to }, D1)
      expect(r.screen).toBe(to)
      expect(r.plant).toBeNull()
      expect(r.dex).toEqual([])
      expect(r.finished).toEqual({})
      expect(r.pastTries).toEqual([])
      expect(r.journal).toEqual([])
      expect(r.morningShownFor ?? null).toBeNull()
      expect(r.lastReport).toBeNull()
      expect(r.settings).toEqual({ sound: false, tutorialSeen: false })
      expect(hasProgress(r)).toBe(false)
    }
  })

  it("another tab's save keeps the viewer on the title screen", () => {
    const prev = reducer(withPlant(), { type: 'open', screen: 'title' }, D1)
    const next = boot({ ...emptySave(), plant: newPlant('corn') }, D1)
    expect(keepView(prev, next).screen).toBe('title')
  })
})

describe('useApp and the title screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('every launch opens on the title screen, with or without a save', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(renderHook(() => useApp()).result.current[0].screen).toBe('title')
    const save = { ...emptySave(), plant: newPlant('bean') }
    vi.stubGlobal('localStorage', fakeStorage({ [SAVE_KEY]: JSON.stringify(save) }))
    expect(renderHook(() => useApp()).result.current[0].screen).toBe('title')
  })

  it('picking a plant writes the save at once', () => {
    const ls = fakeStorage()
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    act(() => result.current[1]({ type: 'continue' }))
    act(() => result.current[1]({ type: 'pick', id: 'bean' }))
    const saved = JSON.parse(ls.getItem(SAVE_KEY)!) as SaveData
    expect(saved.plant?.speciesId).toBe('bean')
    expect(hasProgress(saved)).toBe(true)
  })

  it('reset clears the save and its backup copy', () => {
    const save = { ...emptySave(), plant: newPlant('bean'), dex: ['corn'], settings: { sound: false, tutorialSeen: true } }
    const ls = fakeStorage({ [SAVE_KEY]: JSON.stringify(save), [BACKUP_KEY]: '{old' })
    vi.stubGlobal('localStorage', ls)
    const { result } = renderHook(() => useApp())
    act(() => result.current[1]({ type: 'reset', to: 'pick' }))
    expect(ls.getItem(BACKUP_KEY)).toBeNull()
    const saved = JSON.parse(ls.getItem(SAVE_KEY)!) as SaveData
    expect(hasProgress(saved)).toBe(false)
    expect(saved.settings).toEqual({ sound: false, tutorialSeen: false })
    // the app's keys are only these two
    const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i))
    expect(keys).toEqual([SAVE_KEY])
  })
})
