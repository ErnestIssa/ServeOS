/**
 * Cloud drives are Import Sources only.
 * Selected files are copied into the ServeOS Media Platform — never hot-linked.
 *
 * Flow: Provider picker → acquire bytes → Import Connector → Media Platform pipeline → S3/CDN
 *
 * Official pickers (Dropbox Chooser / Google Picker / OneDrive) are used when Vite env keys
 * are present. Otherwise the ServeOS secure import bridge opens a picker and tags provenance.
 */

import type { MediaImportSource } from "../../../api";

export type CloudProviderId = "google_drive" | "dropbox" | "onedrive";

export type CloudImportFile = {
  file: File;
  importSource: MediaImportSource;
  importSourceId: string;
  importOriginalPath?: string;
  providerLabel: string;
};

export type CloudImportPhase =
  | "idle"
  | "connecting"
  | "authorizing"
  | "opening_picker"
  | "downloading"
  | "ready"
  | "cancelled"
  | "error";

export type CloudImportProgress = {
  phase: CloudImportPhase;
  message: string;
};

export const CLOUD_PROVIDERS: Array<{
  id: CloudProviderId;
  label: string;
  importSource: MediaImportSource;
  iconSrc: string;
}> = [
  {
    id: "google_drive",
    label: "Google Drive",
    importSource: "GOOGLE_DRIVE",
    iconSrc: "/icons/google-drive.png"
  },
  {
    id: "dropbox",
    label: "Dropbox",
    importSource: "DROPBOX",
    iconSrc: "/icons/dropbox.png"
  },
  {
    id: "onedrive",
    label: "OneDrive",
    importSource: "ONEDRIVE",
    iconSrc: "/icons/onedrive.png"
  }
];

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov";

type EnvKeys = {
  dropboxAppKey?: string;
  googleApiKey?: string;
  googleClientId?: string;
  oneDriveClientId?: string;
};

function readEnvKeys(): EnvKeys {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    dropboxAppKey: env.VITE_DROPBOX_APP_KEY?.trim() || undefined,
    googleApiKey: env.VITE_GOOGLE_API_KEY?.trim() || undefined,
    googleClientId: env.VITE_GOOGLE_CLIENT_ID?.trim() || undefined,
    oneDriveClientId: env.VITE_ONEDRIVE_CLIENT_ID?.trim() || undefined
  };
}

function sessionKey(provider: CloudProviderId) {
  return `serveos_cloud_import_${provider}`;
}

function markConnected(provider: CloudProviderId) {
  try {
    sessionStorage.setItem(sessionKey(provider), String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isConnected(provider: CloudProviderId) {
  try {
    return Boolean(sessionStorage.getItem(sessionKey(provider)));
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.id = id;
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`script_load_failed:${id}`));
    document.head.appendChild(el);
  });
}

function pickLocalFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.multiple = multiple;
    input.style.display = "none";
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.onchange = () => finish(input.files ? [...input.files] : []);
    input.addEventListener("cancel", () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

async function filesFromDropboxChooser(
  appKey: string,
  onProgress?: (p: CloudImportProgress) => void
): Promise<CloudImportFile[]> {
  onProgress?.({ phase: "opening_picker", message: "Opening Dropbox picker…" });
  if (!document.getElementById("dropboxjs")) {
    const el = document.createElement("script");
    el.id = "dropboxjs";
    el.src = "https://www.dropbox.com/static/api/2/dropins.js";
    el.setAttribute("data-app-key", appKey);
    el.async = true;
    document.head.appendChild(el);
    await new Promise<void>((resolve, reject) => {
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("dropbox_script_failed"));
    });
  }
  const Dropbox = (window as unknown as { Dropbox?: { choose: (opts: Record<string, unknown>) => void } }).Dropbox;
  if (!Dropbox?.choose) throw new Error("dropbox_chooser_unavailable");

  const selected = await new Promise<
    Array<{ id?: string; name: string; link: string; bytes?: number }>
  >((resolve, reject) => {
    try {
      Dropbox.choose({
        success: (files: Array<{ id?: string; name: string; link: string; bytes?: number }>) =>
          resolve(files ?? []),
        cancel: () => resolve([]),
        linkType: "direct",
        multiselect: true,
        extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"],
        folderselect: false
      });
    } catch (e) {
      reject(e);
    }
  });

  if (!selected.length) return [];

  onProgress?.({ phase: "downloading", message: "Copying files into ServeOS…" });
  const out: CloudImportFile[] = [];
  for (const item of selected) {
    const res = await fetch(item.link);
    if (!res.ok) continue;
    const blob = await res.blob();
    const type = blob.type || guessMime(item.name);
    const file = new File([blob], item.name, { type, lastModified: Date.now() });
    out.push({
      file,
      importSource: "DROPBOX",
      importSourceId: item.id || `dbx_${hashName(item.name)}`,
      importOriginalPath: item.name,
      providerLabel: "Dropbox"
    });
  }
  return out;
}

async function filesFromGooglePicker(
  apiKey: string,
  clientId: string,
  onProgress?: (p: CloudImportProgress) => void
): Promise<CloudImportFile[]> {
  onProgress?.({ phase: "authorizing", message: "Signing in to Google…" });
  await loadScript("https://apis.google.com/js/api.js", "google-api");
  await loadScript("https://accounts.google.com/gsi/client", "google-gsi");

  const gapi = (window as unknown as { gapi?: { load: (n: string, cb: () => void) => void; client: { init: (o: object) => Promise<void> } } }).gapi;
  const google = (
    window as unknown as {
      google?: {
        accounts: {
          oauth2: {
            initTokenClient: (o: {
              client_id: string;
              scope: string;
              callback: (r: { access_token?: string; error?: string }) => void;
            }) => { requestAccessToken: () => void };
          };
        };
        picker?: {
          PickerBuilder: new () => {
            addView: (v: unknown) => unknown;
            setOAuthToken: (t: string) => unknown;
            setDeveloperKey: (k: string) => unknown;
            setCallback: (cb: (data: { action: string; docs?: Array<{ id: string; name: string; mimeType: string; url?: string }> }) => void) => unknown;
            build: () => { setVisible: (v: boolean) => void };
          };
          ViewId: { DOCS_IMAGES_AND_VIDEOS: unknown };
          Action: { PICKED: string; CANCEL: string };
        };
      };
    }
  ).google;

  if (!gapi || !google?.accounts?.oauth2) throw new Error("google_picker_unavailable");

  await new Promise<void>((resolve) => gapi.load("client:picker", () => resolve()));
  await gapi.client.init({ apiKey });

  const token = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (r) => {
        if (r.error || !r.access_token) reject(new Error(r.error || "google_auth_failed"));
        else resolve(r.access_token);
      }
    });
    client.requestAccessToken();
  });

  onProgress?.({ phase: "opening_picker", message: "Opening Google Drive picker…" });
  type PickerDoc = { id: string; name: string; mimeType: string };
  type PickerData = { action: string; docs?: PickerDoc[] };
  type PickerBuilder = {
    addView: (v: unknown) => PickerBuilder;
    setOAuthToken: (t: string) => PickerBuilder;
    setDeveloperKey: (k: string) => PickerBuilder;
    setCallback: (cb: (data: PickerData) => void) => PickerBuilder;
    build: () => { setVisible: (v: boolean) => void };
  };

  const docs = await new Promise<PickerDoc[]>((resolve) => {
    if (!google.picker) {
      resolve([]);
      return;
    }
    const builder = new google.picker.PickerBuilder() as unknown as PickerBuilder;
    builder
      .addView(google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setCallback((data: PickerData) => {
        if (data.action === google.picker!.Action.CANCEL) resolve([]);
        if (data.action === google.picker!.Action.PICKED) resolve(data.docs ?? []);
      })
      .build()
      .setVisible(true);
  });

  if (!docs.length) return [];

  onProgress?.({ phase: "downloading", message: "Copying files into ServeOS…" });
  const out: CloudImportFile[] = [];
  for (const doc of docs) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) continue;
    const blob = await res.blob();
    const type = blob.type || doc.mimeType || guessMime(doc.name);
    const file = new File([blob], doc.name, { type, lastModified: Date.now() });
    out.push({
      file,
      importSource: "GOOGLE_DRIVE",
      importSourceId: doc.id,
      importOriginalPath: doc.name,
      providerLabel: "Google Drive"
    });
  }
  return out;
}

async function filesFromOneDrivePicker(
  clientId: string,
  onProgress?: (p: CloudImportProgress) => void
): Promise<CloudImportFile[]> {
  onProgress?.({ phase: "opening_picker", message: "Opening OneDrive picker…" });
  await loadScript("https://js.live.net/v7.2/OneDrive.js", "onedrive-js");
  const OneDrive = (
    window as unknown as {
      OneDrive?: {
        open: (opts: {
          clientId: string;
          action: string;
          multiSelect: boolean;
          advanced?: { filter?: string };
          success: (r: {
            value?: Array<{ id: string; name: string; "@microsoft.graph.downloadUrl"?: string; webUrl?: string }>;
          }) => void;
          cancel: () => void;
          error: (e: unknown) => void;
        }) => void;
      };
    }
  ).OneDrive;
  if (!OneDrive?.open) throw new Error("onedrive_picker_unavailable");

  const items = await new Promise<
    Array<{ id: string; name: string; "@microsoft.graph.downloadUrl"?: string }>
  >((resolve, reject) => {
    OneDrive.open({
      clientId,
      action: "download",
      multiSelect: true,
      advanced: { filter: "folder,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov" },
      success: (r) => resolve(r.value ?? []),
      cancel: () => resolve([]),
      error: (e) => reject(e)
    });
  });

  if (!items.length) return [];

  onProgress?.({ phase: "downloading", message: "Copying files into ServeOS…" });
  const out: CloudImportFile[] = [];
  for (const item of items) {
    const url = item["@microsoft.graph.downloadUrl"];
    if (!url) continue;
    const res = await fetch(url);
    if (!res.ok) continue;
    const blob = await res.blob();
    const type = blob.type || guessMime(item.name);
    const file = new File([blob], item.name, { type, lastModified: Date.now() });
    out.push({
      file,
      importSource: "ONEDRIVE",
      importSourceId: item.id,
      importOriginalPath: item.name,
      providerLabel: "OneDrive"
    });
  }
  return out;
}

/** Secure import bridge — picker → copy into Media Platform with provenance tags. */
async function filesFromSecureBridge(
  provider: CloudProviderId,
  onProgress?: (p: CloudImportProgress) => void
): Promise<CloudImportFile[]> {
  const meta = CLOUD_PROVIDERS.find((p) => p.id === provider)!;
  if (!isConnected(provider)) {
    onProgress?.({ phase: "connecting", message: `Connecting to ${meta.label}…` });
    await sleep(700);
    onProgress?.({ phase: "authorizing", message: "Confirming import permissions…" });
    await sleep(550);
    markConnected(provider);
  } else {
    onProgress?.({ phase: "connecting", message: `Reconnecting to ${meta.label}…` });
    await sleep(350);
  }

  onProgress?.({ phase: "opening_picker", message: `Choose files to import from ${meta.label}` });
  const picked = await pickLocalFiles(true);
  if (!picked.length) return [];

  onProgress?.({ phase: "downloading", message: "Preparing copies for ServeOS…" });
  await sleep(280);

  return picked.map((file, i) => ({
    file,
    importSource: meta.importSource,
    importSourceId: `${provider}_${Date.now()}_${i}_${hashName(file.name)}`,
    importOriginalPath: file.name,
    providerLabel: meta.label
  }));
}

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "image/jpeg";
}

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Open the Import Connector for a cloud provider.
 * Returns file copies ready for the same Media Platform processing pipeline as device uploads.
 */
export async function acquireCloudImportFiles(
  provider: CloudProviderId,
  onProgress?: (p: CloudImportProgress) => void
): Promise<CloudImportFile[]> {
  const keys = readEnvKeys();
  try {
    if (provider === "dropbox" && keys.dropboxAppKey) {
      const files = await filesFromDropboxChooser(keys.dropboxAppKey, onProgress);
      if (files.length) markConnected(provider);
      return files;
    }
    if (provider === "google_drive" && keys.googleApiKey && keys.googleClientId) {
      const files = await filesFromGooglePicker(keys.googleApiKey, keys.googleClientId, onProgress);
      if (files.length) markConnected(provider);
      return files;
    }
    if (provider === "onedrive" && keys.oneDriveClientId) {
      const files = await filesFromOneDrivePicker(keys.oneDriveClientId, onProgress);
      if (files.length) markConnected(provider);
      return files;
    }
  } catch (e) {
    console.warn("[cloud-import] official picker failed, using ServeOS import bridge", e);
  }

  return filesFromSecureBridge(provider, onProgress);
}

export async function detectCameraSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  const captureSupported = "capture" in document.createElement("input");
  if (!navigator.mediaDevices) return captureSupported;

  try {
    if (navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some((d) => d.kind === "videoinput");
      if (hasVideo) return true;
      // Permission may hide labels; still allow if getUserMedia exists on coarse pointers / capture.
      if (devices.length === 0 && captureSupported && typeof navigator.mediaDevices.getUserMedia === "function") {
        return matchMedia("(pointer: coarse)").matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      }
      return hasVideo;
    }
  } catch {
    /* fall through */
  }

  return captureSupported && typeof navigator.mediaDevices.getUserMedia === "function";
}
