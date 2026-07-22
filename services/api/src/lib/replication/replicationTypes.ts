import type { Prisma } from "@prisma/client";

export type ReplicationProgressCounts = {
  categories?: { done: number; total: number };
  items?: { done: number; total: number };
  modifiers?: { done: number; total: number };
  media?: { done: number; total: number };
};

export type DuplicateMenuJobPayload = {
  menuId: string;
  name?: string;
  copyCategories?: boolean;
  copyAvailability?: boolean;
  copyMedia?: boolean;
};

export type DuplicateToLocationJobPayload = DuplicateMenuJobPayload & {
  targetRestaurantId: string;
};

export type ApplyTemplateJobPayload = {
  templateId: string;
  name?: string;
  targetRestaurantId: string;
};

export type DuplicateMediaUsageJobPayload = {
  assetId: string;
  targetType: "MENU_COVER" | "MENU_ITEM" | "CATEGORY" | "VENUE_LOGO" | "VENUE_COVER";
  targetId: string;
  role?: "PRIMARY" | "GALLERY" | "COVER";
  sortOrder?: number;
};

export type ReplicationJobPayload =
  | DuplicateMenuJobPayload
  | DuplicateToLocationJobPayload
  | ApplyTemplateJobPayload
  | DuplicateMediaUsageJobPayload
  | Record<string, unknown>;

export type MenuTemplateSnapshot = {
  version: 1;
  menu: {
    name: string;
    description: string | null;
    surfaceKey: string | null;
    coverMediaKey: string | null;
    availabilityWindows: unknown;
  };
  categories: Array<{
    name: string;
    description: string | null;
    sortOrder: number;
    items: Array<{
      name: string;
      description: string | null;
      ingredients: string | null;
      specialNotes: string | null;
      priceCents: number;
      imageKey: string | null;
      sortOrder: number;
      media: Array<{
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256Hex: string | null;
        originalName: string | null;
        scope: "MENU_IMAGE" | "VIDEO";
        sortOrder: number;
        durationMs: number | null;
      }>;
      modifierGroups: Array<{
        name: string;
        minSelect: number;
        maxSelect: number;
        sortOrder: number;
        options: Array<{
          name: string;
          priceDeltaCents: number;
          sortOrder: number;
          isActive: boolean;
        }>;
      }>;
    }>;
  }>;
};

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
