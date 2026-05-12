import { Audio } from "expo-av";
import { Platform } from "react-native";

let lastPlayAt = 0;
let configured = false;

/** Short cue when an item joins the basket (FAB + browse +). Same asset as FAB; throttled globally. */
export async function playCartAddCue() {
  if (!configured) {
    configured = true;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      });
    } catch {
      /* continue */
    }
  }

  const now = Date.now();
  if (now - lastPlayAt < 200) return;
  lastPlayAt = now;
  try {
    const { sound } = await Audio.Sound.createAsync(require("../appSounds/cartNotice.wav"), {
      shouldPlay: true,
      volume: Platform.OS === "ios" ? 0.36 : 0.42,
      positionMillis: 0
    });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || status.didJustFinish) void sound.unloadAsync().catch(() => {});
    });
  } catch {
    /* non-fatal */
  }
}
