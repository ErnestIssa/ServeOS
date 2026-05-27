import * as ImageManipulator from "expo-image-manipulator";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FloatingCardModal } from "../../components/FloatingCardModal";
import { useAppTheme } from "../../theme/AppThemeContext";
import { manipulateProfileAvatar, pickProfileAvatarUri } from "./profileAvatarPicker";
import { BlurModalScrim } from "./ProfileUi";

type Props = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  onSaved: (uri: string) => void;
};

type Mode = "view" | "edit";

export function ProfileAvatarModal(props: Props) {
  const { colors: t } = useAppTheme();
  const [mode, setMode] = React.useState<Mode>("view");
  const [workingUri, setWorkingUri] = React.useState<string | null>(props.uri);
  const [rotation, setRotation] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [scalePct, setScalePct] = React.useState(100);
  const [busy, setBusy] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const baselineUriRef = React.useRef<string | null>(props.uri);

  React.useEffect(() => {
    if (props.visible) {
      baselineUriRef.current = props.uri;
      setMode("view");
      setWorkingUri(props.uri);
      setRotation(0);
      setFlipped(false);
      setScalePct(100);
      setDiscardOpen(false);
    }
  }, [props.visible, props.uri]);

  const hasUnsavedChanges = React.useMemo(() => {
    const uriChanged = workingUri !== baselineUriRef.current;
    const editDirty = mode === "edit" && (rotation !== 0 || flipped || scalePct !== 100);
    return uriChanged || editDirty;
  }, [workingUri, mode, rotation, flipped, scalePct]);

  const tryClose = React.useCallback(() => {
    if (hasUnsavedChanges) {
      setDiscardOpen(true);
      return;
    }
    props.onClose();
  }, [hasUnsavedChanges, props]);

  const runPick = async () => {
    const picked = await pickProfileAvatarUri();
    if (!picked) return;
    setWorkingUri(picked);
    setRotation(0);
    setFlipped(false);
    setScalePct(100);
    setMode("view");
  };

  const applyEdits = async (): Promise<string | null> => {
    if (!workingUri) return null;
    const actions: ImageManipulator.Action[] = [];
    if (rotation) actions.push({ rotate: rotation });
    if (flipped) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
    if (scalePct !== 100) {
      try {
        const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          Image.getSize(workingUri, (w, h) => resolve({ w, h }), reject);
        });
        const factor = scalePct / 100;
        actions.push({
          resize: {
            width: Math.round(size.w * factor),
            height: Math.round(size.h * factor)
          }
        });
      } catch {
        /* skip resize */
      }
    }
    if (!actions.length) return workingUri;
    return manipulateProfileAvatar(workingUri, actions);
  };

  const saveEdits = async () => {
    if (!workingUri || busy) return;
    setBusy(true);
    try {
      const out = await applyEdits();
      if (out) {
        baselineUriRef.current = out;
        props.onSaved(out);
        props.onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const hasImage = Boolean(workingUri);

  return (
    <>
      <FloatingCardModal visible={props.visible} onRequestClose={tryClose} maxWidth={380}>
        <Text style={[styles.title, { color: t.text }]}>{mode === "edit" ? "Edit photo" : "Profile photo"}</Text>

        {mode === "view" ? (
          <>
            <View style={[styles.previewBox, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
              {hasImage ? (
                <Image source={{ uri: workingUri! }} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <Text style={[styles.emptyHint, { color: t.textMuted }]}>No photo yet</Text>
              )}
            </View>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: t.accentPurple }]}
              onPress={() => void runPick()}
            >
              <Text style={styles.actionBtnText}>Change image</Text>
            </Pressable>
            {hasImage ? (
              <Pressable
                style={[styles.actionBtnGhost, { borderColor: t.border }]}
                onPress={() => setMode("edit")}
              >
                <Text style={[styles.actionBtnGhostText, { color: t.text }]}>Edit image</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <ScrollView
              style={styles.editScroll}
              contentContainerStyle={styles.editScrollContent}
              maximumZoomScale={Platform.OS === "ios" ? 3 : 1}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {workingUri ? (
                <Image
                  source={{ uri: workingUri }}
                  style={[
                    styles.editImage,
                    {
                      transform: [{ rotate: `${rotation}deg` }, { scaleX: flipped ? -1 : 1 }]
                    }
                  ]}
                  resizeMode="contain"
                />
              ) : null}
            </ScrollView>
            <Text style={[styles.editHint, { color: t.textMuted }]}>
              Drag down or tap outside to close. Unsaved rotate, flip, or scale will be lost.
            </Text>
            <View style={styles.toolRow}>
              <ToolChip label="↺ 90°" onPress={() => setRotation((r) => (r + 90) % 360)} t={t} />
              <ToolChip label="Flip" onPress={() => setFlipped((f) => !f)} t={t} />
              <ToolChip label="−" onPress={() => setScalePct((s) => Math.max(80, s - 10))} t={t} />
              <ToolChip label={`${scalePct}%`} onPress={() => {}} t={t} />
              <ToolChip label="+" onPress={() => setScalePct((s) => Math.min(200, s + 10))} t={t} />
            </View>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: t.accentPurple, opacity: busy ? 0.6 : 1 }]}
              disabled={busy}
              onPress={() => void saveEdits()}
            >
              <Text style={styles.actionBtnText}>{busy ? "Saving…" : "Save changes"}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnGhost, { borderColor: t.border }]}
              onPress={() => {
                setRotation(0);
                setFlipped(false);
                setScalePct(100);
                setMode("view");
              }}
            >
              <Text style={[styles.actionBtnGhostText, { color: t.text }]}>Cancel edit</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => void runPick()}>
              <Text style={[styles.linkBtnText, { color: t.accentBlue }]}>Change image</Text>
            </Pressable>
          </>
        )}
      </FloatingCardModal>

      <BlurModalScrim
        visible={discardOpen}
        title="Discard changes?"
        body="Your photo edits or new image have not been saved. If you leave now, those changes will be lost."
        primaryLabel="Discard"
        primaryDanger
        onPrimary={() => {
          setDiscardOpen(false);
          setWorkingUri(baselineUriRef.current);
          setMode("view");
          setRotation(0);
          setFlipped(false);
          setScalePct(100);
          props.onClose();
        }}
        secondaryLabel="Keep editing"
        onSecondary={() => setDiscardOpen(false)}
      />
    </>
  );
}

function ToolChip(props: { label: string; onPress: () => void; t: ReturnType<typeof useAppTheme>["colors"] }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.toolChip, { backgroundColor: props.t.bgElevated, borderColor: props.t.border }]}
    >
      <Text style={[styles.toolChipText, { color: props.t.text }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  previewBox: {
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 14
  },
  previewImage: { width: "100%", height: "100%" },
  emptyHint: { fontSize: 15, fontWeight: "600" },
  actionBtn: { borderRadius: 999, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  actionBtnGhost: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8
  },
  actionBtnGhostText: { fontSize: 16, fontWeight: "700" },
  editScroll: { maxHeight: 260 },
  editScrollContent: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  editImage: { width: 220, height: 220 },
  editHint: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginBottom: 12, textAlign: "center" },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 14 },
  toolChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 52,
    alignItems: "center"
  },
  toolChipText: { fontSize: 14, fontWeight: "800" },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkBtnText: { fontSize: 15, fontWeight: "700" }
});
