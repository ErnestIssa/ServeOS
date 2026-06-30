import type { PrismaClient } from "@prisma/client";
import { fetchMenuTree } from "../menu.js";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportMenuCsv(prisma: PrismaClient, restaurantId: string): Promise<string> {
  const tree = await fetchMenuTree(prisma, restaurantId);
  const lines = ["category,item,description,price_cents,sort_order,active,modifier_group,modifier_option,option_price_delta_cents"];

  for (const cat of tree.categories) {
    if (cat.items.length === 0) {
      lines.push(
        [escapeCsv(cat.name), "", "", "", String(cat.sortOrder), cat.isActive ? "yes" : "no", "", "", ""].join(",")
      );
      continue;
    }
    for (const item of cat.items) {
      if (item.modifierGroups.length === 0) {
        lines.push(
          [
            escapeCsv(cat.name),
            escapeCsv(item.name),
            escapeCsv(item.description ?? ""),
            String(item.priceCents),
            String(item.sortOrder),
            item.isActive ? "yes" : "no",
            "",
            "",
            ""
          ].join(",")
        );
        continue;
      }
      for (const group of item.modifierGroups) {
        if (group.options.length === 0) {
          lines.push(
            [
              escapeCsv(cat.name),
              escapeCsv(item.name),
              escapeCsv(item.description ?? ""),
              String(item.priceCents),
              String(item.sortOrder),
              item.isActive ? "yes" : "no",
              escapeCsv(group.name),
              "",
              ""
            ].join(",")
          );
          continue;
        }
        for (const opt of group.options) {
          lines.push(
            [
              escapeCsv(cat.name),
              escapeCsv(item.name),
              escapeCsv(item.description ?? ""),
              String(item.priceCents),
              String(item.sortOrder),
              item.isActive ? "yes" : "no",
              escapeCsv(group.name),
              escapeCsv(opt.name),
              String(opt.priceDeltaCents)
            ].join(",")
          );
        }
      }
    }
  }

  return `\uFEFF${lines.join("\n")}`;
}

type ImportRow = {
  category: string;
  item: string;
  description: string;
  priceCents: number;
  sortOrder: number;
  active: boolean;
  modifierGroup: string;
  modifierOption: string;
  optionDeltaCents: number;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function importMenuCsv(prisma: PrismaClient, restaurantId: string, csvText: string) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { ok: false as const, error: "csv_empty" };

  const header = parseCsvLine(lines[0]!.toLowerCase());
  if (!header.includes("category") || !header.includes("item")) {
    return { ok: false as const, error: "csv_invalid_header" };
  }

  const idx = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const category = cols[idx("category")]?.trim() ?? "";
    const item = cols[idx("item")]?.trim() ?? "";
    if (!category) continue;
    const priceRaw = cols[idx("price_cents")]?.trim() ?? "0";
    const priceCents = Math.max(0, Math.round(Number(priceRaw) || 0));
    rows.push({
      category,
      item,
      description: cols[idx("description")]?.trim() ?? "",
      priceCents,
      sortOrder: Number(cols[idx("sort_order")]?.trim() || "0") || 0,
      active: (cols[idx("active")]?.trim().toLowerCase() ?? "yes") !== "no",
      modifierGroup: cols[idx("modifier_group")]?.trim() ?? "",
      modifierOption: cols[idx("modifier_option")]?.trim() ?? "",
      optionDeltaCents: Math.round(Number(cols[idx("option_price_delta_cents")]?.trim() || "0") || 0)
    });
  }

  if (rows.length === 0) return { ok: false as const, error: "csv_no_rows" };

  let categoriesCreated = 0;
  let itemsCreated = 0;
  let modifiersCreated = 0;

  await prisma.$transaction(async (tx) => {
    const catCache = new Map<string, string>();
    const itemCache = new Map<string, string>();
    const groupCache = new Map<string, string>();

    for (const row of rows) {
      let categoryId = catCache.get(row.category);
      if (!categoryId) {
        const existing = await tx.menuCategory.findFirst({
          where: { restaurantId, name: { equals: row.category, mode: "insensitive" } }
        });
        if (existing) {
          categoryId = existing.id;
        } else {
          const created = await tx.menuCategory.create({
            data: { restaurantId, name: row.category, sortOrder: row.sortOrder, isActive: true }
          });
          categoryId = created.id;
          categoriesCreated++;
        }
        catCache.set(row.category, categoryId);
      }

      if (!row.item) continue;

      const itemKey = `${row.category}::${row.item}`;
      let itemId = itemCache.get(itemKey);
      if (!itemId) {
        const existingItem = await tx.menuItem.findFirst({
          where: { categoryId, name: { equals: row.item, mode: "insensitive" } }
        });
        if (existingItem) {
          itemId = existingItem.id;
        } else {
          const created = await tx.menuItem.create({
            data: {
              categoryId,
              name: row.item,
              description: row.description || null,
              priceCents: row.priceCents,
              sortOrder: row.sortOrder,
              isActive: row.active
            }
          });
          itemId = created.id;
          itemsCreated++;
        }
        itemCache.set(itemKey, itemId);
      }

      if (!row.modifierGroup || !row.modifierOption) continue;

      const groupKey = `${itemKey}::${row.modifierGroup}`;
      let groupId = groupCache.get(groupKey);
      if (!groupId) {
        const existingGroup = await tx.modifierGroup.findFirst({
          where: { menuItemId: itemId, name: { equals: row.modifierGroup, mode: "insensitive" } }
        });
        if (existingGroup) {
          groupId = existingGroup.id;
        } else {
          const created = await tx.modifierGroup.create({
            data: { menuItemId: itemId, name: row.modifierGroup, minSelect: 0, maxSelect: 1, sortOrder: 0 }
          });
          groupId = created.id;
          modifiersCreated++;
        }
        groupCache.set(groupKey, groupId);
      }

      const existingOpt = await tx.modifierOption.findFirst({
        where: { groupId, name: { equals: row.modifierOption, mode: "insensitive" } }
      });
      if (!existingOpt) {
        await tx.modifierOption.create({
          data: {
            groupId,
            name: row.modifierOption,
            priceDeltaCents: row.optionDeltaCents,
            sortOrder: 0,
            isActive: true
          }
        });
        modifiersCreated++;
      }
    }
  });

  return { ok: true as const, imported: { categoriesCreated, itemsCreated, modifiersCreated, rows: rows.length } };
}

export function mapImportExportError(code: string): string {
  switch (code) {
    case "csv_empty":
      return "CSV file is empty.";
    case "csv_invalid_header":
      return "CSV must include category and item columns.";
    case "csv_no_rows":
      return "No importable rows found.";
    default:
      return "Import/export failed.";
  }
}
