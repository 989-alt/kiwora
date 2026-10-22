import { useRef } from 'react'
import { measureAnswer, rulerTicks } from '../../sim/measure'
import { usePress } from '../care/press'
import type { SceneLayout } from '../PlantView'
import './observe.css'

/** Width of the ruler strip (scene px). */
const RULER_W = 56
/** The ruler's top end stays this far below the top of the scene. */
const TOP_GAP = 6

type Props = {
  L: SceneLayout
  /** The plant's height (at least 1 cm when the ruler is out). */
  heightCm: number
  /** Middle of the ruler (scene px); null = beside the plant's stem. */
  x: number | null
  /** After two misses: the answer's mark lights up and is a button. */
  hint: boolean
  disabled: boolean
  onMove: (x: number) => void
  /** The lit mark was tapped. */
  onPickTick: () => void
}

/** Where the ruler stands when it is not dragged anywhere: just right of the stem. */
export function besidePlant(L: SceneLayout): number {
  return L.plant.x + L.plant.originX + Math.max(40, 64 * L.unit)
}

/**
 * The ruler stood in the soil beside the plant (drawn, not a picture): its 0 mark on the ground line and one
 * cm the same as the drawn plant's cm (the plant is drawn at its height, so the top meets the reading).
 * It can be dragged sideways.
 */
const TICK_BTN_W = 76

export function Ruler({ L, heightCm, x, hint, disabled, onMove, onPickTick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const pxPerCm = (L.groundY - L.plantTopY) / heightCm
  const { minor, label } = rulerTicks(pxPerCm)
  const W = L.bg.w + 2 * L.bg.x
  const cx = Math.min(W - RULER_W / 2 - 4, Math.max(RULER_W / 2 + 4, x ?? besidePlant(L)))
  const left = cx - RULER_W / 2
  const maxCm = Math.floor((L.groundY - TOP_GAP - 4) / pxPerCm)
  const top = L.groundY - maxCm * pxPerCm - TOP_GAP
  const yAt = (cm: number) => L.groundY - cm * pxPerCm
  const answer = measureAnswer(heightCm)
  // the pick-this-tick button sits right of the ruler; near the right edge it flips to the left side
  const flip = left + RULER_W + 6 + TICK_BTN_W > W

  const marks: number[] = []
  for (let cm = 0; cm <= maxCm; cm++) if (cm % minor === 0 || cm % label === 0) marks.push(cm)

  const press = usePress({
    disabled,
    onMove: (_step, at) => {
      const r = ref.current?.parentElement?.getBoundingClientRect()
      if (r) onMove(at.x - r.left)
    },
  })

  return (
    <div ref={ref} className="obs-ruler-layer">
      <svg className="obs-ruler" width="100%" height="100%" aria-hidden="true">
        <rect className="obs-ruler-body" x={left} y={top} width={RULER_W} height={L.groundY + 12 - top} rx={6} />
        {marks.map((cm) => {
          const long = cm % label === 0
          const len = long ? 22 : cm % 5 === 0 ? 16 : 10
          const y = yAt(cm)
          return (
            <g key={cm}>
              <line className="obs-tick" data-cm={cm} x1={left} x2={left + len} y1={y} y2={y} />
              {long && (
                <text className="obs-tick-num" x={left + 26} y={y + 6}>
                  {cm}
                </text>
              )}
            </g>
          )
        })}
        {hint && <line className="obs-tick-hint" x1={left - 8} x2={left + RULER_W + 8} y1={yAt(answer)} y2={yAt(answer)} />}
      </svg>
      {/* the ruler body is the drag handle (a plain strip, no label of its own) */}
      <div
        className="obs-ruler-grip"
        style={{ left, top, width: RULER_W, height: L.groundY - top }}
        aria-hidden="true"
        {...press}
      />
      {hint && (
        <button
          type="button"
          className="obs-tick-btn"
          aria-label={`${answer} cm 눈금`}
          disabled={disabled}
          style={flip ? { right: W - left + 6, top: yAt(answer) - 26 } : { left: left + RULER_W + 6, top: yAt(answer) - 26 }}
          onClick={onPickTick}
        >
          {answer}
        </button>
      )}
    </div>
  )
}
