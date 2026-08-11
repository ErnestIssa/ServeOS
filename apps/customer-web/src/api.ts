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

export type MenuReleaseState = "draft" | "scheduled" | "live" | "retired" | "archived";

export type MenuSurfaceRow = {
  id: string;
  name: string;
  description: string | null;
  surfaceKey: string | null;
  status: "DRAFT" | "PUBLISHED" | "RETIRED" | "ARCHIVED";
  releaseState?: MenuReleaseState;
  releaseLabel?: string;
  sortOrder: number;
  categoryCount: number;
  itemCount: number;
  coverMediaKey: string | null;
  activeVersionNumber: number | null;
  publishedAt: string | null;
  scheduledPublishAt?: string | null;
  scheduledRetireAt?: string | null;
  hasUnpublishedChanges?: boolean;
  draftChangeCount?: number;
  availabilityWindows: MenuAvailabilityWindows | null;
  scopeTone: "live" | "draft" | "problem" | "scheduled" | "retired";
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
  params?: { page?: number; pageSize?: number; q?: string; sort?: string; filters?: string[] }
) {
  const search = new URLSearchParams();
  if (status !== "active") search.set("status", status);
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.sort?.trim()) search.set("sort", params.sort.trim());
  if (params?.filters?.length) search.set("filters", params.filters.join(","));
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

export async function duplicateCategory(
  token: string,
  restaurantId: string,
  categoryId: string,
  body?: {
    name?: string;
    targetMenuId?: string | null;
    copyItems?: boolean;
    copyMedia?: boolean;
  }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; category?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/categories/${encodeURIComponent(categoryId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
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

export async function duplicateMenuItem(
  token: string,
  restaurantId: string,
  itemId: string,
  body?: {
    name?: string;
    targetCategoryId?: string;
    copyModifiers?: boolean;
    copyMedia?: boolean;
  }
) {
  return apiFetch<{
    ok: boolean;
    error?: string;
    message?: string;
    item?: { id: string; name: string; categoryId?: string };
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/items/${encodeURIComponent(itemId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
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

export async function duplicateModifierGroup(
  token: string,
  restaurantId: string,
  groupId: string,
  body?: { name?: string }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; group?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-groups/${encodeURIComponent(groupId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
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

export async function duplicateModifierOption(
  token: string,
  restaurantId: string,
  optionId: string,
  body?: { name?: string }
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string; option?: { id: string; name: string } }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menu/modifier-options/${encodeURIComponent(optionId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
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
    uploadJobId?: string;
    displayName?: string;
    altText?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    forceNewAsset?: boolean;
    importSource?: MediaImportSource;
    importSourceId?: string;
    importOriginalPath?: string;
  }
) {
  return apiFetch<{
    ok: boolean;
    media?: { id: string };
    assetId?: string | null;
    reused?: boolean;
    error?: string;
  }>("/media/upload", {
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
    uploadJobId?: string;
    sha256Hex?: string;
    forceNewAsset?: boolean;
  }
) {
  return apiFetch<{
    ok: boolean;
    media?: { id: string };
    assetId?: string | null;
    reused?: boolean;
    error?: string;
  }>("/media/complete", {
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

export type PaymentProviderEnvReady = {
  stripe: boolean;
  swish: boolean;
  webhook: boolean;
  demoLedger: boolean;
};

export type PaymentOrderSource =
  | "qr_orders"
  | "in_app"
  | "walk_ins"
  | "staff_created"
  | "reservations"
  | "delivery"
  | "catering"
  | "b2b";

export type PaymentSettlementMode =
  | "automatic"
  | "staff_confirmed"
  | "provider_verified"
  | "manual_reference";

export type PaymentReconciliationMode = "none" | "required" | "provider_match";
export type PaymentRefundPolicy = "standard" | "manager_only" | "disabled" | "provider_only";
export type PaymentCancellationPolicy = "allow" | "manager_only" | "block_if_paid";
export type PaymentStaffRole = "owner" | "manager" | "staff";

export type PaymentMethodConfig = {
  methodType?: string;
  enabled: boolean;
  displayName?: string;
  instructionsStaff?: string;
  instructionsCustomer?: string;
  supportedOrderSources?: PaymentOrderSource[];
  currencies: string[];
  minCents: number | null;
  maxCents: number | null;
  allowedRoles?: PaymentStaffRole[];
  requiresStaffConfirmation?: boolean;
  requiresReference?: boolean;
  settlementMode?: PaymentSettlementMode;
  reconciliationMode?: PaymentReconciliationMode;
  refundPolicy?: PaymentRefundPolicy;
  cancellationPolicy?: PaymentCancellationPolicy;
  availabilityRules?: {
    always: boolean;
    openHoursOnly: boolean;
    scheduleNote: string;
  };
  provider?: "stripe" | "swish" | "terminal" | "manual" | "none";
  capture: "automatic" | "manual";
  refundsEnabled: boolean;
  threeDSecure: "automatic" | "always" | "never";
  isDefault?: boolean;
  priority?: number;
  version?: number;
  updatedAt?: string | null;
};

export type VenuePaymentSettings = {
  providers: {
    stripe: {
      connected: boolean;
      accountId?: string;
      connectedAt?: string;
      displayName?: string;
      environment?: "sandbox" | "production";
    };
    swish: {
      connected: boolean;
      merchantId?: string;
      connectedAt?: string;
      displayName?: string;
      environment?: "sandbox" | "production";
    };
  };
  methods: Record<string, boolean>;
  methodConfig?: Record<string, PaymentMethodConfig>;
  defaultPaymentMethodKey?: string | null;
  rules: {
    payBeforeOrder: boolean;
    payAfterMeal: boolean;
    depositRequired: boolean;
    minOrderCents: number | null;
    maxOrderCents: number | null;
    defaultPaymentMode: "PAY_AT_VENUE" | "PREPAY" | "HYBRID";
  };
  payAtVenue?: {
    enabled: boolean;
    timing: "before_served" | "when_ready" | "when_bill_requested" | "after_completed";
    channels: {
      qrOrders: boolean;
      walkIns: boolean;
      staffCreated: boolean;
      reservations: boolean;
      delivery: boolean;
    };
    settlementMethods: {
      cash: boolean;
      cardTerminal: boolean;
      swish: boolean;
      other: boolean;
    };
  };
  qrPolicy?: {
    defaultPaymentMode: "PAY_AT_VENUE" | "PREPAY" | "HYBRID";
    allowSwitchToApp: boolean;
    requirePaymentBeforePrep: boolean;
    allowUnpaidOrders: boolean;
    autoCloseUnpaidHours: number | null;
    requireStaffConfirmation: boolean;
  };
  splits?: {
    enabled: boolean;
    maxSplits: number;
    allowCustomerSelfSplit: boolean;
    allowStaffSplit: boolean;
    allowEqualSplit: boolean;
    allowItemBasedSplit: boolean;
    allowCustomAmount: boolean;
  };
  tips?: {
    enabled: boolean;
    suggestedPercents: number[];
    customTip: boolean;
    tipBeforePayment: boolean;
    tipAfterPayment: boolean;
    cashTipsMode: "track_manually" | "ignore";
  };
  failedPayment?: {
    remainUnpaid: boolean;
    allowRetry: boolean;
    blockKitchen: boolean;
    allowStaffAcceptUnpaid: boolean;
  };
  refunds: {
    managerApproval: boolean;
    automaticRefund: boolean;
    manualRefund: boolean;
    refundTimeoutHours: number;
  };
  refundLimits?: {
    staffMaxCents: number;
    managerMaxCents: number;
    ownerUnlimited: boolean;
  };
  taxes: {
    vatStandardPercent: number;
    serviceFeePercent: number;
    deliveryFeeCents: number;
    tipsEnabled: boolean;
  };
  taxDisplay?: {
    managedIn: "restaurant_taxes";
    pricesIncludeTax: boolean;
    calculation: "backend";
  };
  bankAccount: { linked: boolean; lastFour?: string; holderName?: string };
  auditLog?: Array<{
    id: string;
    at: string;
    actorUserId?: string;
    actorRole?: string;
    action: string;
    path: string;
  }>;
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

export type PaymentHealthStatus = "operational" | "degraded" | "disabled" | "unknown";

export type PaymentOverviewAnalysisTone = "ahead" | "on_track" | "behind" | "unknown";

export type PaymentOverviewAnalysis = {
  tone: PaymentOverviewAnalysisTone;
  toneLabel: string;
  todayCents: number;
  yesterdayCents: number;
  yesterdaySameTimeCents: number;
  expectedCents: number;
  deltaPercent: number;
  aheadThresholdPercent: number;
  behindThresholdPercent: number;
  summary: string;
  detail: string;
};

export type PaymentOverview = {
  source: "live" | "demo";
  currency: string;
  health: {
    paymentSystem: PaymentHealthStatus;
    onlinePayments: PaymentHealthStatus;
    payAtVenue: PaymentHealthStatus;
    refunds: PaymentHealthStatus;
    webhooks: PaymentHealthStatus;
    settlement: PaymentHealthStatus;
  };
  today: {
    paymentsCents: number;
    pendingCents: number;
    refundedCents: number;
    failedCents: number;
    payAtVenueCents: number;
    onlineCents: number;
    disputeCount: number;
    reconAlertCount: number;
  };
  analysis: PaymentOverviewAnalysis;
  providerSummary: {
    stripe: "connected" | "disconnected";
    swish: "connected" | "disconnected";
    terminalsConnected: number;
  };
};

export type PaymentActivityRange = "7d" | "30d" | "90d";

export type PaymentActivityPoint = {
  date: string;
  onlineCents: number;
  venueCents: number;
  refundedCents: number;
  failedCents: number;
};

export type PaymentActivitySeries = {
  source: "live" | "demo";
  range: PaymentActivityRange;
  currency: string;
  points: PaymentActivityPoint[];
};

export type PaymentTxnStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded"
  | "disputed"
  | "charged_back";

export type PaymentTransactionRow = {
  id: string;
  source: "live" | "demo";
  orderId: string | null;
  orderDisplay?: string | null;
  customerLabel: string;
  amountCents: number;
  tipCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  method: string;
  provider: string;
  status: PaymentTxnStatus;
  refundedCents: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTransactionDetail = PaymentTransactionRow & {
  timeline: Array<{ at: string; type: string; label: string }>;
};

export type PaymentRefundRow = {
  id: string;
  source: "live" | "demo";
  paymentId: string;
  orderId: string | null;
  amountCents: number;
  currency: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  provider: string;
  status: "pending_approval" | "processing" | "completed" | "failed" | "partially_refunded";
  createdAt: string;
  completedAt: string | null;
};

export type PaymentReconciliation = {
  source: "live" | "demo";
  orders: number;
  payments: number;
  matched: number;
  mismatched: number;
  pendingProviderEvents: number;
  mismatches: Array<{
    id: string;
    type: string;
    summary: string;
    orderId: string | null;
    paymentId: string | null;
    amountCents: number | null;
    createdAt: string;
  }>;
};

export type PaymentPayoutRow = {
  id: string;
  source: "live" | "demo";
  status: "scheduled" | "in_transit" | "paid" | "failed";
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  chargebacksCents: number;
  tipsCents: number;
  netCents: number;
  currency: string;
  expectedAt: string;
  paidAt: string | null;
  provider: string;
};

export type PaymentWebhookHealth = {
  source: "live" | "demo";
  status: "healthy" | "degraded" | "failing";
  lastEventAt: string | null;
  eventsToday: number;
  failed: number;
  retrying: number;
  recentEvents: Array<{ id: string; type: string; at: string; ok: boolean }>;
};

export type PaymentLogRow = {
  id: string;
  source: "live" | "demo";
  category: "webhook" | "payment" | "refund" | "security" | "config" | "reconciliation";
  level: "info" | "warn" | "error";
  message: string;
  at: string;
  meta?: Record<string, unknown>;
};

export async function getVenuePaymentSettings(token: string, restaurantId: string) {
  return apiFetch<{
    ok: boolean;
    settings?: VenuePaymentSettings;
    stats?: PaymentStats;
    envReady?: PaymentProviderEnvReady;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payment-settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function patchVenuePaymentSettings(
  token: string,
  restaurantId: string,
  body: Partial<VenuePaymentSettings>
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
  return apiFetch<{
    ok: boolean;
    settings?: VenuePaymentSettings;
    needsEnv?: boolean;
    envReady?: PaymentProviderEnvReady;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payment-settings/connect`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
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

export async function getVenuePaymentOverview(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; overview?: PaymentOverview; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/overview`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type TodaysPaymentsDrillTarget = "transactions" | "refunds";

export type TodaysPaymentsDrillFilter = {
  target: TodaysPaymentsDrillTarget;
  ids: string[];
  statuses?: PaymentTxnStatus[];
  methods?: string[];
  day: string;
  dayStart?: string;
  dayEnd?: string;
  searchPreset?: string;
};

export type TodaysPaymentsMetric = {
  key: string;
  label: string;
  valueLabel: string;
  amountCents?: number;
  count?: number;
  currency: string;
  filter: TodaysPaymentsDrillFilter;
};

export type TodaysPaymentsMethodSlice = {
  key: string;
  label: string;
  amountCents: number;
  count: number;
  currency: string;
  sharePercent: number;
  enabled?: boolean;
  filter: TodaysPaymentsDrillFilter;
};

export type TodaysPaymentsSnapshot = {
  source: "live" | "demo";
  timezone: string;
  dayKey: string;
  dayStart: string;
  dayEnd: string;
  currency: string;
  currencies: string[];
  aggregates: {
    collectedCents: number;
    successfulCount: number;
    averagePaymentCents: number;
    failedCents: number;
    failedCount: number;
    refundedCents: number;
    refundedCount: number;
    pendingCents: number;
    pendingCount: number;
  };
  analysis: PaymentOverviewAnalysis;
  metrics: TodaysPaymentsMetric[];
  methods: TodaysPaymentsMethodSlice[];
  recent: PaymentTransactionRow[];
  ledger: PaymentTransactionRow[];
  transactionsView: {
    label: string;
    day: string;
    dayStart: string;
    dayEnd: string;
    searchPreset: string;
    filter: TodaysPaymentsDrillFilter;
  };
};

export async function getVenueTodaysPayments(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; today?: TodaysPaymentsSnapshot; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/today`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type TodaysPaymentsDetailScope = "metric" | "method" | "collected" | "payment";

export type TodaysPaymentsDetailQuery = {
  scope: TodaysPaymentsDetailScope;
  key?: string;
  id?: string;
};

export type TodaysPaymentsDetailRecord = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  amountCents: number;
  currency: string;
  at: string;
  method: string;
  provider: string;
};

export type TodaysPaymentsDetail = {
  source: "live" | "demo";
  dayKey: string;
  timezone: string;
  currency: string;
  title: string;
  subtitle: string;
  summary: {
    impact: string;
    recommendedAction: string;
  };
  relatedMetrics: Array<{ label: string; value: string }>;
  filter: TodaysPaymentsDrillFilter;
  records: TodaysPaymentsDetailRecord[];
  payment?: PaymentTransactionRow | null;
};

export async function getVenueTodaysPaymentsDetail(
  token: string,
  restaurantId: string,
  query: TodaysPaymentsDetailQuery
) {
  const q = new URLSearchParams();
  q.set("scope", query.scope);
  if (query.key) q.set("key", query.key);
  if (query.id) q.set("id", query.id);
  return apiFetch<{ ok: boolean; detail?: TodaysPaymentsDetail; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/today/details?${q}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type PaymentOverallHealth = "healthy" | "degraded" | "critical";

export type PaymentHealthActionTarget =
  | "transactions"
  | "refunds"
  | "reconciliation"
  | "providers"
  | "logs"
  | "overview";

export type PaymentHealthIssue = {
  id: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
  actionLabel: string;
  actionTarget: PaymentHealthActionTarget;
  count?: number;
};

export type PaymentHealthChartSlice = {
  key: string;
  label: string;
  short: string;
  status: PaymentHealthStatus;
  statusLabel: string;
  value: number;
};

export type PaymentHealthHistoryPoint = {
  at: string;
  overall: PaymentOverallHealth;
  reason: string;
};

export type PaymentHealthSnapshot = {
  source: "live" | "demo";
  evaluatedAt: string;
  cached: boolean;
  cacheTtlSec: number;
  overall: PaymentOverallHealth;
  overallLabel: string;
  summary: string;
  dimensions: {
    paymentSystem: PaymentHealthStatus;
    onlinePayments: PaymentHealthStatus;
    payAtVenue: PaymentHealthStatus;
    refunds: PaymentHealthStatus;
    webhooks: PaymentHealthStatus;
    settlement: PaymentHealthStatus;
    providers: PaymentHealthStatus;
    reconciliation: PaymentHealthStatus;
  };
  chartSlices: PaymentHealthChartSlice[];
  metrics: {
    successRate24h: number;
    successRate7d: number;
    failedCount24h: number;
    failureRate24h: number;
    pendingStuckCount: number;
    refundFailedOrPending: number;
    reconciliationMismatches: number;
    webhookReceivedToday: number;
    webhookFailed: number;
    webhookDelayed: number;
    webhookRetrying: number;
  };
  providers: Array<{
    key: string;
    label: string;
    connected: boolean;
    status: PaymentHealthStatus;
    statusLabel: string;
  }>;
  timestamps: {
    lastSuccessfulPaymentAt: string | null;
    lastWebhookAt: string | null;
    lastReconciliationAt: string | null;
  };
  issues: PaymentHealthIssue[];
  incidents: Array<{
    id: string;
    at: string;
    severity: "warning" | "critical";
    title: string;
  }>;
  history: PaymentHealthHistoryPoint[];
};

export async function getVenuePaymentHealth(
  token: string,
  restaurantId: string,
  opts?: { refresh?: boolean }
) {
  const q = new URLSearchParams();
  if (opts?.refresh) q.set("refresh", "1");
  const suffix = q.toString() ? `?${q}` : "";
  return apiFetch<{ ok: boolean; health?: PaymentHealthSnapshot; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/health${suffix}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type PaymentHealthIssueRecord = {
  id: string;
  kind: "webhook_event" | "mismatch" | "payment" | "provider" | "note";
  title: string;
  subtitle: string;
  statusLabel: string;
  amountCents?: number | null;
  currency?: string;
  at: string | null;
};

export type PaymentHealthIssueDetail = {
  source: "live" | "demo";
  evaluatedAt: string;
  issue: PaymentHealthIssue;
  summary: {
    severityLabel: string;
    impact: string;
    recommendedAction: string;
  };
  relatedMetrics: Array<{ label: string; value: string }>;
  records: PaymentHealthIssueRecord[];
};

export async function getVenuePaymentHealthIssue(
  token: string,
  restaurantId: string,
  issueId: string
) {
  return apiFetch<{ ok: boolean; detail?: PaymentHealthIssueDetail; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/health/issues/${encodeURIComponent(issueId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function getVenuePaymentActivity(
  token: string,
  restaurantId: string,
  range: PaymentActivityRange = "30d"
) {
  const q = new URLSearchParams({ range });
  return apiFetch<{ ok: boolean; activity?: PaymentActivitySeries; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/activity?${q}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function listVenuePaymentTransactions(
  token: string,
  restaurantId: string,
  limit = 100,
  opts?: { day?: string }
) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (opts?.day) q.set("day", opts.day);
  return apiFetch<{
    ok: boolean;
    source?: "live" | "demo";
    day?: string;
    dayStart?: string;
    dayEnd?: string;
    transactions?: PaymentTransactionRow[];
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payments/transactions?${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getVenuePaymentTransaction(token: string, restaurantId: string, transactionId: string) {
  return apiFetch<{ ok: boolean; transaction?: PaymentTransactionDetail; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/transactions/${encodeURIComponent(transactionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function listVenuePaymentRefunds(token: string, restaurantId: string) {
  return apiFetch<{
    ok: boolean;
    source?: "live" | "demo";
    refunds?: PaymentRefundRow[];
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payments/refunds`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getVenuePaymentReconciliation(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; reconciliation?: PaymentReconciliation; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/reconciliation`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function listVenuePaymentPayouts(token: string, restaurantId: string) {
  return apiFetch<{
    ok: boolean;
    source?: "live" | "demo";
    payouts?: PaymentPayoutRow[];
    summary?: { upcomingCents: number; lastCents: number; currency: string };
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payments/payouts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getVenuePaymentWebhookHealth(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; health?: PaymentWebhookHealth; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/payments/webhooks/health`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function listVenuePaymentLogs(token: string, restaurantId: string) {
  return apiFetch<{
    ok: boolean;
    source?: "live" | "demo";
    logs?: PaymentLogRow[];
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/payments/logs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
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

export type ReplicationJobRow = {
  id: string;
  kind: string;
  status: string;
  sourceRestaurantId: string;
  targetRestaurantId: string | null;
  progressPct: number;
  phase: string | null;
  counts: unknown;
  result: { newMenuId?: string; name?: string } | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type MediaImportSource =
  | "DEVICE"
  | "CAMERA"
  | "GOOGLE_DRIVE"
  | "DROPBOX"
  | "ONEDRIVE"
  | "URL"
  | "CLIPBOARD";

export type MediaAssetRow = {
  id: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  originalName: string | null;
  displayName?: string | null;
  altText?: string | null;
  sha256Hex: string | null;
  usageCount: number;
  favorite?: boolean;
  processingStatus?: string;
  createdAt: string;
  url: string | null;
  importSource?: MediaImportSource | null;
  importSourceId?: string | null;
  importOriginalPath?: string | null;
  importedAt?: string | null;
  health?: {
    missingAlt: boolean;
    unused: boolean;
    largeFile: boolean;
    processingFailed: boolean;
    hasThumb?: boolean;
    hasWebp?: boolean;
    hasBlurHash?: boolean;
  };
};

export type MediaLibraryAsset = MediaAssetRow & {
  description?: string | null;
  tags?: string[];
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  archivedAt?: string | null;
  currentVersionNumber?: number;
  updatedAt?: string;
  collectionIds?: string[];
};

export type MediaUsageGraphNode = {
  id: string;
  targetType: string;
  targetId: string;
  role: string;
  sortOrder: number;
  createdAt: string;
  label?: string;
  group?: "Menus" | "Items" | "Categories" | "Venue" | string;
  hrefHint?: string;
};

export type MediaLibraryDetail = MediaLibraryAsset & {
  originalObjectKey?: string;
  visibility?: string;
  aiQualityScore?: number | null;
  aiTags?: string[];
  createdByUserId?: string | null;
  importedByUserId?: string | null;
  versions?: Array<{
    id: string;
    versionNumber: number;
    objectKey: string;
    byteSize: number;
    contentType: string;
    note: string | null;
    createdAt: string;
  }>;
  collections?: Array<{ id: string; name: string }>;
  usages?: MediaUsageGraphNode[];
};

export type MediaLibraryStats = {
  totalAssets: number;
  storageBytes: number;
  unusedCount: number;
  duplicateGroupCount: number;
  videosProcessing: number;
  imageCount: number;
  videoCount: number;
  missingAltCount: number;
  libraryHealthScore: number;
};

export type MediaDeleteImpact = {
  assetId: string;
  displayName: string;
  total: number;
  canHardDelete: boolean;
  byType: Record<string, number>;
  byGroup: Record<string, number>;
  usages: MediaUsageGraphNode[];
};

export type MediaDuplicateCheckAsset = {
  id: string;
  displayName: string;
  contentType: string;
  byteSize: number;
  sha256Hex: string | null;
  createdAt: string;
  url: string | null;
};

export type MediaCollectionRow = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MediaUploadJobRow = {
  id: string;
  restaurantId: string;
  status: string;
  stage: string;
  progress: number;
  assetId: string | null;
  error: string | null;
  originalName: string | null;
  contentType: string | null;
  purpose: string | null;
  objectKey: string | null;
  stages?: string[];
  createdAt: string;
  updatedAt: string;
};

export type MediaLibraryListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: "image" | "video" | "all";
  used?: boolean;
  unused?: boolean;
  favorite?: boolean;
  archived?: boolean;
  needsAlt?: boolean;
  largeFiles?: boolean;
  recentlyUploaded?: boolean;
  duplicates?: boolean;
  processing?: boolean;
  collectionId?: string;
  sort?: string;
};

export type ContentTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  restaurantId: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function duplicateRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  body?: {
    name?: string;
    copyCategories?: boolean;
    copyAvailability?: boolean;
    copyMedia?: boolean;
  }
) {
  return apiFetch<{ ok: boolean; jobId?: string; menu?: MenuSurfaceRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
  );
}

export async function duplicateRestaurantMenuToLocation(
  token: string,
  restaurantId: string,
  menuId: string,
  body: {
    targetRestaurantId: string;
    name?: string;
    copyCategories?: boolean;
    copyAvailability?: boolean;
    copyMedia?: boolean;
  }
) {
  return apiFetch<{ ok: boolean; jobId?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/duplicate-to-location`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function getReplicationJob(token: string, restaurantId: string, jobId: string) {
  return apiFetch<{ ok: boolean; job?: ReplicationJobRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/replication/jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(token) }
  );
}

export async function listReplicationJobs(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; jobs?: ReplicationJobRow[]; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/replication/jobs`,
    { headers: authHeaders(token) }
  );
}

export async function listMediaAssets(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; assets?: MediaAssetRow[]; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/assets`,
    { headers: authHeaders(token) }
  );
}

export async function listMediaLibrary(
  token: string,
  restaurantId: string,
  query: MediaLibraryListQuery = {}
) {
  const qs = new URLSearchParams();
  if (query.page) qs.set("page", String(query.page));
  if (query.pageSize) qs.set("pageSize", String(query.pageSize));
  if (query.q) qs.set("q", query.q);
  if (query.type) qs.set("type", query.type);
  if (query.used) qs.set("used", "true");
  if (query.unused) qs.set("unused", "true");
  if (query.favorite) qs.set("favorite", "true");
  if (query.archived) qs.set("archived", "true");
  if (query.needsAlt) qs.set("needsAlt", "true");
  if (query.largeFiles) qs.set("largeFiles", "true");
  if (query.recentlyUploaded) qs.set("recentlyUploaded", "true");
  if (query.duplicates) qs.set("duplicates", "true");
  if (query.processing) qs.set("processing", "true");
  if (query.collectionId) qs.set("collectionId", query.collectionId);
  if (query.sort) qs.set("sort", query.sort);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<{
    ok: boolean;
    assets?: MediaLibraryAsset[];
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    cloudSources?: Array<{ id: string; label: string; available: boolean }>;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/media/library${suffix}`, {
    headers: authHeaders(token)
  });
}

export async function getMediaLibraryStats(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; stats?: MediaLibraryStats; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/stats`,
    { headers: authHeaders(token) }
  );
}

export async function checkMediaDuplicate(token: string, restaurantId: string, sha256Hex: string) {
  const qs = new URLSearchParams({ sha256Hex });
  return apiFetch<{
    ok: boolean;
    exists?: boolean;
    asset?: MediaDuplicateCheckAsset | null;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/check-duplicate?${qs.toString()}`,
    { headers: authHeaders(token) }
  );
}

export async function getMediaDeleteImpact(token: string, restaurantId: string, assetId: string) {
  return apiFetch<{ ok: boolean; impact?: MediaDeleteImpact; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}/delete-impact`,
    { headers: authHeaders(token) }
  );
}

export async function deleteMediaLibraryAsset(token: string, restaurantId: string, assetId: string) {
  return apiFetch<{
    ok: boolean;
    deleted?: boolean;
    error?: string;
    message?: string;
    impact?: MediaDeleteImpact;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
}

export async function detachMediaLibraryUsages(
  token: string,
  restaurantId: string,
  assetId: string,
  usageIds: string[]
) {
  return apiFetch<{ ok: boolean; detached?: number; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}/detach-many`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ usageIds }) }
  );
}

export async function getMediaLibraryAsset(token: string, restaurantId: string, assetId: string) {
  return apiFetch<{ ok: boolean; asset?: MediaLibraryDetail; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}`,
    { headers: authHeaders(token) }
  );
}

export async function patchMediaLibraryAsset(
  token: string,
  restaurantId: string,
  assetId: string,
  body: Record<string, unknown>
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function replaceMediaLibraryAsset(
  token: string,
  restaurantId: string,
  assetId: string,
  body: { dataBase64: string; contentType?: string; note?: string; purpose?: string }
) {
  return apiFetch<{ ok: boolean; versionNumber?: number; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}/replace`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function rollbackMediaLibraryAsset(
  token: string,
  restaurantId: string,
  assetId: string,
  versionNumber: number
) {
  return apiFetch<{ ok: boolean; versionNumber?: number; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}/rollback`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ versionNumber }) }
  );
}

export async function attachMediaLibraryAsset(
  token: string,
  restaurantId: string,
  assetId: string,
  body: {
    targetType:
      | "MENU_COVER"
      | "MENU_ITEM"
      | "CATEGORY"
      | "VENUE_LOGO"
      | "VENUE_COVER"
      | "STAFF_AVATAR"
      | "CUSTOMER_AVATAR"
      | "MODIFIER_OPTION"
      | "QR_HERO"
      | "MARKETING_CAMPAIGN"
      | "LOYALTY_REWARD"
      | "RECEIPT_BRANDING"
      | "RESERVATION"
      | "GIFT_CARD";
    targetId: string;
    role?: "PRIMARY" | "GALLERY" | "COVER";
  }
) {
  return apiFetch<{ ok: boolean; usage?: { id: string }; storedMediaId?: string | null; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/library/${encodeURIComponent(assetId)}/attach`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function createMediaUploadJob(
  token: string,
  restaurantId: string,
  body?: { originalName?: string; contentType?: string; purpose?: string }
) {
  return apiFetch<{ ok: boolean; job?: MediaUploadJobRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/upload-jobs`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
  );
}

export async function listMediaUploadJobs(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; jobs?: MediaUploadJobRow[]; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/upload-jobs`,
    { headers: authHeaders(token) }
  );
}

export async function getMediaUploadJob(token: string, restaurantId: string, jobId: string) {
  return apiFetch<{ ok: boolean; job?: MediaUploadJobRow; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/upload-jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(token) }
  );
}

export async function listMediaCollections(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; collections?: MediaCollectionRow[]; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections`,
    { headers: authHeaders(token) }
  );
}

export async function createMediaCollection(
  token: string,
  restaurantId: string,
  body: { name: string; description?: string | null }
) {
  return apiFetch<{ ok: boolean; collection?: MediaCollectionRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateMediaCollection(
  token: string,
  restaurantId: string,
  collectionId: string,
  body: { name?: string; description?: string | null }
) {
  return apiFetch<{ ok: boolean; collection?: MediaCollectionRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections/${encodeURIComponent(collectionId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deleteMediaCollection(token: string, restaurantId: string, collectionId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections/${encodeURIComponent(collectionId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

export async function addMediaCollectionItems(
  token: string,
  restaurantId: string,
  collectionId: string,
  assetIds: string[]
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections/${encodeURIComponent(collectionId)}/items`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ assetIds }) }
  );
}

export async function removeMediaCollectionItem(
  token: string,
  restaurantId: string,
  collectionId: string,
  assetId: string
) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(assetId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

export async function duplicateMediaAssetUsage(
  token: string,
  restaurantId: string,
  assetId: string,
  body: {
    targetType: "MENU_COVER" | "MENU_ITEM" | "CATEGORY" | "VENUE_LOGO" | "VENUE_COVER";
    targetId: string;
    role?: "PRIMARY" | "GALLERY" | "COVER";
  }
) {
  return apiFetch<{ ok: boolean; usage?: { id: string }; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/media/assets/${encodeURIComponent(assetId)}/duplicate-usage`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function listContentTemplates(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; templates?: ContentTemplateRow[]; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/content-templates`,
    { headers: authHeaders(token) }
  );
}

export async function saveMenuAsTemplate(
  token: string,
  restaurantId: string,
  menuId: string,
  body?: { name?: string; description?: string }
) {
  return apiFetch<{ ok: boolean; template?: ContentTemplateRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/menus/${encodeURIComponent(menuId)}/save-as-template`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
  );
}

export async function applyContentTemplate(
  token: string,
  restaurantId: string,
  templateId: string,
  body?: { targetRestaurantId?: string; name?: string }
) {
  return apiFetch<{ ok: boolean; jobId?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/content-templates/${encodeURIComponent(templateId)}/apply`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body ?? {}) }
  );
}

export async function deleteContentTemplate(token: string, restaurantId: string, templateId: string) {
  return apiFetch<{ ok: boolean; error?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/content-templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE", headers: authJsonHeaders(token) }
  );
}

export async function scheduleRestaurantMenu(
  token: string,
  restaurantId: string,
  menuId: string,
  body: {
    scheduledPublishAt?: string | null;
    scheduledUnpublishAt?: string | null;
    scheduledRetireAt?: string | null;
    availabilityWindows?: MenuAvailabilityWindows;
  }
) {
  return apiFetch<{
    ok: boolean;
    menu?: MenuSurfaceRow & {
      scheduledPublishAt?: string | null;
      scheduledRetireAt?: string | null;
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

export type MigrationGuideStep = {
  key: string;
  title: string;
  summary: string;
  detail: string;
};

export type ImportExportCatalog = {
  sections: Array<{ id: string; label: string; description: string }>;
  targets: Array<{
    key: string;
    label: string;
    description: string;
    availability: "available" | "planned";
    directions: Array<"import" | "export">;
    formats: string[];
    permissionEntity: string;
  }>;
  sources: Array<{ key: string; label: string; availability: "available" | "planned" }>;
  formats: Array<{
    key: string;
    label: string;
    availability: "available" | "planned";
    extensions: string[];
  }>;
  migrationProviders: Array<{
    key: string;
    label: string;
    availability: "available" | "planned";
    description?: string;
  }>;
  migrationSteps?: MigrationGuideStep[];
  uploadOrigins: Array<{ key: string; label: string; availability: "available" | "planned" }>;
  conflictStrategies: Array<{ key: string; label: string; availability: "available" | "planned" }>;
  limits: { maxCsvBytes: number; maxCsvRows: number };
};

export type DataTransferMigrationRequestRow = {
  id: string;
  restaurantId: string;
  providerKey: string;
  providerLabel: string | null;
  note: string | null;
  status: string;
  requestedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function createDataTransferMigrationRequest(
  token: string,
  restaurantId: string,
  body: { providerKey: string; note?: string | null }
) {
  return apiFetch<{
    ok: boolean;
    request?: DataTransferMigrationRequestRow;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/import-export/migration-requests`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
}

export type DataTransferJobRow = {
  id: string;
  restaurantId: string;
  direction: "IMPORT" | "EXPORT";
  status: string;
  targetKey: string;
  sourceFormat: string | null;
  fileName: string | null;
  fileHash: string | null;
  fileSizeBytes: number | null;
  rowCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  dryRun: boolean;
  summary: unknown;
  error: string | null;
  startedByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  undoExpiresAt: string | null;
  undoAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuCsvPreview = {
  rowCount: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  issues: Array<{ line: number; code: string; message: string; severity: "error" | "warning" }>;
  sample: Array<{
    category: string;
    item: string;
    priceCents: number;
    modifierGroup: string;
    modifierOption: string;
  }>;
};

export async function getImportExportCatalog(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; catalog?: ImportExportCatalog; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/catalog`,
    { headers: authHeaders(token) }
  );
}

export async function listDataTransferJobs(
  token: string,
  restaurantId: string,
  opts?: { direction?: "IMPORT" | "EXPORT"; limit?: number }
) {
  const qs = new URLSearchParams();
  if (opts?.direction) qs.set("direction", opts.direction);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<{ ok: boolean; jobs?: DataTransferJobRow[]; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/jobs${suffix}`,
    { headers: authHeaders(token) }
  );
}

export type DataTransferActivityRange = "7d" | "30d" | "90d";

export type DataTransferActivityPoint = {
  date: string;
  imports: number;
  exports: number;
};

export type DataTransferActivitySeries = {
  range: DataTransferActivityRange;
  days: number;
  from: string;
  to: string;
  points: DataTransferActivityPoint[];
  totals: { imports: number; exports: number; operations: number };
};

export async function getDataTransferActivity(
  token: string,
  restaurantId: string,
  range: DataTransferActivityRange = "90d"
) {
  const qs = new URLSearchParams({ range });
  return apiFetch<{
    ok: boolean;
    activity?: DataTransferActivitySeries;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/import-export/activity?${qs}`, {
    headers: authHeaders(token)
  });
}

export type DataTransferTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type DataTransferTemplateRow = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  targetKey: string;
  targetLabel: string;
  format: string;
  version: number;
  status: DataTransferTemplateStatus;
  content: string;
  systemKey: string | null;
  isSystem: boolean;
  rowEstimate: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listDataTransferTemplates(
  token: string,
  restaurantId: string,
  opts?: { includeArchived?: boolean }
) {
  const qs = new URLSearchParams();
  if (opts?.includeArchived) qs.set("includeArchived", "1");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<{
    ok: boolean;
    templates?: DataTransferTemplateRow[];
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates${suffix}`, {
    headers: authHeaders(token)
  });
}

export async function getDataTransferTemplate(token: string, restaurantId: string, templateId: string) {
  return apiFetch<{
    ok: boolean;
    template?: DataTransferTemplateRow;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates/${encodeURIComponent(templateId)}`,
    { headers: authHeaders(token) }
  );
}

export async function createDataTransferTemplate(
  token: string,
  restaurantId: string,
  body: {
    name: string;
    description?: string | null;
    targetKey: string;
    format?: string;
    content: string;
    status?: DataTransferTemplateStatus;
  }
) {
  return apiFetch<{
    ok: boolean;
    template?: DataTransferTemplateRow;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates`, {
    method: "POST",
    headers: authJsonHeaders(token),
    body: JSON.stringify(body)
  });
}

export async function updateDataTransferTemplate(
  token: string,
  restaurantId: string,
  templateId: string,
  body: {
    name?: string;
    description?: string | null;
    targetKey?: string;
    format?: string;
    content?: string;
    status?: DataTransferTemplateStatus;
  }
) {
  return apiFetch<{
    ok: boolean;
    template?: DataTransferTemplateRow;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PATCH",
      headers: authJsonHeaders(token),
      body: JSON.stringify(body)
    }
  );
}

export async function duplicateDataTransferTemplate(
  token: string,
  restaurantId: string,
  templateId: string
) {
  return apiFetch<{
    ok: boolean;
    template?: DataTransferTemplateRow;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates/${encodeURIComponent(templateId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function deleteDataTransferTemplate(
  token: string,
  restaurantId: string,
  templateId: string
) {
  return apiFetch<{ ok: boolean; id?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

export async function downloadDataTransferTemplate(
  token: string,
  restaurantId: string,
  templateId: string
) {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${encodeURIComponent(restaurantId)}/import-export/templates/${encodeURIComponent(templateId)}/download`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    let message = "Download failed";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false as const, error: "download_failed", message };
  }
  const csv = await res.text();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return { ok: true as const, csv, fileName: match?.[1] ?? "template.csv" };
}

export async function getDataTransferJob(token: string, restaurantId: string, jobId: string) {
  return apiFetch<{ ok: boolean; job?: DataTransferJobRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(token) }
  );
}

export async function cancelDataTransferJob(token: string, restaurantId: string, jobId: string) {
  return apiFetch<{ ok: boolean; job?: DataTransferJobRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function deleteDataTransferJob(token: string, restaurantId: string, jobId: string) {
  return apiFetch<{ ok: boolean; id?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/jobs/${encodeURIComponent(jobId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

export async function exportDataTransferTarget(
  token: string,
  restaurantId: string,
  targetKey: string,
  format = "csv"
) {
  const res = await fetch(
    `${getApiBaseUrl()}/restaurants/${encodeURIComponent(restaurantId)}/import-export/exports/${encodeURIComponent(targetKey)}?format=${encodeURIComponent(format)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    let message = "Export failed";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false as const, error: "export_failed", message };
  }
  const csv = await res.text();
  const jobId = res.headers.get("X-ServeOS-Transfer-Job-Id");
  return { ok: true as const, csv, jobId };
}

export async function previewDataTransferImport(
  token: string,
  restaurantId: string,
  targetKey: string,
  body: { csv: string; sourceFormat?: string; fileName?: string }
) {
  return apiFetch<{
    ok: boolean;
    dryRun?: boolean;
    jobId?: string;
    preview?: MenuCsvPreview;
    fileHash?: string;
    fileSizeBytes?: number;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/imports/${encodeURIComponent(targetKey)}/preview`,
    {
      method: "POST",
      headers: authJsonHeaders(token),
      body: JSON.stringify(body)
    }
  );
}

export async function runDataTransferImport(
  token: string,
  restaurantId: string,
  targetKey: string,
  body: {
    csv: string;
    sourceFormat?: string;
    fileName?: string;
    dryRun?: boolean;
    conflictStrategy?: "skip" | "replace" | "update" | "duplicate" | "ask";
  }
) {
  return apiFetch<{
    ok: boolean;
    dryRun?: boolean;
    jobId?: string;
    preview?: MenuCsvPreview;
    imported?: {
      categoriesCreated: number;
      itemsCreated: number;
      modifiersCreated: number;
      rows: number;
      skippedExisting?: number;
    } | null;
    summary?: {
      rows: number;
      imported?: number;
      valid?: number;
      updated?: number;
      skipped?: number;
      failed?: number;
      warnings?: number;
      errors?: number;
    };
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/import-export/imports/${encodeURIComponent(targetKey)}`,
    {
      method: "POST",
      headers: authJsonHeaders(token),
      body: JSON.stringify(body)
    }
  );
}

/** @deprecated Prefer exportDataTransferTarget — kept for compatibility. */
export async function exportMenuCsv(token: string, restaurantId: string) {
  return exportDataTransferTarget(token, restaurantId, "menu", "csv");
}

/** @deprecated Prefer runDataTransferImport — kept for compatibility. */
export async function importMenuCsv(token: string, restaurantId: string, csv: string) {
  return runDataTransferImport(token, restaurantId, "menu", { csv, sourceFormat: "csv" });
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
  allowOrdering?: boolean;
  qrCodeId?: string | null;
  menuId?: string | null;
};

export type QrCodeType = "TABLE" | "MENU" | "TAKEAWAY" | "STAFF" | "MARKETING" | "FEEDBACK";
export type QrCodeStatus = "ACTIVE" | "INACTIVE" | "ROTATED" | "ARCHIVED";
export type QrExperience = "ORDERING" | "MENU_BROWSE" | "FEEDBACK" | "PROMOTION" | "RESERVATION";
export type QrPaymentMode = "PAY_AT_VENUE" | "PREPAY" | "HYBRID";

export type QrCodeRow = {
  id: string;
  restaurantId: string;
  publicCode: string;
  name: string;
  type: QrCodeType;
  status: QrCodeStatus;
  experience: QrExperience;
  locationLabel: string | null;
  areaLabel: string | null;
  tableLabel: string | null;
  tableId: string | null;
  seatCount: number | null;
  paymentMode: QrPaymentMode;
  menuId: string | null;
  menuName: string | null;
  allowOrdering: boolean;
  orderingPaused: boolean;
  sessionTtlHours: number | null;
  description: string | null;
  headline: string | null;
  showRestaurantLogo: boolean;
  showServeosBranding: boolean;
  createdByUserId: string | null;
  scanCount: number;
  orderCount: number;
  lastUsedAt: string | null;
  deactivatedAt?: string | null;
  archivedAt: string | null;
  publicUrl: string;
  qrImageUrl: string;
  pngDownloadUrl: string;
  svgDownloadUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type QrDashboardStats = {
  activeCount: number;
  tableCount: number;
  scansToday: number;
  ordersToday: number;
  revenueTodayCents: number;
  totalScans: number;
  totalOrders: number;
};

export type CreateQrCodeBody = {
  name: string;
  type: QrCodeType;
  experience?: QrExperience;
  locationLabel?: string | null;
  areaLabel?: string | null;
  tableLabel?: string | null;
  tableId?: string | null;
  seatCount?: number | null;
  paymentMode?: QrPaymentMode;
  menuId?: string | null;
  allowOrdering?: boolean;
  orderingPaused?: boolean;
  sessionTtlHours?: number | null;
  description?: string | null;
  headline?: string | null;
  showRestaurantLogo?: boolean;
  showServeosBranding?: boolean;
};

export type QrManageActionDescriptor = {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
};

export type QrManageContextPayload = {
  targets: QrCodeRow[];
  actions: QrManageActionDescriptor[];
};

export type QrAnalyticsSummary = {
  scans: number;
  orders: number;
  revenueCents: number;
  conversionRate: number;
  lastOrderAt: string | null;
};

export async function listQrCodes(
  token: string,
  restaurantId: string,
  query?: { status?: QrCodeStatus; type?: QrCodeType; q?: string }
) {
  const sp = new URLSearchParams();
  if (query?.status) sp.set("status", query.status);
  if (query?.type) sp.set("type", query.type);
  if (query?.q) sp.set("q", query.q);
  const qs = sp.toString();
  return apiFetch<{ ok: boolean; items?: QrCodeRow[]; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function getQrCodeStats(token: string, restaurantId: string) {
  return apiFetch<{ ok: boolean; stats?: QrDashboardStats; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/stats`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createQrCode(token: string, restaurantId: string, body: CreateQrCodeBody) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function updateQrCode(
  token: string,
  restaurantId: string,
  qrCodeId: string,
  body: Partial<CreateQrCodeBody>
) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}`,
    { method: "PATCH", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function deactivateQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/deactivate`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function reactivateQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/reactivate`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function rotateQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; previousId?: string; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/rotate`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function duplicateQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/duplicate`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function getQrManageContext(
  token: string,
  restaurantId: string,
  qrIds?: string[]
) {
  const qs = qrIds?.length ? `?qrIds=${qrIds.map(encodeURIComponent).join(",")}` : "";
  return apiFetch<{
    ok: boolean;
    context?: QrManageContextPayload;
    error?: string;
    message?: string;
  }>(`/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/manage-context${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getQrAnalytics(
  token: string,
  restaurantId: string,
  qrCodeId: string
) {
  return apiFetch<{
    ok: boolean;
    summary?: QrAnalyticsSummary;
    error?: string;
    message?: string;
  }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/analytics`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function archiveQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/archive`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function restoreQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/restore`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function deleteQrCode(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}`,
    { method: "DELETE", headers: authHeaders(token) }
  );
}

export async function pauseQrOrdering(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/pause-ordering`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function resumeQrOrdering(token: string, restaurantId: string, qrCodeId: string) {
  return apiFetch<{ ok: boolean; qr?: QrCodeRow; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/${encodeURIComponent(qrCodeId)}/resume-ordering`,
    { method: "POST", headers: authJsonHeaders(token), body: "{}" }
  );
}

export async function bulkUpdateQrCodes(
  token: string,
  restaurantId: string,
  body: {
    qrIds: string[];
    patch: Partial<{
      status: "ACTIVE" | "INACTIVE";
      orderingPaused: boolean;
      menuId: string | null;
      paymentMode: QrPaymentMode;
      locationLabel: string | null;
      areaLabel: string | null;
    }>;
  }
) {
  return apiFetch<{ ok: boolean; items?: QrCodeRow[]; error?: string; message?: string }>(
    `/restaurants/${encodeURIComponent(restaurantId)}/qr-codes/bulk`,
    { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }
  );
}

export async function resolvePublicQr(publicCode: string) {
  return apiFetch<{
    ok: boolean;
    sessionId?: string;
    menuUrl?: string;
    restaurantId?: string;
    qr?: { name: string; tableLabel: string | null; headline: string | null; allowOrdering: boolean };
    error?: string;
    message?: string;
  }>(`/public/qr/${encodeURIComponent(publicCode)}/resolve`, { method: "POST" });
}

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
