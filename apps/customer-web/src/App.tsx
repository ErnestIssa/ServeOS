import { AmbientWebShell } from "@serveos/core-ambient";
import { useState } from "react";
import { AccountSignupPage } from "./AccountSignupPage";
import { HowServeOSWorksPage } from "./HowServeOSWorksPage";
import { LandingPage } from "./LandingPage";
import { SupportPopup } from "./marketing/SupportPopup";
import { useSupportPopup } from "./marketing/useSupportPopup";
import { scrollToId } from "./marketing/ui";

type View = "landing" | "how-it-works" | "signup";

export function App() {
  const [view, setView] = useState<View>("landing");
  const { isVisible: isSupportVisible, onOpen: onSupportOpen, onClose: onSupportClose } = useSupportPopup();

  function goLanding(sectionId?: string) {
    setView("landing");
    if (sectionId) {
      requestAnimationFrame(() => scrollToId(sectionId));
    }
  }

  function goPricing() {
    if (view === "landing") scrollToId("pricing");
    else goLanding("pricing");
  }

  function goSignup() {
    setView("signup");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  return (
    <AmbientWebShell variant="customer" parallax={false} className="font-ui">
      {view === "landing" ? (
        <LandingPage onHowItWorks={() => setView("how-it-works")} onFindSetup={goSignup} />
      ) : null}
      {view === "how-it-works" ? (
        <HowServeOSWorksPage
          onHome={() => goLanding("top")}
          onGoFeatures={() => goLanding("features")}
          onGoPricing={() => goLanding("pricing")}
        />
      ) : null}
      {view === "signup" ? (
        <AccountSignupPage
          onHome={() => goLanding("top")}
          onHowItWorks={() => setView("how-it-works")}
          onGoPricing={goPricing}
        />
      ) : null}

      <SupportPopup
        isVisible={isSupportVisible}
        onOpen={onSupportOpen}
        onClose={onSupportClose}
        onHowItWorks={
          view === "how-it-works"
            ? () => scrollToId("top")
            : () => setView("how-it-works")
        }
        onViewPricing={goPricing}
        onFindSetup={goSignup}
      />
    </AmbientWebShell>
  );
}
