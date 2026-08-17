import { Audio } from "expo-av";

export type ChatAttachmentKind = "image" | "video" | "file" | "voice";

export type ChatAttachmentResult = {
  kind: ChatAttachmentKind;
  label: string;
  uri?: string;
  fileName?: string;
  durationSec?: number;
};

export type VoiceDraft = {
  uri: string;
  durationSec: number;
};

let activeRecording: Audio.Recording | null = null;
let previewSound: Audio.Sound | null = null;

export async function startVoiceRecording(): Promise<boolean> {
  try {
    await stopVoicePreview();
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true
    });
    const { recording } = await Audio.Recording.createAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true
    });
    activeRecording = recording;
    return true;
  } catch {
    activeRecording = null;
    return false;
  }
}

export async function getRecordingLevel(): Promise<number> {
  if (!activeRecording) return 0;
  try {
    const status = await activeRecording.getStatusAsync();
    if (!status.isRecording) return 0;
    const db = "metering" in status && typeof status.metering === "number" ? status.metering : -160;
    return Math.max(0, Math.min(1, (db + 60) / 60));
  } catch {
    return 0;
  }
}

export async function getRecordingDurationMs(): Promise<number> {
  if (!activeRecording) return 0;
  try {
    const status = await activeRecording.getStatusAsync();
    return status.isRecording && "durationMillis" in status ? status.durationMillis ?? 0 : 0;
  } catch {
    return 0;
  }
}

export async function pauseVoiceRecording(): Promise<VoiceDraft | null> {
  if (!activeRecording) return null;
  try {
    const status = await activeRecording.getStatusAsync();
    const uri = activeRecording.getURI();
    await activeRecording.stopAndUnloadAsync();
    activeRecording = null;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true
    });
    const durationMs =
      status.isRecording === false && "durationMillis" in status ? status.durationMillis ?? 0 : 0;
    const durationSec = Math.max(1, Math.round(durationMs / 1000));
    if (!uri) return null;
    return { uri, durationSec };
  } catch {
    activeRecording = null;
    return null;
  }
}

export async function cancelVoiceRecording() {
  try {
    if (activeRecording) await activeRecording.stopAndUnloadAsync();
  } catch {
    /* ignore */
  }
  activeRecording = null;
  await stopVoicePreview();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
}

export async function playVoicePreview(uri: string, onFinish?: () => void): Promise<boolean> {
  try {
    await stopVoicePreview();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri });
    previewSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) onFinish?.();
    });
    await sound.playAsync();
    return true;
  } catch {
    return false;
  }
}

export async function stopVoicePreview() {
  try {
    if (previewSound) {
      await previewSound.stopAsync();
      await previewSound.unloadAsync();
    }
  } catch {
    /* ignore */
  }
  previewSound = null;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function voiceDraftToMessage(draft: VoiceDraft): ChatAttachmentResult {
  return {
    kind: "voice",
    label: `🎤 Voice message (${formatDuration(draft.durationSec)})`,
    uri: draft.uri,
    durationSec: draft.durationSec
  };
}

export function attachmentToMessageText(result: ChatAttachmentResult): string {
  if (result.fileName && result.kind === "file") return `📎 ${result.fileName}`;
  return result.label;
}
