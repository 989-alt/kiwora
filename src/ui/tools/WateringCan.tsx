import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { SceneLayout } from '../PlantView'
import { asset } from '../art'
import { startWater } from '../sound'
import './tools.css'

const TICK_MS = 100
export const WATER_PER_TICK = 1.2

type Props = {
  disabled: boolean
  sound: boolean
  onWater: (amount: number) => void
  onPourChange: (pouring: boolean) => void
}

/** Hold to pour: one `water` every 100 ms (12 per second) while the press lasts. */
export function WateringCan({ disabled, sound, onWater, onPourChange }: Props) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopSound = useRef<() => void>(() => {})
  const latest = useRef({ onWater, onPourChange })
  latest.current = { onWater, onPourChange }

  const stop = () => {
    if (timer.current === null) return
    clearInterval(timer.current)
    timer.current = null
    stopSound.current()
    stopSound.current = () => {}
    latest.current.onPourChange(false)
  }

  const start = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || timer.current !== null) return
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

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) onWater(WATER_PER_TICK)
    }
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
      onKeyDown={onKey}
    >
      <img src={asset('tools/watering_can.png')} alt="" draggable={false} />
      <span className="tool-text">
        <span className="tool-name">물 주기</span>
        <span className="tool-hint">꾹 누르고 있어요</span>
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
