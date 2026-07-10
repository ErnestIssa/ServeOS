export type VenueCallLineSource = "customer_call_line" | "registered_phone";

export type VenueCallLineResult =
  | {
      ok: true;
      venueName: string;
      dialUri: string;
      source: VenueCallLineSource;
    }
  | { ok: false; error: "no_call_line_configured" };

type VenueCallRow = {
  name: string;
  customerCallLine: string | null;
  registeredPhone: string | null;
};

/** Normalize a stored phone value into a `tel:`-compatible URI segment. */
export function toDialUri(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return plus ? `+${digits}` : digits;
}

/**
 * Resolve which number customers should dial: customer call line first, then registered venue phone.
 */
export function resolveVenueCallLine(restaurant: VenueCallRow): VenueCallLineResult {
  const customerLine = restaurant.customerCallLine?.trim() ?? "";
  const registered = restaurant.registeredPhone?.trim() ?? "";

  if (customerLine) {
    const dialUri = toDialUri(customerLine);
    if (dialUri) {
      return {
        ok: true,
        venueName: restaurant.name,
        dialUri,
        source: "customer_call_line"
      };
    }
  }

  if (registered) {
    const dialUri = toDialUri(registered);
    if (dialUri) {
      return {
        ok: true,
        venueName: restaurant.name,
        dialUri,
        source: "registered_phone"
      };
    }
  }

  return { ok: false, error: "no_call_line_configured" };
}
