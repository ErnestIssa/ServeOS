import React from "react";
import { AppErrorFullScreen } from "./AppErrorUi";
import { formatAppError } from "./formatAppError";

type Props = {
  children: React.ReactNode;
  onReset?: () => void;
};

type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("[AppErrorBoundary]", error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <AppErrorFullScreen
          title="ServeOS needs a moment"
          message={formatAppError(this.state.error, "The app ran into an unexpected problem.")}
          detail={__DEV__ ? this.state.error.stack?.split("\n").slice(0, 3).join("\n") : undefined}
          onRetry={this.handleReset}
          retryLabel="Reload screen"
        />
      );
    }
    return this.props.children;
  }
}
