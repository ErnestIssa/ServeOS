import type { ChatImageMime } from "../chatImageLimits.js";
import {
  buildObjectKeyForType,
  toStoredContentRef,
  uploadBase64Object
} from "../integrations/objectStorage.js";

export async function uploadChatImageBase64(params: {
  chatRoomId: string;
  mimeType: ChatImageMime;
  dataBase64: string;
}): Promise<
  | {
      ok: true;
      contentRef: string;
      objectKey: string;
      byteSize: number;
      sha256Hex: string;
      contentType: string;
    }
  | { ok: false; error: string }
> {
  const objectKey = buildObjectKeyForType("chat", [params.chatRoomId], params.mimeType);
  const uploaded = await uploadBase64Object({
    scope: "chat",
    objectKey,
    dataBase64: params.dataBase64,
    contentType: params.mimeType
  });
  if ("error" in uploaded) return { ok: false, error: uploaded.error };

  return {
    ok: true,
    contentRef: toStoredContentRef(uploaded.objectKey),
    objectKey: uploaded.objectKey,
    byteSize: uploaded.byteSize,
    sha256Hex: uploaded.sha256Hex,
    contentType: params.mimeType
  };
}
