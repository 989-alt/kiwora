import type { ObsPart } from '../../data/observations'
import type { SpeciesId, StageId } from '../../sim/species'
import { lensArt, plantArt, type PlantArt } from '../art'
import { seedSpots } from '../care/Sow'
import { carePoints } from '../care/targets'
import type { SceneLayout } from '../PlantView'
import './observe.css'

type P = [number, number]

/** The point of the plant picture (its px) the magnifier looks at, and how much of the picture (its px) fills the lens. */
export function lensFocus(part: ObsPart, pic: PlantArt, id: SpeciesId, stage: StageId, L: SceneLayout): { at: P; span: number } {
  const a = pic.a
  const h = a.stemY - a.top
  const left = a.left ?? 0
  const right = a.right ?? a.w
  const toPic = ([x, y]: P): P => [(x - L.plant.x) / L.plant.scale, (y - L.plant.y) / L.plant.scale]
  switch (part) {
    case 'seed':
      return { at: [(left + right) / 2, (a.top + a.stemY) / 2], span: Math.max(right - left, h) * 1.05 }
    case 'flower':
    case 'fruit':
      return { at: toPic(carePoints(part, L, pic, id)[0]), span: 0.28 * h }
    case 'stem':
      // a bare tree in winter / spring: buds on the upper branches; else the lower stem
      return stage === 'winter' || stage === 'newShoot' ? { at: [a.stemX, a.top + 0.3 * h], span: 0.36 * h } : { at: [a.stemX, a.top + 0.68 * h], span: 0.34 * h }
    case 'leaf':
    default:
      // a sprout is small: the whole of it; else one leaf (a measured leaf spot when the picture has one)
      if (stage === 'sprout') return { at: [a.stemX, a.top + 0.32 * h], span: 0.8 * h }
      return { at: a.spots?.[0] ?? [left + 0.28 * (right - left), a.top + 0.42 * h], span: 0.32 * h }
  }
}

/** Keeps the frame this far (scene px) inside the scene edges. */
const EDGE = 4

/**
 * Where the magnifier is held (scene px): over the observed part like a real magnifier, the zoomed picture
 * round the looked-at point in the lens. A seed under the soil: over the middle seed spot. The lens keeps
 * the old size rule (150..260 px), shrinks (not below 150) before it moves, and moves only as far as needed
 * to keep the whole frame, handle too, inside the scene.
 */
export function lensPlacement(L: SceneLayout, speciesId: SpeciesId, stage: StageId, part: ObsPart) {
  const W = L.bg.w + 2 * L.bg.x
  const H = L.bg.y + L.bg.h
  const A = lensArt()
  const pic = plantArt(speciesId, part === 'seed' ? 'seed' : stage)
  const { at, span } = lensFocus(part, pic, speciesId, stage, L)
  const s = seedSpots(L)[1]
  const target: P = part === 'seed' ? [s.x, s.y] : [L.plant.x + at[0] * L.plant.scale, L.plant.y + at[1] * L.plant.scale]
  // frame extents round the lens centre, per px of lens diameter
  const ext = { l: A.cx / (2 * A.r), r: (A.w - A.cx) / (2 * A.r), t: A.cy / (2 * A.r), b: (A.h - A.cy) / (2 * A.r) }
  const rule = Math.round(Math.min(260, Math.max(150, 0.42 * Math.min(W, H))))
  // the largest lens whose frame fits in the scene at all, and the largest that fits held right on the target
  const cap = Math.min((W - 2 * EDGE) / (ext.l + ext.r), (H - 2 * EDGE) / (ext.t + ext.b))
  const onTarget = Math.min(
    (target[0] - EDGE) / ext.l,
    (W - EDGE - target[0]) / ext.r,
    (target[1] - EDGE) / ext.t,
    (H - EDGE - target[1]) / ext.b,
  )
  const D = Math.min(Math.min(rule, cap), Math.max(Math.min(150, cap), onTarget))
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const center: P = [
    clamp(target[0], EDGE + ext.l * D, W - EDGE - ext.r * D),
    clamp(target[1], EDGE + ext.t * D, H - EDGE - ext.b * D),
  ]
  const k = D / (2 * A.r)
  const frame = { left: center[0] - A.cx * k, top: center[1] - A.cy * k, width: A.w * k, height: A.h * k }
  const zoom = D / span
  const img = { left: D / 2 - at[0] * zoom, top: D / 2 - at[1] * zoom, width: pic.a.w * zoom, height: pic.a.h * zoom }
  return { D, center, target, frame, at, zoom, img, pic, frameSrc: A.src, k }
}

type Props = { L: SceneLayout; speciesId: SpeciesId; stage: StageId; part: ObsPart }

/**
 * The magnifier over the scene, held over the observed part: the stage's own picture, enlarged, in a round
 * window under the clay frame's see-through lens (the frame picture lies on top). A seed under the soil: the
 * lens over the sown spot shows the seed picture.
 */
export function Magnifier({ L, speciesId, stage, part }: Props) {
  const m = lensPlacement(L, speciesId, stage, part)
  // the round picture reaches a little under the rim, so no gap shows at its edge
  const o = 3 * m.k
  const size = m.D + 2 * o
  return (
    <div className="obs-mag-layer" data-part={part}>
      <div className="obs-lens" style={{ left: m.center[0] - size / 2, top: m.center[1] - size / 2, width: size, height: size }}>
        <img src={m.pic.src} alt="" draggable={false} style={{ ...m.img, left: m.img.left + o, top: m.img.top + o }} />
      </div>
      <img className="obs-lens-frame" src={m.frameSrc} alt="" draggable={false} style={m.frame} />
    </div>
  )
}
