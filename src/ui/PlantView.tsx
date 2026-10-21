import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import anchors from '../../public/anchors.json'
import { SPECIES, STAGE_LABEL, type SpeciesId, type StageId } from '../sim/species'
import type { Place } from '../sim/types'
import './PlantView.css'

export type Face = 'happy' | 'normal' | 'worried' | 'sick'

export function faceFor(health: number): Face {
  if (health >= 75) return 'happy'
  if (health >= 50) return 'normal'
  if (health >= 25) return 'worried'
  return 'sick'
}

/** Plant size per stage until every stage has its own picture (Task 12). Seed = no plant. */
export function stageScale(stage: StageId): number {
  if (stage === 'seed') return 0
  if (stage === 'sprout') return 0.35
  if (stage === 'leafStem') return 0.65
  return 1
}

// Numbers of the approved composition (docs/mockup/compose.py, 746×586 scene).
const MOCK_W = 746
const MOCK_SURFACE = 502
const POT_SCALE = 0.216
const PLANT_SCALE = 0.22
/** The stem base sits this far (mockup px) below the soil line, so it is buried in the soil. */
const STEM_DEPTH = 9
/** Keeps the pot from filling a very narrow scene. */
const MAX_UNIT_PER_WIDTH = 1.3 / MOCK_W

export type Box = { x: number; y: number; w: number; h: number; scale: number }
export type SceneLayout = {
  /** Mockup px → scene px. */
  unit: number
  bg: Box
  surface: number
  pot: Box & { frontClipTop: number }
  soilLine: number
  plant: Box & { originX: number; originY: number }
  shadow: { cx: number; cy: number; rx: number; ry: number; blur: number }
}

/**
 * Port of compose.py: background covers the scene (bottom aligned so the sill stays in view),
 * pot bottom stands on the surface line, plant stem base 9 mockup-px under the soil line.
 */
export function sceneLayout(W: number, H: number, plantStageScale: number): SceneLayout {
  const bgA = anchors.bg.window
  const potA = anchors.pot
  const plA = anchors.plant.default

  const s = Math.max(W / bgA.w, H / bgA.h)
  const bg: Box = { w: bgA.w * s, h: bgA.h * s, x: (W - bgA.w * s) / 2, y: H - bgA.h * s, scale: s }
  const surface = bg.y + bgA.surfaceY * s
  const unit = Math.min(surface / MOCK_SURFACE, W * MAX_UNIT_PER_WIDTH)

  const ps = POT_SCALE * unit
  const cx = W / 2
  const pot = {
    x: cx - potA.cx * ps,
    y: surface - potA.bottom * ps,
    w: potA.w * ps,
    h: potA.h * ps,
    scale: ps,
    frontClipTop: potA.soilY * ps,
  }
  const soilLine = pot.y + potA.soilY * ps

  const pl = PLANT_SCALE * unit * plantStageScale
  const plant = {
    x: cx - plA.stemX * pl,
    y: soilLine + STEM_DEPTH * unit - plA.stemY * pl,
    w: plA.w * pl,
    h: plA.h * pl,
    scale: pl,
    originX: plA.stemX * pl,
    originY: plA.stemY * pl,
  }
  const shadow = { cx, cy: surface - 2 * unit, rx: 118 * unit, ry: 14 * unit, blur: 6 * unit }
  return { unit, bg, surface, pot, soilLine, plant, shadow }
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Health → faded colour and tilted stem; low light → pale, thin and a little stretched. */
export function plantLook(health: number, lightLow: boolean): { filter: string; transform: string } {
  const h = Math.max(0, Math.min(100, Number.isFinite(health) ? health : 100))
  const d = h >= 75 ? 0 : (75 - h) / 75
  const filters: string[] = []
  if (d > 0) filters.push(`saturate(${r2(1 - 0.6 * d)}) sepia(${r2(0.45 * d)})`)
  if (lightLow) filters.push('saturate(0.5) brightness(1.15)')
  const transform = `rotate(${r2(16 * d)}deg)${lightLow ? ' scale(0.85, 1.06)' : ''}`
  return { filter: filters.join(' ') || 'none', transform }
}

const BG_FILTER: Record<Place, string> = {
  window: 'none',
  yardSunny: 'none',
  desk: 'brightness(.92) saturate(.9)',
  yardPartial: 'brightness(.92) saturate(.9)',
  shade: 'brightness(.7) saturate(.75)',
  yardShade: 'brightness(.7) saturate(.75)',
}

const PLACE_NAME: Record<Place, string> = {
  window: '창가',
  desk: '책상',
  shade: '그늘',
  yardSunny: '해가 잘 드는 땅',
  yardPartial: '반그늘 땅',
  yardShade: '그늘진 땅',
}

/** Stand-in picture for every species and stage until Task 12. */
const plantSrc = (_id: SpeciesId, _stage: StageId) => '/plants/balsam/flower.png'

const DEFAULT_SIZE = { w: MOCK_W, h: 586 }

function useSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState(DEFAULT_SIZE)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

type Props = {
  speciesId: SpeciesId
  stage: StageId
  health: number
  lightLow: boolean
  place: Place
  /** Handlers and attributes for the touch area over the pot (drag, drop target). */
  potProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>
  /** Pot glows as a drop target. */
  potHighlight?: boolean
  /** Rendered in plant picture coordinates (moves with tilt and scale); gets px per source px. */
  plantOverlay?: (scale: number) => ReactNode
  /** Rendered in scene coordinates above everything. */
  sceneOverlay?: (layout: SceneLayout) => ReactNode
}

export function PlantView({ speciesId, stage, health, lightLow, place, potProps, potHighlight, plantOverlay, sceneOverlay }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(ref)
  const scale = stageScale(stage)
  const L = sceneLayout(w, h, scale)
  const face = faceFor(health)
  const potSrc = `/pots/${face}.png`
  const potFilter = face === 'sick' ? 'saturate(.6)' : undefined
  const look = plantLook(health, lightLow)
  const name = SPECIES[speciesId].name
  const hasPlant = scale > 0

  const potBox = { left: L.pot.x, top: L.pot.y, width: L.pot.w, height: L.pot.h }
  const plantBox = {
    left: L.plant.x,
    top: L.plant.y,
    width: L.plant.w,
    height: L.plant.h,
    transformOrigin: `${L.plant.originX}px ${L.plant.originY}px`,
    transform: look.transform,
  }
  // Touch area: the visible pot (pot picture bbox 143..1115 × 140..1139).
  const ps = L.pot.scale
  const hitBox = { left: L.pot.x + 143 * ps, top: L.pot.y + 140 * ps, width: 972 * ps, height: 999 * ps }

  return (
    <div
      ref={ref}
      className="pv"
      role="group"
      aria-label={`${PLACE_NAME[place]}에 놓인 ${name} 화분`}
    >
      <img
        data-layer="bg"
        className="pv-layer"
        src="/bg/window.png"
        alt=""
        draggable={false}
        style={{ left: L.bg.x, top: L.bg.y, width: L.bg.w, height: L.bg.h, filter: BG_FILTER[place] }}
      />
      <div
        data-layer="shadow"
        className="pv-layer pv-shadow"
        style={{
          left: L.shadow.cx - L.shadow.rx,
          top: L.shadow.cy - L.shadow.ry,
          width: L.shadow.rx * 2,
          height: L.shadow.ry * 2,
          filter: `blur(${r2(L.shadow.blur)}px)`,
        }}
      />
      <img data-layer="pot-back" className="pv-layer" src={potSrc} alt="" draggable={false} style={{ ...potBox, filter: potFilter }} />
      {hasPlant && (
        <img
          data-layer="plant"
          className="pv-layer pv-plant"
          src={plantSrc(speciesId, stage)}
          alt={`${name} (${STAGE_LABEL[stage]})`}
          draggable={false}
          style={{ ...plantBox, filter: look.filter }}
        />
      )}
      <img
        data-layer="pot-front"
        className="pv-layer"
        src={potSrc}
        alt=""
        draggable={false}
        style={{ ...potBox, filter: potFilter, clipPath: `inset(${r2(L.pot.frontClipTop)}px 0 0 0)` }}
      />
      <div
        {...potProps}
        className={`pv-pot-hit${potHighlight ? ' pv-pot-hit--glow' : ''}`}
        style={{ left: hitBox.left, top: hitBox.top, width: hitBox.width, height: hitBox.height }}
      />
      {hasPlant && plantOverlay && (
        <div className="pv-layer pv-plant-overlay" style={plantBox}>
          {plantOverlay(L.plant.scale)}
        </div>
      )}
      {sceneOverlay?.(L)}
    </div>
  )
}
