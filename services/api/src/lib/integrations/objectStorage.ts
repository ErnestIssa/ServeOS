import { createHash, randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { scheduleCdnPurgeForObjectKeys } from "./cloudflareCdn.js";

export const DEFAULT_S3_BUCKET = "serveos-media-prod";
export const DEFAULT_S3_REGION = "eu-north-1";

export type StorageScope =
  | "profile"
  | "restaurant"
  | "menu"
  | "chat"
  | "video"
  | "pdf"
  | "invoice"
  | "document"
  | "attachment";

export type MediaVisibility = "public" | "private";

export type UploadSession = {
  mode: "presigned" | "direct";
  objectKey: string;
  uploadUrl?: string;
  publicUrl?: string;
  maxBytes: number;
  expiresInSeconds?: number;
};

export type PutObjectResult = {
  objectKey: string;
  byteSize: number;
  sha256Hex: string;
  etag?: string;
};

const S3_CONTENT_PREFIX = "s3:";

const SCOPE_MAX_BYTES: Record<StorageScope, number> = {
  profile: 5 * 1024 * 1024,
  restaurant: 8 * 1024 * 1024,
  menu: 8 * 1024 * 1024,
  chat: 5 * 1024 * 1024,
  video: 120 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  invoice: 25 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  attachment: 25 * 1024 * 1024
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const PDF_TYPES = new Set(["application/pdf"]);

const SCOPE_ALLOWED_TYPES: Record<StorageScope, Set<string>> = {
  profile: IMAGE_TYPES,
  restaurant: IMAGE_TYPES,
  menu: IMAGE_TYPES,
  chat: IMAGE_TYPES,
  video: VIDEO_TYPES,
  pdf: PDF_TYPES,
  invoice: PDF_TYPES,
  document: new Set([...PDF_TYPES, "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  attachment: new Set([
    ...IMAGE_TYPES,
    ...VIDEO_TYPES,
    ...PDF_TYPES,
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ])
};

const SCOPE_DEFAULT_VISIBILITY: Record<StorageScope, MediaVisibility> = {
  profile: "private",
  restaurant: "public",
  menu: "public",
  chat: "private",
  video: "public",
  pdf: "private",
  invoice: "private",
  document: "private",
  attachment: "private"
};

let s3Client: S3Client | null = null;

export function awsAccessKeyId(): string | undefined {
  return process.env.AWS_ACCESS_KEY_ID?.trim() || process.env.AWS_S3_ACCESS_KEY_ID?.trim();
}

export function awsSecretAccessKey(): string | undefined {
  return process.env.AWS_SECRET_ACCESS_KEY?.trim() || process.env.AWS_S3_SECRET_ACCESS_KEY?.trim();
}

export function awsRegion(): string {
  return process.env.AWS_REGION?.trim() || process.env.AWS_S3_REGION?.trim() || DEFAULT_S3_REGION;
}

export function awsBucket(): string {
  return process.env.AWS_S3_BUCKET?.trim() || DEFAULT_S3_BUCKET;
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(awsAccessKeyId() && awsSecretAccessKey() && awsBucket());
}

export function requireObjectStorage(): void {
  if (!isObjectStorageConfigured()) {
    throw Object.assign(new Error("object_storage_not_configured"), { statusCode: 503 });
  }
}

function getS3Client(): S3Client {
  requireObjectStorage();
  if (!s3Client) {
    const endpoint = process.env.AWS_S3_ENDPOINT?.trim();
    s3Client = new S3Client({
      region: awsRegion(),
      credentials: {
        accessKeyId: awsAccessKeyId()!,
        secretAccessKey: awsSecretAccessKey()!
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {})
    });
  }
  return s3Client;
}

function extForContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "application/msword":
      return "doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/vnd.ms-excel":
      return "xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    default:
      return "bin";
  }
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** Secure, non-guessable S3 keys with scope-based prefixes. */
export function buildObjectKey(scope: StorageScope, parts: string[]): string {
  if (scope === "profile") return `profiles/${sanitizeSegment(parts[0] ?? "unknown")}/${randomUUID()}.jpg`;
  if (scope === "restaurant") return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/images/${randomUUID()}.jpg`;
  if (scope === "menu") {
    const restaurantId = sanitizeSegment(parts[0] ?? "unknown");
    const itemId = sanitizeSegment(parts[1] ?? "item");
    return `venues/${restaurantId}/menu/${itemId}/${randomUUID()}.jpg`;
  }
  if (scope === "chat") {
    return `chat/${sanitizeSegment(parts[0] ?? "room")}/${randomUUID()}.jpg`;
  }
  if (scope === "video") {
    return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/videos/${randomUUID()}.mp4`;
  }
  if (scope === "invoice") {
    return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/invoices/${randomUUID()}.pdf`;
  }
  if (scope === "pdf" || scope === "document") {
    return `documents/${sanitizeSegment(parts[0] ?? "general")}/${randomUUID()}.pdf`;
  }
  return `attachments/${sanitizeSegment(parts[0] ?? "general")}/${randomUUID()}.bin`;
}

export function buildObjectKeyForType(scope: StorageScope, parts: string[], contentType: string): string {
  const ext = extForContentType(contentType);
  const id = randomUUID();
  if (scope === "profile") return `profiles/${sanitizeSegment(parts[0] ?? "unknown")}/${id}.${ext}`;
  if (scope === "restaurant") return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/images/${id}.${ext}`;
  if (scope === "menu") {
    return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/menu/${sanitizeSegment(parts[1] ?? "item")}/${id}.${ext}`;
  }
  if (scope === "chat") return `chat/${sanitizeSegment(parts[0] ?? "room")}/${id}.${ext}`;
  if (scope === "video") return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/videos/${id}.${ext}`;
  if (scope === "invoice") return `venues/${sanitizeSegment(parts[0] ?? "unknown")}/invoices/${id}.${ext}`;
  if (scope === "pdf" || scope === "document") {
    return `documents/${sanitizeSegment(parts[0] ?? "general")}/${id}.${ext}`;
  }
  return `attachments/${sanitizeSegment(parts[0] ?? "general")}/${id}.${ext}`;
}

export function visibilityForScope(scope: StorageScope): MediaVisibility {
  return SCOPE_DEFAULT_VISIBILITY[scope];
}

export function maxBytesForScope(scope: StorageScope): number {
  return SCOPE_MAX_BYTES[scope];
}

export function isAllowedContentType(scope: StorageScope, contentType: string): boolean {
  return SCOPE_ALLOWED_TYPES[scope].has(contentType);
}

export function publicUrlForKey(key: string): string {
  const cdn = process.env.CLOUDFLARE_CDN_URL?.trim() || process.env.AWS_S3_PUBLIC_URL?.trim();
  if (cdn) return `${cdn.replace(/\/$/, "")}/${key}`;
  return `https://${awsBucket()}.s3.${awsRegion()}.amazonaws.com/${key}`;
}

export function toStoredContentRef(objectKey: string): string {
  return `${S3_CONTENT_PREFIX}${objectKey}`;
}

export function parseStoredContentRef(content: string): string | null {
  if (!content.startsWith(S3_CONTENT_PREFIX)) return null;
  const key = content.slice(S3_CONTENT_PREFIX.length).trim();
  return key || null;
}

export function isStoredContentRef(content: string): boolean {
  return content.startsWith(S3_CONTENT_PREFIX);
}

export async function createPresignedPutUrl(params: {
  objectKey: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: awsBucket(),
    Key: params.objectKey,
    ContentType: params.contentType,
    ContentLength: params.maxBytes
  });
  return getSignedUrl(client, command, { expiresIn: params.expiresInSeconds ?? 900 });
}

export async function createPresignedGetUrl(
  objectKey: string,
  opts?: { expiresInSeconds?: number; downloadName?: string }
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: awsBucket(),
    Key: objectKey,
    ...(opts?.downloadName
      ? { ResponseContentDisposition: `inline; filename="${sanitizeSegment(opts.downloadName)}"` }
      : {})
  });
  return getSignedUrl(client, command, { expiresIn: opts?.expiresInSeconds ?? 3600 });
}

export async function resolveClientMediaUrl(
  content: string,
  opts?: { expiresInSeconds?: number }
): Promise<string> {
  const key = parseStoredContentRef(content);
  if (!key) return content;
  return createPresignedGetUrl(key, { expiresInSeconds: opts?.expiresInSeconds ?? 3600 });
}

export async function putObjectBuffer(params: {
  objectKey: string;
  body: Buffer;
  contentType: string;
  visibility?: MediaVisibility;
}): Promise<PutObjectResult> {
  if (!isObjectStorageConfigured()) {
    throw Object.assign(new Error("object_storage_not_configured"), { statusCode: 503 });
  }

  const client = getS3Client();
  const sha256Hex = createHash("sha256").update(params.body).digest("hex");
  const result = await client.send(
    new PutObjectCommand({
      Bucket: awsBucket(),
      Key: params.objectKey,
      Body: params.body,
      ContentType: params.contentType,
      ContentLength: params.body.byteLength,
      Metadata: {
        sha256: sha256Hex
      }
    })
  );

  scheduleCdnPurgeForObjectKeys([params.objectKey]);

  return {
    objectKey: params.objectKey,
    byteSize: params.body.byteLength,
    sha256Hex,
    etag: result.ETag
  };
}

export async function deleteObject(objectKey: string): Promise<void> {
  if (!isObjectStorageConfigured()) return;
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: awsBucket(), Key: objectKey }));
  scheduleCdnPurgeForObjectKeys([objectKey]);
}

export async function headObject(objectKey: string): Promise<{ byteSize: number; contentType?: string } | null> {
  if (!isObjectStorageConfigured()) return null;
  try {
    const client = getS3Client();
    const head = await client.send(new HeadObjectCommand({ Bucket: awsBucket(), Key: objectKey }));
    return { byteSize: Number(head.ContentLength ?? 0), contentType: head.ContentType };
  } catch {
    return null;
  }
}

export async function createUploadSession(params: {
  scope: StorageScope;
  contentType: string;
  keyParts: string[];
}): Promise<UploadSession | { ok: false; error: string }> {
  if (!isAllowedContentType(params.scope, params.contentType)) {
    return { ok: false, error: "invalid_content_type" };
  }

  const objectKey = buildObjectKeyForType(params.scope, params.keyParts, params.contentType);
  const maxBytes = maxBytesForScope(params.scope);

  if (!isObjectStorageConfigured()) {
    return { ok: false, error: "object_storage_not_configured" };
  }

  const uploadUrl = await createPresignedPutUrl({
    objectKey,
    contentType: params.contentType,
    maxBytes
  });

  const visibility = visibilityForScope(params.scope);
  return {
    mode: "presigned",
    objectKey,
    uploadUrl,
    publicUrl: visibility === "public" ? publicUrlForKey(objectKey) : undefined,
    maxBytes,
    expiresInSeconds: 900
  };
}

export async function uploadBase64Object(params: {
  scope: StorageScope;
  objectKey: string;
  dataBase64: string;
  contentType: string;
}): Promise<PutObjectResult | { ok: false; error: string }> {
  if (!isAllowedContentType(params.scope, params.contentType)) {
    return { ok: false, error: "invalid_content_type" };
  }

  const raw = params.dataBase64.includes(",") ? params.dataBase64.split(",")[1]! : params.dataBase64;
  const body = Buffer.from(raw, "base64");
  const maxBytes = maxBytesForScope(params.scope);
  if (body.byteLength > maxBytes) return { ok: false, error: "file_too_large" };
  if (body.byteLength === 0) return { ok: false, error: "empty_file" };

  try {
    const stored = await putObjectBuffer({
      objectKey: params.objectKey,
      body,
      contentType: params.contentType,
      visibility: visibilityForScope(params.scope)
    });
    return stored;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upload_failed";
    return { ok: false, error: msg };
  }
}

// --- Profile image helpers (existing API surface) ---

const MAX_PROFILE_IMAGE_BYTES = SCOPE_MAX_BYTES.profile;

export type ProfileImageUpload = UploadSession & { imageKey: string };

export function profileImageKeyForUser(userId: string, ext: string): string {
  return `profiles/${sanitizeSegment(userId)}/${randomUUID()}.${ext}`;
}

export async function createProfileImageUploadSession(
  userId: string,
  contentType: string
): Promise<ProfileImageUpload | { ok: false; error: string }> {
  if (!IMAGE_TYPES.has(contentType)) return { ok: false, error: "invalid_image_type" };

  const session = await createUploadSession({
    scope: "profile",
    contentType,
    keyParts: [userId]
  });
  if ("error" in session) return { ok: false, error: session.error };

  return {
    ...session,
    imageKey: session.objectKey
  };
}

export async function storeProfileImageDirect(
  imageKey: string,
  dataBase64: string,
  contentType: string
): Promise<
  { ok: true; objectKey: string; sha256Hex: string; byteSize: number } | { ok: false; error: string }
> {
  const uploaded = await uploadBase64Object({
    scope: "profile",
    objectKey: imageKey,
    dataBase64,
    contentType
  });
  if ("error" in uploaded) return uploaded;
  return {
    ok: true,
    objectKey: uploaded.objectKey,
    sha256Hex: uploaded.sha256Hex,
    byteSize: uploaded.byteSize
  };
}

export async function resolveProfileImageUrl(profileImageKey: string | null | undefined): Promise<string | null> {
  if (!profileImageKey) return null;
  if (!isObjectStorageConfigured()) return null;
  return createPresignedGetUrl(profileImageKey, { expiresInSeconds: 3600 });
}
