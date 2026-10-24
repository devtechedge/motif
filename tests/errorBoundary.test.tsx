// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

function Thrower({ crash }: { crash: boolean }): never {
  if (crash) throw new Error('boom')
  return null as never
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = (crash: boolean) =>
    act(() => {
      root.render(
        <ErrorBoundary contextLabel="Rain on Glass">
          <Thrower crash={crash} />
        </ErrorBoundary>,
      )
    })

  it('renders children normally when nothing throws', () => {
    render(false)
    expect(container.querySelector('.crash-fallback')).toBeNull()
  })

  it('shows the quiet fallback with context and a reload action on crash', () => {
    render(true)
    const fallback = container.querySelector('.crash-fallback')
    expect(fallback).not.toBeNull()
    expect(fallback?.textContent).toContain('Rain on Glass')
    expect(fallback?.textContent).toContain('saved mixes and settings are untouched')
    expect(container.querySelector('button')?.textContent).toBe('Reload MOTIF')
  })

  it('recovers when the next render does not throw', () => {
    render(true)
    expect(container.querySelector('.crash-fallback')).not.toBeNull()
    render(false)
    expect(container.querySelector('.crash-fallback')).toBeNull()
  })
})
