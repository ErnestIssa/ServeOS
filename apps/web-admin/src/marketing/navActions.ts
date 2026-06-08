import { DEMO_MAILTO } from "./constants";
import type { NavAction } from "./navContent";
import { scrollToId } from "./ui";

export type NavHandlers = {
  onHowItWorks: () => void;
  onPricing?: () => void;
};

export function runNavAction(action: NavAction, handlers: NavHandlers) {
  switch (action.type) {
    case "scroll":
      scrollToId(action.targetId);
      break;
    case "how-it-works":
      handlers.onHowItWorks();
      break;
    case "pricing":
      handlers.onPricing?.() ?? scrollToId("pricing");
      break;
    case "external":
      if (action.url.startsWith("mailto:")) {
        window.location.href = action.url;
      } else {
        window.open(action.url, "_blank", "noopener,noreferrer");
      }
      break;
    case "mailto":
      window.location.href = DEMO_MAILTO;
      break;
    default:
      break;
  }
}
