import { AmbientWebShell } from "@serveos/core-ambient";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AccountSignupPage } from "./AccountSignupPage";
import { type AppView, syncUrlForView, viewFromPath } from "./appNavigation";
import { HowServeOSWorksPage } from "./HowServeOSWorksPage";
import { LandingPage } from "./LandingPage";
import { SupportPopup } from "./marketing/SupportPopup";
import { useSupportPopup } from "./marketing/useSupportPopup";
import { scrollToId } from "./marketing/ui";

export function App() {
  const [view, setView] = useState<AppView>(() => viewFromPath(window.location.pathname));
  const { isVisible: isSupportVisible, onOpen: onSupportOpen, onClose: onSupportClose } = useSupportPopup();

  const setAppView = useCallback((next: AppView, replace = false) => {
    setView(next);
    syncUrlForView(next, replace);
    if (next !== "landing") window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const onPopState = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function goLanding(sectionId?: string) {
    setAppView("landing");
    if (sectionId) {
      requestAnimationFrame(() => scrollToId(sectionId));
    }
  }

  function goPricing() {
    if (view === "landing") scrollToId("pricing");
    else goLanding("pricing");
  }

  function goSignup() {
    setAppView("signup");
  }

  return (
    <AmbientWebShell variant="customer" parallax={false} className="font-ui">
      {view === "landing" ? (
        <LandingPage onHowItWorks={() => setAppView("how-it-works")} onFindSetup={goSignup} />
      ) : null}
      {view === "how-it-works" ? (
        <HowServeOSWorksPage
          onHome={() => goLanding("top")}
          onGoFeatures={() => goLanding("features")}
          onGoPricing={() => goLanding("pricing")}
        />
      ) : null}
      {view === "signup" ? <AccountSignupPage onBack={() => goLanding("pricing")} /> : null}
      {view === "admin" ? <AdminDashboardPage onHome={() => goLanding("top")} /> : null}

      {view !== "admin" ? (
        <SupportPopup
          isVisible={isSupportVisible}
          onOpen={onSupportOpen}
          onClose={onSupportClose}
          onHowItWorks={
            view === "how-it-works"
              ? () => scrollToId("top")
              : () => setAppView("how-it-works")
          }
          onViewPricing={goPricing}
          onFindSetup={goSignup}
        />
      ) : null}
    </AmbientWebShell>
  );
}
