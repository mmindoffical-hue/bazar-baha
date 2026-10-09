import { Component, type ErrorInfo, type ReactNode } from 'react'
import { tk } from '../i18n/tk'

type Props = { children: ReactNode }

type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6 py-10 text-center">
          <section className="max-w-sm">
            <h1 className="text-xl font-semibold text-stone-900">{tk.errorBoundary.title}</h1>
            <p className="mt-3 text-sm text-stone-600">{tk.errorBoundary.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-11 rounded bg-emerald-900 px-5 font-semibold text-white"
            >
              {tk.errorBoundary.retry}
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
