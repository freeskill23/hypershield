import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Render crash:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-navy-950 p-6">
          <div className="card-surface max-w-lg p-6">
            <h2 className="font-display text-lg font-bold text-red-400">렌더링 오류 발생</h2>
            <p className="mt-2 text-sm text-slate-400">
              페이지를 표시하는 중 오류가 발생했습니다.
            </p>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-navy-950 p-3 text-xs text-slate-300">
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-4"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
