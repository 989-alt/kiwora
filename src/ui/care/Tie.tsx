import { useRef, useState } from 'react'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink } from '../sound'
import { Target, picStyle, type Pt } from './parts'
import { usePress } from './press'
import { PlantedStake, Wraps, WRAPS } from './Stake'
import { careGeo, hits, strawAt, type Rect } from './targets'

/** stake.webp: the visible stick runs from y 20 to 490 (of 512), centered on x 254. */
const STAKE = { cx: 254.5, top: 20, tip: 490 }

type Props = {
  L: SceneLayout
  /** [trunk, stake lying on the ground], the same places the winter wrap uses. */
  rects: [Rect, Rect]
  tied: boolean
  disabled: boolean
  sound: boolean
  toScene: (p: Pt) => Pt
  onTie: () => void
}

/** The stake standing beside the trunk with the string around both. */
export function TiedStake({ L }: { L: SceneLayout }) {
  return (
    <>
      <PlantedStake L={L} />
      <Wraps L={L} n={WRAPS} />
    </>
  )
}

/**
 * Typhoon day: drag the stake lying by the tree to the trunk (or tap the trunk) to tie the tree to it.
 * Done, it stays standing there for the rest of the day.
 */
export function Tie({ L, rects, tied, disabled, sound, toScene, onTie }: Props) {
  const [trunkR, sourceR] = rects
  const [ghost, setGhost] = useState<Pt | null>(null)
  const done = useRef(false)
  const tie = () => {
    if (done.current) return
    done.current = true
    plink(sound)
    onTie()
  }
  const trunk = usePress({ disabled, onTap: tie })
  const source = usePress({
    disabled,
    onTap: tie,
    onMove: (_step, at, dragging) => {
      if (dragging) setGhost(toScene(at))
    },
    onDrop: (at) => {
      const p = toScene(at)
      if (hits(trunkR, p.x, p.y)) tie()
    },
    onEnd: () => setGhost(null),
  })
  const g = careGeo(L)
  const s = strawAt(g)
  const pic = propArt('stake')
  // short enough to lie in its box: the picture's stick is (tip - top) px long
  const k = (s.w * 1.1) / (STAKE.tip - STAKE.top)
  const lying = (at: Pt, tilt: number) => ({
    ...picStyle(pic.w, pic.h, STAKE.cx, (STAKE.top + STAKE.tip) / 2, at.x, at.y, k),
    transform: `rotate(${tilt}deg)`,
  })
  return (
    <>
      {tied && <TiedStake L={L} />}
      {!tied && (
        <>
          <Target r={trunkR} label="묶을 나무 밑동" disabled={disabled} press={trunk} className="care-slot" />
          {!ghost && <img className="care-pic" src={pic.src} alt="" draggable={false} style={lying(s, -90)} />}
          <Target r={sourceR} label="지지대" disabled={disabled} press={source} mark={false} className="care-source" />
        </>
      )}
      {ghost && <img className="care-pic care-ghost" src={pic.src} alt="" draggable={false} style={lying(ghost, 0)} />}
      <p className="care-hint care-hint--tie" aria-live="polite">
        {tied ? '나무를 지지대에 묶었어요' : '지지대를 끌어서 나무에 묶어요'}
      </p>
    </>
  )
}
