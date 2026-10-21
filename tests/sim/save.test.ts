import { describe, expect, it } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { emptySave, exportCode, importCode, loadSave, requestPersist, writeSave, type SaveData } from '../../src/sim/save'

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

describe('requestPersist', () => {
  it('never throws', async () => {
    await expect(requestPersist()).resolves.toBeUndefined()
  })
})
