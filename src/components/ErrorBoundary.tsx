import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Human context for the fallback, e.g. the active scene name. */
  contextLabel?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Keeps MOTIF usable when a render crash would otherwise blank the page.
 * The fallback is quiet on purpose: it names what happened, offers a reload,
 * and never exposes stack traces to visitors.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(): void {
    // intentionally quiet: the fallback is the report
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="crash-fallback" role="alert">
          <p className="crash-title">MOTIF hit an unexpected state.</p>
          <p className="crash-detail">
            {this.props.contextLabel ? `The ${this.props.contextLabel} scene could not finish rendering. ` : ''}
            Your saved mixes and settings are untouched.
          </p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload MOTIF
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
