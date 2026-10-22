import { useRef, useState } from 'react'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { plink, pop } from '../sound'
import { CareHint, Target, picStyle, type CareProps, type Pt } from './parts'
import { usePress } from './press'
import { careGeo, hits, stakeAt } from './targets'

export const WRAPS = 3

/** stake.webp: the visible stick runs from y 20 to 490 (of 512), centered on x 254. */
const STAKE = { cx: 254.5, top: 20, tip: 490 }

/** The stake standing in the soil beside the stem. */
export function PlantedStake({ L }: { L: SceneLayout }) {
  const g = careGeo(L)
  const st = stakeAt(g)
  const pic = propArt('stake')
  const s = st.h / (STAKE.tip - STAKE.top)
  return (
    <img
      className="care-pic care-stake"
      src={pic.src}
      alt=""
      draggable={false}
      style={picStyle(pic.w, pic.h, STAKE.cx, STAKE.tip, st.x, g.ground + 6 * g.u, s)}
    />
  )
}

/** Twine rings around the stem and the stake, from the bottom up. */
export function Wraps({ L, n }: { L: SceneLayout; n: number }) {
  const g = careGeo(L)
  const st = stakeAt(g)
  const midX = (g.cx + st.x) / 2
  const rx = Math.max(14, (st.x - g.cx) / 2 + 12 * g.u)
  const ry = Math.max(4, 6 * g.u)
  return (
    <svg className="care-svg" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const y = g.ground - st.h * (0.22 + 0.24 * i)
        return (
          <g key={i} className="care-wrap">
            <ellipse cx={midX} cy={y} rx={rx} ry={ry} transform={`rotate(-12 ${midX} ${y})`} strokeWidth={Math.max(3, 4 * g.u)} />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * stake: drag the stake leaning by the pot to the mark beside the stem (or tap the mark).
 * stakeTwine: then tap the stem 3 times to wind the vine around the stake.
 */
export function Stake({ L, rects, disabled, sound, onDone, toScene, twine }: CareProps & { twine: boolean }) {
  const [markR, sourceR, stemR] = rects
  const [planted, setPlanted] = useState(false)
  const [wraps, setWraps] = useState(0)
  const [ghost, setGhost] = useState<Pt | null>(null)
  const now = useRef({ planted: false, wraps: 0, finished: false })
  const finish = () => {
    if (now.current.finished) return
    now.current.finished = true
    onDone()
  }
  const plant = () => {
    const n = now.current
    if (n.planted) return
    n.planted = true
    setPlanted(true)
    plink(sound)
    if (!twine) finish()
  }
  const wind = () => {
    const n = now.current
    if (!n.planted || n.wraps >= WRAPS) return
    n.wraps += 1
    setWraps(n.wraps)
    pop(sound)
    if (n.wraps >= WRAPS) finish()
  }
  const mark = usePress({ disabled, onTap: plant })
  const source = usePress({
    disabled,
    onTap: plant,
    onMove: (_step, at, dragging) => {
      if (dragging) setGhost(toScene(at))
    },
    onDrop: (at) => {
      const p = toScene(at)
      if (hits(markR, p.x, p.y)) plant()
    },
    onEnd: () => setGhost(null),
  })
  const stem = usePress({ disabled, onTap: wind })
  const pic = propArt('stake')
  const g = careGeo(L)
  const h = stakeAt(g).h
  const s = h / (STAKE.tip - STAKE.top)
  // the lying-in-wait stake (and the one under the finger) is drawn by its middle
  const loose = (at: Pt, tilt: number) => ({
    ...picStyle(pic.w, pic.h, STAKE.cx, (STAKE.top + STAKE.tip) / 2, at.x, at.y, s),
    transform: `rotate(${tilt}deg)`,
  })

  return (
    <>
      {planted && <PlantedStake L={L} />}
      {twine && wraps > 0 && <Wraps L={L} n={wraps} />}
      {!planted && (
        <>
          <Target r={markR} label="지지대 꽂을 자리" disabled={disabled} press={mark} className="care-slot" />
          {!ghost && (
            <img
              className="care-pic"
              src={pic.src}
              alt=""
              draggable={false}
              // lying on the table, tip to the right
              style={loose({ x: g.cx + g.potHalf + 24 * g.u + h / 2, y: g.surface - 10 * g.u }, -90)}
            />
          )}
          <Target r={sourceR} label="지지대" disabled={disabled} press={source} mark={false} className="care-source" />
        </>
      )}
      {planted && twine && wraps < WRAPS && <Target r={stemR} label="줄기에 덩굴 감기" disabled={disabled} press={stem} />}
      {ghost && <img className="care-pic care-ghost" src={pic.src} alt="" draggable={false} style={loose(ghost, 0)} />}
      <CareHint>
        {!planted
          ? '지지대를 끌어서 줄기 옆에 꽂아요'
          : twine
            ? `줄기를 톡톡 눌러 덩굴을 감아요 ${wraps}/${WRAPS}`
            : '지지대를 세웠어요'}
      </CareHint>
    </>
  )
}
