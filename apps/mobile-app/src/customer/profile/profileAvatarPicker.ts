import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

async function ensureMediaPermission(kind: "camera" | "library"): Promise<boolean> {
  if (kind === "camera") {
    const cur = await ImagePicker.getCameraPermissionsAsync();
    if (cur.granted) return true;
    return (await ImagePicker.requestCameraPermissionsAsync()).granted;
  }
  const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (cur.granted) return true;
  return (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
}

function pickSourceAlert(): Promise<"camera" | "library" | null> {
  return new Promise((resolve) => {
    Alert.alert("Profile photo", "Take a new picture or choose from your library.", [
      { text: "Take photo", onPress: () => resolve("camera") },
      { text: "Photo library", onPress: () => resolve("library") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) }
    ]);
  });
}

export async function pickProfileAvatarUri(): Promise<string | null> {
  const source = await pickSourceAlert();
  if (!source) return null;
  if (!(await ensureMediaPermission(source))) {
    Alert.alert("Permission needed", "Allow camera or photo access to update your profile image.");
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9
        });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function manipulateProfileAvatar(
  uri: string,
  actions: ImageManipulator.Action[]
): Promise<string | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.88,
      format: ImageManipulator.SaveFormat.JPEG
    });
    return out.uri ?? null;
  } catch {
    return null;
  }
}
