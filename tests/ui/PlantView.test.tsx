import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { PlantView, faceFor, sceneLayout } from '../../src/ui/PlantView'
import anchors from '../../public/anchors.json'

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

describe('PlantView', () => {
  test('stacks bg, shadow, pot back, plant, pot front in that order', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="flower" health={90} lightLow={false} place="window" />,
    )
    const layers = [...container.querySelectorAll('[data-layer]')].map((el) => el.getAttribute('data-layer'))
    expect(layers).toEqual(['bg', 'shadow', 'pot-back', 'plant', 'pot-front'])
    const front = container.querySelector('[data-layer="pot-front"]') as HTMLImageElement
    expect(front.getAttribute('src')).toBe('/pots/happy.png')
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
    expect(container.querySelector('[data-layer="pot-back"]')!.getAttribute('src')).toBe('/pots/sick.png')
    const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
    expect(plant.style.transform).toMatch(/rotate\((?!0deg)/)
    expect(plant.style.filter).toMatch(/sepia/)
  })

  test('low light makes the plant pale and thin', () => {
    const { container } = render(
      <PlantView speciesId="balsam" stage="leafStem" health={90} lightLow place="shade" />,
    )
    const plant = container.querySelector('[data-layer="plant"]') as HTMLElement
    expect(plant.style.filter).toContain('saturate(0.5) brightness(1.15)')
    expect(plant.style.transform).toContain('scale(0.85, 1.06)')
  })
})
