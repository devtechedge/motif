import { AlertIcon, CheckIcon } from './icons'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'warn'
  text: string
}

interface ToastsProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} role="status">
          <span className="toast-icon" aria-hidden="true">
            {t.kind === 'success' ? <CheckIcon /> : t.kind === 'warn' ? <AlertIcon /> : null}
          </span>
          <span className="toast-text">{t.text}</span>
          <button type="button" className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
