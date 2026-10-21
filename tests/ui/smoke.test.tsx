import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../../src/App'

test('App renders a main landmark', () => {
  render(<App />)
  expect(screen.getByRole('main')).toBeTruthy()
})
