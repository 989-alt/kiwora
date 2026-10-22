import { useEffect, useRef, type PointerEvent } from 'react'
import type { SceneLayout } from '../PlantView'
import { asset } from '../art'
import { startWater } from '../sound'
import './tools.css'

const TICK_MS = 100
export const WATER_PER_TICK = 1.2
/** A click this soon after a press belongs to that press (its pour already counted). */
export const PRESS_CLICK_MS = 1000

type Props = {
  disabled: boolean
  sound: boolean
  onWater: (amount: number) => void
  onPourChange: (pouring: boolean) => void
  /** Why the can can't be used yet (e.g. the seed is not sown): shown as its name, and the can is disabled. */
  blocked?: string
}

/**
 * Hold to pour: one `water` every 100 ms (12 per second) while the press lasts.
 * A plain click without a press (keyboard Enter/Space, a screen reader) gives one dose.
 */
export function WateringCan({ disabled: off, sound, onWater, onPourChange, blocked }: Props) {
  const disabled = off || blocked !== undefined
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopSound = useRef<() => void>(() => {})
  const latest = useRef({ onWater, onPourChange })
  latest.current = { onWater, onPourChange }
  const lastPress = useRef(Number.NEGATIVE_INFINITY)

  const stop = () => {
    lastPress.current = Date.now()
    if (timer.current === null) return
    clearInterval(timer.current)
    timer.current = null
    stopSound.current()
    stopSound.current = () => {}
    latest.current.onPourChange(false)
  }

  const start = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || timer.current !== null) return
    lastPress.current = Date.now()
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // pointer already gone
    }
    latest.current.onWater(WATER_PER_TICK)
    timer.current = setInterval(() => latest.current.onWater(WATER_PER_TICK), TICK_MS)
    stopSound.current = startWater(sound)
    latest.current.onPourChange(true)
  }

  useEffect(() => {
    if (disabled) stop()
  }, [disabled])
  useEffect(() => {
    // A press can end without pointerup when the tab is hidden or the window loses focus.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('blur', stop)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('blur', stop)
      stop()
    }
  }, [])

  const onClick = () => {
    if (disabled || Date.now() - lastPress.current < PRESS_CLICK_MS) return
    onWater(WATER_PER_TICK)
  }

  return (
    <button
      type="button"
      className="tool tool--water"
      data-tut="water"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <img src={asset('tools/watering_can.png')} alt="" draggable={false} />
      <span className="tool-text">
        {blocked ? (
          <span className="tool-name tool-name--blocked">{blocked}</span>
        ) : (
          <>
            <span className="tool-name">물 주기</span>
            <span className="tool-hint">길게 꾹 눌러요</span>
          </>
        )}
      </span>
    </button>
  )
}

/** Tilted can beside the stem, pouring drops from its spout onto the soil, shown while pouring. */
export function WaterStream({ layout }: { layout: SceneLayout }) {
  const u = layout.unit
  const soilX = layout.pot.x + layout.pot.w / 2
  const soilY = layout.soilLine
  const size = 130 * u
  const imgH = (size * 215) / 256
  // spout tip of tools/watering_can.png is at (0%, 44%)
  const tipX = soilX + 26 * u
  const tipY = soilY - 80 * u
  return (
    <div className="water-stream" aria-hidden="true">
      <img
        className="water-can"
        src={asset('tools/watering_can.png')}
        alt=""
        draggable={false}
        style={{ left: tipX, top: tipY - 0.44 * imgH, width: size }}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="water-drop"
          style={{
            left: tipX - 8 * u + ((i % 3) - 1) * 5 * u,
            top: tipY,
            height: soilY - tipY + 4 * u,
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}
    </div>
  )
}
