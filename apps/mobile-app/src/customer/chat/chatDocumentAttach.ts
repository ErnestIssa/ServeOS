import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";

export const CHAT_MAX_DOCUMENT_BYTES = 2_500_000;

export type PreparedChatDocument = {
  fileName: string;
  mimeType:
    | "application/pdf"
    | "text/plain"
    | "application/msword"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  dataBase64: string;
  byteSize: number;
};

const ALLOWED_MIME = new Set<PreparedChatDocument["mimeType"]>([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function normalizeMime(mime: string | null | undefined): PreparedChatDocument["mimeType"] | null {
  if (!mime) return null;
  return ALLOWED_MIME.has(mime as PreparedChatDocument["mimeType"])
    ? (mime as PreparedChatDocument["mimeType"])
    : null;
}

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function mimeFromExtension(ext: string): PreparedChatDocument["mimeType"] | null {
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}

export async function pickChatDocument(): Promise<PreparedChatDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const fileName = asset.name?.trim() || "document";
  let mimeType = normalizeMime(asset.mimeType);
  if (!mimeType) mimeType = mimeFromExtension(extFromName(fileName));
  if (!mimeType) {
    Alert.alert("Unsupported file", "Use PDF, TXT, DOC, or DOCX.");
    return null;
  }

  const byteSize = asset.size ?? 0;
  if (byteSize > CHAT_MAX_DOCUMENT_BYTES) {
    Alert.alert("File too large", "Documents must be 2.5 MB or smaller.");
    return null;
  }

  try {
    const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    if (!dataBase64?.length) {
      Alert.alert("Could not read file", "Try another document.");
      return null;
    }
    return { fileName, mimeType, dataBase64, byteSize: byteSize || dataBase64.length };
  } catch {
    Alert.alert("Could not read file", "Try another document.");
    return null;
  }
}

export function confirmSendChatDocument(fileName: string, restaurantName: string, onConfirm: () => void) {
  const venue = restaurantName.trim() || "the restaurant";
  Alert.alert("Send document?", `Send “${fileName}” to ${venue}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Send", onPress: onConfirm }
  ]);
}
