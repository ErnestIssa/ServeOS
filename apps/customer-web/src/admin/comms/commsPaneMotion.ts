export const COMMS_PANE_TRANSITION = { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const };

export const COMMS_PANE_MOTION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: COMMS_PANE_TRANSITION
};

export const COMMS_LIST_ITEM_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: COMMS_PANE_TRANSITION
};

export const THREAD_SEARCH_DEBOUNCE_MS = 320;
export const THREADS_SEARCH_PLACEHOLDER = "Order #, guest, table, status";
