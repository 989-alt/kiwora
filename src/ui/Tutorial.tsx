import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

export type TipTarget = 'sow' | 'water' | 'pot' | 'bug' | 'todo'

const STEPS: { target: TipTarget; text: string }[] = [
  { target: 'sow', text: '씨 봉투에서 씨를 꺼내 흙에 심어요' },
  { target: 'water', text: '물뿌리개를 꾹 누르면 물이 나와요' },
  { target: 'pot', text: '화분을 끌어서 자리를 옮겨요' },
  { target: 'bug', text: '벌레를 톡 눌러 잡아요' },
  { target: 'todo', text: '오늘 할 일은 여기에 나와요' },
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
  // The seed packet sits right of the soil it is sown on: the bubble starts at the packet's left edge and runs away from the
  // soil (centred on the packet it would cover the soil, and a tap meant for the soil would hit the bubble).
  const want = target === 'sow' ? t.left - r.left - 8 : cx - BUBBLE_W / 2
  const left = Math.max(8, Math.min(r.width - BUBBLE_W - 8, want))
  const below = t.top - r.top < 120
  const top = below ? t.bottom - r.top + GAP : t.top - r.top - GAP
  return { left, top, arrowX: Math.max(24, Math.min(BUBBLE_W - 24, cx - left)), below }
}

/**
 * First-visit tips: bubbles in order (seed packet → watering can → pot → bug → to-do card), each closes on tap; `steps` picks
 * some of them (a plant past the seed stage has no sowing, the yard has no pot to move, no card without a to-do). Only the bubble takes touches, so the student can keep playing.
 */
export function Tutorial({ rootRef, onDone, steps }: { rootRef: RefObject<HTMLElement>; onDone: () => void; steps?: TipTarget[] }) {
  const tips = useMemo(() => (steps ? STEPS.filter((s) => steps.includes(s.target)) : STEPS), [steps])
  // Which tips were shown is tracked by target, not by index: the list shrinks while it is on screen (the seed gets
  // sown, the to-do card goes away). The current tip is the first remaining one not shown yet.
  const [shown, setShown] = useState<TipTarget[]>([])
  const [pos, setPos] = useState<Pos | null>(null)
  const current = tips.find((t) => !shown.includes(t.target))
  const target = current?.target
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const ended = useRef(false)
  const end = () => {
    if (ended.current) return
    ended.current = true
    doneRef.current()
  }

  // Nothing left to show (the tips that remain were all shown): the tutorial is over.
  useEffect(() => {
    if (!current) end()
  }, [current])

  // A passive effect: the parent's ref (rootRef) is attached only after this child's layout effects have run,
  // so a layout effect would find no root on the first mount (outside StrictMode's second run: the shipped build).
  useEffect(() => {
    const root = rootRef.current
    if (!root || !target) return
    const update = () => setPos(place(root, target))
    update()
    window.addEventListener('resize', update)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(root)
    return () => {
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [rootRef, target])

  if (!pos || !current) return null
  const { text } = current
  const number = tips.filter((t) => shown.includes(t.target)).length + 1
  return (
    <button
      type="button"
      className={`tip${pos.below ? ' tip--below' : ''}`}
      style={{ left: pos.left, top: pos.top, width: BUBBLE_W, ['--arrow-x' as string]: `${pos.arrowX}px` }}
      onClick={() => {
        // The last tip closes the tutorial in the tap itself (saved at once, also if the page is left right away).
        if (tips.every((t) => t === current || shown.includes(t.target))) end()
        setShown((list) => [...list, current.target])
      }}
    >
      {text}
      <span className="tip-next" aria-hidden="true">
        {number}/{tips.length}
      </span>
    </button>
  )
}
