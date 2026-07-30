import type { QrCodeRow, QrCodeStatus, QrCodeType, QrExperience, QrPaymentMode } from "../../../api";

export function isUiOnlyQrId(id: string) {
  return id.startsWith("ui-mock-qr-");
}

function mockQr(partial: {
  id: string;
  name: string;
  type: QrCodeType;
  status?: QrCodeStatus;
  experience?: QrExperience;
  locationLabel?: string | null;
  areaLabel?: string | null;
  tableLabel?: string | null;
  paymentMode?: QrPaymentMode;
  menuName?: string | null;
  allowOrdering?: boolean;
  scanCount?: number;
  orderCount?: number;
  lastUsedAt?: string | null;
}): QrCodeRow {
  const publicCode = partial.id.replace("ui-mock-qr-", "Mock");
  const now = new Date().toISOString();
  return {
    id: partial.id,
    restaurantId: "ui-mock-venue",
    publicCode,
    name: partial.name,
    type: partial.type,
    status: partial.status ?? "ACTIVE",
    experience: partial.experience ?? "ORDERING",
    locationLabel: partial.locationLabel ?? "Main restaurant",
    areaLabel: partial.areaLabel ?? null,
    tableLabel: partial.tableLabel ?? null,
    tableId: null,
    seatCount: partial.type === "TABLE" ? 4 : null,
    paymentMode: partial.paymentMode ?? (partial.type === "TAKEAWAY" ? "PREPAY" : "PAY_AT_VENUE"),
    menuId: null,
    menuName: partial.menuName ?? null,
    allowOrdering: partial.allowOrdering ?? partial.experience !== "MENU_BROWSE",
    orderingPaused: false,
    sessionTtlHours: null,
    description: null,
    headline: "Scan to order",
    showRestaurantLogo: true,
    showServeosBranding: true,
    createdByUserId: null,
    scanCount: partial.scanCount ?? 0,
    orderCount: partial.orderCount ?? 0,
    lastUsedAt: partial.lastUsedAt ?? null,
    deactivatedAt: null,
    archivedAt: null,
    publicUrl: `/q/${publicCode}`,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(`/q/${publicCode}`)}`,
    pngDownloadUrl: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(`/q/${publicCode}`)}&format=png`,
    svgDownloadUrl: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(`/q/${publicCode}`)}&format=svg`,
    createdAt: now,
    updatedAt: now
  };
}

/** Local preview rows for the QR identities list — not persisted / not sent to the API. */
export const UI_MOCK_QR_CODES: QrCodeRow[] = [
  mockQr({
    id: "ui-mock-qr-01",
    name: "Table 1",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 1",
    scanCount: 42,
    orderCount: 18,
    lastUsedAt: new Date().toISOString()
  }),
  mockQr({
    id: "ui-mock-qr-02",
    name: "Table 2",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 2",
    scanCount: 31,
    orderCount: 12
  }),
  mockQr({
    id: "ui-mock-qr-03",
    name: "Table 3",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 3",
    status: "INACTIVE",
    scanCount: 8,
    orderCount: 2
  }),
  mockQr({
    id: "ui-mock-qr-04",
    name: "Patio A",
    type: "TABLE",
    areaLabel: "Outdoor",
    tableLabel: "Patio A",
    scanCount: 67,
    orderCount: 29,
    lastUsedAt: new Date().toISOString()
  }),
  mockQr({
    id: "ui-mock-qr-05",
    name: "Patio B",
    type: "TABLE",
    areaLabel: "Outdoor",
    tableLabel: "Patio B",
    scanCount: 54,
    orderCount: 21
  }),
  mockQr({
    id: "ui-mock-qr-06",
    name: "Bar seat 1",
    type: "TABLE",
    areaLabel: "Bar",
    tableLabel: "Bar 1",
    scanCount: 19,
    orderCount: 7
  }),
  mockQr({
    id: "ui-mock-qr-07",
    name: "Bar seat 2",
    type: "TABLE",
    areaLabel: "Bar",
    tableLabel: "Bar 2",
    scanCount: 14,
    orderCount: 5
  }),
  mockQr({
    id: "ui-mock-qr-08",
    name: "VIP booth",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "VIP 1",
    menuName: "Dinner Menu",
    scanCount: 9,
    orderCount: 6
  }),
  mockQr({
    id: "ui-mock-qr-09",
    name: "Window lunch QR",
    type: "MENU",
    experience: "MENU_BROWSE",
    allowOrdering: false,
    menuName: "Lunch Menu",
    locationLabel: "Front window",
    scanCount: 120,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-10",
    name: "Poster dinner QR",
    type: "MENU",
    experience: "MENU_BROWSE",
    allowOrdering: false,
    menuName: "Dinner Menu",
    locationLabel: "Entry poster",
    scanCount: 88,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-11",
    name: "Pickup counter",
    type: "TAKEAWAY",
    paymentMode: "PREPAY",
    locationLabel: "Takeaway desk",
    scanCount: 203,
    orderCount: 91,
    lastUsedAt: new Date().toISOString()
  }),
  mockQr({
    id: "ui-mock-qr-12",
    name: "Drive-up order",
    type: "TAKEAWAY",
    paymentMode: "PREPAY",
    locationLabel: "Parking lot",
    scanCount: 45,
    orderCount: 22
  }),
  mockQr({
    id: "ui-mock-qr-13",
    name: "Kitchen pairing",
    type: "STAFF",
    experience: "ORDERING",
    allowOrdering: false,
    locationLabel: "Kitchen",
    scanCount: 3,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-14",
    name: "Welcome 10% off",
    type: "MARKETING",
    experience: "PROMOTION",
    allowOrdering: false,
    locationLabel: "Flyer",
    scanCount: 310,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-15",
    name: "After-meal feedback",
    type: "FEEDBACK",
    experience: "FEEDBACK",
    allowOrdering: false,
    locationLabel: "Receipt",
    scanCount: 76,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-16",
    name: "Table 4",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 4",
    scanCount: 28,
    orderCount: 11
  }),
  mockQr({
    id: "ui-mock-qr-17",
    name: "Table 5",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 5",
    scanCount: 33,
    orderCount: 14
  }),
  mockQr({
    id: "ui-mock-qr-18",
    name: "Table 6",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 6",
    status: "INACTIVE",
    scanCount: 2,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-19",
    name: "Table 7",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 7",
    scanCount: 41,
    orderCount: 16
  }),
  mockQr({
    id: "ui-mock-qr-20",
    name: "Table 8",
    type: "TABLE",
    areaLabel: "Indoor",
    tableLabel: "Table 8",
    scanCount: 22,
    orderCount: 9
  }),
  mockQr({
    id: "ui-mock-qr-21",
    name: "Garden 1",
    type: "TABLE",
    areaLabel: "Outdoor",
    tableLabel: "Garden 1",
    scanCount: 15,
    orderCount: 4
  }),
  mockQr({
    id: "ui-mock-qr-22",
    name: "Garden 2",
    type: "TABLE",
    areaLabel: "Outdoor",
    tableLabel: "Garden 2",
    scanCount: 11,
    orderCount: 3
  }),
  mockQr({
    id: "ui-mock-qr-23",
    name: "Lounge sofa",
    type: "TABLE",
    areaLabel: "Lounge",
    tableLabel: "Lounge A",
    menuName: "Drinks Menu",
    scanCount: 38,
    orderCount: 17
  }),
  mockQr({
    id: "ui-mock-qr-24",
    name: "Hotel room service",
    type: "TABLE",
    areaLabel: "Rooms",
    tableLabel: "Room 204",
    locationLabel: "Partner hotel",
    paymentMode: "HYBRID",
    scanCount: 6,
    orderCount: 2
  }),
  mockQr({
    id: "ui-mock-qr-25",
    name: "Event buffet QR",
    type: "MENU",
    experience: "ORDERING",
    menuName: "Event Menu",
    locationLabel: "Banquet hall",
    scanCount: 95,
    orderCount: 40
  }),
  mockQr({
    id: "ui-mock-qr-26",
    name: "Rotated patio C",
    type: "TABLE",
    status: "ROTATED",
    areaLabel: "Outdoor",
    tableLabel: "Patio C",
    scanCount: 50,
    orderCount: 19
  }),
  mockQr({
    id: "ui-mock-qr-27",
    name: "Self-checkout kiosk",
    type: "TAKEAWAY",
    paymentMode: "PREPAY",
    locationLabel: "Lobby kiosk",
    scanCount: 160,
    orderCount: 74
  }),
  mockQr({
    id: "ui-mock-qr-28",
    name: "Staff device pair",
    type: "STAFF",
    locationLabel: "Host stand",
    allowOrdering: false,
    scanCount: 1,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-29",
    name: "Weekend promo",
    type: "MARKETING",
    experience: "PROMOTION",
    allowOrdering: false,
    locationLabel: "Instagram story",
    scanCount: 540,
    orderCount: 0
  }),
  mockQr({
    id: "ui-mock-qr-30",
    name: "Exit survey QR",
    type: "FEEDBACK",
    experience: "FEEDBACK",
    allowOrdering: false,
    locationLabel: "Exit door",
    scanCount: 64,
    orderCount: 0
  })
];
