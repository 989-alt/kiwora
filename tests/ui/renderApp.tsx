import { fireEvent, render, screen } from '@testing-library/react'
import App from '../../src/App'

/**
 * Renders the app and goes past the title screen it opens on: [이어하기] when there is a save to go on
 * from, else [새로 시작하기] (no save: straight to the pick screen).
 */
export function renderApp() {
  const r = render(<App />)
  const go = screen.queryByRole('button', { name: '이어하기' })
  if (go && go.getAttribute('aria-disabled') !== 'true') fireEvent.click(go)
  else if (go) fireEvent.click(screen.getByRole('button', { name: '새로 시작하기' }))
  return r
}
