import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** `alertdialog` asks a yes/no question, `dialog` offers a choice. */
  role?: 'dialog' | 'alertdialog'
  labelledBy: string
  /** Escape (and nothing else) calls this. */
  onClose: () => void
  /** Taps this soon after opening are ignored (a double tap on the button that opened it must not choose). */
  tapGuardMs?: number
  children: ReactNode
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A dialog over the screen: drawn outside the app's root, with everything else made `inert` while it is open
 * (no focus, no taps, hidden from screen readers), Tab kept inside, Escape closing it, and the focus handed
 * back to what had it before.
 */
export function Modal({ role = 'dialog', labelledBy, onClose, tapGuardMs = 0, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const openedAt = useRef(Date.now())
  /** What had the focus inside the dialog when it opened (an autoFocus), before an older dialog's cleanup moved it. */
  const intended = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const at = document.activeElement as HTMLElement | null
    intended.current = at && box.current?.contains(at) ? at : null
  }, [])

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const overlay = box.current?.closest('.bk-overlay')
    const made: Element[] = []
    for (const el of Array.from(document.body.children)) {
      if (el === overlay || el.hasAttribute('inert')) continue
      el.setAttribute('inert', '')
      made.push(el)
    }
    // Dialog after dialog: the older one's cleanup has just given the focus back to the page, which is inert now.
    // Put the focus into this dialog (what asked for it, else the first control).
    const inside = box.current
    if (inside && !inside.contains(document.activeElement)) {
      const target = intended.current && inside.contains(intended.current) ? intended.current : inside.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }
    return () => {
      for (const el of made) el.removeAttribute('inert')
      if (before && document.contains(before) && typeof before.focus === 'function') before.focus()
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closeRef.current()
      return
    }
    if (e.key !== 'Tab' || !box.current) return
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || !box.current.contains(at))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (at === last || !box.current.contains(at))) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="bk-overlay">
      <div
        ref={box}
        className="bk-dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={onKeyDown}
        onClickCapture={(e) => {
          if (tapGuardMs > 0 && Date.now() - openedAt.current < tapGuardMs) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
