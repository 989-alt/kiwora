import { useEffect, useMemo, useState, type RefObject } from 'react'

export type TipTarget = 'water' | 'pot' | 'bug'

const STEPS: { target: TipTarget; text: string }[] = [
  { target: 'water', text: '물뿌리개를 꾹 누르면 물이 나와요' },
  { target: 'pot', text: '화분을 끌어서 자리를 옮겨요' },
  { target: 'bug', text: '벌레를 톡 눌러 잡아요' },
]

const BUBBLE_W = 300
const GAP = 14

type Pos = { left: number; top: number; arrowX: number; below: boolean }

function place(root: HTMLElement, target: string): Pos | null {
  // No bug yet: point at the pot (in the yard, at the soil around the tree).
  const el = root.querySelector(`[data-tut="${target}"]`) ?? root.querySelector('[data-tut="pot"]') ?? root.querySelector('[data-drop="pot"]')
  if (!el) return null
  const r = root.getBoundingClientRect()
  const t = el.getBoundingClientRect()
  const cx = t.left - r.left + t.width / 2
  const left = Math.max(8, Math.min(r.width - BUBBLE_W - 8, cx - BUBBLE_W / 2))
  const below = t.top - r.top < 120
  const top = below ? t.bottom - r.top + GAP : t.top - r.top - GAP
  return { left, top, arrowX: Math.max(24, Math.min(BUBBLE_W - 24, cx - left)), below }
}

/**
 * First-visit tips: three bubbles (watering can → pot → bug), each closes on tap; `steps` picks some of them
 * (the yard has no pot to move). Only the bubble takes touches, so the student can keep playing.
 */
export function Tutorial({ rootRef, onDone, steps }: { rootRef: RefObject<HTMLElement>; onDone: () => void; steps?: TipTarget[] }) {
  const tips = useMemo(() => (steps ? STEPS.filter((s) => steps.includes(s.target)) : STEPS), [steps])
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<Pos | null>(null)

  // A passive effect: the parent's ref (rootRef) is attached only after this child's layout effects have run,
  // so a layout effect would find no root on the first mount (outside StrictMode's second run: the shipped build).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => setPos(place(root, tips[step].target))
    update()
    window.addEventListener('resize', update)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(root)
    return () => {
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [rootRef, step, tips])

  if (!pos) return null
  const { text } = tips[step]
  return (
    <button
      type="button"
      className={`tip${pos.below ? ' tip--below' : ''}`}
      style={{ left: pos.left, top: pos.top, width: BUBBLE_W, ['--arrow-x' as string]: `${pos.arrowX}px` }}
      onClick={() => {
        if (step + 1 < tips.length) setStep(step + 1)
        else onDone()
      }}
    >
      {text}
      <span className="tip-next" aria-hidden="true">
        {step + 1}/{tips.length}
      </span>
    </button>
  )
}
