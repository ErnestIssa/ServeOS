import type {
  CanonicalOrderSource,
  CompositionalSourceAttribution,
  SourceAttributionModifier,
  SourceAnalyticsAttribution
} from "./orderSourceTypes.js";

export type AnalyticsAttributionView = {
  primarySource: CanonicalOrderSource;
  creationSource: CanonicalOrderSource;
  modificationSources: SourceAttributionModifier[];
  channel: string;
  revenueBucket: string;
  revenueSplitPolicy: CompositionalSourceAttribution["revenueSplitPolicy"];
  hybridStaffModified: boolean;
};

export function buildInitialCompositionalAttribution(
  primarySource: CanonicalOrderSource,
  analytics: SourceAnalyticsAttribution
): CompositionalSourceAttribution {
  return {
    primarySource,
    modifiers: [],
    revenueSplitPolicy: analytics.conversionTrackable ? "primary_100" : "compositional_future"
  };
}

export function resolveAnalyticsAttributionView(
  primarySource: CanonicalOrderSource,
  analytics: SourceAnalyticsAttribution,
  compositional?: CompositionalSourceAttribution | null
): AnalyticsAttributionView {
  const comp =
    compositional ?? buildInitialCompositionalAttribution(primarySource, analytics);

  const hybridStaffModified = comp.modifiers.some(
    (m) => m.type === "HYBRID_STAFF_LINE_ADDITION" || m.type === "STAFF_ASSISTED"
  );

  return {
    primarySource: comp.primarySource,
    creationSource: primarySource,
    modificationSources: comp.modifiers,
    channel: analytics.channel,
    revenueBucket: analytics.revenueBucket,
    revenueSplitPolicy: comp.revenueSplitPolicy,
    hybridStaffModified
  };
}

export const COMPOSABLE_ANALYTICS_RULES = {
  creationLabel: "Order.source + primarySource — immutable",
  modifications: "compositionalAttribution.modifiers — append-only overlays",
  revenueSplit: "compositional_future reserved for order editing engine"
} as const;
