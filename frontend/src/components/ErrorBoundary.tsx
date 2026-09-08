import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md w-full glass rounded-2xl p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                An unexpected error occurred. This has been logged automatically.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-2 text-xs text-destructive bg-destructive/5 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 rounded-xl gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
