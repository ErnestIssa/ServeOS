import { useEffect } from "react";

const BUTTON_LIKE =
  'button[title], [role="button"][title], input[type="button"][title], input[type="submit"][title], input[type="reset"][title]';

function stripTitle(el: Element) {
  if (el instanceof HTMLElement && el.hasAttribute("title")) {
    el.removeAttribute("title");
  }
}

function stripAll(root: ParentNode = document) {
  root.querySelectorAll(BUTTON_LIKE).forEach(stripTitle);
}

/**
 * Native `title` tooltips on buttons are banned platform-wide.
 * Strips existing attributes and keeps stripping on DOM mutations.
 */
export function useForbidButtonTitleTooltips() {
  useEffect(() => {
    stripAll();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "title") {
          const t = mutation.target;
          if (
            t instanceof HTMLElement &&
            (t.tagName === "BUTTON" ||
              t.getAttribute("role") === "button" ||
              (t.tagName === "INPUT" &&
                ["button", "submit", "reset"].includes((t as HTMLInputElement).type)))
          ) {
            stripTitle(t);
          }
          continue;
        }
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (
                node.matches?.(BUTTON_LIKE) ||
                (node.tagName === "BUTTON" && node.hasAttribute("title"))
              ) {
                stripTitle(node);
              }
              stripAll(node);
            }
          });
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"]
    });

    return () => observer.disconnect();
  }, []);
}
