import data from '../../public/anchors.json'
import type { SpeciesId, StageId } from '../sim/species'
import type { Place } from '../sim/types'

/** Anchor numbers of one picture (px of the picture file). Measured by scripts/anchors.py. */
export type PotAnchor = { w: number; h: number; soilY: number; cx: number; bottom: number; bbox: [number, number, number, number] }
export type PlantAnchor = {
  w: number
  h: number
  stemX: number
  stemY: number
  top: number
  left?: number
  right?: number
  spots?: [number, number][]
}
export type BgAnchor = { w: number; h: number; surfaceY: number }

type Files = Record<string, { kind: string } & Partial<PotAnchor & PlantAnchor & BgAnchor>>
const files = data.files as unknown as Files

/** Numbers of the stand-in pictures (and what a picture without measured anchors falls back to). */
export const DEFAULTS = data.defaults as { pot: PotAnchor; plant: PlantAnchor; bg: BgAnchor }

export type PotArt = { src: string; a: PotAnchor }
export type PlantArt = { src: string; a: PlantAnchor; /** false = the shared stand-in picture */ real: boolean }
export type BgArt = { src: string; a: BgAnchor }

const has = (rel: string) => rel in files

export function potArt(face: string): PotArt {
  const rel = `pots/${face}.webp`
  return { src: `/${rel}`, a: has(rel) ? (files[rel] as unknown as PotAnchor) : DEFAULTS.pot }
}

export function bgArt(place: Place): BgArt {
  const rel = `bg/${place}.webp`
  return { src: `/${rel}`, a: has(rel) ? (files[rel] as unknown as BgAnchor) : DEFAULTS.bg }
}

/** The species' own picture for the stage, or the shared stand-in until that species' pictures are in. */
export function plantArt(id: SpeciesId, stage: StageId): PlantArt {
  const rel = `plants/${id}/${stage}.webp`
  if (has(rel)) return { src: `/${rel}`, a: files[rel] as unknown as PlantAnchor, real: true }
  return { src: '/plants/standin.png', a: DEFAULTS.plant, real: false }
}

export const plantSrc = (id: SpeciesId, stage: StageId) => plantArt(id, stage).src

/** Bugs on a plant never exceed this (the sim's MAX_BUGS), so every picture offers this many places. */
export const BUG_SLOTS = 12

type Pt = [number, number]
type Box = { left: number; right: number; top: number; bottom: number }

/** Offsets (source px) for copies of a place when nothing else is left: each copy is its own button. */
const NUDGE: Pt[] = [
  [60, 40],
  [-60, 40],
  [60, -40],
  [-60, -40],
  [0, 70],
  [0, -70],
]

const same = (p: Pt, q: Pt) => p[0] === q[0] && p[1] === q[1]
const far = (p: Pt, pts: Pt[], min: number) => pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= min)

/**
 * Pads `base` to BUG_SLOTS places: `base` first (as it is), then `extra` points (those not crowding a place
 * already taken first), then nudged copies of the places so far (kept inside `box` when given).
 * Every counted bug then has a place of its own, so the student can always tap them all.
 */
export function fillSpots(base: Pt[], extra: Pt[] = [], box?: Box): Pt[] {
  const out: Pt[] = base.slice(0, BUG_SLOTS)
  for (const p of extra) if (out.length < BUG_SLOTS && far(p, out, 90)) out.push(p)
  for (const p of extra) if (out.length < BUG_SLOTS && !out.some((q) => same(p, q))) out.push(p)
  const inBox = (p: Pt): Pt =>
    box ? [Math.min(box.right - 1, Math.max(box.left + 1, p[0])), Math.min(box.bottom - 1, Math.max(box.top + 1, p[1]))] : p
  const n = out.length
  for (let i = 0; out.length < BUG_SLOTS && n > 0 && i < n * NUDGE.length; i++) {
    const [x, y] = out[i % n]
    const [dx, dy] = NUDGE[Math.floor(i / n)]
    const p = inBox([x + dx, y + dy])
    if (!out.some((q) => same(p, q))) out.push(p)
  }
  // Last resort (a tiny box): plain copies still give every bug its own button.
  for (let i = 0; out.length < BUG_SLOTS && n > 0; i++) out.push(out[i % n])
  return out
}

export type BugSpots = {
  /** BUG_SLOTS places (source px of the picture), measured leaf spots first. */
  points: Pt[]
  /** How many of `points` are measured leaf spots (the first ones); bugs take these before the padded ones. */
  measured: number
}

/**
 * Bug places for a real plant picture: its measured leaf spots, padded to BUG_SLOTS with points of a grid
 * inside that picture's own bounding box (never the stand-in's coordinates). undefined for the stand-in.
 */
export function bugSpots(pic: PlantArt): BugSpots | undefined {
  if (!pic.real) return undefined
  const { w, stemY, top } = pic.a
  const left = pic.a.left ?? 0
  const right = pic.a.right ?? w
  const grid: Pt[] = []
  // a 3 x 4 grid over the middle 60% of the box, so every point is well inside the picture
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push([Math.round(left + (right - left) * (0.2 + 0.3 * c)), Math.round(top + (stemY - top) * (0.15 + 0.2 * r))])
    }
  }
  const measured = (pic.a.spots ?? []).slice(0, BUG_SLOTS)
  return { points: fillSpots(measured, grid, { left, right, top, bottom: stemY }), measured: measured.length }
}
