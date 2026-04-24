import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, type AuthUser, authLogin, authSignup } from "../api";

const BG = "#8B5CF6";
const BG_DEEP = "#4C1D95";
const SCREEN_W = Dimensions.get("window").width;
const PAD = 24;

type Mode = "signin" | "signup";

type Props = {
  onAuthed: (p: { token: string; user: AuthUser }) => void;
};

export function AuthFlowScreen({ onAuthed }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView>(null);
  const [mode, setMode] = React.useState<Mode>("signin");
  const [page, setPage] = React.useState(0);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [role, setRole] = React.useState<"CUSTOMER" | "OWNER" | "STAFF">("CUSTOMER");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const signInPages = 2;
  const signUpPages = 3;

  const pageCount = mode === "signin" ? signInPages : signUpPages;

  React.useEffect(() => {
    setPage(0);
    setErr(null);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [mode]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / SCREEN_W));
  };

  const goToPage = (p: number) => {
    const next = Math.max(0, Math.min(p, pageCount - 1));
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    setPage(next);
  };

  function validateEmail() {
    const t = email.trim();
    if (!t) {
      setErr("Enter your email");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setErr("Enter a valid email");
      return false;
    }
    return true;
  }

  function validatePassword() {
    if (password.length < 8) {
      setErr("Password must be at least 8 characters");
      return false;
    }
    return true;
  }

  async function doSignIn() {
    setBusy(true);
    setErr(null);
    const res = await authLogin({ email: email.trim(), password });
    setBusy(false);
    if (!res.ok || !res.token || !res.user) {
      setErr(res.error ?? "sign_in_failed");
      return;
    }
    onAuthed({ token: res.token, user: res.user as AuthUser });
  }

  async function doSignUp() {
    if (password !== password2) {
      setErr("Passwords do not match");
      return;
    }
    if (!validatePassword()) return;
    setBusy(true);
    setErr(null);
    const res = await authSignup({ email: email.trim(), password, role });
    setBusy(false);
    if (!res.ok || !res.token || !res.user) {
      setErr(res.error ?? "sign_up_failed");
      return;
    }
    onAuthed({ token: res.token, user: res.user as AuthUser });
  }

  const nextLabel = () => {
    if (mode === "signin") {
      if (page === 0) return "Continue";
      return busy ? "Signing in…" : "Sign in";
    }
    if (page < 2) return "Continue";
    return busy ? "Creating account…" : "Create account";
  };

  const onPrimary = () => {
    setErr(null);
    if (mode === "signin") {
      if (page === 0) {
        if (!validateEmail()) return;
        goToPage(1);
        return;
      }
      if (!validatePassword()) return;
      void doSignIn();
      return;
    }
    if (page === 0) {
      goToPage(1);
      return;
    }
    if (page === 1) {
      if (!validateEmail()) return;
      goToPage(2);
      return;
    }
    if (!validatePassword() || password !== password2) {
      if (password !== password2) setErr("Passwords do not match");
      return;
    }
    void doSignUp();
  };

  const back = () => {
    setErr(null);
    if (page > 0) goToPage(page - 1);
  };

  return (
    <LinearGradient colors={[BG_DEEP, BG, "#1E1B4B"]} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={[styles.topPad, { paddingTop: Math.max(12, insets.top) }]}>
          <Text style={styles.brand} accessibilityRole="header">
            SERVEOS
          </Text>
          <Text style={styles.subBrand}>Account</Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {mode === "signin" ? (
            <>
              <View style={[styles.page, { width: SCREEN_W, paddingHorizontal: PAD }]}>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.caption}>Step 1 of 2 — your email</Text>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  placeholder="you@restaurant.com"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.page, { width: SCREEN_W, paddingHorizontal: PAD }]}>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.caption}>Step 2 of 2 — password</Text>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  secureTextEntry
                  textContentType="password"
                />
              </View>
            </>
          ) : (
            <>
              <View style={[styles.page, { width: SCREEN_W, paddingHorizontal: PAD }]}>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.caption}>Step 1 of 3 — how will you use ServeOS?</Text>
                <View style={styles.segRow}>
                  {(
                    [
                      { id: "CUSTOMER" as const, label: "Customer" },
                      { id: "OWNER" as const, label: "Owner" },
                      { id: "STAFF" as const, label: "Staff" }
                    ] as const
                  ).map((o) => (
                    <Pressable
                      key={o.id}
                      onPress={() => setRole(o.id)}
                      style={({ pressed }) => [styles.seg, role === o.id && styles.segOn, pressed && { opacity: 0.9 }]}
                    >
                      <Text style={[styles.segText, role === o.id && styles.segTextOn]}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.page, { width: SCREEN_W, paddingHorizontal: PAD }]}>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.caption}>Step 2 of 3 — your email</Text>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  placeholder="you@restaurant.com"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoCorrect={false}
                />
              </View>
              <View style={[styles.page, { width: SCREEN_W, paddingHorizontal: PAD }]}>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.caption}>Step 3 of 3 — choose a password</Text>
                <Text style={styles.label}>Password (8+ characters)</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  secureTextEntry
                  textContentType="newPassword"
                />
                <Text style={[styles.label, { marginTop: 14 }]}>Confirm password</Text>
                <TextInput
                  value={password2}
                  onChangeText={setPassword2}
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  secureTextEntry
                  textContentType="newPassword"
                />
              </View>
            </>
          )}
        </ScrollView>

        {err ? <Text style={styles.errText}>{err}</Text> : null}
        <Text style={styles.apiHint} numberOfLines={2}>
          API: {API_URL}
        </Text>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
          <View style={styles.modeRow}>
            <Pressable onPress={() => setMode("signin")} style={({ pressed }) => [styles.modeTab, mode === "signin" && styles.modeTabOn, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.modeText, mode === "signin" && styles.modeTextOn]}>Sign in</Text>
            </Pressable>
            <Pressable onPress={() => setMode("signup")} style={({ pressed }) => [styles.modeTab, mode === "signup" && styles.modeTabOn, pressed && { opacity: 0.9 }]}>
              <Text style={[styles.modeText, mode === "signup" && styles.modeTextOn]}>Create account</Text>
            </Pressable>
          </View>
          <View style={styles.btnRow}>
            {page > 0 ? (
              <Pressable onPress={back} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.9 }]} disabled={busy}>
                <Text style={styles.ghostText}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ width: 100 }} />
            )}
            <Pressable
              onPress={onPrimary}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.95 }, (busy) && { opacity: 0.7 }]}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#1E1B4B" /> : <Text style={styles.primaryText}>{nextLabel()}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topPad: { paddingHorizontal: PAD },
  brand: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2.4, textAlign: "center" },
  subBrand: { marginTop: 6, fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.75)", textAlign: "center" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)" },
  dotOn: { backgroundColor: "#FFFFFF", transform: [{ scale: 1.2 }] },
  page: { paddingTop: 8, paddingBottom: 12, justifyContent: "flex-start" },
  title: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  caption: { fontSize: 14, color: "rgba(255,255,255,0.78)", marginBottom: 18 },
  label: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.12)"
  },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  seg: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(0,0,0,0.1)"
  },
  segOn: { borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.18)" },
  segText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "700" },
  segTextOn: { color: "#FFFFFF" },
  errText: { color: "#FECACA", textAlign: "center", paddingHorizontal: PAD, fontSize: 14, fontWeight: "600" },
  apiHint: { textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.45)", paddingHorizontal: PAD, marginTop: 4 },
  bottomBar: { paddingHorizontal: PAD, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)" },
  modeRow: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 4, marginBottom: 12 },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modeTabOn: { backgroundColor: "rgba(255,255,255,0.2)" },
  modeText: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  modeTextOn: { color: "#FFFFFF" },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ghost: { paddingVertical: 12, paddingHorizontal: 4 },
  ghostText: { color: "rgba(255,255,255,0.88)", fontSize: 16, fontWeight: "600" },
  primary: {
    minWidth: 160,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center"
  },
  primaryText: { color: "#1E1B4B", fontSize: 16, fontWeight: "800" }
});
