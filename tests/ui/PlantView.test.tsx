import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { fullHeightCm } from '../../src/sim/measure'
import { SPECIES, type SpeciesId, type StageId } from '../../src/sim/species'
import type { Place } from '../../src/sim/types'
import { PlantView, faceFor, plantLayout, plantLook, sceneLayout, stageScale, yardLayout } from '../../src/ui/PlantView'
import { DEFAULTS, bgArt, plantArt, potArt } from '../../src/ui/art'

const anchors = { bg: { window: DEFAULTS.bg }, pot: DEFAULTS.pot, plant: { default: DEFAULTS.plant } }

describe('faceFor', () => {
  test('maps health to the pot face', () => {
    expect(faceFor(80)).toBe('happy')
    expect(faceFor(75)).toBe('happy')
    expect(faceFor(74)).toBe('normal')
    expect(faceFor(50)).toBe('normal')
    expect(faceFor(49)).toBe('worried')
    expect(faceFor(25)).toBe('worried')
    expect(faceFor(20)).toBe('sick')
  })
})

describe('sceneLayout', () => {
  const sizes: [number, number][] = [
    [746, 586], // mockup scene
    [754, 600], // 1194×834 landscape
    [772, 560], // portrait, wider than the background
    [1000, 420], // very wide and short
    [600, 800], // tall and narrow
  ]

  test.each(sizes)('pot bottom stands on the background surface (%i×%i)', (W, H) => {
    const L = sceneLayout(W, H, 1)
    const surface = L.bg.y + anchors.bg.window.surfaceY * L.bg.scale
    expect(L.pot.y + anchors.pot.bottom * L.pot.scale).toBeCloseTo(surface, 6)
    // the surface line is inside the scene, so the pot is not cut off
    expect(surface).toBeGreaterThan(0)
    expect(surface).toBeLessThan(H)
    // background covers the scene
    expect(L.bg.x).toBeLessThanOrEqual(0)
    expect(L.bg.y).toBeLessThanOrEqual(0)
    expect(L.bg.x + L.bg.w).toBeGreaterThanOrEqual(W - 1e-6)
    expect(L.bg.y + L.bg.h).toBeGreaterThanOrEqual(H - 1e-6)
  })

  test.each(sizes)('stem base is buried 9 mockup-px below the soil line, under the pot front (%i×%i)', (W, H) => {
    for (const stageScale of [0.35, 0.65, 1]) {
      const L = sceneLayout(W, H, stageScale)
      const p = L.plant
      const stemBaseY = p.y + anchors.plant.default.stemY * p.scale
      const stemBaseX = p.x + anchors.plant.default.stemX * p.scale
      expect(stemBaseY - L.soilLine).toBeCloseTo(9 * L.unit, 6)
      // the pot front starts at the soil line, so the stem base is covered by it
      expect(L.pot.y + L.pot.frontClipTop).toBeCloseTo(L.soilLine, 6)
      expect(stemBaseY).toBeLessThan(L.pot.y + anchors.pot.bottom * L.pot.scale)
      // stem stands in the middle of the pot
      expect(stemBaseX).toBeCloseTo(L.pot.x + anchors.pot.cx * L.pot.scale, 6)
      // full-size plant stays inside the scene
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
  })

  test('mockup size reproduces compose.py numbers', () => {
    const L = sceneLayout(746, 586, 1)
    expect(L.pot.scale).toBeCloseTo(0.216, 2)
    expect(L.plant.scale).toBeCloseTo(0.22, 2)
    expect(L.pot.y + anchors.pot.bottom * L.pot.scale).toBeCloseTo(502, 0)
  })
})

describe('pot stands on the surface', () => {
  // scene px sizes of the 6 viewports, as tests/e2e/placement.spec.ts logs them
  const SCENES: [number, number][] = [
    [746, 584], // 1194×834
    [832, 550], // 1280×800
    [936, 416], // 1366×640
    [918, 518], // 1366×768
    [764, 632], // 820×1180
    [712, 565], // 768×1024
  ]
  for (const [W, H] of SCENES)
    for (const place of ['window', 'desk', 'shade'] as const)
      test(`${place} ${W}x${H}`, () => {
        const a = bgArt(place).a
        const L = sceneLayout(W, H, 0.65, { ...DEFAULTS, bg: a, pot: potArt('happy').a })
        const bottom = L.pot.y + potArt('happy').a.bottom * L.pot.scale
        expect(bottom).toBeGreaterThanOrEqual(L.bg.y + a.standTop! * L.bg.scale)
        expect(bottom).toBeLessThanOrEqual(L.bg.y + a.standBottom! * L.bg.scale)
        expect(bottom).toBeLessThanOrEqual(H)
      })
})

describe('PlantView', () => {
  test('stacks bg, shadow, pot back, plant, pot front in that order', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="flower" health={90} lightLow={false} place="window" />,
    )
    const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
    expect(layers).toEqual(['bg', 'shadow', 'pot-back', 'plant', 'pot-front'])
    const front = container.querySelector('[data-layer="pot-front"]') as HTMLImageElement
    expect(front.getAttribute('src')).toBe('/pots/happy.webp')
    expect(front.style.clipPath).toMatch(/^inset\(/)
  })

  test('seed stage shows the pot only', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="seed" health={100} lightLow={false} place="desk" />,
    )
    expect(container.querySelector('[data-layer="plant"]')).toBeNull()
    expect(container.querySelector('[data-layer="pot-back"]')).not.toBeNull()
  })

  test('sick plant uses the sick pot and a tilted, faded plant', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="leafStem" health={10} lightLow={false} place="window" />,
    )
    expect(container.querySelector('[data-layer="pot-back"]')!.getAttribute('src')).toBe('/pots/sick.webp')
    const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
    expect(plant.style.transform).toMatch(/rotate\((?!0deg)/)
    expect(plant.style.filter).toMatch(/sepia/)
  })

  test('low light makes the plant pale and thin (its height stays what the ruler reads)', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="leafStem" health={90} lightLow place="shade" />,
    )
    const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
    expect(plant.style.filter).toContain('saturate(0.5) brightness(1.15)')
    expect(plant.style.transform).toContain('scale(0.85, 1)')
  })
})

describe('yardLayout', () => {
  const sizes: [number, number][] = [
    [754, 600],
    [772, 560],
    [600, 800],
    [1000, 420],
  ]

  test.each(sizes)('soil line is the yard picture surface, stem base buried under the mound (%i×%i)', (W, H) => {
    for (const stageScale of [0.65, 1]) {
      const L = yardLayout(W, H, stageScale)
      const p = L.plant
      const stemBaseY = p.y + anchors.plant.default.stemY * p.scale
      expect(L.surface).toBeCloseTo(L.bg.y + anchors.bg.window.surfaceY * L.bg.scale, 6)
      expect(L.surface).toBeGreaterThan(H / 2)
      expect(L.surface).toBeLessThan(H)
      expect(L.soilLine).toBe(L.surface)
      expect(stemBaseY - L.surface).toBeCloseTo(2 * L.unit, 6)
      // the picture ends 33 source px below the stem base; the heap reaches past that
      expect(L.mound.cy + L.mound.ry).toBeGreaterThan(p.y + p.h)
      // the heap covers the stem base: its top is above the soil line, its bottom below the stem base
      expect(L.mound.cy - L.mound.ry).toBeLessThan(L.surface)
      expect(L.mound.cy + L.mound.ry).toBeGreaterThan(stemBaseY)
      expect(L.mound.cx).toBeCloseTo(p.x + anchors.plant.default.stemX * p.scale, 6)
      // tree inside the scene, sign inside the scene and right of the trunk
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(L.sign.cx).toBeGreaterThan(L.mound.cx)
      expect(L.sign.cx).toBeLessThanOrEqual(W - 56)
    }
  })

  test('the planted tree is 1.4x the potted plant', () => {
    const potted = sceneLayout(754, 600, 1)
    const planted = yardLayout(754, 600, 1)
    expect(planted.plant.scale / planted.unit).toBeCloseTo((potted.plant.scale / potted.unit) * 1.4, 6)
  })
})

describe('PlantView in the yard', () => {
  test('no pot, a mound over the stem base, a health signpost', () => {
    const { container, getByRole } = render(
      <PlantView speciesId="apple" stage="grownTree" health={90} lightLow={false} place="yardPartial" />,
    )
    const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
    expect(layers).toEqual(['yard-bg', 'shadow', 'plant', 'mound', 'signpost'])
    expect(getByRole('img', { name: '건강 표지판' })).toBeTruthy()
    expect(container.querySelector('.pv-sign-face img')!.getAttribute('src')).toBe('/pots/happy.webp')
  })

  test('the signpost face follows health', () => {
    const { container } = render(
      <PlantView speciesId="apple" stage="grownTree" health={10} lightLow={false} place="yardShade" />,
    )
    expect(container.querySelector('.pv-sign-face img')!.getAttribute('src')).toBe('/pots/sick.webp')
  })
})

describe('PlantView in winter', () => {
  test('indoors: a cool window-light tint under the plant, no snow falling in the room', () => {
    for (const place of ['window', 'desk', 'shade'] as const) {
      const { container, unmount } = render(
        <PlantView speciesId="dandelion" stage="winter" health={90} lightLow={false} place={place} winter />,
      )
      const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
      expect(layers, place).toEqual(['bg', 'winter-light', 'shadow', 'pot-back', 'plant', 'pot-front'])
      unmount()
    }
  })

  test('in the yard: white veil under the tree, snow above it', () => {
    const { container } = render(
      <PlantView speciesId="apple" stage="winter" health={90} lightLow={false} place="yardSunny" winter />,
    )
    const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
    expect(layers).toEqual(['yard-bg', 'winter', 'shadow', 'plant', 'mound', 'signpost', 'snow'])
  })

  test('a species with a real winter picture shows it without the leafless filter', () => {
    for (const id of ['apple', 'persimmon', 'forsythia', 'dandelion'] as const) {
      const { container, unmount } = render(
        <PlantView speciesId={id} stage="winter" health={90} lightLow={false} place="desk" winter />,
      )
      const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
      expect(plant.getAttribute('src'), id).toBe(`/plants/${id}/winter.webp`)
      expect(plant.style.filter, id).not.toContain('grayscale')
      expect(plant.style.opacity, id).toBe('')
      expect(container.querySelector('[data-layer="winter-light"]'), id).not.toBeNull()
      unmount()
    }
  })

  test('the sick look still applies to the real winter picture, without the winter filter', () => {
    const { container } = render(
      <PlantView speciesId="dandelion" stage="winter" health={10} lightLow={false} place="desk" winter />,
    )
    const f = (container.querySelector('[data-layer="plant"]') as HTMLElement).style.filter
    expect(f).toMatch(/sepia/)
    expect(f).not.toMatch(/grayscale/)
  })

  test('a picture without a winter version (stand-in) is muted by the filter instead', () => {
    // balsam has no winter stage, so its lookup falls back to the stand-in
    const { container } = render(
      <PlantView speciesId="balsam" stage="winter" health={90} lightLow={false} place="desk" winter />,
    )
    const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
    expect(plant.getAttribute('src')).toBe('/plants/standin.png')
    expect(plant.style.filter).toContain('grayscale(.7) brightness(.9) contrast(.9)')
    expect(plant.style.opacity).toBe('0.85')
  })

  test('the shade background is lightened so the pot and plant read clearly (only the shade)', () => {
    const { container, unmount } = render(<PlantView speciesId="bean" stage="leafStem" health={90} lightLow={false} place="shade" />)
    expect(container.querySelector('[data-layer="bg"]')!.className).toContain('pv-bg--shade')
    unmount()
    for (const place of ['window', 'desk'] as const) {
      const r = render(<PlantView speciesId="bean" stage="leafStem" health={90} lightLow={false} place={place} />)
      expect(r.container.querySelector('[data-layer="bg"]')!.className, place).not.toContain('pv-bg--shade')
      r.unmount()
    }
  })

  test('no snow outside winter', () => {
    const { container } = render(<PlantView speciesId="dandelion" stage="flower" health={90} lightLow={false} place="desk" />)
    expect(container.querySelector('[data-layer="snow"]')).toBeNull()
  })
})

describe('pictures and their anchors', () => {
  const FACES = ['happy', 'normal', 'worried', 'sick'] as const
  const ROOM = ['window', 'desk', 'shade'] as const
  const YARD = ['yardSunny', 'yardPartial', 'yardShade'] as const
  const BALSAM = ['sprout', 'leafStem', 'flower', 'fruit', 'seedDone'] as const
  const sizes: [number, number][] = [
    [754, 600],
    [820, 1180],
    [1366, 768],
  ]

  test('every species has its own picture with measured anchors for every stage it passes through', () => {
    for (const sp of Object.values(SPECIES)) {
      for (const st of sp.stages) {
        const art = plantArt(sp.id, st)
        expect(art.real, `${sp.id}/${st}`).toBe(true)
        expect(art.src).toBe(`/plants/${sp.id}/${st}.webp`)
        expect(art.a.stemY, `${sp.id}/${st}`).toBeGreaterThan(art.a.top)
      }
    }
  })

  test('a stage a species does not have falls back to the shared stand-in', () => {
    const other = plantArt('balsam', 'winter')
    expect(other.real).toBe(false)
    expect(other.src).toBe('/plants/standin.png')
  })

  test('every pot face and place has its own measured anchors', () => {
    for (const f of FACES) expect(potArt(f).a).not.toBe(DEFAULTS.pot)
    for (const p of [...ROOM, ...YARD]) expect(bgArt(p).a).not.toBe(DEFAULTS.bg)
  })

  test.each(sizes)('pot stands on every room surface and the stem base is buried in its soil (%i×%i)', (W, H) => {
    for (const place of ROOM) {
      for (const face of FACES) {
        for (const st of BALSAM) {
          const art = { bg: bgArt(place).a, pot: potArt(face).a, plant: plantArt('balsam', st).a }
          const L = sceneLayout(W, H, stageScale(st), art)
          const label = `${place}/${face}/${st}`
          const bottom = L.pot.y + art.pot.bottom * L.pot.scale
          expect(bottom, label).toBeCloseTo(L.surface, 6)
          expect(bottom, label).toBeGreaterThanOrEqual(L.bg.y + art.bg.standTop! * L.bg.scale)
          expect(bottom, label).toBeLessThanOrEqual(L.bg.y + art.bg.standBottom! * L.bg.scale)
          expect(L.pot.y + art.pot.soilY * L.pot.scale, label).toBeCloseTo(L.soilLine, 6)
          const stemBaseY = L.plant.y + art.plant.stemY * L.plant.scale
          expect(stemBaseY - L.soilLine, label).toBeCloseTo(9 * L.unit, 6)
          expect(L.plant.x + art.plant.stemX * L.plant.scale, label).toBeCloseTo(L.pot.x + art.pot.cx * L.pot.scale, 6)
          // same visible pot width for every face, and the picture stays inside the scene
          expect((art.pot.bbox[2] - art.pot.bbox[0]) * L.pot.scale, label).toBeCloseTo(972 * 0.216 * L.unit, 6)
          expect(L.plant.y + art.plant.top * L.plant.scale, label).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  test.each(sizes)('plants grow taller stage by stage at the same pot (%i×%i)', (W, H) => {
    const heights = BALSAM.slice(0, 3).map((st) => {
      const a = plantArt('balsam', st).a
      const L = sceneLayout(W, H, stageScale(st), { bg: bgArt('window').a, pot: potArt('happy').a, plant: a })
      return (a.stemY - a.top) * L.plant.scale
    })
    expect(heights[0]).toBeLessThan(heights[1])
    expect(heights[1]).toBeLessThan(heights[2])
  })

  test('PlantView draws the balsam picture of the stage and the place background', () => {
    const { container } = render(<PlantView speciesId="balsam" stage="fruit" health={90} lightLow={false} place="shade" />)
    expect(container.querySelector('[data-layer="plant"]')!.getAttribute('src')).toBe('/plants/balsam/fruit.webp')
    expect(container.querySelector('[data-layer="bg"]')!.getAttribute('src')).toBe('/bg/shade.webp')
  })

  test('the yard draws the yard picture of the place', () => {
    const { container } = render(<PlantView speciesId="apple" stage="grownTree" health={90} lightLow={false} place="yardShade" />)
    expect(container.querySelector('[data-layer="yard-bg"]')!.getAttribute('src')).toBe('/bg/yardShade.webp')
  })
})

describe('the plant is drawn at its height (a fixed cm per scene)', () => {
  // scene px of the 6 viewports (1194×834, 1280×800, 1366×640, 1366×768, 820×1180, 768×1024) without and with
  // the '오늘 할 일' band, measured by tests/e2e/observe.spec.ts
  const SCENES: [number, number][] = [
    [746, 584], [832, 550], [936, 416], [918, 518], [764, 632], [712, 565],
    [746, 516], [832, 484], [936, 358], [918, 452],
  ]
  const IDS = Object.keys(SPECIES) as SpeciesId[]
  const ROOM = ['window', 'desk', 'shade'] as const
  const YARD = ['yardSunny', 'yardPartial', 'yardShade'] as const
  /** Where a plant at `stage` can stand: a tree is in the yard from the young-tree stage on. */
  const placesOf = (id: SpeciesId, stage: StageId): Place[] =>
    SPECIES[id].transplant && SPECIES[id].stages.indexOf(stage) >= SPECIES[id].stages.indexOf('grownTree') ? [...YARD] : [...ROOM]
  /** The highest height of a stage (growth waits at the stage's top until its care is done). */
  const stageTop = (id: SpeciesId, stage: StageId) => SPECIES[id].stages.indexOf(stage) * 6

  test('one cm is the same number of px on every day and stage of a plant in a scene', () => {
    for (const [W, H] of SCENES)
      for (const id of IDS)
        for (const yard of [false, true]) {
          if (yard && !SPECIES[id].transplant) continue
          const place: Place = yard ? 'yardSunny' : 'desk'
          const full = fullHeightCm(id, yard)
          const stages = SPECIES[id].stages.filter((st) => st !== 'seed' && placesOf(id, st).includes(place))
          const per: number[] = []
          for (const st of stages)
            for (let h = Math.max(1, stageTop(id, st) - 6); h <= Math.min(full, stageTop(id, st)); h += 0.7) {
              const L = plantLayout(W, H, { speciesId: id, stage: st, heightCm: h, place, health: 90 })
              per.push((L.groundY - L.plantTopY) / h)
            }
          const label = `${W}x${H} ${id} ${place}`
          expect(per.length, label).toBeGreaterThan(3)
          for (const v of per) expect(v, label).toBeCloseTo(per[0], 6)
          expect(per[0], label).toBeGreaterThan(3)
        }
  })

  test('a just-sprouted plant under 1 cm is drawn 1 cm tall (the ruler starts at 1 cm)', () => {
    const at = (h: number) => plantLayout(746, 584, { speciesId: 'bean', stage: 'sprout', heightCm: h, place: 'desk', health: 90 })
    const one = at(1)
    expect(at(0).plantTopY).toBeCloseTo(one.plantTopY, 6)
    expect(at(0.4).plantTopY).toBeCloseTo(one.plantTopY, 6)
    expect(one.plantTopY).toBeLessThan(one.groundY)
    expect(at(2).plantTopY).toBeLessThan(one.plantTopY)
  })

  test('the plant top is never cut off, also when it is pale and stretched by low light or tilted by sickness', () => {
    // the drawn top after the CSS transform of plantLook (scale about the stem base)
    const scaleY = (t: string) => {
      const m = /scale\(([\d.]+), ([\d.]+)\)/.exec(t)
      return m ? Number(m[2]) : 1
    }
    for (const [W, H] of SCENES)
      for (const id of IDS)
        for (const st of SPECIES[id].stages) {
          if (st === 'seed') continue
          // the tallest the plant can be while at this stage in that place
          const h = Math.min(stageTop(id, st), fullHeightCm(id, placesOf(id, st)[0].startsWith('yard')))
          for (const place of placesOf(id, st))
            for (const health of [100, 60, 10])
              for (const lightLow of [false, true]) {
                const L = plantLayout(W, H, { speciesId: id, stage: st, heightCm: h, place, health })
                const sy = scaleY(plantLook(health, lightLow).transform)
                const base = L.plant.y + L.plant.originY
                const top = base - sy * (base - L.plantTopY)
                expect(top, `${W}x${H} ${id}/${st} ${place} ${health} ${lightLow}`).toBeGreaterThanOrEqual(0)
              }
        }
  })

  test('the dandelion flower head stands inside the room scene at every size', () => {
    for (const [W, H] of SCENES) {
      const L = plantLayout(W, H, { speciesId: 'dandelion', stage: 'flower', heightCm: 24, place: 'window', health: 90 })
      expect(L.plantTopY, `${W}x${H}`).toBeGreaterThanOrEqual(12)
    }
  })

  test('PlantView draws the picture where the layout of its height puts it', () => {
    const { container } = render(<PlantView speciesId="bean" stage="leafStem" heightCm={9} health={90} lightLow={false} place="desk" />)
    const img = container.querySelector('[data-layer="plant"]') as HTMLElement
    const L = plantLayout(746, 586, { speciesId: 'bean', stage: 'leafStem', heightCm: 9, place: 'desk', health: 90 })
    expect(Number.parseFloat(img.style.top)).toBeCloseTo(L.plant.y, 3)
    expect(Number.parseFloat(img.style.height)).toBeCloseTo(L.plant.h, 3)
  })
})
