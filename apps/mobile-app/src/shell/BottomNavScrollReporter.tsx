import React from "react";

const BottomNavScrollReporterContext = React.createContext<((y: number) => void) | null>(null);

type Props = {
  report: (y: number) => void;
  children: React.ReactNode;
};

export function BottomNavScrollReporter({ report, children }: Props) {
  const value = React.useMemo(() => report, [report]);
  return (
    <BottomNavScrollReporterContext.Provider value={value}>{children}</BottomNavScrollReporterContext.Provider>
  );
}

export function useBottomNavScrollReporter(): ((y: number) => void) | null {
  return React.useContext(BottomNavScrollReporterContext);
}

/** Call from any vertical ScrollView that does not use App-level Animated onScroll. */
export function reportBottomNavScroll(
  report: ((y: number) => void) | null | undefined,
  e: { nativeEvent: { contentOffset: { y: number } } }
) {
  report?.(Math.max(0, e.nativeEvent.contentOffset.y));
}
