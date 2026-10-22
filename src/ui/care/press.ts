import { useRef, type PointerEvent } from 'react'
import { PRESS_CLICK_MS } from '../tools/WateringCan'

/** A press that moves less than this (px) is a tap. */
export const TAP_SLOP = 14

type Pt = { x: number; y: number }

/**
 * Time of the last press on any care target. A press can change what is under the finger (the stake mark
 * gives way to the stem): the click the browser sends after that press must not count on the new target.
 */
let lastPress = Number.NEGATIVE_INFINITY

type Opts = {
  disabled: boolean
  onTap?: () => void
  /** Each pointer move while pressed: px moved since the last move and the client point. */
  onMove?: (step: number, at: Pt, dragging: boolean) => void
  /** A press that moved (a drag) ended at this client point. */
  onDrop?: (at: Pt) => void
  /** The press ended or was cancelled. */
  onEnd?: () => void
}

/**
 * Pointer handlers for a care target: a tap (touch or mouse, press and release without moving) calls onTap;
 * with onMove/onDrop the target keeps the pointer while pressed, so it can be dragged or rubbed. A plain
 * click without a press (keyboard, screen reader) is a tap too.
 */
export function usePress({ disabled, onTap, onMove, onDrop, onEnd }: Opts) {
  const start = useRef<{ id: number; x: number; y: number; last: Pt; dragging: boolean } | null>(null)
  const keep = onMove !== undefined || onDrop !== undefined

  const finish = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = start.current
    if (!s || e.pointerId !== s.id) return
    start.current = null
    lastPress = Date.now()
    const at = { x: e.clientX, y: e.clientY }
    const dragging = s.dragging || Math.hypot(at.x - s.x, at.y - s.y) >= TAP_SLOP
    if (!cancelled && !disabled) {
      if (!dragging) onTap?.()
      else onDrop?.(at)
    }
    onEnd?.()
  }

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (disabled) return
      e.preventDefault()
      lastPress = Date.now()
      if (keep) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // pointer already gone
        }
      }
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, last: { x: e.clientX, y: e.clientY }, dragging: false }
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s || e.pointerId !== s.id || disabled) return
      const at = { x: e.clientX, y: e.clientY }
      const step = Math.hypot(at.x - s.last.x, at.y - s.last.y)
      s.last = at
      if (!s.dragging && Math.hypot(at.x - s.x, at.y - s.y) >= TAP_SLOP) s.dragging = true
      onMove?.(step, at, s.dragging)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => finish(e, true),
    onLostPointerCapture: (e: PointerEvent<HTMLElement>) => finish(e, true),
    onClick: () => {
      if (!disabled && Date.now() - lastPress >= PRESS_CLICK_MS) onTap?.()
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
