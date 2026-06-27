export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DaySchedule = {
  closed: boolean;
  open: string;
  close: string;
};

export type SpecialSchedule = {
  id: string;
  label: string;
  kind: "holiday" | "closure" | "vacation" | "event";
  startDate: string;
  endDate: string;
  note: string;
};

export type TableRow = {
  id: string;
  name: string;
  capacity: number;
  group: string;
  qrAssigned: boolean;
};

export type LocationRow = {
  id: string;
  name: string;
  status: "active" | "disabled";
  openingDate: string;
  managerName: string;
  timezone: string;
  notes: string;
};

export type VenueProfileSettings = {
  profile: {
    venueName: string;
    legalBusinessName: string;
    brandName: string;
    description: string;
    cuisineTypes: string[];
    contactEmail: string;
    phone: string;
    website: string;
    socialInstagram: string;
    socialFacebook: string;
    socialTiktok: string;
  };
  business: {
    organizationNumber: string;
    vatNumber: string;
    taxId: string;
    currency: string;
    language: string;
    timezone: string;
  };
  address: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
    gpsLat: string;
    gpsLng: string;
    deliveryRadiusKm: string;
  };
  hours: {
    weekly: Record<DayKey, DaySchedule>;
    specials: SpecialSchedule[];
  };
  dining: {
    dineIn: boolean;
    takeaway: boolean;
    delivery: boolean;
    qrOrdering: boolean;
    reservations: boolean;
    walkIns: boolean;
  };
  tables: {
    rows: TableRow[];
  };
  receipt: {
    footer: string;
    thankYou: string;
    showVat: boolean;
    printLogo: boolean;
    emailReceiptDefault: boolean;
  };
  branding: {
    primaryColor: string;
    accentColor: string;
    customerBrandingNote: string;
  };
  notifications: {
    newOrders: boolean;
    refunds: boolean;
    staffInvitations: boolean;
    reservations: boolean;
    supportAlerts: boolean;
  };
  advanced: {
    status: "open" | "paused" | "maintenance" | "archived";
    pauseOrdering: boolean;
    maintenanceMode: boolean;
    archived: boolean;
  };
  locations: LocationRow[];
};

const DEFAULT_WEEK: Record<DayKey, DaySchedule> = {
  mon: { closed: false, open: "08:00", close: "22:00" },
  tue: { closed: false, open: "08:00", close: "22:00" },
  wed: { closed: false, open: "08:00", close: "22:00" },
  thu: { closed: false, open: "08:00", close: "22:00" },
  fri: { closed: false, open: "08:00", close: "22:00" },
  sat: { closed: false, open: "10:00", close: "23:00" },
  sun: { closed: false, open: "10:00", close: "21:00" }
};

export function defaultVenueProfileSettings(venueName = ""): VenueProfileSettings {
  return {
    profile: {
      venueName: venueName,
      legalBusinessName: "",
      brandName: venueName,
      description: "",
      cuisineTypes: [],
      contactEmail: "",
      phone: "",
      website: "",
      socialInstagram: "",
      socialFacebook: "",
      socialTiktok: ""
    },
    business: {
      organizationNumber: "",
      vatNumber: "",
      taxId: "",
      currency: "SEK",
      language: "sv",
      timezone: "Europe/Stockholm"
    },
    address: {
      street: "",
      postalCode: "",
      city: "",
      country: "Sweden",
      gpsLat: "",
      gpsLng: "",
      deliveryRadiusKm: ""
    },
    hours: { weekly: { ...DEFAULT_WEEK }, specials: [] },
    dining: {
      dineIn: true,
      takeaway: true,
      delivery: false,
      qrOrdering: true,
      reservations: true,
      walkIns: true
    },
    tables: {
      rows: [
        { id: "t1", name: "Table 1", capacity: 2, group: "Main floor", qrAssigned: false },
        { id: "t2", name: "Table 2", capacity: 4, group: "Main floor", qrAssigned: false }
      ]
    },
    receipt: {
      footer: "",
      thankYou: "Thank you for dining with us!",
      showVat: true,
      printLogo: true,
      emailReceiptDefault: true
    },
    branding: {
      primaryColor: "#6d28d9",
      accentColor: "#2563eb",
      customerBrandingNote: ""
    },
    notifications: {
      newOrders: true,
      refunds: true,
      staffInvitations: true,
      reservations: true,
      supportAlerts: true
    },
    advanced: {
      status: "open",
      pauseOrdering: false,
      maintenanceMode: false,
      archived: false
    },
    locations: []
  };
}

const STORAGE_PREFIX = "serveos.venueProfile.";

export function loadVenueProfileSettings(venueId: string, venueName: string): VenueProfileSettings {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${venueId}`);
    if (!raw) return defaultVenueProfileSettings(venueName);
    const parsed = JSON.parse(raw) as VenueProfileSettings;
    return { ...defaultVenueProfileSettings(venueName), ...parsed, profile: { ...defaultVenueProfileSettings(venueName).profile, ...parsed.profile } };
  } catch {
    return defaultVenueProfileSettings(venueName);
  }
}

export function saveVenueProfileSettings(venueId: string, settings: VenueProfileSettings) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${venueId}`, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};

export type VenueProfileTab =
  | "overview"
  | "profile"
  | "locations"
  | "hours"
  | "dining"
  | "notifications"
  | "advanced";

export const VENUE_PROFILE_TABS: Array<{ id: VenueProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile & business" },
  { id: "locations", label: "Locations" },
  { id: "hours", label: "Opening hours" },
  { id: "dining", label: "Dining & tables" },
  { id: "notifications", label: "Notifications" },
  { id: "advanced", label: "Advanced" }
];

export function computeSetupProgress(settings: VenueProfileSettings) {
  const checks = [
    Boolean(settings.profile.venueName.trim()),
    Boolean(settings.profile.contactEmail.trim()),
    Boolean(settings.profile.phone.trim()),
    Boolean(settings.business.organizationNumber.trim() || settings.business.vatNumber.trim()),
    Boolean(settings.address.street.trim() && settings.address.city.trim()),
    settings.hours.weekly.mon.open.length > 0,
    settings.dining.dineIn || settings.dining.takeaway || settings.dining.delivery
  ];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
}

export function missingRequiredSetup(settings: VenueProfileSettings): string[] {
  const missing: string[] = [];
  if (!settings.profile.venueName.trim()) missing.push("Venue display name");
  if (!settings.profile.contactEmail.trim()) missing.push("Contact email");
  if (!settings.profile.phone.trim()) missing.push("Phone number");
  if (!settings.address.street.trim() || !settings.address.city.trim()) missing.push("Street address");
  if (!settings.business.organizationNumber.trim() && !settings.business.vatNumber.trim()) {
    missing.push("Organization or VAT number");
  }
  return missing;
}
