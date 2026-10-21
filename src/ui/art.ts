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

/**
 * Bug places for a real plant picture: its measured leaf spots, or - when none were measured - points inside
 * that picture's own bounding box (never the stand-in's coordinates). undefined for the stand-in.
 */
export function bugSpots(pic: PlantArt): [number, number][] | undefined {
  if (!pic.real) return undefined
  if (pic.a.spots && pic.a.spots.length > 0) return pic.a.spots
  const { w, stemY, top } = pic.a
  const left = pic.a.left ?? 0
  const right = pic.a.right ?? w
  const pts: [number, number][] = []
  // a 3 x 4 grid over the middle 60% of the box, so every point is well inside the picture
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      pts.push([Math.round(left + (right - left) * (0.2 + 0.3 * c)), Math.round(top + (stemY - top) * (0.15 + 0.2 * r))])
    }
  }
  return pts
}
