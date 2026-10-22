import { useRef, useState, type PointerEvent } from 'react'
import { asset } from '../art'
import { plink } from '../sound'
import { PRESS_CLICK_MS } from './WateringCan'
import './tools.css'

export const DRAG_START_PX = 8

type Props = {
  disabled: boolean
  sound: boolean
  onPellet: () => void
  /** True while a pellet is being dragged (the pot shows it is a drop target). */
  onDragChange: (dragging: boolean) => void
  /** What the pellet is dragged to (a noun that takes '으로'): the pot, or the ground in the yard. */
  target?: string
}

const overPot = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-drop="pot"]') != null

/** Drag a pellet onto the pot (or just tap) to give 1 pellet. A plain click (keyboard, screen reader) gives 1 too. */
export function Fertilizer({ disabled, sound, onPellet, onDragChange, target = '화분' }: Props) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  // Whether this press became a drag is decided from the ref, not render state, so a fast flick is never a tap.
  const dragging = useRef(false)
  // A click right after a press is that press's own click (the tap already gave its pellet).
  const lastPress = useRef(Number.NEGATIVE_INFINITY)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)

  const give = () => {
    onPellet()
    plink(sound)
  }

  const end = (dropped: boolean, e?: PointerEvent<HTMLButtonElement>) => {
    const s = start.current
    if (!s || (e && e.pointerId !== s.id)) return
    lastPress.current = Date.now()
    start.current = null
    const wasDrag = dragging.current
    dragging.current = false
    setGhost(null)
    if (wasDrag) {
      onDragChange(false)
      if (dropped && e && overPot(e.clientX, e.clientY)) give()
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
          lastPress.current = Date.now()
          e.preventDefault()
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // pointer already gone
          }
          start.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
          dragging.current = false
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || e.pointerId !== s.id) return
          if (!dragging.current) {
            if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_START_PX) return
            dragging.current = true
            onDragChange(true)
          }
          setGhost({ x: e.clientX, y: e.clientY })
        }}
        onPointerUp={(e) => {
          // a flick can end before any move event: count the distance at release too
          const s = start.current
          if (s && e.pointerId === s.id && Math.hypot(e.clientX - s.x, e.clientY - s.y) >= DRAG_START_PX && !dragging.current) {
            dragging.current = true
            onDragChange(true)
          }
          end(true, e)
        }}
        onPointerCancel={(e) => end(false, e)}
        onLostPointerCapture={(e) => end(false, e)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (!disabled && Date.now() - lastPress.current >= PRESS_CLICK_MS) give()
        }}
      >
        <img src={asset('tools/fertilizer.png')} alt="" draggable={false} />
        <span className="tool-text">
          <span className="tool-name">영양분</span>
          <span className="tool-hint">{target}으로 끌어요</span>
        </span>
      </button>
      {ghost && <span className="pellet-ghost" aria-hidden="true" style={{ left: ghost.x, top: ghost.y }} />}
    </>
  )
}
