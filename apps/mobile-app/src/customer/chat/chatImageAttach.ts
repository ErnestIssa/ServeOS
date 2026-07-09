import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

export const CHAT_MAX_IMAGES_PER_SEND = 3;
export const CHAT_MAX_IMAGES_PER_ROOM = 10;

export type PreparedChatImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
};

async function ensureMediaPermission(kind: "camera" | "library"): Promise<boolean> {
  if (kind === "camera") {
    const cur = await ImagePicker.getCameraPermissionsAsync();
    if (cur.granted) return true;
    const req = await ImagePicker.requestCameraPermissionsAsync();
    return req.granted;
  }
  const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (cur.granted) return true;
  const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return req.granted;
}

export async function prepareChatImageFromUri(uri: string): Promise<PreparedChatImage | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!out.base64) return null;
    return { mimeType: "image/jpeg", dataBase64: out.base64 };
  } catch {
    return null;
  }
}

function pickSourceAlert(): Promise<"camera" | "library" | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      Alert.alert("Add photo", "Take a new picture or choose from your library.", [
        { text: "Take photo", onPress: () => resolve("camera") },
        { text: "Photo library", onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) }
      ]);
      return;
    }
    Alert.alert("Add photo", undefined, [
      { text: "Camera", onPress: () => resolve("camera") },
      { text: "Gallery", onPress: () => resolve("library") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) }
    ]);
  });
}

export async function pickChatImagesFromLibrary(
  remainingRoom: number
): Promise<PreparedChatImage[] | null> {
  const remaining = Math.max(0, Math.min(CHAT_MAX_IMAGES_PER_SEND, remainingRoom));
  if (remaining <= 0) {
    Alert.alert(
      "Photo limit reached",
      `You can send up to ${CHAT_MAX_IMAGES_PER_ROOM} photos in this chat.`
    );
    return null;
  }

  const allowed = await ensureMediaPermission("library");
  if (!allowed) {
    Alert.alert("Permission needed", "Allow photo access to send images.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining
  });

  if (result.canceled || !result.assets?.length) return null;

  const prepared: PreparedChatImage[] = [];
  for (const asset of result.assets.slice(0, remaining)) {
    const p = await prepareChatImageFromUri(asset.uri);
    if (p) prepared.push(p);
  }

  if (!prepared.length) {
    Alert.alert("Could not use photo", "Try another image (JPEG or PNG).");
    return null;
  }

  return prepared;
}

export async function pickChatImages(remainingRoom: number): Promise<PreparedChatImage[] | null> {
  const remaining = Math.max(0, Math.min(CHAT_MAX_IMAGES_PER_SEND, remainingRoom));
  if (remaining <= 0) {
    Alert.alert(
      "Photo limit reached",
      `You can send up to ${CHAT_MAX_IMAGES_PER_ROOM} photos in this chat.`
    );
    return null;
  }

  const source = await pickSourceAlert();
  if (!source) return null;

  if (source === "library") {
    return pickChatImagesFromLibrary(remainingRoom);
  }

  const allowed = await ensureMediaPermission("camera");
  if (!allowed) {
    Alert.alert("Permission needed", "Allow camera access to send images.");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: false
  });

  if (result.canceled || !result.assets?.length) return null;

  const prepared: PreparedChatImage[] = [];
  for (const asset of result.assets.slice(0, remaining)) {
    const p = await prepareChatImageFromUri(asset.uri);
    if (p) prepared.push(p);
  }

  if (!prepared.length) {
    Alert.alert("Could not use photo", "Try another image (JPEG or PNG).");
    return null;
  }

  return prepared;
}

export function confirmSendChatImages(
  count: number,
  restaurantName: string,
  remainingAfter: number,
  onConfirm: () => void
) {
  const venue = restaurantName.trim() || "the restaurant";
  const limitNote =
    remainingAfter <= 0
      ? `This uses your remaining photo allowance for this chat.`
      : `You can send ${remainingAfter} more photo${remainingAfter === 1 ? "" : "s"} in this chat later.`;

  Alert.alert(
    "Send photo?",
    `Send ${count} image${count === 1 ? "" : "s"} to ${venue}? Only images are allowed. ${limitNote}`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: onConfirm }
    ]
  );
}
