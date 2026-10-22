import { describe, expect, it } from 'vitest'
import { careTasks } from '../../src/sim/care'
import { endDay, newPlant } from '../../src/sim/day'
import { seedFor } from '../../src/sim/rng'
import { SPECIES } from '../../src/sim/species'
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

  const v2Entry = {
    day: 3,
    dateKey: '2026-10-21',
    stage: 'sprout',
    heightCm: 1.5,
    leaves: 2,
    actions: { waterAdded: 10, pellets: 0, bugsRemoved: 0, place: 'desk', care: ['thin'], tied: false },
    statuses: {},
    measuredCm: 1.5,
    measureHelped: true,
    observed: 'leaves',
    weather: { kind: 'heat', prepared: true },
  }

  it('journal entries keep measured height, observation and weather; bad values drop only that field', () => {
    const r = load({ v: 1, journal: [v2Entry] })
    expect(r.data.journal).toEqual([v2Entry])
    const bads: Record<string, unknown[]> = {
      measuredCm: ['3', NaN, null],
      measureHelped: ['yes', 1],
      observed: [5, {}],
      weather: ['heat', { kind: 'snow', prepared: true }, { kind: 'rain', prepared: 'no' }, { kind: 'rain' }],
    }
    for (const [key, values] of Object.entries(bads)) {
      for (const bad of values) {
        const j = load({ v: 1, journal: [{ ...v2Entry, [key]: bad }] }).data.journal
        expect(j.length, `${key} ${String(bad)}`).toBe(1)
        expect(key in j[0], `${key} ${String(bad)}`).toBe(false)
        const { [key as keyof typeof v2Entry]: _drop, ...rest } = v2Entry
        expect(j[0]).toEqual(rest)
      }
    }
    // the day's care and tie-down are kept in the entry's actions; junk drops only that field
    const a = load({ v: 1, journal: [{ ...v2Entry, actions: { ...v2Entry.actions, care: ['dance'], tied: 'yes' } }] }).data.journal[0]
    expect(a.actions).toEqual({ waterAdded: 10, pellets: 0, bugsRemoved: 0, place: 'desk' })
    // and all of it survives the long code
    const code = importCode(exportCode(r.data))
    expect(code.ok && code.data.journal).toEqual([v2Entry])
  })

  it("pending actions keep today's care and tie-down", () => {
    const pend = { waterAdded: 5, pellets: 1, bugsRemoved: 0, place: 'window', care: ['sow', 'thin'], tied: true }
    expect(load({ v: 1, pendingActions: pend }).data.pendingActions).toEqual(pend)
    expect(load({ v: 1, pendingActions: { ...pend, care: 'sow', tied: 1 } }).data.pendingActions).toEqual({ waterAdded: 5, pellets: 1, bugsRemoved: 0, place: 'window' })
    expect(load({ v: 1, pendingActions: { ...pend, care: ['sow', 7] } }).data.pendingActions).toEqual({ waterAdded: 5, pellets: 1, bugsRemoved: 0, place: 'window', tied: true })
  })

  it('finished journal and past tries keep their mode', () => {
    const tries = [
      { speciesId: 'bean', days: 4, stage: 'seed', cause: 'x', mode: 'quick' },
      { speciesId: 'corn', days: 2, stage: 'sprout', cause: 'y', mode: 'fast' },
      { speciesId: 'rice', days: 1, stage: 'seed', cause: 'z' },
    ]
    const r = load({ v: 1, pastTries: tries, finished: { balsam: { journal: [v2Entry], mode: 'quick' }, bean: { journal: [v2Entry], mode: 3 }, rice: { journal: [v2Entry] } } })
    expect(r.data.pastTries).toEqual([tries[0], { speciesId: 'corn', days: 2, stage: 'sprout', cause: 'y' }, tries[2]])
    expect(r.data.finished).toEqual({ balsam: { journal: [v2Entry], mode: 'quick' }, bean: { journal: [v2Entry] }, rice: { journal: [v2Entry] } })
    const code = importCode(exportCode(r.data))
    expect(code.ok && code.data).toEqual(r.data)
  })

  it('pendingObs round-trips and junk becomes null', () => {
    expect(emptySave().pendingObs).toBeNull()
    expect(load({ v: 1, plant: null }).data.pendingObs).toBeNull()
    const obs = { measuredCm: 2.5, measureHelped: false, observed: 'flower' }
    const r = load({ v: 1, pendingObs: obs })
    expect(r.data.pendingObs).toEqual(obs)
    const code = importCode(exportCode(r.data))
    expect(code.ok && code.data.pendingObs).toEqual(obs)
    for (const junk of ['x', 5, [obs], true]) expect(load({ v: 1, pendingObs: junk }).data.pendingObs, String(junk)).toBeNull()
    expect(load({ v: 1, pendingObs: { measuredCm: 'tall', measureHelped: false, observed: 3 } }).data.pendingObs).toEqual({ measureHelped: false })
    expect(load({ v: 1, pendingObs: {} }).data.pendingObs).toEqual({})
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

  /** A plant as v1 saved it: no mode, care or weather fields. */
  function v1Plant(over: Record<string, unknown> = {}): Record<string, unknown> {
    const p: Record<string, unknown> = { ...newPlant('morningGlory'), ...over }
    for (const k of ['mode', 'careDone', 'weatherSeed', 'weatherFrom']) delete p[k]
    return p
  }

  it('v1 plant loads as daily with its stage care done', () => {
    // morning glory in leafStem, almost at the next stage, watered on day 6
    const raw = { ...sample(), plant: v1Plant({ stageIndex: 2, growth: 3.5, day: 6, heightCm: 6, leaves: 4 }) }
    const p = load(raw).data.plant!
    expect(p).toMatchObject({ speciesId: 'morningGlory', stageIndex: 2, growth: 3.5, mode: 'daily', careDone: 1, weatherFrom: 7 })
    expect(Number.isInteger(p.weatherSeed)).toBe(true)
    expect(p.weatherSeed).toBeGreaterThanOrEqual(0)
    expect(p.weatherSeed).toBeLessThanOrEqual(255)
    // loading the same save twice gives the same seed (also through the long code)
    expect(load(raw).data.plant!.weatherSeed).toBe(p.weatherSeed)
    const code = importCode(exportCode(raw as unknown as SaveData))
    expect(code.ok && code.data.plant).toEqual(p)
    // every stage counts its care as done, also a stage without care
    expect(load({ ...raw, plant: v1Plant({ stageIndex: 0 }) }).data.plant!.careDone).toBe(1)
    expect(load({ ...raw, plant: v1Plant({ stageIndex: 5 }) }).data.plant!.careDone).toBe(0) // seedDone
    const dandelion = load({ ...raw, plant: v1Plant({ speciesId: 'dandelion', stageIndex: 3 }) }).data.plant!
    expect(dandelion.careDone).toBe(0) // grownTree: nothing to do
    // and the next ideal day moves the stage on as in v1
    const next = endDay(p, { waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'window' }, () => 0.99)
    expect(next.report.waiting).toBeFalsy()
    expect(next.report.stageChanged).toBe(true)
    expect(next.state).toMatchObject({ stageIndex: 3, careDone: 0 })
  })

  it('a v2 plant keeps its fields; junk becomes defaults', () => {
    const d = sample()
    d.plant = { ...newPlant('bean', { mode: 'quick', weatherSeed: 77 }), stageIndex: 3, growth: 4, careDone: 1, weatherFrom: 2, day: 8 }
    expect(load(d).data.plant).toEqual(d.plant)
    const junk = load({ ...d, plant: { ...d.plant, careDone: 'x', weatherSeed: 300, weatherFrom: 1.5 } }).data.plant!
    expect(junk).toMatchObject({ mode: 'quick', careDone: 0, weatherSeed: 0, weatherFrom: 2 })
    for (const bad of [-1, 2, 0.5, NaN]) {
      expect(load({ ...d, plant: { ...d.plant, careDone: bad } }).data.plant!.careDone, String(bad)).toBe(0)
    }
    for (const bad of [-1, 256, 3.5, '7']) {
      expect(load({ ...d, plant: { ...d.plant, weatherSeed: bad } }).data.plant!.weatherSeed, String(bad)).toBe(0)
    }
    for (const bad of [0, 1, 2.5, null]) {
      expect(load({ ...d, plant: { ...d.plant, weatherFrom: bad } }).data.plant!.weatherFrom, String(bad)).toBe(2)
    }
    // a mode that is there but not one of the two is read as daily (not as a v1 plant)
    const odd = load({ ...d, plant: { ...d.plant, mode: 'fast' } }).data.plant!
    expect(odd).toMatchObject({ mode: 'daily', careDone: 1, weatherSeed: 77, weatherFrom: 2 })
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

  it('keeps waiting and weather; bad values drop only that field', () => {
    const v2 = { ...report, grew: false, waiting: true, weather: { kind: 'typhoon', prepared: false } }
    expect(load({ ...sample(), lastReport: v2 }).lastReport).toEqual(v2)
    expect(load({ ...sample(), lastReport: { ...v2, waiting: 'yes' } }).lastReport).toEqual({ ...report, grew: false, weather: v2.weather })
    expect(load({ ...sample(), lastReport: { ...v2, weather: { kind: 'snow', prepared: true } } }).lastReport).toEqual({ ...report, grew: false, waiting: true })
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
  const BAD = '기록 코드가 맞지 않아요. 다시 확인해 주세요.'

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
  const BAD = '기록 코드가 맞지 않아요. 다시 확인해 주세요.'
  const FORMAT = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){6}$/

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
  /** Formats 1 and 2 carry no mode, care or weather fields, so the plant comes back as a v1 plant does. */
  const asV1 = (p: NonNullable<SaveData['plant']>) => ({
    ...p,
    mode: 'daily' as const,
    careDone: careTasks(p.speciesId, SPECIES[p.speciesId].stages[p.stageIndex]).length,
    weatherSeed: seedFor(0, p.speciesId) & 255,
    weatherFrom: p.day + 1,
  })
  const expectedV1 = (d: SaveData): SaveData => {
    const e = expected(d)
    return { ...e, plant: e.plant ? asV1(e.plant) : null }
  }

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

  it('is 28 letters in 7 groups of 4 without I, L, O or U', () => {
    const code = shortCode(growingBean())
    expect(code.replace(/-/g, '').length).toBe(28)
    expect(code.length).toBe(34)
    expect(code).toMatch(FORMAT)
  })

  it('format 3 keeps a plant waiting on its care', () => {
    // a quick-mode bean at the leafStem threshold, its stake not done yet, tied down for a typhoon today
    const d = growingBean()
    d.plant = { ...d.plant!, mode: 'quick', growth: 4, careDone: 0, weatherSeed: 201 }
    d.pendingActions = { ...d.pendingActions!, tied: true }
    expect(importCode(shortCode(d))).toEqual({ ok: true, data: expected(d) })
    // and the other way round: daily, care done, not tied
    const e = growingBean()
    e.plant = { ...e.plant!, careDone: 1, weatherSeed: 255 }
    expect(importCode(shortCode(e))).toEqual({ ok: true, data: expected(e) })
  })

  it('format 3 keeps when the weather starts (a new plant from day 2, a v1 plant from the day after the update)', () => {
    const at = (day: number, weatherFrom: number) => {
      const d = growingBean()
      d.plant = { ...d.plant!, day, weatherFrom }
      const r = importCode(shortCode(d))
      return r.ok ? r.data.plant!.weatherFrom : undefined
    }
    expect(at(1, 2)).toBe(2)
    expect(at(30, 2)).toBe(2)
    expect(at(6, 7)).toBe(7) // updated today: no weather before tomorrow
    expect(at(9, 7)).toBe(7)
    expect(at(11, 7)).toBe(7)
    // weather that started long ago only has to have started: today and later stay the same
    const far = at(40, 7)!
    expect(far).toBeGreaterThanOrEqual(2)
    expect(far).toBeLessThanOrEqual(40)
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

  it('still reads format 1 and format 2 codes as daily v1 plants', () => {
    const d = growingBean()
    // format 1 (24 letters, written before the water amount was kept)
    expect(importCode('8MRP-1F4E-E0G5-2T43-8H4W-15NG')).toEqual({ ok: true, data: expectedV1({ ...d, pendingActions: { ...d.pendingActions!, waterAdded: 1 } }) })
    expect(importCode('8MRP-1F4E-E0G5-2T43-8H4W-15NH')).toEqual({ ok: false, message: BAD })
    // format 2 (25 letters in 5 groups of 5)
    expect(importCode('GMRP1-F4EE0-G52T4-2AH29-R2A4F')).toEqual({ ok: true, data: expectedV1(d) })
    expect(importCode('GMRP1-F4EE0-G52T4-2AH29-R2A4G')).toEqual({ ok: false, message: BAD })
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
    d.plant = { ...newPlant('apple', { mode: 'quick', weatherSeed: 9 }), stageIndex: 5, growth: 0.25, place: 'yardSunny', water: 62, nutrient: 50, lightExp: 90, day: 12, heightCm: 22.5, leaves: 11 }
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
    const d = growingBean()
    d.plant = { ...d.plant!, mode: 'quick', growth: 4, weatherSeed: 201 }
    d.pendingActions = { ...d.pendingActions!, tied: true }
    const code = shortCode(d)
    const chars = code.replace(/-/g, '').split('')
    expect(chars.length).toBe(28)
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
