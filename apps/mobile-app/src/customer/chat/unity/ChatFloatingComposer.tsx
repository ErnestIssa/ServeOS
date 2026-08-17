import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cancelVoiceRecording,
  formatDuration,
  getRecordingDurationMs,
  getRecordingLevel,
  pauseVoiceRecording,
  playVoicePreview,
  startVoiceRecording,
  stopVoicePreview,
  voiceDraftToMessage,
  type VoiceDraft
} from "./chatAttachments";
import { CHAT_BACKGROUND, colors, radius, shadows, spacing } from "./theme";
import type { ChatReplyPreview } from "./chatUi";
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess } from "./haptics";
import {
  filterMentionableUsers,
  getActiveMentionQuery,
  insertMention,
  type MentionableUser
} from "./mentions";
import { MentionSuggestions } from "./MentionSuggestions";
import { VoiceWaveform } from "./VoiceWaveform";

type Props = {
  onSend: (text: string) => void;
  onVoiceSend: (text: string) => void;
  placeholder?: string;
  onAttachPress: () => void;
  replyTo?: ChatReplyPreview | null;
  onClearReply?: () => void;
  onKeyboardHeightChange?: (height: number) => void;
  venueName?: string;
  disabled?: boolean;
  onDraftChange?: (text: string) => void;
};

type VoiceMode = "idle" | "recording" | "preview";

export function ChatFloatingComposer({
  onSend,
  onVoiceSend,
  placeholder = "Message",
  onAttachPress,
  replyTo,
  onClearReply,
  onKeyboardHeightChange,
  venueName = "Venue",
  disabled,
  onDraftChange
}: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("idle");
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0.3);
  const [playingPreview, setPlayingPreview] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasText = text.trim().length > 0;
  const inVoiceUi = voiceMode !== "idle";
  const activeMention = !inVoiceUi ? getActiveMentionQuery(text, selection.start) : null;
  const mentionSuggestions = activeMention
    ? filterMentionableUsers(venueName, activeMention.query)
    : [];

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates.height;
      setKeyboardHeight(h);
      onKeyboardHeightChange?.(h);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      onKeyboardHeightChange?.(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [onKeyboardHeightChange]);

  useEffect(() => {
    if (voiceMode !== "recording") {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    pollRef.current = setInterval(async () => {
      setRecordingMs(await getRecordingDurationMs());
      setMeterLevel(await getRecordingLevel());
    }, 100);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [voiceMode]);

  useEffect(
    () => () => {
      void cancelVoiceRecording();
    },
    []
  );

  const bottomPad = keyboardHeight > 0 ? 2 : Math.max(insets.bottom, spacing.sm);
  const keyboardLift = Platform.OS === "android" ? keyboardHeight : 0;

  const handlePickMention = (user: MentionableUser) => {
    if (!activeMention) return;
    const next = insertMention(text, activeMention.start, selection.start, user.name);
    setText(next);
    const cursor = activeMention.start + `@${user.name.replace(/\s+/g, "")} `.length;
    setSelection({ start: cursor, end: cursor });
    hapticSelection();
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    void hapticSuccess();
  };

  const handleStartRecording = async () => {
    if (hasText || inVoiceUi || disabled) return;
    const ok = await startVoiceRecording();
    if (!ok) {
      hapticLight();
      return;
    }
    setRecordingMs(0);
    setMeterLevel(0.3);
    setVoiceMode("recording");
    hapticMedium();
  };

  const handlePauseRecording = async () => {
    const draft = await pauseVoiceRecording();
    if (!draft) {
      setVoiceMode("idle");
      return;
    }
    setVoiceDraft(draft);
    setVoiceMode("preview");
    hapticMedium();
  };

  const handleCancelVoice = async () => {
    await cancelVoiceRecording();
    setVoiceDraft(null);
    setVoiceMode("idle");
    setPlayingPreview(false);
    hapticLight();
  };

  const handleTogglePreview = async () => {
    if (!voiceDraft) return;
    if (playingPreview) {
      await stopVoicePreview();
      setPlayingPreview(false);
      return;
    }
    const ok = await playVoicePreview(voiceDraft.uri, () => setPlayingPreview(false));
    if (ok) {
      setPlayingPreview(true);
      hapticSelection();
    }
  };

  const handleSendVoice = () => {
    if (!voiceDraft) return;
    void stopVoicePreview();
    onVoiceSend(voiceDraftToMessage(voiceDraft).label);
    setVoiceDraft(null);
    setVoiceMode("idle");
    setPlayingPreview(false);
    void hapticSuccess();
  };

  const handleActionPress = () => {
    if (hasText) {
      handleSendText();
      return;
    }
    if (voiceMode === "recording") {
      void handlePauseRecording();
      return;
    }
    if (voiceMode === "preview") {
      handleSendVoice();
      return;
    }
    void handleStartRecording();
  };

  const actionIcon = (() => {
    if (hasText || voiceMode === "preview") return "send" as const;
    if (voiceMode === "recording") return "pause" as const;
    return "mic" as const;
  })();

  const actionStyle = (() => {
    if (hasText || voiceMode === "preview") return styles.sendBtn;
    if (voiceMode === "recording") return styles.pauseBtn;
    return styles.micBtn;
  })();

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad, marginBottom: keyboardLift }]}>
      {replyTo ? (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={styles.replyContent}>
            <Text style={styles.replyAuthor} numberOfLines={1}>
              {replyTo.author}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyTo.text}
            </Text>
          </View>
          <Pressable onPress={onClearReply} hitSlop={8} accessibilityLabel="Cancel reply">
            <Ionicons name="close" size={20} color="#667781" />
          </Pressable>
        </View>
      ) : null}

      {activeMention && mentionSuggestions.length > 0 ? (
        <MentionSuggestions users={mentionSuggestions} onPick={handlePickMention} />
      ) : null}

      <View style={[styles.bar, shadows.float]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={88} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidGlass]} />
        )}

        {!inVoiceUi ? (
          <>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                hapticLight();
                onAttachPress();
              }}
              accessibilityLabel="Attach file"
              disabled={disabled}
            >
              <Ionicons name="add" size={24} color={colors.brand} />
            </Pressable>

            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(value) => {
                setText(value);
                setSelection({ start: value.length, end: value.length });
                onDraftChange?.(value);
              }}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              placeholder={placeholder}
              placeholderTextColor={colors.whatsAppGray}
              multiline
              maxLength={2000}
              editable={!disabled}
            />
          </>
        ) : (
          <View style={styles.voiceRow}>
            <Pressable
              onPress={handleCancelVoice}
              style={styles.iconBtn}
              accessibilityLabel="Cancel recording"
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>

            <VoiceWaveform
              active={voiceMode === "recording" || playingPreview}
              level={voiceMode === "recording" ? Math.max(0.25, meterLevel) : 0.45}
              color={voiceMode === "recording" ? colors.danger : colors.brand}
            />

            <Text style={styles.durationText}>
              {formatDuration(
                voiceMode === "recording"
                  ? Math.max(0, Math.round(recordingMs / 1000))
                  : (voiceDraft?.durationSec ?? 0)
              )}
            </Text>

            {voiceMode === "preview" ? (
              <Pressable
                style={styles.iconBtn}
                onPress={handleTogglePreview}
                accessibilityLabel={playingPreview ? "Stop preview" : "Play preview"}
              >
                <Ionicons name={playingPreview ? "stop" : "play"} size={20} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable
          style={[styles.actionBtn, actionStyle]}
          onPress={handleActionPress}
          accessibilityLabel={
            hasText
              ? "Send message"
              : voiceMode === "recording"
                ? "Pause recording"
                : voiceMode === "preview"
                  ? "Send voice message"
                  : "Record voice message"
          }
        >
          <Ionicons
            name={actionIcon}
            size={20}
            color={colors.white}
            style={hasText || voiceMode === "preview" ? styles.sendIcon : undefined}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    zIndex: 40,
    backgroundColor: CHAT_BACKGROUND
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(23,95,97,0.1)"
  },
  replyAccent: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: colors.brand },
  replyContent: { flex: 1 },
  replyAuthor: { fontSize: 12, fontWeight: "800", color: colors.brand },
  replyText: { fontSize: 12, marginTop: 1, color: "#667781" },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)"
  },
  androidGlass: { backgroundColor: "rgba(255,255,255,0.92)" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,95,97,0.1)"
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: colors.primaryText,
    backgroundColor: "transparent"
  },
  voiceRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 40
  },
  durationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667781",
    minWidth: 36,
    textAlign: "center"
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center"
  },
  micBtn: { backgroundColor: colors.brand },
  pauseBtn: { backgroundColor: colors.danger },
  sendBtn: { backgroundColor: colors.green },
  sendIcon: { marginLeft: -2 }
});
