import type { SpeciesId } from '../../sim/species'
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

type P = [number, number]
/** What the points of a picture mark: dry twigs to cut (young tree), flowers (A then B, or where pollen flies from), fruits. */
export type SpotKind = 'dry' | 'flower' | 'fruit'

/**
 * Points on the species' own pictures (picture px), picked by hand off grid overlays of
 * public/plants/<id>/{grownTree,flower,fruit}.webp: 'dry' = crown edges where a dry twig sticks out,
 * 'flower' = two open flowers (pollinate goes from the first to the second; for rice and corn the
 * tassels / panicles the pollen flies from), 'fruit' = three fruits (pods, ears, capsules).
 * A dandelion has a single flower head: its two points are the two sides of that head (each floret is a flower).
 */
const SPOTS: Partial<Record<SpeciesId, Partial<Record<SpotKind, P[]>>>> = {
  apple: {
    dry: [[100, 500], [680, 480], [590, 250]],
    flower: [[144, 395], [495, 464]],
    fruit: [[159, 397], [516, 470], [265, 741]],
  },
  persimmon: {
    dry: [[80, 420], [700, 380], [160, 180]],
    flower: [[250, 482], [492, 533]],
    fruit: [[193, 464], [630, 545], [492, 700]],
  },
  forsythia: {
    dry: [[70, 550], [715, 520], [490, 110]],
    flower: [[156, 510], [582, 487]],
    fruit: [[190, 372], [605, 401], [230, 775]],
  },
  dandelion: { flower: [[300, 100], [450, 100]], fruit: [[300, 120], [460, 130], [380, 230]] },
  morningGlory: { flower: [[276, 280], [472, 481]], fruit: [[435, 144], [325, 407], [447, 591]] },
  bean: { flower: [[290, 597], [313, 150]], fruit: [[304, 476], [463, 614], [334, 827]] },
  balsam: { flower: [[276, 476], [490, 338]], fruit: [[512, 458], [305, 683], [472, 775]] },
  rice: { flower: [[244, 176], [384, 130], [540, 330]], fruit: [[141, 487], [498, 165], [659, 522]] },
  corn: { flower: [[380, 130], [300, 160], [460, 150]], fruit: [[305, 349], [450, 420], [420, 590]] },
}

/** Without hand-picked points (a stand-in picture): shares of the picture's opaque box (x across, y from top to stem base). */
const SHARES: Record<SpotKind, P[]> = {
  dry: [[0.08, 0.5], [0.92, 0.48], [0.75, 0.25]],
  flower: [[0.3, 0.35], [0.7, 0.45]],
  fruit: [[0.25, 0.4], [0.7, 0.45], [0.4, 0.65]],
}

/** The marked points of the plant picture, in scene px. */
export function carePoints(kind: SpotKind, L: SceneLayout, pic: PlantArt, id?: SpeciesId): P[] {
  const a = pic.a
  const own = pic.real && id ? SPOTS[id]?.[kind] : undefined
  const pts: P[] =
    own ??
    SHARES[kind].map(([sx, sy]): P => {
      const left = a.left ?? 0
      return [left + sx * ((a.right ?? a.w) - left), a.top + sy * (a.stemY - a.top)]
    })
  return pts.map(([x, y]) => [L.plant.x + x * L.plant.scale, L.plant.y + y * L.plant.scale])
}

/**
 * Square targets of `want` px (at least `min`) on points that may lie close together in a small scene
 * (flowers, fruits): the points are moved into the scene and out from under the morning card, and pushed
 * apart until no target can cover another one's middle; then each target is kept smaller than twice the
 * distance to its nearest neighbour. A tap on the middle of a mark then always lands on that mark.
 */
function pointTargets(
  pts: P[],
  want: number,
  min: number,
  W: number,
  H: number,
  avoid: boolean,
  at: (x: number, y: number, w: number, h: number, min?: number) => Rect,
): Rect[] {
  const ps = pts.map(([x, y]): P => [x, y])
  const need = min / 2 + 2
  const h = Math.max(min, want) / 2
  const cheb = (a: P, b: P) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
  const clamp = (p: P) => {
    p[0] = Math.min(W - h, Math.max(h, p[0]))
    p[1] = Math.min(H - h, Math.max(h, p[1]))
    if (avoid && p[0] - h < MORNING_BOX.right && p[1] - h < MORNING_BOX.bottom) p[1] = MORNING_BOX.bottom + h
  }
  for (let round = 0; round < 8; round++) {
    ps.forEach(clamp)
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const [a, b] = [ps[i], ps[j]]
        const d = cheb(a, b)
        if (d >= need) continue
        // apart along the axis they are already furthest apart on
        const k = Math.abs(a[0] - b[0]) >= Math.abs(a[1] - b[1]) ? 0 : 1
        const dir = a[k] <= b[k] ? 1 : -1
        const push = (need - d) / 2
        a[k] -= dir * push
        b[k] += dir * push
      }
  }
  ps.forEach(clamp)
  return ps.map((p, i) => {
    const near = Math.min(...ps.filter((_, j) => j !== i).map((q) => cheb(p, q)), Infinity)
    const size = Math.max(min, Math.min(want, 2 * near - 4))
    return at(p[0], p[1], size, size, min)
  })
}

/** The straw wrapped around the lower trunk: its middle x, bottom (ground) and height. */
export const wrapAt = (g: CareGeo) => ({ x: g.cx, h: Math.max(56 * g.u, 0.2 * g.plantH), w: Math.max(26, 34 * g.u) })
/** Where the straw bundle lies on the ground, left of the trunk (the sign stands on the right). */
export const strawAt = (g: CareGeo) => ({ x: g.cx - 120 * g.u, y: g.ground - 14 * g.u, w: 130 * g.u })

/** A rect of at least `min` px around (x, y), moved into the scene (and, with `avoid`, out from under the morning card). */
function box(x: number, y: number, w: number, h: number, W: number, H: number, avoid: boolean, min = MIN_TARGET): Rect {
  const width = Math.min(W, Math.max(min, w))
  let height = Math.min(H, Math.max(min, h))
  const left = Math.min(W - width, Math.max(0, x - width / 2))
  let top = Math.min(H - height, Math.max(0, y - height / 2))
  if (avoid && left < MORNING_BOX.right && top < MORNING_BOX.bottom) {
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
 * scene). Empty for moveIn: it has no scene manipulation (the desk slot under the scene finishes it).
 * `id` picks the species' hand-picked points on its own pictures (flowers, fruits, dry twigs).
 * `avoidMorning`: the morning card is up (top left), so targets keep out of its box; once it is closed the
 * targets sit right on what they mark (a dandelion's flower head is at the very top of a small scene).
 */
export function careTargets(task: CareTaskId, L: SceneLayout, pic: PlantArt, id?: SpeciesId, avoidMorning = true): Rect[] {
  const { W, H } = sceneSize(L)
  const g = careGeo(L)
  const u = g.u
  const at = (x: number, y: number, w: number, h: number, min?: number) => box(x, y, w, h, W, H, avoidMorning, min)
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
    case 'prune':
      return pointTargets(carePoints('dry', L, pic, id), 60 * u, 56, W, H, avoidMorning, at)
    case 'pollinate':
      return pointTargets(carePoints('flower', L, pic, id), 56 * u, 48, W, H, avoidMorning, at)
    case 'shakePollen':
      // the whole plant: tapped or swung across its stem
      return [at(g.cx, g.top + g.plantH * 0.45, Math.max(150 * u, 0.5 * g.plantH), g.plantH * 0.75, 72)]
    case 'harvestSeed':
    case 'harvest':
      return pointTargets(carePoints('fruit', L, pic, id), 56 * u, 52, W, H, avoidMorning, at)
    case 'winterWrap': {
      const w = wrapAt(g)
      const s = strawAt(g)
      return [at(w.x, g.ground - w.h / 2, 60 * u, w.h, 56), at(s.x, s.y, s.w, 64 * u, 64)]
    }
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
