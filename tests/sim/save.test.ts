import { describe, expect, it } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { emptySave, exportCode, importCode, loadSave, requestPersist, shortCode, writeSave, type SaveData } from '../../src/sim/save'

function memStorage(initial: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(initial))
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

const throwing = (): Storage => {
  const boom = () => {
    throw new Error('denied')
  }
  return { length: 0, clear: boom, getItem: boom, key: boom, removeItem: boom, setItem: boom }
}

function sample(): SaveData {
  const d = emptySave()
  d.plant = newPlant('balsam')
  d.lastDayKey = '2026-10-21'
  d.dayDone = true
  d.dex = ['balsam']
  d.pastTries = [{ speciesId: 'bean', days: 4, stage: 'seed', cause: '물이 부족했어요' }]
  return d
}

describe('save', () => {
  it('roundtrip', () => {
    const s = memStorage()
    const d = sample()
    expect(writeSave(d, s)).toBe(true)
    const r = loadSave(s)
    expect(r.warning).toBeUndefined()
    expect(r.data).toEqual(d)
  })

  it('empty storage gives emptySave without warning', () => {
    const r = loadSave(memStorage())
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBeUndefined()
  })

  it('corrupt save falls back to fresh state', () => {
    const r = loadSave(memStorage({ 'plantlife.v1': '{oops' }))
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBe('corrupt')
  })

  it('wrong version is corrupt', () => {
    const r = loadSave(memStorage({ 'plantlife.v1': JSON.stringify({ v: 2 }) }))
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBe('corrupt')
  })

  it('throwing storage reports unavailable', () => {
    const r = loadSave(throwing())
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBe('unavailable')
  })

  it('writeSave returns false when storage throws', () => {
    expect(writeSave(sample(), throwing())).toBe(false)
  })

  it('normalizes a plant missing history and clamps bugs on load', () => {
    const d = sample()
    const old: any = { ...d.plant, bugs: 30 }
    delete old.history
    const s = memStorage({ 'plantlife.v1': JSON.stringify({ ...d, plant: old }) })
    const r = loadSave(s)
    expect(r.data.plant!.history).toEqual([])
    expect(r.data.plant!.bugs).toBe(12)
  })

  it('normalizes imported codes the same way', () => {
    const d = sample()
    const old: any = { ...d.plant, bugs: 99 }
    delete old.history
    const code = exportCode({ ...d, plant: old })
    const r = importCode(code)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.plant!.history).toEqual([])
      expect(r.data.plant!.bugs).toBe(12)
    }
  })

  it('fills missing optional top-level fields from emptySave', () => {
    const s = memStorage({ 'plantlife.v1': JSON.stringify({ v: 1, plant: null }) })
    const r = loadSave(s)
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBeUndefined()
  })
})

describe('shape validation', () => {
  const load = (o: unknown) => loadSave(memStorage({ 'plantlife.v1': JSON.stringify(o) }))

  it('empty plant object is corrupt', () => {
    const r = load({ v: 1, plant: {} })
    expect(r.data).toEqual(emptySave())
    expect(r.warning).toBe('corrupt')
    expect(importCode(exportCode({ v: 1, plant: {} } as unknown as SaveData)).ok).toBe(false)
  })

  it('filters junk journal entries and cleans scalars', () => {
    const r = load({ v: 1, journal: [null, 5], pastTries: ['x'], dex: ['balsam', 'balsam', 'nope'], lastDayKey: 'yesterday', dayDone: 'yes', pendingActions: { waterAdded: 'a' } })
    expect(r.warning).toBeUndefined()
    expect(r.data).toEqual({ ...emptySave(), dex: ['balsam'] })
  })

  it('finished journals: missing in old saves becomes empty; valid ones kept, junk dropped', () => {
    expect(load({ v: 1, plant: null }).data.finished).toEqual({})
    const entry = {
      day: 1,
      dateKey: '2026-10-21',
      stage: 'seed',
      heightCm: 0,
      leaves: 0,
      actions: { waterAdded: 10, pellets: 0, bugsRemoved: 0, place: 'desk' },
      statuses: {},
    }
    const r = load({ v: 1, finished: { balsam: { journal: [entry, null] }, nope: { journal: [entry] }, bean: 'x', corn: { journal: [] } } })
    expect(r.warning).toBeUndefined()
    expect(r.data.finished).toEqual({ balsam: { journal: [entry] } })
    const code = importCode(exportCode(r.data))
    expect(code.ok && code.data.finished).toEqual({ balsam: { journal: [entry] } })
  })

  it('clamps and rounds bugs', () => {
    const d = sample()
    expect(load({ ...d, plant: { ...d.plant, bugs: -3 } }).data.plant!.bugs).toBe(0)
    expect(load({ ...d, plant: { ...d.plant, bugs: 2.6 } }).data.plant!.bugs).toBe(3)
  })

  it('dead plant with deathCause round-trips', () => {
    const d = sample()
    d.plant = { ...d.plant!, dead: true, deathCause: '물이 부족했어요' }
    expect(importCode(exportCode(d))).toEqual({ ok: true, data: d })
  })
})

describe('lastReport', () => {
  const load = (raw: unknown) => loadSave(memStorage({ 'plantlife.v1': JSON.stringify(raw) })).data
  const report = {
    statuses: { water: { level: 3, dir: null }, light: { level: 3, dir: null }, temp: { level: 3, dir: null }, nutrient: { level: 3, dir: null }, pest: { level: 4, dir: null } },
    healthDelta: 10,
    grew: true,
    stageChanged: false,
    died: false,
    newBugs: 1,
    heightDelta: 2,
  }

  it('emptySave has no report', () => {
    expect(emptySave().lastReport).toBeNull()
  })

  it('a valid report round-trips', () => {
    expect(load({ ...sample(), lastReport: report }).lastReport).toEqual(report)
  })

  it('an invalid or missing report becomes null', () => {
    expect(load({ ...sample(), lastReport: { ...report, heightDelta: 'x' } }).lastReport).toBeNull()
    expect(load({ ...sample(), lastReport: 5 }).lastReport).toBeNull()
    expect(load({ ...sample(), lastReport: { ...report, statuses: null } }).lastReport).toBeNull()
    const { lastReport: _r, ...old } = sample()
    expect(load(old).lastReport).toBeNull()
  })
})

describe('restore code', () => {
  const BAD = '코드가 맞지 않아요. 다시 확인해 주세요.'

  it('roundtrip', () => {
    const d = sample()
    const code = exportCode(d)
    expect(code.startsWith('PL1-')).toBe(true)
    const r = importCode(`  ${code}\n`)
    expect(r).toEqual({ ok: true, data: d })
  })

  it('bad restore code keeps current save', () => {
    for (const bad of ['', 'PL1-xyz', 'hello', 'PL1-' + 'A'.repeat(40)]) {
      expect(importCode(bad)).toEqual({ ok: false, message: BAD })
    }
    const v2 = 'PL1-' + exportCode({ ...sample(), v: 2 } as unknown as SaveData).slice(4)
    expect(importCode(v2)).toEqual({ ok: false, message: BAD })
    expect(importCode(null as unknown as string)).toEqual({ ok: false, message: BAD })
  })
})

describe('short code (for writing down)', () => {
  const BAD = '코드가 맞지 않아요. 다시 확인해 주세요.'
  const FORMAT = /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/

  /** What a short code brings back: plant (no history), dex, day gating, settings; no journal or past tries. */
  const expected = (d: SaveData): SaveData => ({
    ...emptySave(),
    plant: d.plant ? { ...d.plant, history: [] } : null,
    pendingActions: d.pendingActions,
    lastDayKey: d.lastDayKey,
    dayDone: d.dayDone,
    dex: d.dex,
    settings: d.settings,
  })

  function growingBean(): SaveData {
    const d = emptySave()
    d.plant = {
      ...newPlant('bean'),
      stageIndex: 2,
      growth: 1.5,
      health: 88,
      water: 47,
      nutrient: 35,
      lightExp: 78,
      place: 'window',
      bugs: 2,
      day: 5,
      heightCm: 4.5,
      leaves: 2,
      history: [{ water: { level: 4, dir: null }, light: { level: 3, dir: null }, temp: { level: 4, dir: null }, nutrient: { level: 3, dir: null }, pest: { level: 2, dir: 'high' } }],
    }
    d.pendingActions = { waterAdded: 25, pellets: 2, bugsRemoved: 1, place: 'window' }
    d.lastDayKey = '2026-10-22'
    d.dayDone = false
    d.dex = ['balsam', 'rice']
    d.settings = { sound: false, tutorialSeen: true }
    d.journal = [{ day: 4, dateKey: '2026-10-21', stage: 'leafStem', heightCm: 3, leaves: 1, actions: { waterAdded: 10, pellets: 0, bugsRemoved: 0, place: 'desk' }, statuses: d.plant.history[0] }]
    d.pastTries = [{ speciesId: 'corn', days: 3, stage: 'sprout', cause: '물이 부족해서 말라 버렸어요.' }]
    return d
  }

  it('is short, in 5 groups of 5, without I, L, O or U', () => {
    const code = shortCode(growingBean())
    expect(code.length).toBe(29)
    expect(code).toMatch(FORMAT)
  })

  it("keeps the day's pending water in steps of 5 (0..150), so the journal's 한 일 stays right", () => {
    const water = (w: number) => {
      const d = growingBean()
      d.pendingActions = { ...d.pendingActions!, waterAdded: w }
      const r = importCode(shortCode(d))
      return r.ok ? r.data.pendingActions?.waterAdded : undefined
    }
    expect(water(0)).toBe(0)
    expect(water(1.2)).toBe(5) // any watering is still a watering
    expect(water(23)).toBe(25)
    expect(water(42)).toBe(40)
    expect(water(150)).toBe(150)
    expect(water(400)).toBe(150)
  })

  it('still reads an older 24-letter code (format 1, written before the water amount was kept)', () => {
    const r = importCode('8MRP-1F4E-E0G5-2T43-8H4W-15NG')
    const d = growingBean()
    expect(r).toEqual({ ok: true, data: expected({ ...d, pendingActions: { ...d.pendingActions!, waterAdded: 1 } }) })
    // and a typo in it is still caught
    expect(importCode('8MRP-1F4E-E0G5-2T43-8H4W-15NH')).toEqual({ ok: false, message: BAD })
  })

  it('round-trips an in-progress plant with its dex, day and settings (journal and past tries are not kept)', () => {
    const d = growingBean()
    const r = importCode(shortCode(d))
    expect(r).toEqual({ ok: true, data: expected(d) })
  })

  it('round-trips a dead plant with its cause', () => {
    const d = emptySave()
    d.plant = { ...newPlant('corn'), stageIndex: 3, health: 0, water: 0, day: 7, heightCm: 6, leaves: 3, dead: true, deathCause: '물이 부족해서 말라 버렸어요.' }
    d.lastDayKey = '2026-10-23'
    d.dayDone = true
    d.dex = ['corn']
    expect(importCode(shortCode(d))).toEqual({ ok: true, data: expected(d) })
  })

  it('round-trips a perennial planted in the yard, and a save without a plant', () => {
    const d = emptySave()
    d.plant = { ...newPlant('apple'), stageIndex: 5, growth: 0.25, place: 'yardSunny', water: 62, nutrient: 50, lightExp: 90, day: 12, heightCm: 22.5, leaves: 11 }
    d.lastDayKey = '2027-03-02'
    d.dex = ['balsam', 'bean', 'morningGlory', 'rice', 'corn', 'apple', 'dandelion', 'forsythia', 'persimmon']
    expect(importCode(shortCode(d))).toEqual({ ok: true, data: expected(d) })
    const none = { ...emptySave(), dex: ['bean' as const] }
    expect(importCode(shortCode(none))).toEqual({ ok: true, data: expected(none) })
  })

  it('accepts lower case, spaces, missing dashes and O/I/L for 0/1', () => {
    const d = growingBean()
    const code = shortCode(d)
    const sloppy = ` ${code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l')} `
    expect(importCode(sloppy)).toEqual({ ok: true, data: expected(d) })
    expect(importCode(code.replace(/-/g, ''))).toEqual({ ok: true, data: expected(d) })
  })

  it('a typo (one wrong letter, two swapped letters, one missing) is rejected with the friendly message', () => {
    const code = shortCode(growingBean())
    const chars = code.replace(/-/g, '').split('')
    const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < chars.length; i++) {
      for (const c of ALPHA) {
        if (c === chars[i]) continue
        const typo = [...chars]
        typo[i] = c
        expect(importCode(typo.join(''))).toEqual({ ok: false, message: BAD })
      }
      if (i + 1 < chars.length && chars[i] !== chars[i + 1]) {
        const swapped = [...chars]
        ;[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]]
        expect(importCode(swapped.join(''))).toEqual({ ok: false, message: BAD })
      }
    }
    expect(importCode(chars.slice(1).join(''))).toEqual({ ok: false, message: BAD })
    expect(importCode(code + 'U')).toEqual({ ok: false, message: BAD })
  })

  it('the long code still restores everything', () => {
    const d = growingBean()
    expect(importCode(exportCode(d))).toEqual({ ok: true, data: { ...d, finished: {} } })
  })
})

describe('requestPersist', () => {
  it('never throws', async () => {
    await expect(requestPersist()).resolves.toBeUndefined()
  })
})
