import { readApiMessage } from "./bootstrap/clientConfig";
import { captureClientApiError } from "./sentry";

/** Deployment wiring only — all service setup (Sentry, URLs, capabilities) comes from `GET /config/client`. */
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "https://serveos-api.onrender.com";

export function getApiBaseUrl(): string {
  return API_BASE.replace(/\/$/, "");
}

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  displayName?: string;
  fullName?: string;
  signupProfile?: unknown | null;
  preferredRestaurantId?: string | null;
};

export type WorkspaceAuthSummary = {
  state: "none" | "active" | "pending_approval" | "suspended";
  requiresWorkspaceSelection: boolean;
  activeWorkspaceCount: number;
  pendingWorkspaceCount: number;
};

export type AuthResponse = {
  ok: boolean;
  token?: string;
  user?: AuthUser;
  workspaceAuth?: WorkspaceAuthSummary;
  error?: string;
  message?: string;
};

export type CompanyLookupResponse =
  | {
      success: true;
      found: true;
      data: {
        companyName?: string;
        address?: string;
        postalCode?: string;
        city?: string;
        legalForm?: string;
        status?: string;
      };
    }
  | { success: true; found: false }
  | { success: false; message: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, init);
    const text = await res.text();
    if (!res.ok && res.status >= 500) {
      captureClientApiError(path, res.status, text.slice(0, 200) || undefined);
    }
    try {
      const data = JSON.parse(text) as T & { ok?: boolean; error?: string; message?: string };
      if (data && typeof data === "object" && "ok" in data) {
        if (!res.ok && data.ok !== false) {
          return { ...data, ok: false, error: data.error ?? `http_error_${res.status}` } as T;
        }
        return data as T;
      }
      return { ok: res.ok, ...(data as object) } as T;
    } catch {
      return { ok: false, error: text ? "bad_response" : "empty_response" } as T;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "request_failed";
    if (/network|failed to fetch|timed out|timeout/i.test(msg)) {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." } as T;
    }
    return { ok: false, error: msg } as T;
  }
}

export async function authSignup(params: {
  email: string;
  password: string;
  role: "OWNER" | "CUSTOMER";
  phone?: string;
  registrationProfile?: Record<string, unknown>;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      role: params.role,
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.registrationProfile ? { registrationProfile: params.registrationProfile } : {})
    })
  });
}

export async function lookupCompany(orgNumber: string): Promise<CompanyLookupResponse> {
  return apiFetch<CompanyLookupResponse>("/api/business/lookup-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgNumber })
  });
}

export function mapApiErrorToMessage(res?: { message?: string; error?: string } | string | null): string {
  if (!res) return "Request failed";
  if (typeof res === "string") return res;
  return readApiMessage(res);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` } as const;
}

function authJsonHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

export function orderEventsWebSocketUrl(params: {
  orderId?: string;
  restaurantId?: string;
  mine?: boolean;
  token?: string;
}) {
  const httpBase = getApiBaseUrl() || (typeof window !== "undefined" ? window.location.origin : "");
  const u = new URL(httpBase.startsWith("http") ? httpBase : `http://${httpBase}`);
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const sp = new URLSearchParams();
  if (params.orderId) sp.set("orderId", params.orderId);
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  if (params.mine) sp.set("mine", "1");
  if (params.token) sp.set("token", params.token);
  return `${wsProto}//${u.host}/orders/events?${sp.toString()}`;
}

export async function login(params: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export type ProvisionBusinessResponse = AuthResponse & {
  restaurantId?: string;
  companyId?: string;
  membershipId?: string;
};

/** Attach a new OWNER workspace to the signed-in identity (no duplicate user). */
export async function provisionBusinessWorkspace(
  token: string,
  registrationProfile: Record<string, unknown>
): Promise<ProvisionBusinessResponse> {
  return apiFetch<ProvisionBusinessResponse>("/workspaces/provision-business", {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ registrationProfile })
  });
}

export async function requestPasswordReset(
  email: string,
  returnTo?: string | null
): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      ...(returnTo ? { returnTo } : {})
    })
  });
}

export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export function mapPasswordResetError(res?: { message?: string; error?: string }): string {
  return mapApiErrorToMessage(res);
}

export async function fetchMe(token: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function logout(token: string): Promise<{ ok: boolean; error?: string }> {
  return apiFetch<{ ok: boolean; error?: string }>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function signup(params: { email: string; password: string; role: "OWNER" | "STAFF" | "CUSTOMER" }) {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
}

export async function listRestaurants(token: string) {
  return apiFetch<{
    ok: boolean;
    restaurants?: Array<{
      id: string;
      name: string;
      role: string;
      status?: string;
      companyId?: string | null;
      establishmentLocation?: string | null;
    }>;
    error?: string;
  }>("/restaurants/restaurants", { headers: { Authorization: `Bearer ${token}` } });
}

export async function createRestaurant(token: string, params: { name: string; companyId?: string }) {
  return apiFetch<{ ok: boolean; restaurant?: { id: string; name: string }; error?: string }>("/restaurants/restaurants", {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(params)
  });
}

export type MenuTree = {
  restaurant: { id: string; name: string };
  categories: Array<{
    id: string;
    menuId: string | null;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      ingredients: string | null;
      specialNotes: string | null;
      priceCents: number;
      sortOrder: number;
      isActive: boolean;
      isSoldOut?: boolean;
      lifecycle?: "DRAFT" | "ACTIVE" | "ARCHIVED";
      modifierGroups: Array<{
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        sortOrder: number;
        lifecycle?: "ACTIVE" | "ARCHIVED";
        options: Array<{
          id: string;
          name: string;
          priceDeltaCents: number;
          sortOrder: number;
          isActive: boolean;
          lifecycle?: "ACTIVE" | "ARCHIVED";
        }>;
      }>;
    }>;
  }>;
};

export type AvailabilityChannel = "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "QR" | "KIOSK" | "STAFF";
export type AvailabilityScheduleKind = "RECURRING" | "TEMPORARY" | "SEASONAL";
export type AvailabilityVisibility = "CUSTOMERS" | "HIDDEN" | "STAFF_ONLY" | "TESTING";
export type AvailabilityComputedStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "SCHEDULED"
  | "OUT_OF_STOCK"
  | "HIDDEN"
  | "SEASONAL"
  | "EXPIRED"
  | "PAUSED"
  | "TESTING"
  | "INHERITED";

export type AvailabilityReason = {
  ok: boolean;
  code: string;
  label: string;
};

export type AvailabilityEvaluation = {
  orderable: boolean;
  status: AvailabilityComputedStatus;
  reasons: AvailabilityReason[];
  matchedWindowKey: string | null;
};

export type AvailabilityAuditEntry = {
  at: string;
  action: string;
  detail?: string;
  actorUserId?: string | null;
};

export type MenuAvailabilityWindow = {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
  label: string;
  color: string;
  scheduleKind?: AvailabilityScheduleKind;
  temporaryStartAt?: string | null;
  temporaryEndAt?: string | null;
  seasonalStartMd?: string | null;
  seasonalEndMd?: string | null;
  channels?: AvailabilityChannel[];
  locationMode?: "ALL" | "SELECTED";
  locationIds?: string[];
  visibility?: AvailabilityVisibility;
  outOfStock?: boolean;
  requiresManagerApproval?: boolean;
  ageRestricted?: boolean;
  minAge?: number | null;
  paused?: boolean;
  history?: AvailabilityAuditEntry[];
};

export type MenuAvailabilityWindows = Record<string, MenuAvailabilityWindow>;

export type AvailabilityCardPayload = {
  key: string;
  menuId: string;
  menuName: string;
  menuStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  window: MenuAvailabilityWindow;
  evaluation: AvailabilityEvaluation;
};

export type AvailabilityOverviewPayload = {
  ok: boolean;
  restaurant?: {
    id: string;
    name: string;
    timezone: string;
    openingHours: string | null;
  };
  locations?: Array<{ id: string; name: string }>;
  channels?: AvailabilityChannel[];
  cards?: AvailabilityCardPayload[];
  affected?: number;
  exported?: MenuAvailabilityWindows | null;
  error?: string;
  message?: string;
};

export type AvailabilityManageAction =
  | "make_available"
  | "make_unavailable"
  | "set_recurring"
  | "set_temporary"
  | "set_seasonal"
  | "mark_out_of_stock"
  | "restock"
  | "set_channels"
  | "set_locations_all"
  | "set_locations"
  | "set_visibility"
  | "set_business_rules"
  | "copy_schedule"
  | "copy_availability"
  | "apply_to_menus"
  | "reset_to_default"
  | "remove_rules"
  | "update_window"
  | "export_rules"
  | "import_schedule";

export type MenuSurfaceRow = {
  id: string;
  name: string;
  description: string | null;
  surfaceKey: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  categoryCount: number;
  itemCount: number;
  coverMediaKey: string | null;
  activeVersionNumber: number | null;
  publishedAt: string | null;
  scheduledPublishAt?: string | null;
  hasUnpublishedChanges?: boolean;
  draftChangeCount?: number;
  availabilityWindows: MenuAvailabilityWindows | null;
  scopeTone: "live" | "draft" | "problem";
  scopeLabel: string;
  rowActions?: Array<{ id: string; label: string; danger?: boolean }>;
  createdAt: string;
  updatedAt: string;
};

export type MenuManageActionDescriptor = {
  id: string;
  label: string;
  description: string;
  danger?: boolean;
};

export type MenuManageContextPayload = {
  multiLocation: boolean;
  targets: MenuSurfaceRow[];
  draftTargetIds: string[];
  actions: MenuManageActionDescriptor[];
  moveDestinations: Array<{ id: string; name: string }>;
};

export type MenuListStatusFilter = "active" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type MenuListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export async function listRestaurantMenus(
  token: string,
  restaurantId: string,
  status: MenuListStatusFilter = "active",
  params?: { page?: number; pageSize?: number }
) {
  const search = new URLSearchParams();
  if (status !== "active") search.set("status", status);
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{
    ok: boolean;
    menus?: MenuSurfaceRow[];
    pagination?: MenuListPagination;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/menus${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getMenuManageContext(
  token: string,
  restaurantId: string,
  params: { variant: "active" | "live" | "archived"; menuIds?: string[] }
) {
  const search = new URLSearchParams({ variant: params.variant });
  if (params.menuIds && params.menuIds.length > 0) {
    search.set("menuIds", params.menuIds.join(","));
  }
  return apiFetch<{ ok: boolean; context?: MenuManageContextPayload; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/manage-context?${search.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createRestaurantMenu(
  token: string,
  restaurantId: string,
  body: { name: string; description?: string; surfaceKey?: string }
) {
  return apiFetch<{ ok: boolean; menu?: MenuSurfaceRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  body: { name: string; description?: string; surfaceKey?: string }
) {
  return apiFetch<{ ok: boolean; menu?: MenuSurfaceRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function publishRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  body?: { releaseNotes?: string | null; requireChanges?: boolean }
) {
  return apiFetch<{
    ok: boolean;
    menu?: { id: string; status: string; versionNumber: number; publishedAt: string };
    report?: MenuPublishReport;
    changeSummary?: MenuReleaseChangeSummary;
    validation?: MenuReleaseValidationResult;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/publish`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body ?? {})
  });
}

export type MenuReleaseChangeLine = {
  kind: string;
  label: string;
  detail?: string;
};

export type MenuReleaseChangeSummary = {
  totalChanges: number;
  categoriesAdded: number;
  categoriesRemoved: number;
  categoriesUpdated: number;
  itemsAdded: number;
  itemsRemoved: number;
  itemsUpdated: number;
  pricesChanged: number;
  itemsHidden: number;
  itemsShown: number;
  mediaChanged: number;
  modifiersChanged: number;
  lines: MenuReleaseChangeLine[];
};

export type MenuReleaseValidationCheck = {
  id: string;
  ok: boolean;
  label: string;
  detail?: string;
};

export type MenuReleaseValidationResult = {
  ok: boolean;
  checks: MenuReleaseValidationCheck[];
};

export type MenuPublishReport = {
  versionNumber: number;
  publishedAt: string;
  publishedByUserId: string;
  categoryCount: number;
  itemCount: number;
  modifierGroupCount: number;
  modifierOptionCount: number;
  mediaCount: number;
  changeSummary: MenuReleaseChangeSummary;
};

export type MenuReleasePreview = {
  menuId: string;
  menuName: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  currentVersionNumber: number | null;
  nextVersionNumber: number;
  hasUnpublishedChanges: boolean;
  draftChangeCount: number;
  changeSummary: MenuReleaseChangeSummary;
  validation: MenuReleaseValidationResult;
  scheduledPublishAt: string | null;
};

export type MenuVersionListItem = {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
  createdAt: string;
  createdByUserId: string;
  isActive: boolean;
  categoryCount: number;
  itemCount: number;
  changeSummary: MenuReleaseChangeSummary | null;
  publishReport: MenuPublishReport | null;
  releaseNotes: string | null;
};

export type MenuVersionCompareResult = {
  fromVersionNumber: number;
  toVersionNumber: number;
  summary: MenuReleaseChangeSummary;
  priceChanges: Array<{ itemId: string; name: string; fromCents: number; toCents: number }>;
  addedItems: Array<{ id: string; name: string; priceCents: number }>;
  removedItems: Array<{ id: string; name: string; priceCents: number }>;
};

export async function getMenuReleasePreview(token: string, restaurantId: string, menuId: string) {
  return apiFetch<{ ok: boolean; preview?: MenuReleasePreview; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/release-preview`,
    { headers: authHeaders(token) }
  );
}

export async function listMenuVersions(token: string, restaurantId: string, menuId: string) {
  return apiFetch<{ ok: boolean; versions?: MenuVersionListItem[]; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/versions`,
    { headers: authHeaders(token) }
  );
}

export async function compareMenuVersionsApi(
  token: string,
  restaurantId: string,
  menuId: string,
  from: number,
  to: number
) {
  const qs = new URLSearchParams({ from: String(from), to: String(to) });
  return apiFetch<{ ok: boolean; compare?: MenuVersionCompareResult; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/versions/compare?${qs}`,
    { headers: authHeaders(token) }
  );
}

export async function rollbackMenuVersionApi(
  token: string,
  restaurantId: string,
  menuId: string,
  versionNumber: number
) {
  return apiFetch<{
    ok: boolean;
    menu?: { id: string; status: string; versionNumber: number; publishedAt: string };
    report?: MenuPublishReport;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/rollback`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ versionNumber })
  });
}

export async function getMenuAdmin(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; error?: string } & Partial<MenuTree>>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createCategory(
  token: string,
  restaurantId: string,
  body: { name: string; menuId?: string; description?: string; sortOrder?: number }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; category?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateCategory(
  token: string,
  restaurantId: string,
  categoryId: string,
  body: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    menuId?: string | null;
  }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; category?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories/${encodeURIComponent(categoryId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deleteCategory(token: string, restaurantId: string, categoryId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories/${encodeURIComponent(categoryId)}`,
    { method: "DELETE", headers: authJsonHeaders(token) }
  );
}

export async function duplicateCategory(token: string, restaurantId: string, categoryId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; category?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories/${encodeURIComponent(categoryId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token) }
  );
}

export async function createMenuItem(
  token: string,
  restaurantId: string,
  body: {
    categoryId: string;
    name: string;
    description?: string;
    ingredients?: string;
    specialNotes?: string;
    priceCents: number;
    sortOrder?: number;
  }
) {
  return apiFetch<{ ok: boolean; error?: string; item?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateMenuItem(
  token: string,
  restaurantId: string,
  itemId: string,
  body: {
    categoryId?: string;
    name?: string;
    description?: string | null;
    ingredients?: string | null;
    specialNotes?: string | null;
    priceCents?: number;
    sortOrder?: number;
    isActive?: boolean;
    isSoldOut?: boolean;
    lifecycle?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; item?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deleteMenuItem(token: string, restaurantId: string, itemId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE", headers: authJsonHeaders(token) }
  );
}

export async function duplicateMenuItem(token: string, restaurantId: string, itemId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; item?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token) }
  );
}

export async function copyMenuItem(
  token: string,
  restaurantId: string,
  itemId: string,
  body: { categoryId: string }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; item?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/copy`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function attachMenuSurfaceCoverMedia(
  token: string,
  restaurantId: string,
  menuId: string,
  mediaId: string
) {
  return apiFetch<{ ok: boolean; coverMediaKey?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/cover-media`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ mediaId }) }
  );
}

export async function createModifierGroup(
  token: string,
  restaurantId: string,
  itemId: string,
  body: { name: string; minSelect?: number; maxSelect?: number }
) {
  return apiFetch<{ ok: boolean; error?: string; group?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/modifier-groups`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createModifierOption(
  token: string,
  restaurantId: string,
  groupId: string,
  body: { name: string; priceDeltaCents?: number }
) {
  return apiFetch<{ ok: boolean; error?: string; option?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}/options`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateModifierGroup(
  token: string,
  restaurantId: string,
  groupId: string,
  body: {
    name?: string;
    minSelect?: number;
    maxSelect?: number;
    sortOrder?: number;
    lifecycle?: "ACTIVE" | "ARCHIVED";
  }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; group?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deleteModifierGroup(token: string, restaurantId: string, groupId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}`,
    { method: "DELETE", headers: authJsonHeaders(token) }
  );
}

export async function duplicateModifierGroup(token: string, restaurantId: string, groupId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; group?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token) }
  );
}

export async function attachModifierGroup(
  token: string,
  restaurantId: string,
  groupId: string,
  body: { itemIds: string[] }
) {
  return apiFetch<{
    ok: boolean;
    error?: string;
    message?: string;
    groups?: Array<{ id: string; menuItemId: string }>;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}/attach`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateModifierOption(
  token: string,
  restaurantId: string,
  optionId: string,
  body: {
    name?: string;
    priceDeltaCents?: number;
    sortOrder?: number;
    isActive?: boolean;
    lifecycle?: "ACTIVE" | "ARCHIVED";
    modifierGroupId?: string;
  }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; option?: { id: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-options/${encodeURIComponent(optionId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deleteModifierOption(token: string, restaurantId: string, optionId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-options/${encodeURIComponent(optionId)}`,
    { method: "DELETE", headers: authJsonHeaders(token) }
  );
}

export async function duplicateModifierOption(token: string, restaurantId: string, optionId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; option?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-options/${encodeURIComponent(optionId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token) }
  );
}

export type MenuEntityAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "publish"
  | "archive"
  | "reorder"
  | "upload"
  | "remove";

export type MenuEntity =
  | "menu"
  | "category"
  | "item"
  | "modifier_group"
  | "modifier_option"
  | "description"
  | "media";

export type MenuCapabilitiesPayload = {
  entities: Record<MenuEntity, Record<MenuEntityAction, boolean>>;
  limits: {
    maxImagesPerItem: number;
    maxVideosPerItem: number;
    maxVideoDurationMs: number;
    maxVideoBytes: number;
  };
};

export async function getMenuCapabilities(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; capabilities?: MenuCapabilitiesPayload; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/capabilities`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type MenuItemMediaRow = {
  id: string;
  kind: "image" | "video";
  sortOrder: number;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
  originalName: string | null;
  objectKey: string;
  isCover: boolean;
  url: string | null;
};

export async function listMenuItemMedia(token: string, restaurantId: string, menuItemId: string) {
  return apiFetch<{
    ok: boolean;
    media?: MenuItemMediaRow[];
    counts?: { images: number; videos: number };
    limits?: MenuCapabilitiesPayload["limits"];
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(menuItemId)}/media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function attachMenuItemMedia(
  token: string,
  restaurantId: string,
  menuItemId: string,
  body: { mediaId: string; setAsCover?: boolean; durationMs?: number }
) {
  return apiFetch<{ ok: boolean; media?: MenuItemMediaRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(menuItemId)}/media`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function removeMenuItemMedia(token: string, restaurantId: string, menuItemId: string, mediaId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(menuItemId)}/media/${encodeURIComponent(mediaId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createMenuMediaUploadSession(
  token: string,
  body: {
    scope: "menu" | "video";
    contentType: string;
    restaurantId: string;
    menuItemId?: string;
    originalName?: string;
  }
) {
  return apiFetch<{
    ok: boolean;
    upload?: { objectKey: string; uploadUrl: string; maxBytes: number };
    error?: string;
  }>("/media/upload-session", {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
}

export async function completeMenuMediaUpload(
  token: string,
  body: {
    scope: "menu" | "video";
    objectKey: string;
    contentType: string;
    restaurantId: string;
    menuItemId?: string;
    originalName?: string;
  }
) {
  return apiFetch<{ ok: boolean; media?: { id: string }; error?: string }>("/media/complete", {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
}

export async function uploadMenuMediaBase64(
  token: string,
  body: {
    scope: "menu" | "video";
    objectKey: string;
    contentType: string;
    dataBase64: string;
    restaurantId: string;
    menuItemId?: string;
    originalName?: string;
  }
) {
  return apiFetch<{ ok: boolean; media?: { id: string }; error?: string }>("/media/upload", {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
}

export type OrderRow = {
  id: string;
  status: string;
  totalCents: number;
  customerUserId: string | null;
  createdAt: string;
  lines: Array<{ name: string; quantity: number; lineTotalCents: number }>;
};

export async function listRestaurantOrders(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; error?: string; orders?: OrderRow[] }>(
    `/orders/restaurant/${encodeURIComponent(restaurantId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function patchOrderStatus(token: string, orderId: string, status: string) {
  return apiFetch<{ ok: boolean; error?: string }>(`/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ status })
  });
}

export async function setActiveRestaurant(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; activeRestaurantId?: string | null; error?: string }>(
    "/workspace/active-restaurant",
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify({ restaurantId })
    }
  );
}

export type VenuePaymentSettings = {
  providers: {
    stripe: { connected: boolean; accountId?: string; connectedAt?: string; displayName?: string };
    swish: { connected: boolean; merchantId?: string; connectedAt?: string; displayName?: string };
  };
  methods: Record<string, boolean>;
  rules: {
    payBeforeOrder: boolean;
    payAfterMeal: boolean;
    depositRequired: boolean;
    minOrderCents: number | null;
    maxOrderCents: number | null;
    defaultPaymentMode: "PAY_AT_VENUE" | "PREPAY" | "HYBRID";
  };
  refunds: {
    managerApproval: boolean;
    automaticRefund: boolean;
    manualRefund: boolean;
    refundTimeoutHours: number;
  };
  taxes: {
    vatStandardPercent: number;
    serviceFeePercent: number;
    deliveryFeeCents: number;
    tipsEnabled: boolean;
  };
  bankAccount: { linked: boolean; lastFour?: string; holderName?: string };
};

export type PaymentStats = {
  successful: number;
  pending: number;
  refunded: number;
  failed: number;
  disputed: number;
  connectedProviders: number;
  disconnectedProviders: number;
  lastSyncAt: string | null;
};

export async function getVenuePaymentSettings(token: string, restaurantId: string) {
  return apiFetch<{
    ok: boolean;
    settings?: VenuePaymentSettings;
    stats?: PaymentStats;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payment-settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function patchVenuePaymentSettings(
  token: string,
  restaurantId: string,
  body: Partial<Pick<VenuePaymentSettings, "methods" | "rules" | "refunds" | "taxes" | "bankAccount">>
) {
  return apiFetch<{ ok: boolean; settings?: VenuePaymentSettings; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payment-settings`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function connectVenuePaymentProvider(
  token: string,
  restaurantId: string,
  body: { provider: "stripe" | "swish"; accountId?: string; merchantId?: string; displayName?: string }
) {
  return apiFetch<{ ok: boolean; settings?: VenuePaymentSettings; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payment-settings/connect`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function disconnectVenuePaymentProvider(
  token: string,
  restaurantId: string,
  provider: "stripe" | "swish"
) {
  return apiFetch<{ ok: boolean; settings?: VenuePaymentSettings; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payment-settings/disconnect`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ provider }) }
  );
}

export async function archiveRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  confirmName: string
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/archive`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ confirmName }) }
  );
}

export async function deleteDraftRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  confirmName: string
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/draft`,
    { method: "DELETE", headers: authJsonHeaders(token), body: JSON.stringify({ confirmName }) }
  );
}

export async function deleteRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  confirmName: string
) {
  return apiFetch<{ ok: boolean; mode?: "deleted" | "archived"; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}`,
    { method: "DELETE", headers: authJsonHeaders(token), body: JSON.stringify({ confirmName }) }
  );
}

export async function unpublishRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  confirmName: string
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/unpublish`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ confirmName }) }
  );
}

export async function moveRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  targetRestaurantId: string
) {
  return apiFetch<{ ok: boolean; menu?: MenuSurfaceRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/move`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ targetRestaurantId }) }
  );
}

export async function duplicateRestaurantMenu(token: string, restaurantId: string, menuId: string) {
  return apiFetch<{ ok: boolean; menu?: MenuSurfaceRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/duplicate`,
    { method: "POST", headers: authHeaders(token) }
  );
}

export async function scheduleRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  body: {
    scheduledPublishAt?: string | null;
    scheduledUnpublishAt?: string | null;
    availabilityWindows?: MenuAvailabilityWindows;
  }
) {
  return apiFetch<{
    ok: boolean;
    menu?: MenuSurfaceRow & {
      scheduledPublishAt?: string | null;
      scheduledUnpublishAt?: string | null;
    };
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/schedule`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function getAvailabilityOverview(token: string, restaurantId: string) {
  return apiFetch<AvailabilityOverviewPayload>(
    `/restaurants/${encodeURIComponent(restaurantId)}/availability`,
    { headers: authHeaders(token) }
  );
}

export async function manageAvailability(
  token: string,
  restaurantId: string,
  body: {
    action: AvailabilityManageAction;
    refs: Array<{ menuId: string; key: string }>;
    patch?: Partial<MenuAvailabilityWindow>;
    targetMenuIds?: string[];
    importWindows?: MenuAvailabilityWindows;
  }
) {
  return apiFetch<AvailabilityOverviewPayload>(
    `/restaurants/${encodeURIComponent(restaurantId)}/availability/manage`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function exportMenuCsv(token: string, restaurantId: string) {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${encodeURIComponent(restaurantId)}/menu/export.csv`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { ok: false as const, error: "export_failed" };
  const csv = await res.text();
  return { ok: true as const, csv };
}

export async function importMenuCsv(token: string, restaurantId: string, csv: string) {
  return apiFetch<{
    ok: boolean;
    imported?: { categoriesCreated: number; itemsCreated: number; modifiersCreated: number; rows: number };
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/menu/import.csv`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify({ csv })
  });
}

export async function createOrderingSession(
  token: string,
  restaurantId: string,
  body?: { tableLabel?: string; paymentMode?: string }
) {
  return apiFetch<{
    ok: boolean;
    session?: { id: string; menuUrl: string; paymentMode: string };
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/ordering-sessions`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body ?? {})
  });
}

export async function getOrderingSessionQr(token: string, restaurantId: string, sessionId: string) {
  return apiFetch<{
    ok: boolean;
    menuUrl?: string;
    qrImageUrl?: string;
    pngDownloadUrl?: string;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/ordering-sessions/${encodeURIComponent(sessionId)}/qr`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type PublicOrderingSession = {
  id: string;
  restaurantId: string;
  paymentMode: string;
  tableLabel: string | null;
  menuUrl: string;
};

export async function fetchOrderingSession(sessionId: string) {
  return apiFetch<{ ok: boolean; session?: PublicOrderingSession; error?: string; message?: string }>(
    `/ordering-sessions/${encodeURIComponent(sessionId)}`
  );
}

export async function fetchSessionMenu(sessionId: string) {
  return apiFetch<{
    ok: boolean;
    session?: PublicOrderingSession;
    restaurant?: { id: string; name: string };
    categories?: MenuTree["categories"];
    error?: string;
    message?: string;
  }>(`/ordering-sessions/${encodeURIComponent(sessionId)}/menu`);
}

export type SessionCartPayload = {
  lines: Array<{
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    modifierOptionIds: string[];
  }>;
  subtotalCents: number;
  totalQuantity: number;
  orderNote: string;
};

export async function fetchSessionCart(sessionId: string) {
  return apiFetch<{ ok: boolean; error?: string } & Partial<SessionCartPayload>>(
    `/ordering-sessions/${encodeURIComponent(sessionId)}/cart`
  );
}

export async function addSessionCartItem(
  sessionId: string,
  body: { menuItemId: string; quantity?: number; modifierOptionIds?: string[] }
) {
  return apiFetch<{ ok: boolean; error?: string; meta?: { message?: string } } & Partial<SessionCartPayload>>(
    `/ordering-sessions/${encodeURIComponent(sessionId)}/cart/items`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

export async function patchSessionCartLine(
  sessionId: string,
  lineId: string,
  body: { delta?: number; quantity?: number; confirmRemove?: boolean }
) {
  return apiFetch<{ ok: boolean; error?: string; meta?: Record<string, unknown> } & Partial<SessionCartPayload>>(
    `/ordering-sessions/${encodeURIComponent(sessionId)}/cart/lines/${encodeURIComponent(lineId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

export async function placeOrderFromSession(body: {
  restaurantId: string;
  sourceSessionId: string;
  fromSessionCart?: boolean;
  note?: string;
}) {
  return apiFetch<{
    ok: boolean;
    order?: { id: string; status: string; paymentStatus: string; totalCents: number };
    error?: string;
    message?: string;
  }>("/orders/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, fromSessionCart: true })
  });
}

export async function startOrderCheckout(orderId: string, provider: "stripe" | "swish" | "cash") {
  return apiFetch<{
    ok: boolean;
    checkout?: {
      orderId: string;
      provider: string;
      amountCents: number;
      status: string;
      clientSecret?: string;
      swishQrData?: string;
      swishDeepLink?: string;
      instructions?: string;
    };
    error?: string;
    message?: string;
  }>(`/orders/${encodeURIComponent(orderId)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider })
  });
}

export async function completeOrderCheckout(orderId: string, provider: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/orders/${encodeURIComponent(orderId)}/checkout/complete`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) }
  );
}
