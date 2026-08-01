import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-12">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Crimson glowing circle accent */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-rose-600/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-rose-600/10 rounded-full blur-3xl"></div>

            <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center text-3xl font-bold">
              !
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-400">
                An unexpected rendering error occurred. Our team has been notified.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left overflow-auto max-h-32 text-xs font-mono text-rose-400/90">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-rose-600/25"
              >
                Reload Page
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
