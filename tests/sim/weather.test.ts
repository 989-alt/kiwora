import { describe, expect, it } from 'vitest'
import { newPlant } from '../../src/sim/day'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { DayActions, Place, PlantState, WeatherId } from '../../src/sim/types'
import {
  newWeatherSeed, todayWeather, weatherCandidates, weatherEvents, weatherHit, weatherOn,
} from '../../src/sim/weather'

const SEEDS = Array.from({ length: 256 }, (_, i) => i)

function at(id: SpeciesId, stage: StageId, over: Partial<PlantState> = {}): PlantState {
  return { ...newPlant(id), stageIndex: SPECIES[id].stages.indexOf(stage), ...over }
}

const did = (over: Partial<DayActions> = {}): DayActions => ({
  waterAdded: 0, pellets: 0, bugsRemoved: 0, place: 'desk', ...over,
})

/** The first event of a seed matching `pred`, with its seed. */
function findEvent(pred: (e: { start: number; len: number; roll: number }) => boolean) {
  for (const seed of SEEDS) {
    const e = weatherEvents(seed).find(pred)
    if (e) return { seed, e }
  }
  throw new Error('no such event')
}

describe('weather schedule', () => {
  it('events are 2~3 days apart and never before day 2', () => {
    for (const seed of SEEDS) {
      const ev = weatherEvents(seed)
      expect(ev.length, String(seed)).toBeGreaterThan(0)
      expect([2, 3], String(seed)).toContain(ev[0].start)
      for (let i = 0; i < ev.length; i++) {
        expect([1, 2, 3]).toContain(ev[i].len)
        expect(ev[i].roll).toBeGreaterThanOrEqual(0)
        expect(ev[i].roll).toBeLessThan(1)
        expect(ev[i].start).toBeLessThanOrEqual(255)
        if (i > 0) {
          // at least one calm day between events, at most two
          const gap = ev[i].start - (ev[i - 1].start + ev[i - 1].len)
          expect([1, 2], `${seed} #${i}`).toContain(gap)
          if (ev[i - 1].len === 1) expect([2, 3]).toContain(ev[i].start - ev[i - 1].start)
        }
      }
    }
    // weather never comes on day 1, whatever the seed and stage
    for (const seed of SEEDS) {
      expect(weatherOn(at('balsam', 'sprout', { weatherSeed: seed, weatherFrom: 0 }), 1)).toBeNull()
    }
  })

  it('same seed same weather', () => {
    expect(weatherEvents(77)).toEqual(weatherEvents(77))
    const a = at('bean', 'flower', { weatherSeed: 77 })
    const b = JSON.parse(JSON.stringify(a)) as PlantState
    for (let d = 1; d < 40; d++) expect(weatherOn(b, d)).toBe(weatherOn(a, d))
    // and a different seed gives a different schedule
    expect(weatherEvents(78)).not.toEqual(weatherEvents(77))
  })

  it('no weather for dead or finished plants', () => {
    for (const seed of SEEDS.slice(0, 32)) {
      const dead = at('bean', 'flower', { weatherSeed: seed, dead: true })
      const done = at('bean', 'seedDone', { weatherSeed: seed })
      const tree = at('apple', 'newShoot', { weatherSeed: seed, place: 'yardSunny' })
      for (let d = 1; d < 30; d++) {
        expect(weatherOn(dead, d)).toBeNull()
        expect(weatherOn(done, d)).toBeNull()
        expect(weatherOn(tree, d)).toBeNull()
      }
    }
    expect(weatherCandidates(at('bean', 'seedDone'))).toEqual([])
    expect(weatherCandidates(at('apple', 'newShoot', { place: 'yardSunny' }))).toEqual([])
  })

  it('seed stage has none', () => {
    for (const id of Object.keys(SPECIES) as SpeciesId[]) {
      const s = at(id, 'seed')
      expect(weatherCandidates(s), id).toEqual([])
      for (const seed of SEEDS.slice(0, 32)) {
        for (let d = 1; d < 10; d++) expect(weatherOn({ ...s, weatherSeed: seed }, d)).toBeNull()
      }
    }
  })

  it('weatherFrom delays the first weather', () => {
    // a v1 plant loaded on day 6 gets weatherFrom 7: no weather today, weather may come from tomorrow on
    const { seed, e } = findEvent((ev) => ev.start === 6 && ev.len === 1)
    const v1 = at('balsam', 'sprout', { weatherSeed: seed, day: 6, weatherFrom: 7 })
    expect(weatherOn(v1, 6)).toBeNull()
    expect(weatherOn({ ...v1, weatherFrom: 6 }, 6)).not.toBeNull()
    // the next event still comes as scheduled
    const next = weatherEvents(seed).find((ev) => ev.start > e.start)!
    expect(weatherOn(v1, next.start)).not.toBeNull()
    // a new plant's weather starts on day 2 at the earliest
    expect(newPlant('balsam').weatherFrom).toBe(2)
  })

  it('a tree about to be transplanted gets the yard forecast', () => {
    for (const place of ['window', 'desk'] as Place[]) {
      expect(weatherCandidates(at('apple', 'grownTree', { place }))).toEqual(['heat', 'rain'])
      expect(weatherCandidates(at('apple', 'fruit', { place }))).toEqual(['rain', 'typhoon', 'monsoon'])
    }
    expect(weatherCandidates(at('apple', 'grownTree', { place: 'yardSunny' }))).toEqual(['heat', 'rain'])
    expect(weatherCandidates(at('apple', 'flower', { place: 'yardSunny' }))).toEqual(['rain', 'typhoon', 'monsoon'])
    expect(weatherCandidates(at('persimmon', 'winter', { place: 'yardPartial' }))).toEqual(['frost'])
    // before grownTree the tree is still indoors
    expect(weatherCandidates(at('apple', 'leafStem', { place: 'window' }))).toEqual(['heat', 'cold'])
  })

  it('indoor candidates follow the stage', () => {
    expect(weatherCandidates(at('bean', 'sprout'))).toEqual(['heat', 'cold'])
    expect(weatherCandidates(at('bean', 'leafStem'))).toEqual(['heat', 'cold'])
    expect(weatherCandidates(at('bean', 'flower'))).toEqual(['heat', 'monsoon'])
    expect(weatherCandidates(at('bean', 'fruit'))).toEqual(['heat', 'monsoon'])
    expect(weatherCandidates(at('dandelion', 'grownTree'))).toEqual(['heat', 'cold'])
    expect(weatherCandidates(at('dandelion', 'winter'))).toEqual(['cold'])
  })

  it('monsoon lasts 2 or 3 days', () => {
    for (const len of [2, 3]) {
      const { seed, e } = findEvent((ev) => ev.len === len)
      const flower = at('bean', 'flower', { weatherSeed: seed })
      for (let d = e.start; d < e.start + len; d++) expect(weatherOn(flower, d)).toBe('monsoon')
      expect(weatherOn(flower, e.start - 1)).toBeNull()
      expect(weatherOn(flower, e.start + len)).toBeNull()
      // without monsoon among the candidates, a long event is one single day of weather
      const sprout = at('bean', 'sprout', { weatherSeed: seed })
      expect(['heat', 'cold']).toContain(weatherOn(sprout, e.start))
      for (let d = e.start + 1; d < e.start + len; d++) expect(weatherOn(sprout, d)).toBeNull()
    }
  })

  it('a single event never picks monsoon and spreads over the candidates', () => {
    const seen = new Set<WeatherId | null>()
    for (const seed of SEEDS) {
      const p = at('apple', 'flower', { weatherSeed: seed, place: 'yardSunny' })
      for (const e of weatherEvents(seed).slice(0, 5)) {
        if (e.len === 1) seen.add(weatherOn(p, e.start))
      }
    }
    expect([...seen].sort()).toEqual(['rain', 'typhoon'])
  })

  it('newWeatherSeed is an integer 0..255', () => {
    for (let i = 0; i < 200; i++) {
      const s = newWeatherSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(255)
    }
  })

  it('todayWeather judges the plant on its own day', () => {
    const { seed, e } = findEvent((ev) => ev.len === 2)
    const p = at('bean', 'flower', { weatherSeed: seed, day: e.start })
    expect(todayWeather(p, did())).toEqual({ kind: 'monsoon', prepared: true, hit: { water: 'ideal' } })
    expect(todayWeather({ ...p, day: e.start - 1 }, did())).toBeNull()
  })
})

describe('weatherHit', () => {
  it('heat indoors: off the window is prepared, the window gets 36° and double evaporation', () => {
    const s = at('balsam', 'leafStem')
    expect(weatherHit('heat', { ...s, place: 'desk' }, did())).toEqual({ prepared: true, hit: {} })
    expect(weatherHit('heat', { ...s, place: 'window' }, did({ place: 'window' }))).toEqual({
      prepared: false, hit: { tempAt: 36, evapScale: 2 },
    })
  })

  it('heat in the yard: enough water is prepared', () => {
    const s = at('apple', 'grownTree', { place: 'yardSunny' })
    expect(weatherHit('heat', { ...s, water: 50 }, did())).toEqual({ prepared: true, hit: {} })
    expect(weatherHit('heat', { ...s, water: 49 }, did())).toEqual({ prepared: false, hit: { tempAt: 36, evapScale: 2 } })
  })

  it('rain: no watering is prepared and waters to the ideal; watering overwaters', () => {
    const s = at('apple', 'grownTree', { place: 'yardSunny' })
    expect(weatherHit('rain', s, did())).toEqual({ prepared: true, hit: { water: 'ideal' } })
    expect(weatherHit('rain', s, did({ waterAdded: 5 }))).toEqual({ prepared: false, hit: { water: 'over' } })
  })

  it('monsoon: no watering and no bugs is prepared', () => {
    const yard = at('apple', 'flower', { place: 'yardSunny' })
    const room = at('bean', 'flower')
    expect(weatherHit('monsoon', yard, did())).toEqual({ prepared: true, hit: { water: 'ideal' } })
    expect(weatherHit('monsoon', room, did())).toEqual({ prepared: true, hit: { water: 'ideal' } })
    expect(weatherHit('monsoon', yard, did({ waterAdded: 10 }))).toEqual({ prepared: false, hit: { water: 'over' } })
    expect(weatherHit('monsoon', room, did({ waterAdded: 10 }))).toEqual({ prepared: false, hit: { evapScale: 0 } })
    expect(weatherHit('monsoon', { ...room, bugs: 2 }, did())).toEqual({
      prepared: false, hit: { water: 'ideal', pestBonus: 0.3 },
    })
  })

  it('typhoon: tying the tree is prepared, otherwise health drops 15', () => {
    const s = at('apple', 'flower', { place: 'yardSunny' })
    expect(weatherHit('typhoon', s, did({ tied: true }))).toEqual({ prepared: true, hit: {} })
    expect(weatherHit('typhoon', s, did())).toEqual({ prepared: false, hit: { healthHit: 15 } })
  })

  it('cold indoors: off the window is prepared, the window gets 8° (winter −12°)', () => {
    expect(weatherHit('cold', at('bean', 'sprout', { place: 'desk' }), did())).toEqual({ prepared: true, hit: {} })
    expect(weatherHit('cold', at('bean', 'sprout', { place: 'window' }), did())).toEqual({ prepared: false, hit: { tempAt: 8 } })
    expect(weatherHit('cold', at('dandelion', 'winter', { place: 'window' }), did())).toEqual({ prepared: false, hit: { tempAt: -12 } })
  })

  it('frost in the yard: the straw wrap (winter care) is prepared, otherwise −15°', () => {
    const s = at('apple', 'winter', { place: 'yardSunny' })
    expect(weatherHit('frost', { ...s, careDone: 1 }, did())).toEqual({ prepared: true, hit: {} })
    expect(weatherHit('frost', { ...s, careDone: 0 }, did())).toEqual({ prepared: false, hit: { tempAt: -15 } })
  })
})
