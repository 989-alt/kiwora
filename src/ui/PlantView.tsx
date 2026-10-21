import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { SPECIES, STAGE_LABEL, type SpeciesId, type StageId } from '../sim/species'
import type { Place } from '../sim/types'
import { DEFAULTS, bgArt, bugSpots, plantArt, plantSrc, potArt, type BgAnchor, type PlantAnchor, type PotAnchor } from './art'
import { Mound, Signpost, Snow, WinterVeil } from './Scenery'
import './PlantView.css'

export type Face = 'happy' | 'normal' | 'worried' | 'sick'

export function faceFor(health: number): Face {
  if (health >= 75) return 'happy'
  if (health >= 50) return 'normal'
  if (health >= 25) return 'worried'
  return 'sick'
}

/** Visible plant height per stage, as a share of the full-grown plant. Seed = no plant is drawn. */
export function stageScale(stage: StageId): number {
  if (stage === 'seed') return 0
  if (stage === 'sprout') return 0.35
  if (stage === 'leafStem') return 0.65
  return 1
}

// Numbers of the approved composition (docs/mockup/compose.py, 746×586 scene).
const MOCK_W = 746
const MOCK_SURFACE = 502
/** Visible width of the pot (picture bbox) and visible height of a full-grown plant in that scene, in mockup px. */
const MOCK_POT_W = 972 * 0.216
const MOCK_PLANT_H = 0.22 * (1415 - 23)
/** The stem base sits this far (mockup px) below the soil line, so it is buried in the soil. */
const STEM_DEPTH = 9
/** Keeps the pot from filling a very narrow scene. */
const MAX_UNIT_PER_WIDTH = 1.3 / MOCK_W

/** Anchors of the pictures a scene is built from. */
export type SceneArt = { bg: BgAnchor; pot: PotAnchor; plant: PlantAnchor }
const DEFAULT_ART: SceneArt = DEFAULTS

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

/** Picture px per scene px so the visible pot is MOCK_POT_W wide and the visible plant is `heightShare` of the full height. */
const potScale = (potA: PotAnchor, unit: number) => (MOCK_POT_W * unit) / (potA.bbox[2] - potA.bbox[0])
const plantScale = (plA: PlantAnchor, unit: number, heightShare: number) =>
  (MOCK_PLANT_H * unit * heightShare) / (plA.stemY - plA.top)

/** Background covers the scene, bottom aligned so the placing surface stays in view. */
function coverBg(W: number, H: number, bgA: BgAnchor) {
  const s = Math.max(W / bgA.w, H / bgA.h)
  const bg: Box = { w: bgA.w * s, h: bgA.h * s, x: (W - bgA.w * s) / 2, y: H - bgA.h * s, scale: s }
  return { bg, surface: bg.y + bgA.surfaceY * s }
}

/**
 * Port of compose.py: background covers the scene (bottom aligned so the sill stays in view),
 * pot bottom stands on the surface line, plant stem base 9 mockup-px under the soil line.
 */
export function sceneLayout(W: number, H: number, plantStageScale: number, art: SceneArt = DEFAULT_ART): SceneLayout {
  const { bg: bgA, pot: potA, plant: plA } = art

  const { bg, surface } = coverBg(W, H, bgA)
  const unit = Math.min(surface / MOCK_SURFACE, W * MAX_UNIT_PER_WIDTH)

  const ps = potScale(potA, unit)
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

  const pl = plantScale(plA, unit, plantStageScale)
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

const YARD_PLACES: readonly Place[] = ['yardSunny', 'yardPartial', 'yardShade']
export const isYardPlace = (p: Place) => YARD_PLACES.includes(p)

/** The planted tree is drawn bigger than the potted plant. */
const YARD_PLANT_BOOST = 1.4
/** Stem base sits this far (mockup px) below the soil line, under the mound. */
const YARD_STEM_DEPTH = 2
const YARD_TREE_X = 0.44

export type YardLayout = SceneLayout & {
  mound: { cx: number; cy: number; rx: number; ry: number }
  sign: { cx: number; bottom: number }
  /** Touch area around the stem base (pellets are dropped here). */
  drop: { left: number; top: number; width: number; height: number }
}

/** The yard: no pot, the stem base stands on the soil line of the yard picture. */
export function yardLayout(W: number, H: number, plantStageScale: number, art: Pick<SceneArt, 'bg' | 'plant'> = DEFAULT_ART): YardLayout {
  const plA = art.plant
  const { bg, surface } = coverBg(W, H, art.bg)
  const unit = Math.min(surface / MOCK_SURFACE, W * MAX_UNIT_PER_WIDTH)
  const cx = W * YARD_TREE_X
  const pl = plantScale(plA, unit, YARD_PLANT_BOOST * plantStageScale)
  const plant = {
    x: cx - plA.stemX * pl,
    y: surface + YARD_STEM_DEPTH * unit - plA.stemY * pl,
    w: plA.w * pl,
    h: plA.h * pl,
    scale: pl,
    originX: plA.stemX * pl,
    originY: plA.stemY * pl,
  }
  const treeRight = cx + (plA.w - plA.stemX) * pl * 0.6
  const signCx = Math.min(W - 56, Math.max(W * 0.76, treeRight + 64))
  // a low heap: crown 15u above the soil line, base 13u under it, so it also covers the picture's last pixels below the stem base
  const mound = { cx, cy: surface - unit, rx: 62 * unit, ry: 14 * unit }
  return {
    unit,
    bg,
    surface,
    // a zero-height "pot" at the stem base keeps the watering can and shadow math working
    pot: { x: cx - 100 * unit, y: surface, w: 200 * unit, h: 0, scale: unit, frontClipTop: 0 },
    soilLine: surface,
    plant,
    shadow: { cx, cy: surface + 2 * unit, rx: 110 * unit, ry: 10 * unit, blur: 6 * unit },
    mound,
    sign: { cx: signCx, bottom: surface + 8 },
    drop: { left: cx - 90 * unit, top: surface - 40 * unit, width: 180 * unit, height: 70 * unit },
  }
}

/** Stand-in for a leafless plant: only used when the species has no real winter picture. */
const WINTER_FILTER = 'grayscale(.7) brightness(.9) contrast(.9)'

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

const PLACE_NAME: Record<Place, string> = {
  window: '창가',
  desk: '책상',
  shade: '그늘',
  yardSunny: '해가 잘 드는 땅',
  yardPartial: '반그늘 땅',
  yardShade: '그늘진 땅',
}

/** Every screen resolves plant pictures through this (a species' own picture, else the shared stand-in). */
export { plantSrc }

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
  /** Winter phase: white veil and snow; the plant looks leafless through its own winter picture (a muted filter if it has none). */
  winter?: boolean
  /** Handlers and attributes for the touch area over the pot (drag, drop target). */
  potProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>
  /** Pot glows as a drop target. */
  potHighlight?: boolean
  /** Rendered in plant picture coordinates (moves with tilt and scale); gets px per source px and the picture's leaf spots. */
  plantOverlay?: (scale: number, spots: [number, number][] | undefined) => ReactNode
  /** Rendered in scene coordinates above everything. */
  sceneOverlay?: (layout: SceneLayout) => ReactNode
}

export function PlantView({ speciesId, stage, health, lightLow, place, winter = false, potProps, potHighlight, plantOverlay, sceneOverlay }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(ref)
  const scale = stageScale(stage)
  const yard = isYardPlace(place)
  const face = faceFor(health)
  const bgPic = bgArt(place)
  const potPic = potArt(face)
  const plantPic = plantArt(speciesId, stage)
  const art: SceneArt = { bg: bgPic.a, pot: potPic.a, plant: plantPic.a }
  const L = yard ? yardLayout(w, h, scale, art) : sceneLayout(w, h, scale, art)
  const potSrc = potPic.src
  const potFilter = face === 'sick' ? 'saturate(.6)' : undefined
  const look = plantLook(health, lightLow)
  const name = SPECIES[speciesId].name
  const hasPlant = scale > 0
  // A species with a real winter picture shows it as drawn; the muted filter only fakes winter on a stand-in.
  const fakeWinter = winter && !plantPic.real
  const plantFilter = fakeWinter ? [look.filter === 'none' ? '' : look.filter, WINTER_FILTER].join(' ').trim() : look.filter

  const potBox = { left: L.pot.x, top: L.pot.y, width: L.pot.w, height: L.pot.h }
  const plantBox = {
    left: L.plant.x,
    top: L.plant.y,
    width: L.plant.w,
    height: L.plant.h,
    transformOrigin: `${L.plant.originX}px ${L.plant.originY}px`,
    transform: look.transform,
  }
  // Touch area: the visible pot (its picture's opaque bounding box), or the soil around the tree.
  const ps = L.pot.scale
  const pb = potPic.a.bbox
  const hitBox = yard
    ? (L as YardLayout).drop
    : { left: L.pot.x + pb[0] * ps, top: L.pot.y + pb[1] * ps, width: (pb[2] - pb[0]) * ps, height: (pb[3] - pb[1]) * ps }
  const hitProps = (
    <div
      {...potProps}
      className={`pv-pot-hit${yard ? ' pv-pot-hit--soil' : ''}${potHighlight ? ' pv-pot-hit--glow' : ''}`}
      style={{ left: hitBox.left, top: hitBox.top, width: hitBox.width, height: hitBox.height }}
    />
  )
  const plantImg = hasPlant && (
    <img
      data-layer="plant"
      className="pv-layer pv-plant"
      src={plantPic.src}
      alt={`${name} (${STAGE_LABEL[stage]})`}
      draggable={false}
      style={{ ...plantBox, filter: plantFilter || 'none', opacity: fakeWinter ? 0.85 : undefined }}
    />
  )
  const bugs = hasPlant && plantOverlay && (
    <div className="pv-layer pv-plant-overlay" style={plantBox}>
      {plantOverlay(L.plant.scale, bugSpots(plantPic))}
    </div>
  )
  const shadow = (
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
  )

  if (yard) {
    const Y = L as YardLayout
    return (
      <div ref={ref} className="pv" role="group" aria-label={`${PLACE_NAME[place]}에 심은 ${name}`}>
        <img
          data-layer="yard-bg"
          className="pv-layer"
          src={bgPic.src}
          alt=""
          draggable={false}
          style={{ left: Y.bg.x, top: Y.bg.y, width: Y.bg.w, height: Y.bg.h }}
        />
        {winter && <WinterVeil />}
        {shadow}
        {plantImg}
        <Mound {...Y.mound} />
        <Signpost face={face} filter={potFilter} cx={Y.sign.cx} bottom={Y.sign.bottom} />
        {hitProps}
        {bugs}
        {sceneOverlay?.(L)}
        {winter && <Snow />}
      </div>
    )
  }

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
        src={bgPic.src}
        alt=""
        draggable={false}
        style={{ left: L.bg.x, top: L.bg.y, width: L.bg.w, height: L.bg.h }}
      />
      {winter && <WinterVeil />}
      {shadow}
      <img data-layer="pot-back" className="pv-layer" src={potSrc} alt="" draggable={false} style={{ ...potBox, filter: potFilter }} />
      {plantImg}
      <img
        data-layer="pot-front"
        className="pv-layer"
        src={potSrc}
        alt=""
        draggable={false}
        style={{ ...potBox, filter: potFilter, clipPath: `inset(${r2(L.pot.frontClipTop)}px 0 0 0)` }}
      />
      {hitProps}
      {bugs}
      {sceneOverlay?.(L)}
      {winter && <Snow />}
    </div>
  )
}
