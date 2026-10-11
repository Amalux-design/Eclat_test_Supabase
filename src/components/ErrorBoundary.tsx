import { Component } from "react";
import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="empty-state">
            <div className="empty-state-title">Something went wrong</div>
            <div>{this.state.error.message}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
