import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureClientException } from "./sentry";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ServeOS web-admin render error", error, info.componentStack);
    captureClientException(error, { componentStack: info.componentStack ?? undefined });
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-md text-center">
          <p className="font-display text-2xl font-extrabold">Something went wrong</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            The page failed to load. Reload to try again. Your signup progress is saved for this browser session.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
