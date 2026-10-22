import type { ObsPart } from '../../data/observations'
import type { SpeciesId, StageId } from '../../sim/species'
import { plantArt, type PlantArt } from '../art'
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

type Props = { L: SceneLayout; speciesId: SpeciesId; stage: StageId; part: ObsPart }

/**
 * The magnifier over the scene: a round lens at the top right shows the part of the plant (the stage's own
 * picture, enlarged); a ring on the plant and a line show where it looks. A seed under the soil: the lens
 * shows the seed picture.
 */
export function Magnifier({ L, speciesId, stage, part }: Props) {
  const W = L.bg.w + 2 * L.bg.x
  const H = L.bg.y + L.bg.h
  const D = Math.round(Math.min(260, Math.max(150, 0.42 * Math.min(W, H))))
  const lens = { left: W - D - 24, top: 24 }
  const pic = plantArt(speciesId, part === 'seed' ? 'seed' : stage)
  const { at, span } = lensFocus(part, pic, speciesId, stage, L)
  const z = D / span
  const img = { left: D / 2 - at[0] * z, top: D / 2 - at[1] * z, width: pic.a.w * z, height: pic.a.h * z }
  // where it looks on the plant (scene px); none for a seed under the soil
  const onPlant: P | null = part === 'seed' ? null : [L.plant.x + at[0] * L.plant.scale, L.plant.y + at[1] * L.plant.scale]
  const ring = Math.max(22, (span * L.plant.scale) / 2)
  const c: P = [lens.left + D / 2, lens.top + D / 2]

  return (
    <div className="obs-mag-layer" data-part={part}>
      {onPlant && (
        <svg className="obs-mag-guide" width="100%" height="100%" aria-hidden="true">
          <line x1={onPlant[0]} y1={onPlant[1]} x2={c[0]} y2={c[1]} />
          <circle cx={onPlant[0]} cy={onPlant[1]} r={ring} />
        </svg>
      )}
      <div className="obs-lens" style={{ left: lens.left, top: lens.top, width: D, height: D }}>
        <img src={pic.src} alt="" draggable={false} style={img} />
      </div>
      <span className="obs-lens-handle" style={{ left: lens.left + D * 0.82, top: lens.top + D * 0.82 }} aria-hidden="true" />
    </div>
  )
}
