import { describe, expect, test } from 'vitest'
import { OBSERVATIONS, observeChoices } from '../../src/data/observations'
import { fullHeightCm, measureAnswer, rulerChoices, rulerTicks } from '../../src/sim/measure'
import { SPECIES, type SpeciesId } from '../../src/sim/species'

const IDS = Object.keys(SPECIES) as SpeciesId[]
// pictographs, dingbats, symbols and the variation selector: none of them may be in a sentence
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u

describe('ruler', () => {
  test('ruler choices contain the answer, are distinct and at least 1', () => {
    for (let h = 0.4; h <= 60; h = Math.round((h + 0.1) * 10) / 10) {
      for (const seed of [0, 1, 7, 123456, 0xffffffff]) {
        const c = rulerChoices(h, seed)
        const label = `${h} cm, seed ${seed}`
        expect(c, label).toHaveLength(3)
        expect(c, label).toContain(measureAnswer(h))
        expect(new Set(c).size, label).toBe(3)
        expect([...c].sort((a, b) => a - b), label).toEqual(c)
        for (const v of c) {
          expect(Number.isInteger(v), label).toBe(true)
          expect(v, label).toBeGreaterThanOrEqual(1)
        }
        // 2 cm apart under 10 cm, 5 cm apart from 10 cm on
        const gap = h < 10 ? 2 : 5
        expect([c[1] - c[0], c[2] - c[1]], label).toEqual([gap, gap])
      }
    }
  })

  test('the seed moves where the answer sits among the choices', () => {
    const at = new Set<number>()
    for (let seed = 0; seed < 50; seed++) at.add(rulerChoices(20, seed).indexOf(20))
    expect([...at].sort()).toEqual([0, 1, 2])
    // a tiny plant can only have choices above it
    for (let seed = 0; seed < 20; seed++) expect(rulerChoices(1.2, seed)).toEqual([1, 3, 5])
  })

  test('tick steps by density', () => {
    expect(rulerTicks(15)).toEqual({ minor: 1, label: 5 })
    expect(rulerTicks(8)).toEqual({ minor: 1, label: 5 })
    expect(rulerTicks(7.9)).toEqual({ minor: 2, label: 5 })
    expect(rulerTicks(4)).toEqual({ minor: 2, label: 5 })
    expect(rulerTicks(3.9)).toEqual({ minor: 5, label: 10 })
    expect(rulerTicks(1)).toEqual({ minor: 5, label: 10 })
  })

  test('full-grown height: the top of the last stage the plant reaches in that place', () => {
    expect(fullHeightCm('bean', false)).toBe(24)
    expect(fullHeightCm('dandelion', false)).toBe(36)
    // a tree leaves the pot when it becomes a young tree, and grows on in the yard
    expect(fullHeightCm('apple', false)).toBe(18)
    expect(fullHeightCm('apple', true)).toBe(36)
  })
})

describe('observation sentences', () => {
  test('every species and stage has at least 2 true and 2 false sentences within 28 letters, no species name, no emoji', () => {
    const names = IDS.map((id) => SPECIES[id].name)
    for (const id of IDS) {
      for (const stage of SPECIES[id].stages) {
        const set = OBSERVATIONS[id][stage]
        const label = `${id}/${stage}`
        expect(set, label).toBeDefined()
        expect(set!.yes.length, label).toBeGreaterThanOrEqual(2)
        expect(set!.no.length, label).toBeGreaterThanOrEqual(2)
        if (stage === 'seed') expect(set!.part, label).toBe('seed')
        for (const s of [...set!.yes, ...set!.no]) {
          const l = `${label}: ${s}`
          expect(s.length, l).toBeLessThanOrEqual(28)
          expect(s.endsWith('요'), l).toBe(true)
          expect(EMOJI.test(s), l).toBe(false)
          for (const n of names) expect(s.includes(n), l).toBe(false)
          expect(s, l).toBe(s.trim())
        }
        // a sentence is never both true and false
        for (const y of set!.yes) expect(set!.no, `${label}: ${y}`).not.toContain(y)
        expect(new Set([...set!.yes, ...set!.no]).size, label).toBe(set!.yes.length + set!.no.length)
      }
    }
  })

  test('observe choices hold exactly one true sentence', () => {
    for (const id of IDS) {
      for (const stage of SPECIES[id].stages) {
        const set = OBSERVATIONS[id][stage]!
        const answers = new Set<string>()
        for (let seed = 0; seed < 40; seed++) {
          const { options, answer } = observeChoices(id, stage, seed)
          const label = `${id}/${stage} seed ${seed}`
          expect(options, label).toHaveLength(3)
          expect(new Set(options).size, label).toBe(3)
          expect(options.filter((o) => set.yes.includes(o)), label).toEqual([answer])
          expect(options.filter((o) => set.no.includes(o)), label).toHaveLength(2)
          expect(observeChoices(id, stage, seed), label).toEqual({ options, answer })
          answers.add(answer)
        }
        // the seed picks among the true sentences
        expect(answers.size, `${id}/${stage}`).toBeGreaterThan(1)
      }
    }
  })
})
