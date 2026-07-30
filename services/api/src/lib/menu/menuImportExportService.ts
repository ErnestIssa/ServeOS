import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { fetchMenuTree } from "../menu.js";
import { IMPORT_EXPORT_LIMITS } from "../importExport/importExportCatalog.js";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

type MenuTreeCategory = Awaited<ReturnType<typeof fetchMenuTree>>[number];

export async function exportMenuCsv(prisma: PrismaClient, restaurantId: string): Promise<string> {
  const categories = (await fetchMenuTree(prisma, restaurantId, {
    onlyActive: false
  })) as MenuTreeCategory[];
  const lines = [
    "category,item,description,price_cents,sort_order,active,modifier_group,modifier_option,option_price_delta_cents"
  ];

  for (const cat of categories) {
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
  lineNumber: number;
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

export type MenuCsvIssue = {
  line: number;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type MenuCsvPreview = {
  rowCount: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  issues: MenuCsvIssue[];
  sample: Array<{
    category: string;
    item: string;
    priceCents: number;
    modifierGroup: string;
    modifierOption: string;
  }>;
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

function looksLikeCsvInjection(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value.trim());
}

function parseMenuCsv(csvText: string):
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; issues: MenuCsvIssue[] } {
  if (Buffer.byteLength(csvText, "utf8") > IMPORT_EXPORT_LIMITS.maxCsvBytes) {
    return { ok: false, error: "csv_too_large" };
  }

  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, error: "csv_empty" };

  const dataLineCount = lines.length - 1;
  if (dataLineCount > IMPORT_EXPORT_LIMITS.maxCsvRows) {
    return { ok: false, error: "csv_too_many_rows" };
  }

  const header = parseCsvLine(lines[0]!.toLowerCase()).map((h) => h.trim());
  if (!header.includes("category") || !header.includes("item")) {
    return { ok: false, error: "csv_invalid_header" };
  }

  const idx = (name: string) => header.indexOf(name);
  const rows: ImportRow[] = [];
  const issues: MenuCsvIssue[] = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const cols = parseCsvLine(lines[i]!);
    const category = cols[idx("category")]?.trim() ?? "";
    const item = cols[idx("item")]?.trim() ?? "";
    if (!category) {
      issues.push({
        line: lineNumber,
        code: "missing_category",
        message: "Missing category.",
        severity: "error"
      });
      continue;
    }

    for (const [field, value] of [
      ["category", category],
      ["item", item],
      ["description", cols[idx("description")]?.trim() ?? ""],
      ["modifier_group", cols[idx("modifier_group")]?.trim() ?? ""],
      ["modifier_option", cols[idx("modifier_option")]?.trim() ?? ""]
    ] as const) {
      if (value && looksLikeCsvInjection(value)) {
        issues.push({
          line: lineNumber,
          code: "csv_injection",
          message: `Suspicious value in ${field}.`,
          severity: "error"
        });
      }
    }

    const priceRaw = cols[idx("price_cents")]?.trim() ?? "0";
    const priceNum = Number(priceRaw);
    if (priceRaw && Number.isNaN(priceNum)) {
      issues.push({
        line: lineNumber,
        code: "invalid_price",
        message: "Price must be a number (cents).",
        severity: "error"
      });
    } else if (priceNum < 0) {
      issues.push({
        line: lineNumber,
        code: "negative_price",
        message: "Negative price is not allowed.",
        severity: "error"
      });
    }

    const deltaRaw = cols[idx("option_price_delta_cents")]?.trim() || "0";
    const deltaNum = Number(deltaRaw);
    if (deltaRaw && Number.isNaN(deltaNum)) {
      issues.push({
        line: lineNumber,
        code: "invalid_option_delta",
        message: "Option price delta must be a number.",
        severity: "error"
      });
    }

    const modifierGroup = cols[idx("modifier_group")]?.trim() ?? "";
    const modifierOption = cols[idx("modifier_option")]?.trim() ?? "";
    if (modifierOption && !modifierGroup) {
      issues.push({
        line: lineNumber,
        code: "invalid_modifier",
        message: "Modifier option requires a modifier group.",
        severity: "error"
      });
    }
    if (modifierGroup && !item) {
      issues.push({
        line: lineNumber,
        code: "modifier_without_item",
        message: "Modifiers require an item name.",
        severity: "warning"
      });
    }

    const lineHasError = issues.some((issue) => issue.line === lineNumber && issue.severity === "error");
    if (lineHasError) continue;

    rows.push({
      lineNumber,
      category,
      item,
      description: cols[idx("description")]?.trim() ?? "",
      priceCents: Math.max(0, Math.round(priceNum || 0)),
      sortOrder: Number(cols[idx("sort_order")]?.trim() || "0") || 0,
      active: (cols[idx("active")]?.trim().toLowerCase() ?? "yes") !== "no",
      modifierGroup,
      modifierOption,
      optionDeltaCents: Math.round(deltaNum || 0)
    });
  }

  if (rows.length === 0 && issues.every((i) => i.severity === "error")) {
    return { ok: false, error: "csv_no_rows" };
  }

  return { ok: true, rows, issues };
}

function buildPreview(rows: ImportRow[], issues: MenuCsvIssue[]): MenuCsvPreview {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  return {
    rowCount: rows.length + errorCount,
    validRows: rows.length,
    warningCount,
    errorCount,
    issues: issues.slice(0, 50),
    sample: rows.slice(0, 8).map((r) => ({
      category: r.category,
      item: r.item,
      priceCents: r.priceCents,
      modifierGroup: r.modifierGroup,
      modifierOption: r.modifierOption
    }))
  };
}

export function hashCsvPayload(csvText: string): string {
  return createHash("sha256").update(csvText).digest("hex");
}

export async function previewMenuCsv(csvText: string) {
  const parsed = parseMenuCsv(csvText);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  return {
    ok: true as const,
    dryRun: true as const,
    preview: buildPreview(parsed.rows, parsed.issues),
    fileHash: hashCsvPayload(csvText),
    fileSizeBytes: Buffer.byteLength(csvText, "utf8")
  };
}

export async function importMenuCsv(
  prisma: PrismaClient,
  restaurantId: string,
  csvText: string,
  opts?: { dryRun?: boolean }
) {
  const parsed = parseMenuCsv(csvText);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const preview = buildPreview(parsed.rows, parsed.issues);
  if (preview.errorCount > 0 && parsed.rows.length === 0) {
    return { ok: false as const, error: "csv_no_rows", preview };
  }

  if (opts?.dryRun) {
    return {
      ok: true as const,
      dryRun: true as const,
      preview,
      imported: null,
      fileHash: hashCsvPayload(csvText),
      fileSizeBytes: Buffer.byteLength(csvText, "utf8")
    };
  }

  let categoriesCreated = 0;
  let itemsCreated = 0;
  let modifiersCreated = 0;
  let skippedExisting = 0;

  await prisma.$transaction(async (tx) => {
    const catCache = new Map<string, string>();
    const itemCache = new Map<string, string>();
    const groupCache = new Map<string, string>();

    for (const row of parsed.rows) {
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
          skippedExisting++;
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
        where: { modifierGroupId: groupId, name: { equals: row.modifierOption, mode: "insensitive" } }
      });
      if (!existingOpt) {
        await tx.modifierOption.create({
          data: {
            modifierGroupId: groupId,
            name: row.modifierOption,
            priceDeltaCents: row.optionDeltaCents,
            sortOrder: 0,
            isActive: true
          }
        });
        modifiersCreated++;
      } else {
        skippedExisting++;
      }
    }
  });

  return {
    ok: true as const,
    dryRun: false as const,
    preview,
    imported: {
      categoriesCreated,
      itemsCreated,
      modifiersCreated,
      rows: parsed.rows.length,
      skippedExisting
    },
    fileHash: hashCsvPayload(csvText),
    fileSizeBytes: Buffer.byteLength(csvText, "utf8")
  };
}

export function mapImportExportError(code: string): string {
  switch (code) {
    case "csv_empty":
      return "CSV file is empty.";
    case "csv_invalid_header":
      return "CSV must include category and item columns.";
    case "csv_no_rows":
      return "No importable rows found.";
    case "csv_too_large":
      return "CSV exceeds the maximum upload size.";
    case "csv_too_many_rows":
      return "CSV exceeds the maximum row limit.";
    case "target_unavailable":
      return "That import/export target is not available yet.";
    case "format_unavailable":
      return "That format is not available yet.";
    default:
      return "Import/export failed.";
  }
}
