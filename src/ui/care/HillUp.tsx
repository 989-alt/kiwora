import { useRef, useState } from 'react'
import { propArt } from '../art'
import type { SceneLayout } from '../PlantView'
import { pop } from '../sound'
import { CareHint, Target, type CareProps } from './parts'
import { usePress } from './press'
import { careGeo, heapXs } from './targets'

export const HILL_TAPS = 3

/** The soil heaps on both sides of the stem base; `sizes` = taps on each side so far. */
export function Heaps({ L, sizes }: { L: SceneLayout; sizes: [number, number] }) {
  const g = careGeo(L)
  return (
    <>
      {heapXs(g).map((x, i) => {
        const k = Math.min(HILL_TAPS, sizes[i])
        const w = (34 + 12 * k) * g.u
        const h = (8 + 7 * k) * g.u
        return (
          <span
            key={`${i}-${k}`}
            className={`care-heap${k > 0 ? ' care-heap--grown' : ''}`}
            style={{ left: x - w / 2, top: g.ground - 8 * g.u - h, width: w, height: h + 8 * g.u }}
          />
        )
      })}
    </>
  )
}

/** hillUp: tap the soil beside the stem base 3 times (either side); the heaps grow with each tap. */
export function HillUp({ L, rects, disabled, sound, onDone }: CareProps) {
  const [sizes, setSizes] = useState<[number, number]>([0, 0])
  const now = useRef({ sizes: [0, 0] as [number, number], finished: false })
  const heap = (i: 0 | 1) => {
    const n = now.current
    if (n.finished) return
    n.sizes = [...n.sizes] as [number, number]
    n.sizes[i] += 1
    setSizes(n.sizes)
    pop(sound)
    if (n.sizes[0] + n.sizes[1] >= HILL_TAPS) {
      n.finished = true
      onDone()
    }
  }
  const left = usePress({ disabled, onTap: () => heap(0) })
  const right = usePress({ disabled, onTap: () => heap(1) })
  const g = careGeo(L)
  const scoop = propArt('soilScoop')
  const sw = Math.max(48, 84 * g.u)
  const total = sizes[0] + sizes[1]
  return (
    <>
      <Heaps L={L} sizes={sizes} />
      {/* the trowel stands stuck in the soil at the right edge of the pot (its blade tip is at the bottom of the picture) */}
      <img
        className="care-pic care-scoop"
        src={scoop.src}
        alt=""
        draggable={false}
        style={{ left: g.cx + 86 * g.u - sw / 2, top: g.ground - 4 * g.u - sw * (484 / 512), width: sw, height: sw, transformOrigin: '50% 94%' }}
      />
      <Target r={rects[0]} label="왼쪽 흙 북돋우기" disabled={disabled} press={left} />
      <Target r={rects[1]} label="오른쪽 흙 북돋우기" disabled={disabled} press={right} />
      <CareHint>
        밑동 옆 흙을 톡톡 눌러 북돋아요 {Math.min(total, HILL_TAPS)}/{HILL_TAPS}
      </CareHint>
    </>
  )
}
