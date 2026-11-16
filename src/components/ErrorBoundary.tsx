import React from 'react'
import { translateCurrent } from '../i18n'

interface ErrorBoundaryState {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Renderer crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-root)', color: 'var(--text-primary)' }}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <strong className="text-[14px]">{translateCurrent('errorBoundary.title')}</strong>
          <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{translateCurrent('errorBoundary.description')}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2 text-[12px]"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            {translateCurrent('errorBoundary.reload')}
          </button>
        </div>
      </div>
    )
  }
}
