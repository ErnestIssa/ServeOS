import { getLegalPage } from "./legalPages";
import { LegalPageShell } from "./LegalPageShell";
import type { LegalSlug } from "./types";

type Props = {
  slug: LegalSlug;
  onHome: () => void;
  onHowItWorks: () => void;
  onGoPricing: () => void;
  onGoLogin: () => void;
  onGoLegal: (slug: LegalSlug) => void;
};

export function LegalPageView({ slug, onHome, onHowItWorks, onGoPricing, onGoLogin, onGoLegal }: Props) {
  const page = getLegalPage(slug);
  return (
    <LegalPageShell
      page={page}
      onHome={onHome}
      onHowItWorks={onHowItWorks}
      onGoPricing={onGoPricing}
      onGoLogin={onGoLogin}
      onGoLegal={onGoLegal}
    />
  );
}
