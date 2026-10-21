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

  test('only the teacher-approved species are approved in the shipped table', () => {
    expect(approvedJson).toEqual({ balsam: true })
    expect(isApproved('balsam')).toBe(true)
    expect(isApproved('bean')).toBe(false)
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

  test('74 pictures: 62 plant stages, 4 pots, 6 backgrounds, 2 bugs, no duplicate paths', () => {
    expect(rows).toHaveLength(74)
    expect(paths.size).toBe(74)
    expect(rows.filter((r) => r.path.startsWith('public/plants/'))).toHaveLength(62)
    expect(rows.filter((r) => r.path.startsWith('public/pots/'))).toHaveLength(4)
    expect(rows.filter((r) => r.path.startsWith('public/bg/'))).toHaveLength(6)
    expect(rows.filter((r) => r.path.startsWith('public/bugs/'))).toHaveLength(2)
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
