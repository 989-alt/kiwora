import type { ReactNode } from 'react'
import type { SpeciesId } from '../../sim/species'
import type { PlantArt } from '../art'
import type { SceneLayout } from '../PlantView'
import type { usePress } from './press'
import { place, type Rect } from './targets'

export type Pt = { x: number; y: number }

/** What every care component gets from CareLayer. */
export type CareProps = {
  L: SceneLayout
  /** careTargets(task, L, pic), in the component's order. */
  rects: Rect[]
  pic: PlantArt
  speciesId: SpeciesId
  disabled: boolean
  sound: boolean
  /** Called once, when the care is finished. */
  onDone: () => void
  /** Client (viewport) point → scene point. */
  toScene: (p: Pt) => Pt
}

/** A transparent touch target over the scene; `mark` draws the pulsing ring that says "here". */
export function Target({
  r,
  label,
  disabled,
  press,
  mark = true,
  className = '',
  tut,
  children,
}: {
  r: Rect
  label: string
  disabled: boolean
  press: ReturnType<typeof usePress>
  mark?: boolean
  className?: string
  /** The first-visit tip bubble points at this (data-tut). */
  tut?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      className={`care-target${mark ? ' care-target--mark' : ''} ${className}`}
      aria-label={label}
      data-tut={tut}
      disabled={disabled}
      style={place(r)}
      {...press}
    >
      {children}
    </button>
  )
}

/** The step line at the bottom left of the scene (what to do now, and how far along). */
export function CareHint({ children }: { children: ReactNode }) {
  return (
    <p className="care-hint" aria-live="polite">
      {children}
    </p>
  )
}

/** A picture placed by one of its own points: (ax, ay) of the picture (its px) lands on (x, y), drawn at scale s. */
export function picStyle(w: number, h: number, ax: number, ay: number, x: number, y: number, s: number) {
  return { left: x - ax * s, top: y - ay * s, width: w * s, height: h * s }
}
