import { useEffect } from "react";

const MODAL_SCROLL_LOCK_CLASS = "modal-scroll-locked";

const OVERLAY_SCROLL_ROOT_SELECTOR = [
  '[role="dialog"]',
  ".signup-modal-panel",
  ".admin-staff-profile-panel",
  ".admin-orders-drawer-panel",
  ".admin-venue-sheet",
  ".admin-top-bubble",
  ".admin-staff-actions-portal",
  ".admin-search-modal-panel",
  ".admin-menu-page-modal-backdrop",
  ".admin-bubble-dropdown-panel",
  ".admin-orders-kitchen-more-panel",
  ".admin-side-mobile-drawer",
  ".workspace-launch-panel",
  ".admin-orders-kds-fullscreen",
  "[data-overlay-scroll-root]"
].join(",");

type BodyLockSnapshot = {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
};

let lockCount = 0;
let snapshot: BodyLockSnapshot | null = null;
let blockersAttached = false;

function isInsideOverlayScrollRoot(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(OVERLAY_SCROLL_ROOT_SELECTOR));
}

function findScrollableAncestor(target: EventTarget | null, deltaY: number) {
  if (!(target instanceof Element)) return null;

  let node: Element | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        const canScrollUp = node.scrollTop > 0;
        const canScrollDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
        if ((deltaY < 0 && canScrollUp) || (deltaY > 0 && canScrollDown)) {
          return node;
        }
      }
    }
    node = node.parentElement;
  }

  return null;
}

function onWheelWhileLocked(event: WheelEvent) {
  if (lockCount === 0) return;
  if (isInsideOverlayScrollRoot(event.target) && findScrollableAncestor(event.target, event.deltaY)) {
    return;
  }
  event.preventDefault();
}

function onTouchMoveWhileLocked(event: TouchEvent) {
  if (lockCount === 0) return;
  if (isInsideOverlayScrollRoot(event.target)) return;
  event.preventDefault();
}

function attachScrollBlockers() {
  if (blockersAttached) return;
  blockersAttached = true;
  document.addEventListener("wheel", onWheelWhileLocked, { passive: false, capture: true });
  document.addEventListener("touchmove", onTouchMoveWhileLocked, { passive: false, capture: true });
}

function detachScrollBlockers() {
  if (!blockersAttached) return;
  blockersAttached = false;
  document.removeEventListener("wheel", onWheelWhileLocked, { capture: true });
  document.removeEventListener("touchmove", onTouchMoveWhileLocked, { capture: true });
}

function applyLock() {
  const scrollY = window.scrollY;
  const body = document.body;
  const html = document.documentElement;

  snapshot = {
    scrollY,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
    htmlOverflow: html.style.overflow
  };

  const scrollbarWidth = window.innerWidth - html.clientWidth;
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }

  html.classList.add(MODAL_SCROLL_LOCK_CLASS);
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
  attachScrollBlockers();
}

function releaseLock() {
  if (!snapshot) return;

  detachScrollBlockers();

  const body = document.body;
  const html = document.documentElement;
  const { scrollY, bodyOverflow, bodyPosition, bodyTop, bodyWidth, bodyPaddingRight, htmlOverflow } = snapshot;

  html.classList.remove(MODAL_SCROLL_LOCK_CLASS);
  html.style.overflow = htmlOverflow;
  body.style.overflow = bodyOverflow;
  body.style.position = bodyPosition;
  body.style.top = bodyTop;
  body.style.width = bodyWidth;
  body.style.paddingRight = bodyPaddingRight;
  snapshot = null;
  window.scrollTo(0, scrollY);
}

/** Reference-counted page scroll lock — safe for stacked modals, drawers, and popovers. */
export function acquireModalScrollLock(): () => void {
  if (lockCount === 0) applyLock();
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
}

/** Lock background scroll while `active` — unlocks only when every overlay has closed. */
export function useModalScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireModalScrollLock();
  }, [active]);
}
