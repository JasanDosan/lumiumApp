import { Component } from 'react';

/**
 * Generic error boundary for route sections.
 * Catches render errors and shows a fallback instead of crashing the whole app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm font-semibold text-ink-mid mb-1">Something went wrong</p>
          <p className="text-xs text-ink-light mb-5 max-w-xs">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
