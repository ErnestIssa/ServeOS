import { NORDIC_COUNTRIES, type AllowedCountry } from "@serveos/core-shared/signup-wizard";
import { SignupModalShell } from "./SignupModalShell";

const COUNTRY_META: Record<AllowedCountry, { flag: string; dial: string }> = {
  Sweden: { flag: "🇸🇪", dial: "+46" },
  Norway: { flag: "🇳🇴", dial: "+47" },
  Denmark: { flag: "🇩🇰", dial: "+45" },
  Finland: { flag: "🇫🇮", dial: "+358" }
};

type Props = {
  open: boolean;
  value: AllowedCountry;
  onClose: () => void;
  onSelect: (country: AllowedCountry) => void;
};

export function VenueCountryModal({ open, value, onClose, onSelect }: Props) {
  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="venue-country-title"
      backdropLabel="Close country picker"
    >
      <h2 id="venue-country-title" className="font-display text-center text-xl font-extrabold text-slate-900">
        Select country
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {NORDIC_COUNTRIES.map((country) => {
          const meta = COUNTRY_META[country];
          const selected = value === country;
          return (
            <button
              key={country}
              type="button"
              onClick={() => {
                onSelect(country);
                onClose();
              }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-violet-500 bg-violet-50 text-violet-900 shadow-sm shadow-violet-200/60"
                  : "border-slate-200 bg-white hover:border-violet-200"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {meta.flag}
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-900">{country}</span>
                <span className="block text-xs font-semibold text-slate-500">{meta.dial}</span>
              </span>
            </button>
          );
        })}
      </div>
    </SignupModalShell>
  );
}
