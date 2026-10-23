import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import lens from '../../public/lens.json'
import { OBSERVATIONS, type ObsPart } from '../../src/data/observations'
import { fullHeightCm } from '../../src/sim/measure'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import { lensArt } from '../../src/ui/art'
import { seedSpots } from '../../src/ui/care/Sow'
import { Magnifier, lensPlacement } from '../../src/ui/observe/Magnifier'
import { plantLayout } from '../../src/ui/PlantView'

// scene sizes of the 6 e2e viewports, with and without the '오늘 할 일' band (as in observe.test.tsx)
const SCENES: [number, number][] = [
  [746, 584], [832, 550], [936, 416], [918, 518], [764, 632], [712, 565],
  [746, 516], [832, 482], [936, 358], [918, 450],
]
const IDS = Object.keys(SPECIES) as SpeciesId[]

/** Every species and stage that has magnifier sentences, at a height inside the stage, where it would stand. */
type Case = { id: SpeciesId; stage: StageId; part: ObsPart; heightCm: number; place: 'yardSunny' | 'desk' }

function cases(): Case[] {
  const out: Case[] = []
  for (const id of IDS) {
    const sp = SPECIES[id]
    sp.stages.forEach((stage, i) => {
      const set = OBSERVATIONS[id][stage]
      if (!set) return
      const tree = sp.transplant && i >= sp.stages.indexOf('grownTree')
      const heightCm = stage === 'seed' ? 0 : (fullHeightCm(id, tree) * (i + 0.5)) / sp.stages.length
      out.push({ id, stage, part: set.part, heightCm, place: tree ? ('yardSunny' as const) : ('desk' as const) })
    })
  }
  return out
}

describe('the magnifier frame', () => {
  test('the frame picture has a see-through lens circle inside it', () => {
    const a = lensArt()
    expect(a.src.endsWith('props/magnifier-lens.webp')).toBe(true)
    expect(a).toMatchObject({ w: lens.w, h: lens.h, cx: lens.cx, cy: lens.cy, r: lens.r })
    expect(lens.r).toBeGreaterThan(0.15 * Math.max(lens.w, lens.h))
    expect(lens.cx - lens.r).toBeGreaterThan(0)
    expect(lens.cy - lens.r).toBeGreaterThan(0)
    // the handle goes down to the right: more picture right of and below the lens than left of and above it
    expect(lens.w - lens.cx).toBeGreaterThan(lens.cx)
    expect(lens.h - lens.cy).toBeGreaterThan(lens.cy)
  })

  test('held over the part: whole frame in the scene, lens on the part unless the edge pushes it, the part in the middle of the lens', () => {
    for (const [W, H] of SCENES)
      for (const c of cases()) {
        const L = plantLayout(W, H, { speciesId: c.id, stage: c.stage, heightCm: c.heightCm, place: c.place, health: 90 })
        const m = lensPlacement(L, c.id, c.stage, c.part)
        const label = `${W}x${H} ${c.id}/${c.stage}`
        // the target: the part's scene point; a seed: the middle seed spot in the soil
        if (c.part === 'seed') expect(m.target, label).toEqual([seedSpots(L)[1].x, seedSpots(L)[1].y])
        // size: the old rule (150..260 px), smaller only to keep the frame inside a low scene
        expect(m.D, label).toBeLessThanOrEqual(260)
        expect(m.D, label).toBeGreaterThanOrEqual(Math.min(150, ((H - 8) * 2 * lens.r) / lens.h) - 1e-6)
        // the frame (handle too) is inside the scene
        const f = m.frame
        expect(f.left, label).toBeGreaterThanOrEqual(0)
        expect(f.top, label).toBeGreaterThanOrEqual(0)
        expect(f.left + f.width, label).toBeLessThanOrEqual(W + 1e-6)
        expect(f.top + f.height, label).toBeLessThanOrEqual(H + 1e-6)
        // the frame's hole is the lens circle
        const k = f.width / lens.w
        expect(f.left + lens.cx * k, label).toBeCloseTo(m.center[0], 6)
        expect(f.top + lens.cy * k, label).toBeCloseTo(m.center[1], 6)
        expect(lens.r * k * 2, label).toBeCloseTo(m.D, 6)
        // on the part, or pushed in only as far as an edge needs (the frame then touches that edge)
        const [dx, dy] = [m.center[0] - m.target[0], m.center[1] - m.target[1]]
        const edge = 4 + 1e-6
        if (Math.abs(dx) > 1e-6) expect(Math.min(f.left, W - f.left - f.width), label).toBeLessThanOrEqual(edge)
        if (Math.abs(dy) > 1e-6) expect(Math.min(f.top, H - f.top - f.height), label).toBeLessThanOrEqual(edge)
        // the zoomed picture shows the looked-at point in the middle of the lens
        expect(m.img.left + m.at[0] * m.zoom, label).toBeCloseTo(m.D / 2, 6)
        expect(m.img.top + m.at[1] * m.zoom, label).toBeCloseTo(m.D / 2, 6)
      }
  })

  test('mostly right on the part in a 1194x834 scene', () => {
    let on = 0
    let all = 0
    for (const c of cases()) {
      const L = plantLayout(746, 584, { speciesId: c.id, stage: c.stage, heightCm: c.heightCm, place: c.place, health: 90 })
      const m = lensPlacement(L, c.id, c.stage, c.part)
      all++
      // the part is still under the glass
      if (Math.hypot(m.center[0] - m.target[0], m.center[1] - m.target[1]) <= m.D / 2) on++
    }
    expect(on / all).toBeGreaterThan(0.8)
  })

  test('draws the clay frame over a round picture; no guide line, no ring on the plant', () => {
    const L = plantLayout(746, 584, { speciesId: 'bean', stage: 'leafStem', heightCm: 7.4, place: 'desk', health: 90 })
    const { container } = render(<Magnifier L={L} speciesId="bean" stage="leafStem" part="leaf" />)
    const frame = container.querySelector('img.obs-lens-frame') as HTMLImageElement
    expect(frame.getAttribute('src')).toMatch(/props\/magnifier-lens\.webp$/)
    const glass = container.querySelector('.obs-lens') as HTMLElement
    expect(glass.querySelector('img')!.getAttribute('src')).toMatch(/plants\/bean\/leafStem\.webp$/)
    // the round picture comes first, the frame on top of it
    expect(glass.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.obs-mag-guide')).toBeNull()
    expect(container.querySelector('.obs-lens-handle')).toBeNull()
  })
})
