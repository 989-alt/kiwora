import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Modal } from '../../src/ui/Modal'

function Host({ onPick, guard = 0 }: { onPick: () => void; guard?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <main id="app">
        <button type="button" onClick={() => setOpen(true)}>
          열기
        </button>
      </main>
      {open && (
        <Modal labelledBy="t" onClose={() => setOpen(false)} tapGuardMs={guard}>
          <p id="t">제목</p>
          <button type="button" onClick={onPick}>
            고르기
          </button>
          <button type="button">그만두기</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  test('the rest of the page is inert while open; Escape closes it and gives the focus back', () => {
    // render into a container that is a direct child of body, like the real app root
    const { container } = render(<Host onPick={() => {}} />)
    const opener = screen.getByRole('button', { name: '열기' })
    opener.focus()
    fireEvent.click(opener)
    expect(container.hasAttribute('inert')).toBe(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  test('Tab wraps inside the dialog', () => {
    render(<Host onPick={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '열기' }))
    const last = screen.getByRole('button', { name: '그만두기' })
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '고르기' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  test('taps right after opening are ignored, later ones count', async () => {
    const pick = vi.fn()
    render(<Host onPick={pick} guard={200} />)
    fireEvent.click(screen.getByRole('button', { name: '열기' }))
    fireEvent.click(screen.getByRole('button', { name: '고르기' }))
    expect(pick).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 250))
    fireEvent.click(screen.getByRole('button', { name: '고르기' }))
    expect(pick).toHaveBeenCalledTimes(1)
  })
})
