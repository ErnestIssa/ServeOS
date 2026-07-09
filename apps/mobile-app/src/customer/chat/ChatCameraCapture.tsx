import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatTheme } from "./useChatTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSend: (uri: string) => void;
};

export function ChatCameraCapture({ visible, onClose, onSend }: Props) {
  const { tokens, colors: t } = useChatTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = React.useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const [flash, setFlash] = React.useState<"off" | "on">("off");
  const [previewUri, setPreviewUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setReady(false);
      setCapturing(false);
      setPreviewUri(null);
      return;
    }
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  async function capture() {
    if (!ready || capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === "android"
      });
      if (photo?.uri) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPreviewUri(photo.uri);
      }
    } catch {
      // Ignore — user can retry.
    } finally {
      setCapturing(false);
    }
  }

  function handleClose() {
    if (previewUri) {
      setPreviewUri(null);
      return;
    }
    onClose();
  }

  function handleSend() {
    if (!previewUri) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(previewUri);
  }

  if (!visible) return null;

  const denied = permission && !permission.granted && !permission.canAskAgain;
  const needsPermission = !permission?.granted;
  const previewing = Boolean(previewUri);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        {needsPermission ? (
          <View style={[styles.permission, { backgroundColor: t.bg }]}>
            <Text style={[styles.permissionTitle, { color: t.text }]}>
              {denied ? "Camera access denied" : "Camera access needed"}
            </Text>
            <Text style={[styles.permissionBody, { color: t.textMuted }]}>
              {denied
                ? "Enable camera access in system settings to take photos in chat."
                : "Allow camera access to take and send photos in chat."}
            </Text>
            {!denied ? (
              <Pressable
                onPress={() => void requestPermission()}
                accessibilityRole="button"
                accessibilityLabel="Allow camera"
                style={({ pressed }) => [
                  styles.permissionBtn,
                  { backgroundColor: tokens.brand },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.permissionBtnText, { color: tokens.mineText }]}>Allow camera</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close camera"
              style={({ pressed }) => [styles.permissionCancel, pressed && styles.pressed]}
            >
              <Text style={[styles.permissionCancelText, { color: t.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : previewing && previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

            <View
              pointerEvents="box-none"
              style={[styles.topBar, { paddingTop: insets.top + 8, paddingHorizontal: 16 }]}
            >
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Retake photo"
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: `${t.text}59` },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.iconBtnText, { color: t.bg }]}>↩</Text>
              </Pressable>
            </View>

            <View
              pointerEvents="box-none"
              style={[
                styles.previewActions,
                { paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }
              ]}
            >
              <Pressable
                onPress={handleSend}
                accessibilityRole="button"
                accessibilityLabel="Send photo"
                style={({ pressed }) => [
                  styles.sendBtn,
                  { backgroundColor: tokens.brand },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.sendText, { color: tokens.mineText }]}>↑</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash}
              mode="picture"
              active={visible && !previewing}
              onCameraReady={() => setReady(true)}
            />

            {!ready ? (
              <View style={[styles.loading, { backgroundColor: `${t.text}80` }]}>
                <ActivityIndicator color={tokens.mineText} size="large" />
              </View>
            ) : null}

            <View
              pointerEvents="box-none"
              style={[styles.topBar, { paddingTop: insets.top + 8, paddingHorizontal: 16 }]}
            >
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: `${t.text}59` },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.iconBtnText, { color: t.bg }]}>✕</Text>
              </Pressable>

              <Pressable
                onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
                accessibilityRole="button"
                accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: `${t.text}59` },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.iconBtnText, { color: flash === "on" ? tokens.brand : t.bg }]}>
                  {flash === "on" ? "⚡" : "⚡︎"}
                </Text>
              </Pressable>
            </View>

            <View
              pointerEvents="box-none"
              style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}
            >
              <Pressable
                onPress={() => void capture()}
                disabled={!ready || capturing}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                style={({ pressed }) => [
                  styles.shutterOuter,
                  { borderColor: t.bg },
                  (!ready || capturing) && styles.shutterDisabled,
                  pressed && ready && !capturing && styles.pressed
                ]}
              >
                <View style={[styles.shutterInner, { backgroundColor: t.bg }]} />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000"
  },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12
  },
  permissionTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  permissionBody: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  permissionBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12
  },
  permissionBtnText: { fontSize: 16, fontWeight: "800" },
  permissionCancel: { paddingVertical: 12, marginTop: 4 },
  permissionCancelText: { fontSize: 15, fontWeight: "700" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  iconBtnText: { fontSize: 18, fontWeight: "800" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center"
  },
  previewActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end"
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  sendText: { fontSize: 20, fontWeight: "900", marginTop: -2 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31
  },
  shutterDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.88 }
});
