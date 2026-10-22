import { describe, expect, test } from 'vitest'
import approvedJson from '../../assets/approved.json'
import manifest from '../../assets/manifest.json'
import { isApproved } from '../../src/sim/approved'
import { SPECIES, type SpeciesId } from '../../src/sim/species'

describe('isApproved', () => {
  test('true only for species marked true in the approved table', () => {
    const table = { balsam: true }
    expect(isApproved('balsam', table)).toBe(true)
    expect(isApproved('rice', table)).toBe(false)
  })

  test('false is not approved', () => {
    expect(isApproved('bean', { bean: false })).toBe(false)
  })

  test('the shipped approved.json only names real species', () => {
    for (const id of Object.keys(approvedJson)) expect(SPECIES[id as SpeciesId]).toBeDefined()
  })

  test('every species is approved in the shipped table (all nine picture sets passed review)', () => {
    expect(Object.keys(approvedJson).sort()).toEqual(Object.keys(SPECIES).sort())
    for (const id of Object.keys(SPECIES) as SpeciesId[]) expect(isApproved(id), id).toBe(true)
  })
})

describe('manifest', () => {
  const rows = manifest as { path: string; prompt: string; aspect: string; transparent: boolean; species: string }[]
  const paths = new Set(rows.map((r) => r.path))

  test('covers every species stage', () => {
    for (const sp of Object.values(SPECIES)) {
      for (const stage of sp.stages) {
        expect(paths.has(`public/plants/${sp.id}/${stage}.webp`), `${sp.id}/${stage}`).toBe(true)
      }
    }
  })

  test('91 pictures: 62 plant stages, 4 pots, 6 backgrounds, 2 bugs, 11 props, 6 weather icons, no duplicate paths', () => {
    expect(rows).toHaveLength(91)
    expect(paths.size).toBe(91)
    expect(rows.filter((r) => r.path.startsWith('public/plants/'))).toHaveLength(62)
    expect(rows.filter((r) => r.path.startsWith('public/pots/'))).toHaveLength(4)
    expect(rows.filter((r) => r.path.startsWith('public/bg/'))).toHaveLength(6)
    expect(rows.filter((r) => r.path.startsWith('public/bugs/'))).toHaveLength(2)
    expect(rows.filter((r) => r.path.startsWith('public/props/'))).toHaveLength(11)
    expect(rows.filter((r) => r.path.startsWith('public/weather/'))).toHaveLength(6)
  })

  test('prop and weather rows are 512 px transparent props with the no-text clause', () => {
    const props = rows.filter((r) => r.species === 'props') as (typeof rows[number] & { maxSide?: number })[]
    expect(props).toHaveLength(17)
    for (const r of props) {
      expect(r.maxSide, r.path).toBe(512)
      expect(r.aspect, r.path).toBe('1:1')
      expect(r.prompt, r.path).toMatch(/No text, no labels, no numbers\.$/)
    }
  })

  test('backgrounds are opaque, everything else is transparent', () => {
    for (const r of rows) expect(r.transparent, r.path).toBe(!r.path.startsWith('public/bg/'))
  })

  test('plant prompts forbid pot, soil and text', () => {
    for (const r of rows.filter((r) => r.path.startsWith('public/plants/'))) {
      expect(r.prompt, r.path).toMatch(/no pot/i)
      expect(r.prompt, r.path).toMatch(/no soil/i)
      expect(r.prompt, r.path).toMatch(/no text/i)
    }
  })
})
