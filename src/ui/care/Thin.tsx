import { useRef, useState } from 'react'
import { plantArt } from '../art'
import { pop } from '../sound'
import { CareHint, Target, picStyle, type CareProps } from './parts'
import { usePress } from './press'
import { careGeo, weakSprouts } from './targets'

/** thin: two weak sprouts (small, pale copies of the sprout picture) beside the plant; tap each to pull it out. */
export function Thin({ L, rects, speciesId, disabled, sound, onDone }: CareProps) {
  const [pulled, setPulled] = useState<boolean[]>([false, false])
  const now = useRef([false, false])
  const g = careGeo(L)
  const weak = weakSprouts(g)
  const pic = plantArt(speciesId, 'sprout')
  const s = weak.h / (pic.a.stemY - pic.a.top)

  const pull = (i: number) => {
    const n = now.current
    if (n[i] || n.every(Boolean)) return
    n[i] = true
    setPulled([...n])
    pop(sound)
    if (n.every(Boolean)) onDone()
  }
  const p0 = usePress({ disabled, onTap: () => pull(0) })
  const p1 = usePress({ disabled, onTap: () => pull(1) })
  const presses = [p0, p1]

  return (
    <>
      {weak.xs.map((x, i) => (
        <img
          key={`pic${i}`}
          className={`care-pic care-weak${pulled[i] ? ' care-weak--pulled' : ''}`}
          src={pic.src}
          alt=""
          draggable={false}
          style={{
            ...picStyle(pic.a.w, pic.a.h, pic.a.stemX, pic.a.stemY, x, g.ground + 4 * g.u, s),
            transformOrigin: `${pic.a.stemX * s}px ${pic.a.stemY * s}px`,
            ['--tilt' as string]: i === 0 ? '-9deg' : '8deg',
          }}
        />
      ))}
      {rects.map((r, i) =>
        pulled[i] ? null : <Target key={i} r={r} label={`약한 싹 뽑기 ${i + 1}`} disabled={disabled} press={presses[i]} />,
      )}
      <CareHint>약한 싹을 톡 눌러 뽑아요 {pulled.filter(Boolean).length}/2</CareHint>
    </>
  )
}
