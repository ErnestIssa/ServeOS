/** Client-only insight preset labels for the picker UI — navigation targets are workspace routes. */
export const MENU_INSIGHT_PRESETS = [
  { id: "sales-overview", label: "Sales overview", description: "Revenue and order trends for this menu." },
  { id: "best-sellers", label: "Best selling items", description: "Top performers on this menu surface." },
  { id: "peak-times", label: "Peak times", description: "When guests order most from this menu." }
] as const;

export type MenuPanelVariant = "active" | "live" | "archived";
