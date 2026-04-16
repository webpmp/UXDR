import React, { Component, ErrorInfo, ReactNode } from "react";

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = this.state.error?.message || "Unknown error";
      try {
          if (errorDetails.startsWith("{")) {
              const parsed = JSON.parse(errorDetails);
              if (parsed.error) {
                 errorDetails = parsed.error;
              }
          }
      } catch (e) {}

      return (
        <div className="p-8 bg-red-50 text-red-900 min-h-screen flex items-center justify-center">
            <div className="max-w-2xl bg-white p-6 rounded-lg shadow disabled:opacity-50 border border-red-200">
                <h1 className="text-2xl font-bold mb-4 font-mono">Something went wrong.</h1>
                <p className="mb-4 text-sm font-mono opacity-80">{errorDetails}</p>
                <button
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    onClick={() => window.location.reload()}
                >
                    Refresh
                </button>
            </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
