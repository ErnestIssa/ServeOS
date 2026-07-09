/** Customer chat document upload limits (mirrors API). */
export const CHAT_MAX_DOCUMENT_BYTES = 2_500_000;
export const CHAT_ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

export type ChatDocumentMime = (typeof CHAT_ALLOWED_DOCUMENT_MIMES)[number];

export const CHAT_DOCUMENT_MAX_BASE64_CHARS = 3_400_000;

export const DOC_CONTENT_PREFIX = "DOC|";

export function buildDocumentContent(fileName: string, contentRef: string): string {
  return `${DOC_CONTENT_PREFIX}${fileName}|${contentRef}`;
}

export function parseDocumentContent(
  raw: string
): { fileName: string; contentRef: string } | null {
  if (!raw.startsWith(DOC_CONTENT_PREFIX)) return null;
  const body = raw.slice(DOC_CONTENT_PREFIX.length);
  const sep = body.indexOf("|");
  if (sep <= 0) return null;
  const fileName = body.slice(0, sep).trim();
  const contentRef = body.slice(sep + 1).trim();
  if (!fileName || !contentRef) return null;
  return { fileName, contentRef };
}
