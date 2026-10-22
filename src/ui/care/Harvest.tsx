import { useRef, useState } from 'react'
import type { SpeciesId } from '../../sim/species'
import { plantArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink, pop } from '../sound'
import { CareHint, Target, picStyle, type CareProps, type Pt } from './parts'
import { usePress } from './press'
import { careGeo, carePoints } from './targets'

export const FRUITS = 3

/** Where the seeds land: on the table right of the pot. Bottom middle, scene px. */
const seedSpot = (L: SceneLayout): Pt => {
  const g = careGeo(L)
  return { x: g.cx + g.potHalf + 46 * g.u, y: g.surface }
}

/**
 * The seeds taken out of the fruit (the species' seed picture), lying on the table beside the pot.
 * `from` = the fruit they come out of: they pop from there and land.
 */
export function SeedPile({ L, id, from }: { L: SceneLayout; id: SpeciesId; from?: Pt }) {
  const pic = plantArt(id, 'seed')
  const a = pic.a
  const left = a.left ?? 0
  const right = a.right ?? a.w
  const s = Math.max(48, 72 * L.unit) / (right - left)
  const at = seedSpot(L)
  const style = picStyle(a.w, a.h, (left + right) / 2, a.stemY, at.x, at.y, s)
  return (
    <img
      className={`care-pic care-seeds${from ? ' care-seeds--pop' : ''}`}
      src={pic.src}
      alt=""
      draggable={false}
      style={{
        ...style,
        ...(from ? { ['--from-x' as string]: `${from.x - at.x}px`, ['--from-y' as string]: `${from.y - at.y}px` } : {}),
      }}
    />
  )
}

/**
 * harvestSeed (annuals) / harvest (perennials): three fruits are marked on the plant; tap each to pick it.
 * For an annual the seeds then pop out of the last fruit onto the table (that is the seed the student keeps).
 */
export function Harvest({ L, rects, pic, speciesId, disabled, sound, onDone, seeds }: CareProps & { seeds: boolean }) {
  const [picked, setPicked] = useState<boolean[]>(() => Array(FRUITS).fill(false))
  const [last, setLast] = useState<Pt | null>(null)
  const now = useRef<boolean[]>(Array(FRUITS).fill(false))
  const pts = carePoints('fruit', L, pic, speciesId)
    .slice(0, FRUITS)
    .map(([x, y]) => ({ x, y }))
  const pick = (i: number) => {
    const n = now.current
    if (n[i] || n.every(Boolean)) return
    n[i] = true
    setPicked([...n])
    if (n.every(Boolean)) {
      if (seeds) setLast(pts[i])
      plink(sound)
      onDone()
    } else pop(sound)
  }
  const presses = [
    usePress({ disabled, onTap: () => pick(0) }),
    usePress({ disabled, onTap: () => pick(1) }),
    usePress({ disabled, onTap: () => pick(2) }),
  ]
  // the picked fruit: a round piece of the plant picture around the fruit, lifted off and fading
  const r = Math.max(14, 30 * L.plant.scale)
  const n = picked.filter(Boolean).length
  return (
    <>
      {pts.map((p, i) =>
        picked[i] ? (
          <span
            key={i}
            className="care-picked"
            style={{
              left: p.x - r,
              top: p.y - r,
              width: 2 * r,
              height: 2 * r,
              backgroundImage: `url("${pic.src}")`,
              backgroundSize: `${L.plant.w}px ${L.plant.h}px`,
              backgroundPosition: `${L.plant.x - (p.x - r)}px ${L.plant.y - (p.y - r)}px`,
            }}
          />
        ) : null,
      )}
      {last && <SeedPile L={L} id={speciesId} from={last} />}
      {rects.map((rc, i) => (picked[i] ? null : <Target key={i} r={rc} label={`열매 따기 ${i + 1}`} disabled={disabled} press={presses[i]} />))}
      <CareHint>{n >= FRUITS && seeds ? '씨를 받았어요' : `열매를 톡 눌러 따요 ${n}/${FRUITS}`}</CareHint>
    </>
  )
}
