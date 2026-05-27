import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_AVATAR_URI = "serveos.customer.avatarUri";

export async function loadProfileAvatarUri(): Promise<string | null> {
  const v = await AsyncStorage.getItem(KEY_AVATAR_URI);
  return v?.trim() ? v.trim() : null;
}

export async function saveProfileAvatarUri(uri: string | null): Promise<void> {
  if (!uri?.trim()) {
    await AsyncStorage.removeItem(KEY_AVATAR_URI);
    return;
  }
  await AsyncStorage.setItem(KEY_AVATAR_URI, uri.trim());
}
