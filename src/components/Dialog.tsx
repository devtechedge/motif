import { useEffect, useRef } from 'react'
import { CloseIcon } from './icons'

interface DialogProps {
  open: boolean
  label: string
  title: string
  onClose: () => void
  children: React.ReactNode
}

/**
 * Minimal modal dialog: Escape closes, focus moves in on open and returns
 * to the opener via the caller (who keeps the opener ref).
 */
export function Dialog({ open, label, title, onClose, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('button, input, [tabindex]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => !el.hasAttribute('disabled'))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null
  return (
    // the scrim is decoration: Escape (document listener above) and the close
    // button are the keyboard paths, so click-to-dismiss needs no key handler
    <div className="dialog-scrim" onClick={onClose} role="presentation">
      {/* role=dialog is the ARIA modal pattern; onClick only stops the scrim's
          dismiss from firing on inner clicks. Escape is the keyboard path. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <CloseIcon />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
