import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { Place } from '../../sim/types'
import { DRAG_START_PX } from './Fertilizer'
import './tools.css'

export type RoomPlace = 'window' | 'desk' | 'shade'

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const SLOTS: { place: RoomPlace; label: string; icon: ReactNode }[] = [
  {
    place: 'window',
    label: '창가',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 3v18M3 12h18" />
      </svg>
    ),
  },
  {
    place: 'desk',
    label: '책상',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 10h18" />
        <path d="M5 10v9M19 10v9" />
      </svg>
    ),
  },
  {
    place: 'shade',
    label: '그늘',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M20 15.5A8 8 0 1 1 8.5 4a6.5 6.5 0 0 0 11.5 11.5z" />
      </svg>
    ),
  },
]

const slotAt = (x: number, y: number): RoomPlace | null =>
  (document.elementFromPoint(x, y)?.closest('[data-slot]')?.getAttribute('data-slot') as RoomPlace | null) ?? null

export type PotDrag = {
  /** Spread on the pot touch area. */
  potProps: {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void
    onLostPointerCapture: (e: PointerEvent<HTMLDivElement>) => void
  }
  /** Pointer position while dragging (null = not dragging). */
  ghost: { x: number; y: number } | null
  /** Slot under the pointer while dragging. */
  hover: RoomPlace | null
}

/** Drag the pot (after 8 px of movement) and drop it on a slot to move it there; its own slot (`current`) does nothing. */
export function usePotDrag(disabled: boolean, onMove: (place: RoomPlace) => void, current?: Place): PotDrag {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  // Drag state lives in a ref so a fast flick is judged by distance, not by a render that hasn't happened yet.
  const dragging = useRef(false)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState<RoomPlace | null>(null)

  const reset = () => {
    start.current = null
    dragging.current = false
    setGhost(null)
    setHover(null)
  }
  const farEnough = (e: PointerEvent, s: { x: number; y: number }) => Math.hypot(e.clientX - s.x, e.clientY - s.y) >= DRAG_START_PX

  return {
    ghost,
    hover,
    potProps: {
      onPointerDown: (e) => {
        if (disabled) return
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // pointer already gone
        }
        start.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        dragging.current = false
      },
      onPointerMove: (e) => {
        const s = start.current
        if (!s || e.pointerId !== s.id) return
        if (!dragging.current) {
          if (!farEnough(e, s)) return
          dragging.current = true
        }
        setGhost({ x: e.clientX, y: e.clientY })
        setHover(slotAt(e.clientX, e.clientY))
      },
      onPointerUp: (e) => {
        const s = start.current
        if (!s || e.pointerId !== s.id) return
        const target = dragging.current || farEnough(e, s) ? slotAt(e.clientX, e.clientY) : null
        reset()
        if (target && !disabled && target !== current) onMove(target)
      },
      onPointerCancel: reset,
      onLostPointerCapture: reset,
    },
  }
}

type Props = {
  place: Place
  disabled: boolean
  dragging: boolean
  hover: RoomPlace | null
  onPick: (place: RoomPlace) => void
}

/** The three room spots. Tapping a slot also moves the pot (for students who find dragging hard). */
export function PlaceSlots({ place, disabled, dragging, hover, onPick }: Props) {
  return (
    <div className={`slots${dragging ? ' slots--dragging' : ''}`} role="group" aria-label="화분 자리">
      {SLOTS.map((s) => {
        const here = s.place === place
        const cls = ['slot', `slot--${s.place}`, here && 'slot--here', dragging && !here && 'slot--target', hover === s.place && 'slot--hover']
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={s.place}
            type="button"
            data-slot={s.place}
            className={cls}
            aria-pressed={here}
            disabled={disabled}
            onClick={() => {
              if (!here) onPick(s.place)
            }}
          >
            {s.icon}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
