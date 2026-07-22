import type { MenuSurfaceRow } from "../../../api";
import { filterUserCreatedWindows } from "./availabilityHelpers";
import type { CategoryListRow } from "./categoryListHelpers";
import type { ItemListRow } from "./itemListHelpers";
import type { ModifierGroupListRow } from "./modifierGroupListHelpers";
import type { ModifierOptionListRow } from "./modifierOptionListHelpers";
import type { AvailabilityCardPayload } from "../../../api";

export function menuHealthWarnings(menu: MenuSurfaceRow): string[] {
  const warnings: string[] = [];
  if (menu.categoryCount === 0) warnings.push("No categories yet");
  if (menu.itemCount === 0) warnings.push("No items yet");
  if (!menu.coverMediaKey) warnings.push("Missing menu cover image");
  const windows = Object.keys(filterUserCreatedWindows(menu.availabilityWindows)).length;
  if (windows === 0 && menu.status === "PUBLISHED") {
    warnings.push("No availability schedule configured");
  }
  if (menu.hasUnpublishedChanges) {
    warnings.push(`${menu.draftChangeCount ?? 0} draft change(s) waiting to publish`);
  }
  return warnings;
}

export function categoryHealthWarnings(category: CategoryListRow): string[] {
  const warnings: string[] = [];
  if (category.itemCount === 0) warnings.push("Empty category — no items");
  if (!category.isActive) warnings.push("Hidden from guests");
  if (!category.menuId) warnings.push("Not attached to a menu");
  if (category.menuStatus === "DRAFT") warnings.push("Parent menu is still a draft");
  if (category.menuStatus === "ARCHIVED" || category.menuStatus === "RETIRED") {
    warnings.push("Parent menu is not live");
  }
  if (!category.description?.trim()) warnings.push("No description");
  return warnings;
}

export function itemHealthWarnings(item: ItemListRow): string[] {
  const warnings: string[] = [];
  if (!item.isActive) warnings.push("Hidden from guests");
  if (item.isSoldOut) warnings.push("Marked unavailable / sold out");
  if (item.lifecycle === "DRAFT") warnings.push("Still in draft lifecycle");
  if (item.lifecycle === "ARCHIVED") warnings.push("Archived");
  if (!item.description?.trim()) warnings.push("No guest description");
  if (item.modifierCount === 0) warnings.push("No modifier groups attached");
  if (item.menuStatus !== "PUBLISHED") warnings.push("Parent menu is not live");
  return warnings;
}

export function modifierGroupHealthWarnings(group: ModifierGroupListRow): string[] {
  const warnings: string[] = [];
  if (group.lifecycle === "ARCHIVED") warnings.push("Archived");
  if (group.optionCount === 0) warnings.push("No options in this group");
  if (group.minSelect > group.maxSelect) warnings.push("Invalid selection rules (min > max)");
  if (group.minSelect > group.optionCount) warnings.push("Min select exceeds option count");
  if (!group.itemId) warnings.push("Not attached to an item");
  return warnings;
}

export function modifierOptionHealthWarnings(option: ModifierOptionListRow): string[] {
  const warnings: string[] = [];
  if (!option.isActive) warnings.push("Unavailable to guests");
  if (option.lifecycle === "ARCHIVED") warnings.push("Archived");
  if (!option.groupId) warnings.push("Missing parent group");
  return warnings;
}

export function availabilityHealthWarnings(card: AvailabilityCardPayload): string[] {
  const warnings: string[] = [];
  const days = card.window.days?.length ?? 0;
  if (days === 0) warnings.push("No days selected");
  if (!card.window.start || !card.window.end) warnings.push("Incomplete time window");
  if (!card.window.enabled) warnings.push("Schedule is disabled");
  if (card.window.outOfStock) warnings.push("Marked out of stock");
  if (card.window.paused) warnings.push("Schedule is paused");
  if (
    card.evaluation.status === "UNAVAILABLE" ||
    card.evaluation.status === "OUT_OF_STOCK" ||
    card.evaluation.status === "HIDDEN" ||
    card.evaluation.status === "EXPIRED" ||
    card.evaluation.status === "PAUSED"
  ) {
    warnings.push(`Currently ${card.evaluation.status.toLowerCase().replaceAll("_", " ")}`);
  }
  if (card.menuStatus !== "PUBLISHED") warnings.push("Parent menu is not live");
  return warnings;
}
