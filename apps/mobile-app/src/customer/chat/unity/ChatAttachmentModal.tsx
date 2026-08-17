import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassChip } from "./GlassChip";
import { hapticLight, hapticSelection } from "./haptics";
import { PressableScale } from "./PressableScale";
import { spacing } from "./theme";

export type UnityAttachChoice = "photos" | "video" | "camera" | "file";

type Props = {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: UnityAttachChoice) => void;
};

const OPTIONS: Array<{
  id: UnityAttachChoice;
  icon: "images-outline" | "videocam-outline" | "camera-outline" | "document-outline";
  label: string;
}> = [
  { id: "photos", icon: "images-outline", label: "Photos" },
  { id: "video", icon: "videocam-outline", label: "Video" },
  { id: "camera", icon: "camera-outline", label: "Camera" },
  { id: "file", icon: "document-outline", label: "File" }
];

export function ChatAttachmentModal({ open, onClose, onChoose }: Props) {
  const handle = (id: UnityAttachChoice) => {
    hapticSelection();
    onClose();
    onChoose(id);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            hapticLight();
            onClose();
          }}
        >
          {Platform.OS === "ios" ? (
            <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
          )}
        </Pressable>

        <GlassChip style={styles.card} intensity={92}>
          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <PressableScale
                key={opt.id}
                style={styles.option}
                haptic="selection"
                onPress={() => handle(opt.id)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={opt.icon} size={20} color="#175F61" />
                </View>
                <Text style={styles.label}>{opt.label}</Text>
              </PressableScale>
            ))}
          </View>
        </GlassChip>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 120
  },
  androidDim: { backgroundColor: "rgba(0,0,0,0.25)" },
  card: {
    borderRadius: 18,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  options: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xs
  },
  option: {
    alignItems: "center",
    gap: 3,
    minWidth: 52
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(23,95,97,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111B21"
  }
});
