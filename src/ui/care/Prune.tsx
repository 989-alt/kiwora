import { useRef, useState } from 'react'
import { propArt } from '../art'
import { pop } from '../sound'
import { CareHint, Target, picStyle, type CareProps } from './parts'
import { usePress } from './press'
import { careGeo, carePoints } from './targets'

export const DRY_TWIGS = 3

/** dryBranch.webp: the twig's cut end is at (190, 485), its tip at about (185, 28) (of 512). */
const TWIG = { baseX: 190, baseY: 485, len: 457 }

/**
 * prune: three dry twigs stick out of the young tree's crown, each with the shears beside it; tap a twig
 * to cut it off (it drops away).
 */
export function Prune({ L, rects, pic, speciesId, disabled, sound, onDone }: CareProps) {
  const [cut, setCut] = useState<boolean[]>(() => Array(DRY_TWIGS).fill(false))
  const now = useRef<boolean[]>(Array(DRY_TWIGS).fill(false))
  const snip = (i: number) => {
    const n = now.current
    if (n[i] || n.every(Boolean)) return
    n[i] = true
    setCut([...n])
    pop(sound)
    if (n.every(Boolean)) onDone()
  }
  const presses = [
    usePress({ disabled, onTap: () => snip(0) }),
    usePress({ disabled, onTap: () => snip(1) }),
    usePress({ disabled, onTap: () => snip(2) }),
  ]
  const g = careGeo(L)
  const twig = propArt('dryBranch')
  const shears = propArt('shears')
  const len = Math.max(56, 92 * g.u)
  const s = len / TWIG.len
  const sz = Math.max(40, 52 * g.u)
  // the twigs point away from the middle of the crown
  const mid = { x: g.cx, y: g.top + 0.42 * g.plantH }
  const pts = carePoints('dry', L, pic, speciesId).slice(0, DRY_TWIGS)

  return (
    <>
      {pts.map(([x, y], i) => {
        const dx = x - mid.x
        const dy = y - mid.y
        const d = Math.hypot(dx, dy) || 1
        const ux = dx / d
        const uy = dy / d
        const deg = (Math.atan2(ux, -uy) * 180) / Math.PI
        // the cut end sits a little inside the crown
        const bx = x - ux * len * 0.25
        const by = y - uy * len * 0.25
        // the shears beside the middle of the twig, blades toward it
        const mx = bx + ux * len * 0.5
        const my = by + uy * len * 0.5
        const nx = -uy
        const ny = ux
        const side = i % 2 === 0 ? 1 : -1
        const sx = mx + nx * side * sz * 0.75
        const sy = my + ny * side * sz * 0.75
        const blade = (Math.atan2(-nx * side, ny * side) * 180) / Math.PI
        return (
          <div key={i} className={`care-twig${cut[i] ? ' care-twig--cut' : ''}`} style={{ left: 0, top: 0 }}>
            <img
              className="care-pic care-dry"
              src={twig.src}
              alt=""
              draggable={false}
              style={{
                ...picStyle(twig.w, twig.h, TWIG.baseX, TWIG.baseY, bx, by, s),
                transformOrigin: `${TWIG.baseX * s}px ${TWIG.baseY * s}px`,
                transform: `rotate(${deg}deg)`,
              }}
            />
            {!cut[i] && (
              <img
                className="care-pic care-shears"
                src={shears.src}
                alt=""
                draggable={false}
                style={{ left: sx - sz / 2, top: sy - sz / 2, width: sz, height: sz, transform: `rotate(${blade}deg)` }}
              />
            )}
          </div>
        )
      })}
      {rects.map((r, i) => (cut[i] ? null : <Target key={i} r={r} label="마른 가지 자르기" disabled={disabled} press={presses[i]} />))}
      <CareHint>
        마른 가지를 톡 눌러 잘라요 {cut.filter(Boolean).length}/{DRY_TWIGS}
      </CareHint>
    </>
  )
}
