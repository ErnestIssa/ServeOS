import React from "react";
import { StyleSheet, View } from "react-native";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppErrorFullScreen, AppErrorModal } from "./AppErrorUi";
import { formatAppError } from "./formatAppError";

export type GlobalErrorState = {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
};

export type ErrorModalState = {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onClosed?: () => void;
};

type AppErrorContextValue = {
  /** Blocks the whole app with the universal error page. */
  reportGlobalError: (error: unknown, opts?: Omit<GlobalErrorState, "message"> & { fallback?: string }) => void;
  clearGlobalError: () => void;
  /** Blur modal on the current screen (non-fatal). */
  showErrorModal: (
    error: unknown,
    opts?: Omit<ErrorModalState, "message"> & { fallback?: string; onClosed?: () => void }
  ) => void;
  clearErrorModal: () => void;
  /** True while the non-fatal error modal is on screen. */
  errorModalVisible: boolean;
};

const AppErrorContext = React.createContext<AppErrorContextValue | null>(null);

export function useAppErrors(): AppErrorContextValue {
  const ctx = React.useContext(AppErrorContext);
  if (!ctx) {
    throw new Error("useAppErrors must be used within AppErrorHost");
  }
  return ctx;
}

export function useAppErrorsOptional(): AppErrorContextValue | null {
  return React.useContext(AppErrorContext);
}

type Props = {
  children: React.ReactNode;
};

export function AppErrorHost({ children }: Props) {
  const [globalError, setGlobalError] = React.useState<GlobalErrorState | null>(null);
  const [modal, setModal] = React.useState<ErrorModalState | null>(null);

  const reportGlobalError = React.useCallback(
    (error: unknown, opts?: Omit<GlobalErrorState, "message"> & { fallback?: string }) => {
      setGlobalError({
        title: opts?.title ?? "ServeOS hit a problem",
        message: formatAppError(error, opts?.fallback),
        detail: opts?.detail,
        onRetry: opts?.onRetry
      });
    },
    []
  );

  const clearGlobalError = React.useCallback(() => setGlobalError(null), []);

  const showErrorModal = React.useCallback(
    (error: unknown, opts?: Omit<ErrorModalState, "message"> & { fallback?: string }) => {
      setModal({
        title: opts?.title ?? "Something went wrong",
        message: formatAppError(error, opts?.fallback),
        detail: opts?.detail,
        onRetry: opts?.onRetry,
        retryLabel: opts?.retryLabel,
        onClosed: opts?.onClosed
      });
    },
    []
  );

  const clearErrorModal = React.useCallback(() => setModal(null), []);

  const value = React.useMemo(
    () => ({
      reportGlobalError,
      clearGlobalError,
      showErrorModal,
      clearErrorModal,
      errorModalVisible: modal != null
    }),
    [reportGlobalError, clearGlobalError, showErrorModal, clearErrorModal, modal]
  );

  return (
    <AppErrorContext.Provider value={value}>
      <AppErrorBoundary onReset={clearGlobalError}>
        <View style={styles.flex}>
          {globalError ? (
            <AppErrorFullScreen
              title={globalError.title}
              message={globalError.message}
              detail={globalError.detail}
              onRetry={
                globalError.onRetry
                  ? () => {
                      clearGlobalError();
                      globalError.onRetry?.();
                    }
                  : clearGlobalError
              }
              onDismiss={clearGlobalError}
              dismissLabel="Continue"
            />
          ) : (
            children
          )}
        </View>
      </AppErrorBoundary>
      <AppErrorModal
        visible={modal != null}
        title={modal?.title}
        message={modal?.message ?? ""}
        detail={modal?.detail}
        onRetry={
          modal?.onRetry
            ? () => {
                modal.onRetry?.();
                clearErrorModal();
              }
            : undefined
        }
        retryLabel={modal?.retryLabel}
        onDismiss={() => {
          modal?.onClosed?.();
          clearErrorModal();
        }}
      />
    </AppErrorContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
});
