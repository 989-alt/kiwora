import { useRef, useState } from 'react'
import { propArt } from '../art'
import { plink, pop } from '../sound'
import { CareHint, Target, picStyle, type CareProps, type Pt } from './parts'
import { usePress } from './press'
import { careGeo, carePoints, hits } from './targets'

/** brush.webp: the pollen-dusted bristle tip is at (370, 90), the handle end at (111, 462) (of 512). */
const BRUSH = { tipX: 370, tipY: 90, len: 450 }
/** Pollen dots that trail the brush while it is dragged. */
const TRAIL = 7

/** The pollen left on flower B once it is pollinated (stays for the rest of the stage). */
export function PollenOnFlower({ L, pic, speciesId }: Pick<CareProps, 'L' | 'pic' | 'speciesId'>) {
  const [, [x, y]] = carePoints('flower', L, pic, speciesId)
  return <PollenDots at={{ x, y }} size={Math.max(6, 9 * L.unit)} stuck />
}

/** A few pollen dots around a point (scene px), `size` = the biggest dot. */
function PollenDots({ at, size, stuck }: { at: Pt; size: number; stuck?: boolean }) {
  const offs: [number, number, number][] = [
    [0, 0, 1],
    [-0.9, -0.5, 0.7],
    [0.8, -0.7, 0.8],
    [-0.6, 0.8, 0.6],
    [0.9, 0.6, 0.7],
  ]
  return (
    <>
      {offs.map(([dx, dy, k], i) => {
        const d = Math.max(5, size * k)
        return (
          <span
            key={i}
            className={`care-pollen${stuck ? ' care-pollen--stuck' : ''}`}
            style={{ left: at.x + dx * size - d / 2, top: at.y + dy * size - d / 2, width: d, height: d }}
          />
        )
      })}
    </>
  )
}

/**
 * pollinate: the brush rests on flower A. Drag it to flower B (pollen dots follow it), or tap A to dust
 * the brush with pollen and then tap B.
 */
export function Pollinate({ L, rects, pic, speciesId, disabled, sound, onDone, toScene }: CareProps) {
  const [aR, bR] = rects
  const [loaded, setLoaded] = useState(false)
  const [done, setDone] = useState(false)
  const [ghost, setGhost] = useState<Pt | null>(null)
  const [trail, setTrail] = useState<Pt[]>([])
  const now = useRef({ loaded: false, done: false })
  const g = careGeo(L)
  const [a, b] = carePoints('flower', L, pic, speciesId).map(([x, y]) => ({ x, y }))
  const dot = Math.max(7, 11 * g.u)

  const load = () => {
    if (now.current.loaded || now.current.done) return
    now.current.loaded = true
    setLoaded(true)
    plink(sound)
  }
  const finish = () => {
    const n = now.current
    if (n.done) return
    n.done = true
    n.loaded = true
    setLoaded(true)
    setDone(true)
    pop(sound)
    onDone()
  }
  const flowerA = usePress({
    disabled,
    onTap: load,
    onMove: (_step, at, dragging) => {
      if (!dragging || now.current.done) return
      const p = toScene(at)
      setGhost(p)
      setTrail((t) => {
        const last = t[t.length - 1]
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 6) return t
        return [...t, p].slice(-TRAIL)
      })
    },
    onDrop: (at) => {
      const p = toScene(at)
      if (hits(bR, p.x, p.y)) finish()
      // the brush touched flower A on its way: it carries pollen now
      else load()
    },
    onEnd: () => {
      setGhost(null)
      setTrail([])
    },
  })
  const flowerB = usePress({
    disabled,
    onTap: () => {
      if (now.current.loaded) finish()
    },
  })

  const brush = propArt('brush')
  const s = Math.max(70, 110 * g.u) / BRUSH.len
  // where the brush tip is: under the finger, on B when done, on A otherwise (a bit aside while it waits)
  const tip: Pt = ghost ?? (done ? b : loaded ? a : { x: a.x + 10 * g.u, y: a.y - 8 * g.u })
  return (
    <>
      {done && <PollenDots at={b} size={dot} stuck />}
      <img
        className={`care-pic care-brush${ghost ? ' care-ghost' : ''}`}
        src={brush.src}
        alt=""
        draggable={false}
        style={picStyle(brush.w, brush.h, BRUSH.tipX, BRUSH.tipY, tip.x, tip.y, s)}
      />
      {(loaded || ghost) && !done && <PollenDots at={tip} size={dot} />}
      {trail.map((p, i) => {
        // over the brush (the path runs under its handle); older dots are smaller and fainter
        const d = dot * (0.35 + (0.65 * (i + 1)) / trail.length)
        return (
          <span
            key={`t${i}`}
            className="care-pollen care-pollen--trail"
            style={{ left: p.x - d / 2, top: p.y - d / 2, width: d, height: d, opacity: 0.3 + (0.7 * (i + 1)) / trail.length }}
          />
        )
      })}
      {!done && (
        <>
          <Target r={aR} label="꽃가루 묻히기" disabled={disabled} press={flowerA} mark={!loaded} className="care-flower" />
          <Target r={bR} label="다른 꽃에 꽃가루 옮기기" disabled={disabled} press={flowerB} mark={loaded} className="care-flower" />
        </>
      )}
      <CareHint>{done ? '꽃가루를 옮겼어요' : loaded ? '다른 꽃을 눌러 꽃가루를 묻혀요' : '붓을 끌어 다른 꽃에 꽃가루를 옮겨요'}</CareHint>
    </>
  )
}
