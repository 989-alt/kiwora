import type { Mode } from '../sim/types'
import './screens/Screens.css'

/** A small pill saying how a plant was grown. A record without a mode (kept by a short code) is a daily one. */
export function ModeBadge({ mode }: { mode: Mode }) {
  return <span className={`mode-badge mode-badge--${mode}`}>{mode === 'quick' ? '한 번에' : '매일'}</span>
}
