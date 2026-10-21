import { useRef, useState, type PointerEvent } from 'react'
import { plink } from '../sound'
import './tools.css'

export const DRAG_START_PX = 8

type Props = {
  disabled: boolean
  sound: boolean
  onPellet: () => void
  /** True while a pellet is being dragged (the pot shows it is a drop target). */
  onDragChange: (dragging: boolean) => void
}

const overPot = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-drop="pot"]') != null

/** Drag a pellet onto the pot (or just tap) to give 1 pellet. */
export function Fertilizer({ disabled, sound, onPellet, onDragChange }: Props) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)

  const give = () => {
    onPellet()
    plink(sound)
  }

  const end = (dropped: boolean, e?: PointerEvent<HTMLButtonElement>) => {
    const s = start.current
    if (!s || (e && e.pointerId !== s.id)) return
    start.current = null
    if (ghost) {
      if (dropped && e && overPot(e.clientX, e.clientY)) give()
      setGhost(null)
      onDragChange(false)
    } else if (dropped) {
      give() // a tap also gives one pellet
    }
  }

  return (
    <>
      <button
        type="button"
        className="tool tool--fert"
        disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) return
          e.preventDefault()
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // pointer already gone
          }
          start.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || e.pointerId !== s.id) return
          if (!ghost && Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_START_PX) return
          if (!ghost) onDragChange(true)
          setGhost({ x: e.clientX, y: e.clientY })
        }}
        onPointerUp={(e) => end(true, e)}
        onPointerCancel={(e) => end(false, e)}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled) give()
          }
        }}
      >
        <img src="/tools/fertilizer.png" alt="" draggable={false} />
        <span className="tool-text">
          <span className="tool-name">영양분</span>
          <span className="tool-hint">화분으로 끌어요</span>
        </span>
      </button>
      {ghost && <span className="pellet-ghost" aria-hidden="true" style={{ left: ghost.x, top: ghost.y }} />}
    </>
  )
}
