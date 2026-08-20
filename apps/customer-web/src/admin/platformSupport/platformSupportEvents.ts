export const PLATFORM_SUPPORT_OPEN_EVENT = "serveos:platform-support-open";

export type PlatformSupportOpenDetail = {
  source: "FAB" | "PLATFORM_HELP";
};

export function dispatchOpenPlatformSupport(source: PlatformSupportOpenDetail["source"]) {
  window.dispatchEvent(
    new CustomEvent<PlatformSupportOpenDetail>(PLATFORM_SUPPORT_OPEN_EVENT, { detail: { source } })
  );
}
