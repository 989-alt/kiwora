import { useRef } from 'react'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink } from '../sound'
import { CareHint, Target, type CareProps } from './parts'
import { usePress } from './press'
import { careGeo } from './targets'

/** drainDish.webp: the dish spans x 42..469, y 83..421 (of 512); its middle is at y 252. */
const DISH = { left: 42, right: 469, mid: 252 }

/**
 * The drip dish under the pot. Only its front half is drawn, so the pot seems to stand in it.
 * `wet` adds water in the dish, `dripping` water drops falling from the pot's bottom.
 */
export function Dish({ L, wet, dripping }: { L: SceneLayout; wet: boolean; dripping: boolean }) {
  const g = careGeo(L)
  const pic = propArt('drainDish')
  // seen from the side of the table: as wide as the pot's bottom and a bit, squashed in height
  const s = (150 * g.u) / (DISH.right - DISH.left)
  const sy = s * 0.6
  const left = g.cx - (DISH.left + (DISH.right - DISH.left) / 2) * s
  const top = g.surface - 6 * g.u - DISH.mid * sy
  return (
    <>
      {dripping &&
        [0, 1, 2].map((i) => (
          <span
            key={i}
            className="care-drop"
            style={{
              left: g.cx + (i - 1) * 16 * g.u - 4,
              top: g.surface - 14 * g.u,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
      <img
        className="care-pic care-dish"
        src={pic.src}
        alt=""
        draggable={false}
        style={{ left, top, width: pic.w * s, height: pic.h * sy, clipPath: `inset(${Math.round(DISH.mid * sy)}px 0 0 0)` }}
      />
      {wet && (
        <span
          className="care-dish-water"
          style={{ left: g.cx - 58 * g.u, top: g.surface + 2 * g.u, width: 116 * g.u, height: Math.max(6, 9 * g.u) }}
        />
      )}
    </>
  )
}

/** drainCheck: tap the dish under the pot; water drips out of the pot into it, and the care is done. */
export function Drain({ L, rects, disabled, sound, onDone }: CareProps) {
  const finished = useRef(false)
  const look = usePress({
    disabled,
    onTap: () => {
      if (finished.current) return
      finished.current = true
      plink(sound)
      onDone()
    },
  })
  return (
    <>
      <Dish L={L} wet={false} dripping={false} />
      <Target r={rects[0]} label="물받이 살펴보기" disabled={disabled} press={look} />
      <CareHint>화분 밑 물받이를 톡 눌러 살펴요</CareHint>
    </>
  )
}
