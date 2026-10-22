import type { CareTaskId } from '../../sim/types'
import type { PlantArt } from '../art'
import type { SceneLayout } from '../PlantView'

/** A touch target in scene px. */
export type Rect = { left: number; top: number; width: number; height: number }

/** Smallest touch target (px). */
export const MIN_TARGET = 48
/**
 * The morning card sits at the top left of the scene (left 16, top 16, about 2 lines of 20 px): targets
 * stay out of this box, under it or to its right.
 */
export const MORNING_BOX = { right: 480, bottom: 100 }

/** Scene size: the background covers the scene, centered across and bottom aligned (PlantView coverBg). */
export function sceneSize(L: SceneLayout): { W: number; H: number } {
  return { W: L.bg.w + 2 * L.bg.x, H: L.bg.y + L.bg.h }
}

/** Half the visible pot width (MOCK_POT_W / 2 in mockup px) times the unit. */
const POT_HALF = 105

/** Numbers every care drawing shares, in scene px. */
export type CareGeo = {
  u: number
  /** x of the stem (= the middle of the pot). */
  cx: number
  /** Soil line in the pot. */
  ground: number
  /** The table / sill the pot stands on. */
  surface: number
  /** Top of the visible plant. */
  top: number
  /** Visible plant height (0 for a seed). */
  plantH: number
  potHalf: number
}

export function careGeo(L: SceneLayout): CareGeo {
  const u = L.unit
  return {
    u,
    cx: L.plant.x + L.plant.originX,
    ground: L.groundY,
    surface: L.surface,
    top: L.plantTopY,
    plantH: Math.max(0, L.groundY - L.plantTopY),
    potHalf: POT_HALF * u,
  }
}

/** Stake standing beside the stem: x and height (scene px). */
export const stakeAt = (g: CareGeo) => ({ x: g.cx + 30 * g.u, h: Math.max(60 * g.u, 0.95 * g.plantH) })
/** The two weak sprouts: x of each and their height. */
export const weakSprouts = (g: CareGeo) => ({ xs: [g.cx - 54 * g.u, g.cx + 54 * g.u], h: Math.max(36 * g.u, 0.62 * g.plantH) })
/** The two soil heaps beside the stem base. */
export const heapXs = (g: CareGeo) => [g.cx - Math.max(50 * g.u, 27), g.cx + Math.max(50 * g.u, 27)]

/** The two side branches to pinch, as scene points on the plant picture. */
export function branchPoints(L: SceneLayout, pic: PlantArt): [number, number][] {
  const a = pic.a
  const half = ((a.right ?? a.w) - (a.left ?? 0)) * 0.3
  const at = (x: number, share: number): [number, number] => [
    L.plant.x + x * L.plant.scale,
    L.plant.y + (a.top + share * (a.stemY - a.top)) * L.plant.scale,
  ]
  return [at(a.stemX - half, 0.55), at(a.stemX + half, 0.42)]
}

/** A rect of at least `min` px around (x, y), moved into the scene and out from under the morning card. */
function box(x: number, y: number, w: number, h: number, W: number, H: number, min = MIN_TARGET): Rect {
  const width = Math.min(W, Math.max(min, w))
  let height = Math.min(H, Math.max(min, h))
  const left = Math.min(W - width, Math.max(0, x - width / 2))
  let top = Math.min(H - height, Math.max(0, y - height / 2))
  if (left < MORNING_BOX.right && top < MORNING_BOX.bottom) {
    // cut off the part under the card (keeping the bottom), or slide down when that leaves too little
    const bottom = top + height
    top = MORNING_BOX.bottom
    height = Math.max(min, bottom - top)
    if (top + height > H) top = H - height
  }
  return { left, top, width, height }
}

/**
 * Touch targets of a care task, in the order its component uses them (scene px, each ≥ 48 × 48, inside the
 * scene). Empty for tasks without targets yet (Task 10).
 */
export function careTargets(task: CareTaskId, L: SceneLayout, pic: PlantArt): Rect[] {
  const { W, H } = sceneSize(L)
  const g = careGeo(L)
  const u = g.u
  const at = (x: number, y: number, w: number, h: number, min?: number) => box(x, y, w, h, W, H, min)
  const stake = stakeAt(g)
  // the stake lying on the table right of the pot, ready to be picked up
  const stakeSource = () => at(g.cx + g.potHalf + 24 * u + stake.h / 2, g.surface - 10 * u, stake.h, 50 * u, 56)
  const stakeMark = () => at(stake.x, g.ground - stake.h / 2, 44 * u, stake.h, 56)
  switch (task) {
    case 'sow':
      return [
        // the soil in the pot: seeds go here, then it is rubbed to cover them
        at(g.cx, g.ground - 4 * u, 150 * u, 56 * u, 56),
        // the seed packet on the table right of the pot
        at(g.cx + g.potHalf + 80 * u, g.surface - 62 * u, 120 * u, 130 * u, 72),
      ]
    case 'thin': {
      const w = weakSprouts(g)
      return w.xs.map((x) => at(x, g.ground - w.h / 2, 44 * u, w.h + 12 * u))
    }
    case 'stake':
      return [stakeMark(), stakeSource()]
    case 'stakeTwine':
      return [stakeMark(), stakeSource(), at(g.cx + 15 * u, g.top + g.plantH * 0.5, 70 * u, g.plantH * 0.8, 64)]
    case 'hillUp':
      return heapXs(g).map((x) => at(x, g.ground - 4 * u, 60 * u, 44 * u))
    case 'pinch':
      return branchPoints(L, pic).map(([x, y]) => at(x, y, 50 * u, 50 * u, 56))
    case 'drainCheck':
      return [at(g.cx, g.surface, 180 * u, 60 * u, 64)]
    default:
      return []
  }
}

/** True when the scene point is on the rect (with some slack for a child's finger). */
export function hits(r: Rect, x: number, y: number, slack = 16): boolean {
  return x >= r.left - slack && x <= r.left + r.width + slack && y >= r.top - slack && y <= r.top + r.height + slack
}

/** CSS position of a rect. */
export const place = (r: Rect) => ({ left: r.left, top: r.top, width: r.width, height: r.height })
