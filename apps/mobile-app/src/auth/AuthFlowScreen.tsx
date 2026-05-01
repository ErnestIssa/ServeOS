import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  UIManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Vibration,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AuthUser, authLogin, authSignup, lookupCompany } from "../api";
import { BlurView } from "expo-blur";
import { ThemedSwitch } from "../components/ThemedSwitch";
import { CountrySelect, type AllowedCountry } from "../components/CountrySelect";
import { CITIES, CitySelect } from "../components/CitySelect";

const BG = "#8B5CF6";
const BG_DEEP = "#4C1D95";
const PAD = 24;
/** Matches `authRoutes` signup Zod `phone.min(6)` when phone is sent. */
const MIN_WIZARD_PHONE_LEN = 6;
/** Dimmer ring track hues aligned with swapColor palette order (guest/business loaders). */
const LOADER_SWAP_DIM: readonly string[] = [
  "rgba(255,255,255,0.28)",
  "rgba(253,230,138,0.42)",
  "rgba(167,243,208,0.42)",
  "rgba(186,230,253,0.42)"
];
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

function normalizeCityFromRegistry(country: AllowedCountry, raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const canon = CITIES.find((c) => c.country === country && c.name.toLowerCase() === t.toLowerCase());
  if (canon) return canon.name;
  return t
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type Mode = "signin" | "signup";
type Experience = "GUEST" | "BUSINESS";
type WizardFlow = "GUEST" | "BUSINESS";

type Props = {
  onAuthed: (p: { token: string; user: AuthUser }) => void | Promise<void>;
};

type WizardSignupPayload = {
  email: string;
  password: string;
  role: "CUSTOMER" | "OWNER";
  phone?: string;
  registrationProfile: Record<string, unknown>;
};

function readableAuthFailure(message: string): string {
  const map: Record<string, string> = {
    user_already_exists: "An account with this email or phone already exists.",
    email_or_phone_required: "Email or phone is required.",
    sign_up_failed: "Could not create your account. Try again.",
    session_failed: "Could not verify your session. Try again.",
    failed_to_list_restaurants: "Could not load your venues. Try again.",
    failed_to_fetch_orders: "Could not load your orders. Try again.",
    missing_token: "Session expired. Sign in again."
  };
  const s = map[message];
  if (s) return s;
  const m = message.trim();
  if (/reach the API|reach the server|Network request failed|timed out|timeout|ECONNREFUSED|Failed to fetch|network/i.test(m)) {
    return "Couldn't reach the server. Check Wi-Fi, or wait 30–60s if the backend was asleep, then try again.";
  }
  return message;
}

// Sign-in rotating subtitle (based on this device's last known preference)
const GUEST_SIGNIN_SUBTITLES = ["Order smarter. Serve faster.", "Your table. Your time."] as const;
// Business sign-in subtitles must be short and single-line (no dotted/long sentences).
const BUSINESS_SIGNIN_SUBTITLES = ["Manage orders", "Run operations", "Grow your restaurant"] as const;

// Sign-up rotating phrase (based on selection in the dropdown)
const GUEST_SIGNUP_PHRASES = ["Order food, book tables, track orders, save favorites."] as const;
const BUSINESS_SIGNUP_PHRASES = ["Manage orders, run operations, grow your restaurant."] as const;

// Wizard rotating subtitles must have no dots (.)
const GUEST_WIZARD_PHRASES = ["Order faster", "Book tables", "Track every visit"] as const;
const BUSINESS_WIZARD_PHRASES = ["Manage orders", "Run operations", "Grow your restaurant"] as const;

function useRotatingPhrase(phrases: readonly string[], intervalMs = 3000) {
  const [idx, setIdx] = React.useState(0);
  const opacity = React.useRef(new Animated.Value(1)).current;
  const x = React.useRef(new Animated.Value(0)).current;
  const [cycle, setCycle] = React.useState(0);
  const [colorTick, setColorTick] = React.useState(0);
  const lastColorByPhrase = React.useRef<Record<string, number>>({}).current;
  const lastGlobalColor = React.useRef<number | null>(null);
  const key = React.useMemo(() => phrases.join("|"), [phrases]);

  React.useEffect(() => {
    setIdx(0);
    setCycle(0);
    setColorTick(0);
    opacity.setValue(1);
    x.setValue(0);
  }, [key, opacity, x]);

  React.useEffect(() => {
    if (phrases.length <= 1) return;
    const t = setInterval(() => {
      // slower swipe right->left + fade out -> swap -> swipe in from right + fade in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(x, { toValue: -22, duration: 320, useNativeDriver: true })
      ]).start(() => {
        setIdx((i) => (i + 1) % phrases.length);
        setCycle((c) => c + 1);
        setColorTick((t2) => t2 + 1);
        x.setValue(22);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(x, { toValue: 0, duration: 360, useNativeDriver: true })
        ]).start();
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [key, phrases.length, intervalMs, opacity, x]);

  const text = phrases[Math.max(0, Math.min(idx, phrases.length - 1))] ?? "";
  // Pick a color index so:
  // - the *same phrase* never repeats the same color consecutively
  // - no two consecutive swaps reuse the same color globally
  // Palette size is 4 (see swapColor below).
  const prev = lastColorByPhrase[text];
  const gPrev = lastGlobalColor.current;
  const candidates = [0, 1, 2, 3].filter((c) => c !== prev && c !== gPrev);
  const next =
    candidates.length > 0
      ? candidates[colorTick % candidates.length]
      : // fallback: still ensure "no consecutive colors"
        ((gPrev ?? 0) + 1) % 4;
  lastColorByPhrase[text] = next;
  lastGlobalColor.current = next;

  return { text, opacity, x, idx, cycle, colorIndex: next };
}

export function AuthFlowScreen({ onAuthed }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  /** Keeps Business Details scroll area between header/footer without hugging notch/home indicator edges. */
  const wizardBizDetailsScrollMaxH = React.useMemo(
    () => Math.max(260, Math.min(520, screenH - insets.top - insets.bottom - 296)),
    [screenH, insets.top, insets.bottom]
  );
  const signInEmailRef = React.useRef<TextInput>(null);
  const signInPasswordRef = React.useRef<TextInput>(null);

  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [signInShowPassword, setSignInShowPassword] = React.useState(false);
  const [experience, setExperience] = React.useState<Experience>("GUEST");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [emailErr, setEmailErr] = React.useState<string | null>(null);
  const [passwordErr, setPasswordErr] = React.useState<string | null>(null);
  const [signinBtnErr, setSigninBtnErr] = React.useState<string | null>(null);
  const emailShake = React.useRef(new Animated.Value(0)).current;
  const passwordShake = React.useRef(new Animated.Value(0)).current;
  const signinBtnShake = React.useRef(new Animated.Value(0)).current;
  const signinBtnErrTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailErrAnim = React.useRef(new Animated.Value(0)).current;
  const passwordErrAnim = React.useRef(new Animated.Value(0)).current;
  const emailErrResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordErrResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasSeenDevice, setHasSeenDevice] = React.useState(false);
  const [preferredExperience, setPreferredExperience] = React.useState<Experience | null>(null);
  const enterOpacity = React.useRef(new Animated.Value(0)).current;
  const enterY = React.useRef(new Animated.Value(14)).current;
  const modeOpacity = React.useRef(new Animated.Value(1)).current;
  const modeX = React.useRef(new Animated.Value(0)).current;

  // Signup wizard (only affects signup flow)
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardFlow, setWizardFlow] = React.useState<WizardFlow>("GUEST");
  const [wizardStep, setWizardStep] = React.useState(0);
  const [wizErr, setWizErr] = React.useState<string | null>(null);
  const [wizardBtnErr, setWizardBtnErr] = React.useState<string | null>(null);
  const wizardBtnShake = React.useRef(new Animated.Value(0)).current;
  const wizardBtnErrTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wizFieldErrs, setWizFieldErrs] = React.useState<Record<string, string | null>>({});
  const wizErrResetTimers = React.useRef<Record<string, ReturnType<typeof setTimeout> | null>>({}).current;
  const [wizConfirmStarted, setWizConfirmStarted] = React.useState(false);
  const [wizConfirmEditing, setWizConfirmEditing] = React.useState(false);
  const [wizConfirmMismatch, setWizConfirmMismatch] = React.useState<string | null>(null);
  const [wizShowPass, setWizShowPass] = React.useState(false);
  const [wizShowConfirmPass, setWizShowConfirmPass] = React.useState(false);
  const wizardFade = React.useRef(new Animated.Value(0)).current;
  const wizardY = React.useRef(new Animated.Value(18)).current;

  /** Final wizard step: sheet + blur fade, progress morphs → endless ring on gradient (no navigation into app yet). */
  const [wizardExitInfiniteLoader, setWizardExitInfiniteLoader] = React.useState(false);
  const [wizardExitInfiniteRing, setWizardExitInfiniteRing] = React.useState(false);
  const [wizardExitInfiniteBiz, setWizardExitInfiniteBiz] = React.useState(false);
  /** Shown on the fullscreen loader only; does not tear down the wizard animation. */
  const [wizardExitLoaderErr, setWizardExitLoaderErr] = React.useState<string | null>(null);
  const guestWizardChromeFade = React.useRef(new Animated.Value(1)).current;
  const guestBlurFade = React.useRef(new Animated.Value(1)).current;
  const guestMorphW = React.useRef(new Animated.Value(280)).current;
  const guestMorphH = React.useRef(new Animated.Value(8)).current;
  const guestMorphR = React.useRef(new Animated.Value(4)).current;
  const guestSpinRotate = React.useRef(new Animated.Value(0)).current;
  const wizardExitSpinLoopRef = React.useRef<{ stop(): void } | null>(null);
  const wizardExitInfiniteFlightRef = React.useRef(false);
  const wizardExitInfiniteLoaderShowingRef = React.useRef(false);
  const wizardExitPendingSignupRef = React.useRef<WizardSignupPayload | null>(null);
  const runWizardSignupFromLoaderRef = React.useRef<() => Promise<void>>(async () => undefined);
  const stopWizardExitSpinLoop = () => {
    (wizardExitSpinLoopRef as React.MutableRefObject<{ stop(): void } | null>).current?.stop();
    wizardExitSpinLoopRef.current = null;
  };

  const recoverWizardExitLoader = React.useCallback(() => {
    stopWizardExitSpinLoop();
    wizardExitInfiniteFlightRef.current = false;
    wizardExitPendingSignupRef.current = null;
    setWizardExitInfiniteLoader(false);
    setWizardExitInfiniteRing(false);
    setWizardExitLoaderErr(null);
    setBusy(false);
    guestWizardChromeFade.setValue(1);
    guestBlurFade.setValue(1);
    guestSpinRotate.setValue(0);
    const cardInnerWGuess = Math.min(520, screenW - PAD * 2) - 34;
    const w = Math.max(180, progressTrackWRef.current > 40 ? progressTrackWRef.current : cardInnerWGuess);
    guestMorphW.setValue(w);
    guestMorphH.setValue(8);
    guestMorphR.setValue(4);
    setWizardOpen(true);
    wizardFade.setValue(1);
    wizardY.setValue(0);
  }, [
    screenW,
    guestWizardChromeFade,
    guestBlurFade,
    guestSpinRotate,
    guestMorphW,
    guestMorphH,
    guestMorphR,
    wizardFade,
    wizardY
  ]);
  const progressTrackWRef = React.useRef(280);
  const guestSpinDeg = guestSpinRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  // Wizard form state (UI only; backend logic later)
  const [guestFirst, setGuestFirst] = React.useState("");
  const [guestLast, setGuestLast] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [guestLanguage, setGuestLanguage] = React.useState<"EN" | "SV">("EN");
  const [guestCity, setGuestCity] = React.useState("");
  const [guestOffers, setGuestOffers] = React.useState(true);

  const [bizName, setBizName] = React.useState("");
  const [bizContact, setBizContact] = React.useState("");
  const [bizPhone, setBizPhone] = React.useState("");
  const [guestCountry, setGuestCountry] = React.useState<AllowedCountry>("Sweden");
  const [bizCountry, setBizCountry] = React.useState<AllowedCountry>("Sweden");
  const [bizCity, setBizCity] = React.useState("");
  const [bizAddress, setBizAddress] = React.useState("");
  const [bizType, setBizType] = React.useState<"Restaurant" | "Cafe" | "Fast Food" | "Bakery" | "Ghost Kitchen" | "Other">("Restaurant");
  const [bizLocations, setBizLocations] = React.useState("1");
  const [bizMonthlyOrders, setBizMonthlyOrders] = React.useState("");
  const [bizNeedBookings, setBizNeedBookings] = React.useState(true);
  const [bizNeedDelivery, setBizNeedDelivery] = React.useState(true);
  const [bizCurrentSystem, setBizCurrentSystem] = React.useState("");
  const [bizOrgNumber, setBizOrgNumber] = React.useState("");
  const [bizAcceptTerms, setBizAcceptTerms] = React.useState(false);
  const [bizAuthorized, setBizAuthorized] = React.useState(false);
  const [bizLookupBusy, setBizLookupBusy] = React.useState(false);
  const [bizLookupMsg, setBizLookupMsg] = React.useState<string | null>(null);
  /** Set after verified org lookup; registry-sourced rows stay non-editable */
  const [bizCompanyFieldsLocked, setBizCompanyFieldsLocked] = React.useState(false);
  const [bizPostalLocked, setBizPostalLocked] = React.useState("");
  const [bizLegalFormLocked, setBizLegalFormLocked] = React.useState("");
  const [bizRegStatusLocked, setBizRegStatusLocked] = React.useState("");

  const wizAnim = React.useRef<Record<string, Animated.Value>>({
    guestFirst: new Animated.Value(0),
    guestLast: new Animated.Value(0),
    guestEmail: new Animated.Value(0),
    guestPhone: new Animated.Value(0),
    guestPassword: new Animated.Value(0),
    guestPassword2: new Animated.Value(0),
    guestCity: new Animated.Value(0),

    bizName: new Animated.Value(0),
    bizContact: new Animated.Value(0),
    bizEmail: new Animated.Value(0),
    bizPhone: new Animated.Value(0),
    bizCity: new Animated.Value(0),
    bizLocations: new Animated.Value(0),
    bizAddress: new Animated.Value(0),
    bizMonthlyOrders: new Animated.Value(0),
    bizCurrentSystem: new Animated.Value(0),
    bizPassword: new Animated.Value(0),
    bizPassword2: new Animated.Value(0),
    bizOrgNumber: new Animated.Value(0),
    bizAcceptTerms: new Animated.Value(0),
    bizAuthorized: new Animated.Value(0)
  }).current;

  const wizShake = React.useRef<Record<string, Animated.Value>>({
    guestFirst: new Animated.Value(0),
    guestLast: new Animated.Value(0),
    guestEmail: new Animated.Value(0),
    guestPhone: new Animated.Value(0),
    guestPassword: new Animated.Value(0),
    guestPassword2: new Animated.Value(0),
    guestCity: new Animated.Value(0),

    bizName: new Animated.Value(0),
    bizContact: new Animated.Value(0),
    bizEmail: new Animated.Value(0),
    bizPhone: new Animated.Value(0),
    bizCity: new Animated.Value(0),
    bizLocations: new Animated.Value(0),
    bizAddress: new Animated.Value(0),
    bizMonthlyOrders: new Animated.Value(0),
    bizCurrentSystem: new Animated.Value(0),
    bizPassword: new Animated.Value(0),
    bizPassword2: new Animated.Value(0),
    bizOrgNumber: new Animated.Value(0),
    bizAcceptTerms: new Animated.Value(0),
    bizAuthorized: new Animated.Value(0)
  }).current;

  const guestTotalSteps = 4;
  // Business steps:
  // 0 org number (optional) → 1 identity → 2 details → 3 address → 4 operations → 5 security → 6 finish
  const bizTotalSteps = 7;
  const totalSteps = wizardFlow === "BUSINESS" ? bizTotalSteps : guestTotalSteps;
  const progress = Math.max(0, Math.min(1, (wizardStep + 1) / totalSteps));

  const wizardStepRef = React.useRef(wizardStep);
  const wizardFlowRef = React.useRef(wizardFlow);
  const totalStepsRef = React.useRef(totalSteps);
  React.useEffect(() => {
    wizardStepRef.current = wizardStep;
  }, [wizardStep]);
  React.useEffect(() => {
    wizardFlowRef.current = wizardFlow;
  }, [wizardFlow]);
  React.useEffect(() => {
    totalStepsRef.current = totalSteps;
  }, [totalSteps]);

  React.useEffect(() => {
    wizardExitInfiniteLoaderShowingRef.current = wizardExitInfiniteLoader;
  }, [wizardExitInfiniteLoader]);

  const wizardPhrases = wizardFlow === "BUSINESS" ? (BUSINESS_WIZARD_PHRASES as readonly string[]) : (GUEST_WIZARD_PHRASES as readonly string[]);
  const wizardSwap = useRotatingPhrase(wizardPhrases, 3000);
  /** Full-screen endless loader uses its own rotation (same phrases + palette as signup wizard per flow). */
  const infiniteLoaderPhrases = React.useMemo((): readonly string[] => {
    if (!wizardExitInfiniteLoader) return [""];
    return wizardExitInfiniteBiz ? BUSINESS_WIZARD_PHRASES : GUEST_WIZARD_PHRASES;
  }, [wizardExitInfiniteLoader, wizardExitInfiniteBiz]);
  const infiniteLoaderSwap = useRotatingPhrase(infiniteLoaderPhrases, 3000);
  const wizardStepOpacity = React.useRef(new Animated.Value(1)).current;
  const wizardStepX = React.useRef(new Animated.Value(0)).current;
  const wizardShift = React.useRef(new Animated.Value(0)).current;
  const wizardShiftRef = React.useRef(0);
  const [kbHeight, setKbHeight] = React.useState(0);

  // Important: do NOT auto-focus any wizard field. Keyboard must stay closed
  // until the user taps an input.
  React.useEffect(() => {
    if (!wizardOpen) return;
    Keyboard.dismiss();
    wizardShiftRef.current = 0;
    wizardShift.setValue(0);
    setWizConfirmStarted(false);
    setWizConfirmEditing(false);
    setWizConfirmMismatch(null);
    setWizShowPass(false);
    setWizShowConfirmPass(false);
    // Don't clear confirm password on every step change; it breaks finish validation and forces users back.
  }, [wizardOpen, wizardFlow]);

  React.useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKbHeight(h);
    };
    const onHide = () => {
      setKbHeight(0);
      wizardShiftRef.current = 0;
      Animated.timing(wizardShift, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    };
    const subShow = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", onShow);
    const subHide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [wizardShift]);

  const ensureWizardFieldVisible = React.useCallback(
    (target: number) => {
      if (!wizardOpen) return;
      if (!kbHeight) return;
      // Measure the focused input in window coordinates.
      UIManager.measureInWindow(target, (_x, y, _w, h) => {
        const topSafe = Math.max(16, insets.top + 12);
        const bottomSafe = Math.max(16, insets.bottom + 12);
        const visibleTop = topSafe + 8;
        const visibleBottom = screenH - kbHeight - bottomSafe - 12;
        const inputTop = y;
        const inputBottom = y + h;

        let nextShift = wizardShiftRef.current;
        // If input is too low (under keyboard), shift up.
        if (inputBottom > visibleBottom) {
          nextShift += inputBottom - visibleBottom;
        }
        // If input is too high (pushed off top), shift down.
        if (inputTop < visibleTop) {
          nextShift -= visibleTop - inputTop;
        }
        // Clamp shift to keep it reasonable.
        nextShift = Math.max(0, Math.min(260, Math.round(nextShift)));
        if (nextShift === wizardShiftRef.current) return;
        wizardShiftRef.current = nextShift;
        Animated.timing(wizardShift, { toValue: nextShift, duration: 220, useNativeDriver: true }).start();
      });
    },
    [wizardOpen, kbHeight, insets.top, insets.bottom, screenH, wizardShift]
  );

  const onWizardFocus = React.useCallback(
    (e: any) => {
      const target = e?.nativeEvent?.target;
      if (typeof target !== "number") return;
      // run after keyboard is actually up
      setTimeout(() => ensureWizardFieldVisible(target), 80);
    },
    [ensureWizardFieldVisible]
  );

  const openWizard = (flow: WizardFlow) => {
    void Haptics.selectionAsync();
    stopWizardExitSpinLoop();
    wizardExitInfiniteFlightRef.current = false;
    wizardExitPendingSignupRef.current = null;
    setWizardExitLoaderErr(null);
    setWizardExitInfiniteLoader(false);
    setWizardExitInfiniteRing(false);
    setWizardExitInfiniteBiz(false);
    guestWizardChromeFade.setValue(1);
    guestBlurFade.setValue(1);
    guestSpinRotate.setValue(0);
    setWizardFlow(flow);
    setWizardStep(0);
    setWizErr(null);
    setWizardBtnErr(null);
    setWizConfirmStarted(false);
    setWizConfirmEditing(false);
    setWizConfirmMismatch(null);
    setWizShowPass(false);
    setWizShowConfirmPass(false);
    setBizLookupMsg(null);
    setBizLookupBusy(false);
    setBizCompanyFieldsLocked(false);
    setBizPostalLocked("");
    setBizLegalFormLocked("");
    setBizRegStatusLocked("");
    if (flow === "BUSINESS") {
      setBizOrgNumber("");
      setBizName("");
      setBizContact("");
      setBizPhone("");
      setBizCountry("Sweden");
      setBizCity("");
      setBizAddress("");
      setBizLocations("1");
      setBizMonthlyOrders("");
      setBizCurrentSystem("");
      setBizAcceptTerms(false);
      setBizAuthorized(false);
      setPassword("");
    }
    setPassword2("");
    setWizardOpen(true);
    wizardFade.setValue(0);
    wizardY.setValue(18);
    Animated.parallel([
      Animated.timing(wizardFade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(wizardY, { toValue: 0, duration: 360, useNativeDriver: true })
    ]).start();
  };

  const closeWizard = () => {
    void Haptics.selectionAsync();
    Animated.parallel([
      Animated.timing(wizardFade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(wizardY, { toValue: 14, duration: 240, useNativeDriver: true })
    ]).start(() => {
      setWizardOpen(false);
      setWizErr(null);
    });
  };

  const triggerWizardInfiniteExitLoader = React.useCallback(
    (businessAccent: boolean, signupPayload: WizardSignupPayload) => {
      if (wizardExitInfiniteFlightRef.current) {
        if (!wizardExitInfiniteLoaderShowingRef.current) {
          wizardExitInfiniteFlightRef.current = false;
        } else {
          if (!wizardExitLoaderErr) {
            setWizardExitLoaderErr("Hang on — we're still creating your account.");
          }
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
      }
      wizardExitPendingSignupRef.current = signupPayload;
      wizardExitInfiniteFlightRef.current = true;
      setBusy(true);
      Keyboard.dismiss();
      void Haptics.selectionAsync();

      setWizardExitInfiniteBiz(businessAccent);
      setWizardExitLoaderErr(null);

      const cardInnerWGuess = Math.min(520, screenW - PAD * 2) - 34;
      const initialW = Math.max(180, progressTrackWRef.current > 40 ? progressTrackWRef.current : cardInnerWGuess);

      guestMorphW.setValue(initialW);
      guestMorphH.setValue(8);
      guestMorphR.setValue(4);
      guestWizardChromeFade.setValue(1);
      guestBlurFade.setValue(1);
      guestSpinRotate.setValue(0);
      stopWizardExitSpinLoop();

      setWizardExitInfiniteRing(false);
      setWizardExitInfiniteLoader(true);

      Animated.parallel([
        Animated.timing(guestWizardChromeFade, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(guestBlurFade, { toValue: 0, duration: 260, useNativeDriver: true })
      ]).start();

      Animated.parallel([
        Animated.timing(guestMorphW, { toValue: 52, duration: 460, delay: 40, useNativeDriver: false }),
        Animated.timing(guestMorphH, { toValue: 52, duration: 460, delay: 40, useNativeDriver: false }),
        Animated.timing(guestMorphR, { toValue: 26, duration: 460, delay: 40, useNativeDriver: false })
      ]).start(({ finished }) => {
        if (!finished) return;
        setWizardExitInfiniteRing(true);
        setTimeout(() => {
          guestSpinRotate.setValue(0);
          stopWizardExitSpinLoop();
          const spinLoop = Animated.loop(
            Animated.timing(guestSpinRotate, {
              toValue: 1,
              duration: 720,
              easing: Easing.linear,
              useNativeDriver: true
            }),
            { resetBeforeIteration: true }
          );
          wizardExitSpinLoopRef.current = spinLoop as unknown as { stop(): void };
          spinLoop.start();
        }, 40);
      });

      setTimeout(() => setWizardOpen(false), 240);

      void runWizardSignupFromLoaderRef.current();
    },
    [screenW, wizardExitLoaderErr]
  );

  React.useEffect(() => {
    return () => {
      stopWizardExitSpinLoop();
    };
  }, []);

  const wizardBack = () => {
    void Haptics.selectionAsync();
    setWizErr(null);
    const dir = -1;
    Animated.parallel([
      Animated.timing(wizardStepOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(wizardStepX, { toValue: 22 * dir, duration: 220, useNativeDriver: true })
    ]).start(() => {
      wizardStepOpacity.setValue(0);
      wizardStepX.setValue(-22 * dir);
      setWizardStep((s) => {
        const next = Math.max(0, s - 1);
        if (wizardFlowRef.current === "BUSINESS" && next === 0) {
          setBizCompanyFieldsLocked(false);
          setBizPostalLocked("");
          setBizLegalFormLocked("");
          setBizRegStatusLocked("");
          setBizName("");
          setBizAddress("");
          setBizCity("");
          setBizCountry("Sweden");
        }
        return next;
      });
      Animated.parallel([
        Animated.timing(wizardStepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(wizardStepX, { toValue: 0, duration: 260, useNativeDriver: true })
      ]).start();
    });
  };

  const runWizardStepForward = React.useCallback(() => {
    const s = wizardStepRef.current;
    const max = totalStepsRef.current;
    if (s >= max - 1) return;
    const dir = 1;
    Animated.parallel([
      Animated.timing(wizardStepOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(wizardStepX, { toValue: -22 * dir, duration: 220, useNativeDriver: true })
    ]).start(() => {
      wizardStepOpacity.setValue(0);
      wizardStepX.setValue(22 * dir);
      setWizardStep((prev) => Math.min(max - 1, prev + 1));
      Animated.parallel([
        Animated.timing(wizardStepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(wizardStepX, { toValue: 0, duration: 260, useNativeDriver: true })
      ]).start();
    });
  }, [wizardStepOpacity, wizardStepX]);

  const wizardNext = () => {
    void Haptics.selectionAsync();
    setWizErr(null);

    // Finish: re-check every prior step; if something drifted, jump back to that step (no mystery errors on the last screen).
    if (wizardStep >= totalSteps - 1) {
      const fin = wizardFlow === "GUEST" ? evaluateGuestSignupForFinish() : evaluateBusinessSignupForFinish();
      if (!fin.ok) {
        errorBuzz();
        setWizardStep(fin.stepIndex);
        wizardStepOpacity.setValue(1);
        wizardStepX.setValue(0);
        setWizErr(fin.message);
        showWizardBtnError(fin.message);
        fin.missing.forEach(setWizFieldErrorOn);
        shake(wizardBtnShake, 1);
        return;
      }
      triggerWizardInfiniteExitLoader(wizardFlow === "BUSINESS", fin.payload);
      return;
    }

    if (wizardFlow === "BUSINESS" && wizardStep === 0) {
      return;
    }

    if (wizardFlow === "GUEST") {
      const b = guestWizardStepValidation(wizardStep);
      if (b.missing.length > 0) {
        errorBuzz();
        showWizardBtnError(b.msg ?? "Fill required fields");
        b.missing.forEach(setWizFieldErrorOn);
        return;
      }
    } else if (wizardStep >= 1 && wizardStep <= 5) {
      const b = businessWizardStepValidation(wizardStep);
      if (b.missing.length > 0) {
        errorBuzz();
        showWizardBtnError(b.msg ?? "Fill required fields");
        b.missing.forEach(setWizFieldErrorOn);
        return;
      }
    }

    runWizardStepForward();
  };

  // Always rotate on sign-in. If we don't know the role yet, default to Guest.
  const signinPhrases: readonly string[] =
    (preferredExperience ?? "GUEST") === "BUSINESS"
      ? (["Welcome to ServeOS", ...BUSINESS_SIGNIN_SUBTITLES] as const)
      : (["Welcome to ServeOS", ...GUEST_SIGNIN_SUBTITLES] as const);

  const signinSwap = useRotatingPhrase(signinPhrases, 3000);

  // Login page rotation palette: 4 colors max.
  const swapColor = (i: number) =>
    i % 4 === 0 ? "#FFFFFF" : i % 4 === 1 ? "#FDE68A" : i % 4 === 2 ? "#A7F3D0" : "#BAE6FD";

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem("serveos.device.seen");
        const pref = await AsyncStorage.getItem("serveos.device.preferredExperience");
        if (cancelled) return;
        setHasSeenDevice(seen === "1");
        if (pref === "GUEST" || pref === "BUSINESS") setPreferredExperience(pref);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    setErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    setSigninBtnErr(null);
    setSignInShowPassword(false);
    Keyboard.dismiss();
  }, [mode]);

  React.useEffect(() => {
    Keyboard.dismiss();
  }, []);

  React.useEffect(() => {
    enterOpacity.setValue(0);
    enterY.setValue(14);
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(enterY, { toValue: 0, duration: 620, useNativeDriver: true })
    ]).start();
  }, [enterOpacity, enterY]);

  React.useEffect(() => {
    return () => {
      if (signinBtnErrTimer.current) clearTimeout(signinBtnErrTimer.current);
      if (emailErrResetTimer.current) clearTimeout(emailErrResetTimer.current);
      if (passwordErrResetTimer.current) clearTimeout(passwordErrResetTimer.current);
      if (wizardBtnErrTimer.current) clearTimeout(wizardBtnErrTimer.current);
    };
  }, []);

  const animateFieldError = (which: "email" | "password", on: boolean) => {
    const v = which === "email" ? emailErrAnim : passwordErrAnim;
    Animated.timing(v, { toValue: on ? 1 : 0, duration: 260, useNativeDriver: false }).start();
  };

  const scheduleAutoClearError = (which: "email" | "password") => {
    const ref = which === "email" ? emailErrResetTimer : passwordErrResetTimer;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => {
      if (which === "email") setEmailErr(null);
      else setPasswordErr(null);
      animateFieldError(which, false);
    }, 3000);
  };

  const clearAllFieldErrors = () => {
    setErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    setSigninBtnErr(null);
    animateFieldError("email", false);
    animateFieldError("password", false);
    if (emailErrResetTimer.current) clearTimeout(emailErrResetTimer.current);
    if (passwordErrResetTimer.current) clearTimeout(passwordErrResetTimer.current);
  };

  const shake = (v: Animated.Value, times = 1) => {
    const seq: Animated.CompositeAnimation[] = [];
    const pushes = times * 2;
    for (let i = 0; i < pushes; i++) {
      seq.push(Animated.timing(v, { toValue: i % 2 === 0 ? 1 : -1, duration: 45, useNativeDriver: true }));
    }
    seq.push(Animated.timing(v, { toValue: 0, duration: 45, useNativeDriver: true }));
    Animated.sequence(seq).start();
  };

  const errorBuzz = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate(80);
  };

  const dismissWizardExitToEditDetails = React.useCallback(() => {
    void Haptics.selectionAsync();
    recoverWizardExitLoader();
  }, [recoverWizardExitLoader]);

  React.useEffect(() => {
    runWizardSignupFromLoaderRef.current = async () => {
      const pending = wizardExitPendingSignupRef.current;
      if (!pending) return;
      setWizardExitLoaderErr(null);
      wizardExitInfiniteFlightRef.current = true;
      setBusy(true);
      try {
        const res = await authSignup({
          email: pending.email,
          password: pending.password,
          role: pending.role,
          phone: pending.phone,
          registrationProfile: pending.registrationProfile
        });
        if (!res.ok || !res.token || !res.user) {
          throw new Error(res.error ?? "sign_up_failed");
        }
        await Promise.resolve(onAuthed({ token: res.token, user: res.user as AuthUser }));
        wizardExitPendingSignupRef.current = null;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        setWizardExitLoaderErr(readableAuthFailure(raw));
        errorBuzz();
        wizardExitInfiniteFlightRef.current = false;
      } finally {
        setBusy(false);
      }
    };
  }, [onAuthed]);

  const animateWizFieldError = React.useCallback(
    (key: string, on: boolean) => {
      const v = wizAnim[key];
      if (!v) return;
      Animated.timing(v, { toValue: on ? 1 : 0, duration: 260, useNativeDriver: false }).start();
    },
    [wizAnim]
  );

  const clearWizFieldError = React.useCallback(
    (key: string) => {
      const t = wizErrResetTimers[key];
      if (t) clearTimeout(t);
      wizErrResetTimers[key] = null;
      setWizFieldErrs((m) => {
        if (!m[key]) return m;
        return { ...m, [key]: null };
      });
      animateWizFieldError(key, false);
    },
    [animateWizFieldError]
  );

  const scheduleAutoClearWizFieldError = React.useCallback(
    (key: string) => {
      const t = wizErrResetTimers[key];
      if (t) clearTimeout(t);
      wizErrResetTimers[key] = setTimeout(() => {
        setWizFieldErrs((m) => {
          if (!m[key]) return m;
          return { ...m, [key]: null };
        });
        animateWizFieldError(key, false);
        wizErrResetTimers[key] = null;
      }, 3000);
    },
    [animateWizFieldError, wizErrResetTimers]
  );

  const setWizFieldErrorOn = React.useCallback(
    (key: string) => {
      setWizFieldErrs((m) => ({ ...m, [key]: "1" }));
      animateWizFieldError(key, true);
      const sh = wizShake[key];
      if (sh) shake(sh, 1);
      scheduleAutoClearWizFieldError(key);
    },
    [animateWizFieldError, scheduleAutoClearWizFieldError, shake, wizShake]
  );

  const setWizFieldErrorSoft = React.useCallback(
    (key: string, on: boolean) => {
      if (on) {
        setWizFieldErrs((m) => ({ ...m, [key]: "1" }));
        animateWizFieldError(key, true);
      } else {
        clearWizFieldError(key);
      }
    },
    [animateWizFieldError, clearWizFieldError]
  );

  const showWizardBtnError = React.useCallback(
    (msg: string) => {
      setWizardBtnErr(msg);
      if (wizardBtnErrTimer.current) clearTimeout(wizardBtnErrTimer.current);
      wizardBtnErrTimer.current = setTimeout(() => setWizardBtnErr(null), 1600);
      shake(wizardBtnShake, 2);
    },
    [wizardBtnShake]
  );

  const handleBusinessOrgStepContinue = React.useCallback(async () => {
    void Haptics.selectionAsync();
    setWizErr(null);
    setWizardBtnErr(null);
    setBizLookupMsg(null);
    const t = bizOrgNumber.trim();
    if (!t) {
      errorBuzz();
      showWizardBtnError("Enter organization number");
      setWizFieldErrorOn("bizOrgNumber");
      return;
    }
    setBizLookupBusy(true);
    try {
      const res = await lookupCompany(t);
      if (res.success && res.found && res.data?.companyName?.trim()) {
        const cityRaw = res.data.city?.trim();
        if (!cityRaw) {
          errorBuzz();
          setBizLookupMsg("We couldn't find full company records. Try another organization number.");
          showWizardBtnError("Incomplete registry data");
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBizName(res.data.companyName.trim());
        setBizAddress((res.data.address ?? "").trim());
        setBizCity(normalizeCityFromRegistry("Sweden", cityRaw));
        setBizCountry("Sweden");
        setBizPostalLocked((res.data.postalCode ?? "").trim());
        setBizLegalFormLocked((res.data.legalForm ?? "").trim());
        setBizRegStatusLocked((res.data.status ?? "").trim());
        setBizCompanyFieldsLocked(true);
        clearWizFieldError("bizOrgNumber");
        runWizardStepForward();
        return;
      }
      errorBuzz();
      setBizLookupMsg("We couldn't find your company.");
      showWizardBtnError("Company not found");
      setWizFieldErrorOn("bizOrgNumber");
    } catch {
      errorBuzz();
      setBizLookupMsg("We couldn't find your company.");
      showWizardBtnError("Lookup failed");
      setWizFieldErrorOn("bizOrgNumber");
    } finally {
      setBizLookupBusy(false);
    }
  }, [bizOrgNumber, clearWizFieldError, runWizardStepForward, setWizFieldErrorOn, showWizardBtnError]);

  const wizBorderColor = React.useCallback(
    (key: string) =>
      (wizAnim[key] ?? new Animated.Value(0)).interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255,255,255,0.20)", "rgba(239,68,68,0.95)"]
      }),
    [wizAnim]
  );

  const wizBgColor = React.useCallback(
    (key: string) =>
      (wizAnim[key] ?? new Animated.Value(0)).interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(0,0,0,0.22)", "rgba(239,68,68,0.12)"]
      }),
    [wizAnim]
  );

  const isValidEmail = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);

  const strongPasswordIssue = (p: string): string | null => {
    const t = p ?? "";
    if (t.length < 8) return "At least 8 characters";
    if (!/[a-z]/.test(t)) return "Add a lowercase letter";
    if (!/[A-Z]/.test(t)) return "Add an uppercase letter";
    if (!/\d/.test(t)) return "Add a number";
    return null;
  };

  function guestWizardStepValidation(stepIndex: number): { missing: string[]; msg: string | null } {
    const emailT = email.trim();
    const missing: string[] = [];
    let msg: string | null = null;
    const passT = password;
    const pass2T = password2;

    if (stepIndex === 0) {
      if (!guestFirst.trim()) missing.push("guestFirst");
      if (!guestLast.trim()) missing.push("guestLast");
      if (!emailT) missing.push("guestEmail");
      else if (!isValidEmail(emailT)) {
        missing.push("guestEmail");
        msg = "Enter a valid email";
      }
      const ph = guestPhone.trim();
      if (!ph) missing.push("guestPhone");
      else if (ph.length < MIN_WIZARD_PHONE_LEN) {
        missing.push("guestPhone");
        msg = msg ?? `Phone needs at least ${MIN_WIZARD_PHONE_LEN} characters`;
      }
      return { missing, msg };
    }
    if (stepIndex === 1) {
      const issue = strongPasswordIssue(passT);
      if (issue) {
        missing.push("guestPassword");
        msg = issue;
      }
      if (!pass2T.trim()) {
        missing.push("guestPassword2");
        if (!msg) msg = "Confirm your password";
      } else if (passT !== pass2T) {
        missing.push("guestPassword2");
        msg = "Passwords do not match";
      }
      return { missing, msg };
    }
    if (stepIndex === 2) {
      if (!guestCity.trim()) {
        missing.push("guestCity");
        msg = "Select city";
      }
      return { missing, msg };
    }
    return { missing: [], msg: null };
  }

  function businessWizardStepValidation(stepIndex: number): { missing: string[]; msg: string | null } {
    const emailT = email.trim();
    const missing: string[] = [];
    let msg: string | null = null;
    const passT = password;
    const pass2T = password2;
    const intOk = (v: string) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 && Number.isInteger(n);
    };

    if (stepIndex === 1) {
      if (!bizName.trim()) missing.push("bizName");
      if (!bizContact.trim()) missing.push("bizContact");
      if (!emailT) missing.push("bizEmail");
      else if (!isValidEmail(emailT)) {
        missing.push("bizEmail");
        msg = "Enter a valid email";
      }
      const ph = bizPhone.trim();
      if (!ph) missing.push("bizPhone");
      else if (ph.length < MIN_WIZARD_PHONE_LEN) {
        missing.push("bizPhone");
        msg = msg ?? `Phone needs at least ${MIN_WIZARD_PHONE_LEN} characters`;
      }
      return { missing, msg };
    }
    if (stepIndex === 2) {
      if (!bizCity.trim()) {
        missing.push("bizCity");
        msg = "Select city";
      }
      if (!bizLocations.trim() || !intOk(bizLocations.trim())) {
        missing.push("bizLocations");
        if (!msg) msg = "Enter locations";
      }
      return { missing, msg };
    }
    if (stepIndex === 3) {
      if (!bizCompanyFieldsLocked && !bizAddress.trim()) missing.push("bizAddress");
      return { missing, msg };
    }
    if (stepIndex === 4) {
      if (!bizMonthlyOrders.trim() || !intOk(bizMonthlyOrders.trim())) {
        missing.push("bizMonthlyOrders");
        if (!msg) msg = "Enter monthly orders";
      }
      if (!bizCurrentSystem.trim()) missing.push("bizCurrentSystem");
      return { missing, msg };
    }
    if (stepIndex === 5) {
      const issue = strongPasswordIssue(passT);
      if (issue) {
        missing.push("bizPassword");
        msg = issue;
      }
      if (!pass2T.trim()) missing.push("bizPassword2");
      else if (passT !== pass2T) {
        missing.push("bizPassword2");
        msg = "Passwords do not match";
      }
      if (!bizAcceptTerms) missing.push("bizAcceptTerms");
      if (!bizAuthorized) missing.push("bizAuthorized");
      return { missing, msg };
    }
    return { missing: [], msg: null };
  }

  function evaluateGuestSignupForFinish():
    | { ok: true; payload: WizardSignupPayload }
    | { ok: false; stepIndex: number; message: string; missing: string[] } {
    for (let s = 0; s <= 2; s++) {
      const b = guestWizardStepValidation(s);
      if (b.missing.length > 0) {
        return { ok: false, stepIndex: s, message: b.msg ?? "Fill required fields", missing: b.missing };
      }
    }
    return {
      ok: true,
      payload: {
        email: email.trim(),
        password,
        role: "CUSTOMER",
        phone: guestPhone.trim(),
        registrationProfile: {
          wizardVersion: 1,
          flow: "GUEST",
          firstName: guestFirst.trim(),
          lastName: guestLast.trim(),
          phone: guestPhone.trim(),
          language: guestLanguage,
          city: normalizeCityFromRegistry(guestCountry, guestCity),
          country: guestCountry,
          offersConsent: guestOffers
        }
      }
    };
  }

  function evaluateBusinessSignupForFinish():
    | { ok: true; payload: WizardSignupPayload }
    | { ok: false; stepIndex: number; message: string; missing: string[] } {
    for (let s = 1; s <= 5; s++) {
      const b = businessWizardStepValidation(s);
      if (b.missing.length > 0) {
        return { ok: false, stepIndex: s, message: b.msg ?? "Fill required fields", missing: b.missing };
      }
    }
    return {
      ok: true,
      payload: {
        email: email.trim(),
        password,
        role: "OWNER",
        phone: bizPhone.trim(),
        registrationProfile: {
          wizardVersion: 1,
          flow: "BUSINESS",
          orgNumber: bizOrgNumber.trim(),
          companyName: bizName.trim(),
          contactPerson: bizContact.trim(),
          phone: bizPhone.trim(),
          country: bizCountry,
          city: normalizeCityFromRegistry(bizCountry, bizCity),
          address: bizAddress.trim(),
          locationsCount: bizLocations.trim(),
          businessType: bizType,
          monthlyOrdersEstimate: bizMonthlyOrders.trim(),
          wantsBookings: bizNeedBookings,
          wantsDelivery: bizNeedDelivery,
          currentSystem: bizCurrentSystem.trim(),
          postalCodeFromRegistry: bizPostalLocked || undefined,
          legalFormFromRegistry: bizLegalFormLocked || undefined,
          registrationStatusFromRegistry: bizRegStatusLocked || undefined,
          companyLookupLocked: bizCompanyFieldsLocked
        }
      }
    };
  }

  function validateEmail() {
    const t = email.trim();
    if (!t) {
      setEmailErr("Enter your email");
      animateFieldError("email", true);
      scheduleAutoClearError("email");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      setEmailErr("Enter a valid email");
      animateFieldError("email", true);
      scheduleAutoClearError("email");
      return false;
    }
    return true;
  }

  function validatePassword() {
    if (!password.trim()) {
      setPasswordErr("Enter your password");
      animateFieldError("password", true);
      scheduleAutoClearError("password");
      return false;
    }
    if (password.length < 8) {
      setPasswordErr("Password too short");
      animateFieldError("password", true);
      scheduleAutoClearError("password");
      return false;
    }
    return true;
  }

  async function doSignIn() {
    setBusy(true);
    setErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    setSigninBtnErr(null);
    try {
      const res = await authLogin({ email: email.trim(), password });
      if (!res.ok || !res.token || !res.user) {
        const code = res.error ?? "sign_in_failed";
        if (code === "invalid_credentials") {
          setPasswordErr("Email or password is incorrect");
          setEmailErr(" ");
          animateFieldError("email", true);
          animateFieldError("password", true);
          scheduleAutoClearError("email");
          scheduleAutoClearError("password");
          errorBuzz();
          shake(emailShake, 2);
          shake(passwordShake, 2);
          shake(signinBtnShake, 2);
          setSigninBtnErr("Wrong details");
          if (signinBtnErrTimer.current) clearTimeout(signinBtnErrTimer.current);
          signinBtnErrTimer.current = setTimeout(() => setSigninBtnErr(null), 1600);
          return;
        }
        if (code === "email_or_phone_required") {
          setEmailErr("Enter your email");
          animateFieldError("email", true);
          scheduleAutoClearError("email");
          errorBuzz();
          shake(emailShake, 1);
          return;
        }
        setErr(readableAuthFailure(code));
        errorBuzz();
        return;
      }
      const pref: Experience = res.user.role === "OWNER" || res.user.role === "STAFF" ? "BUSINESS" : "GUEST";
      setPreferredExperience(pref);
      setHasSeenDevice(true);
      void AsyncStorage.setItem("serveos.device.seen", "1");
      void AsyncStorage.setItem("serveos.device.preferredExperience", pref);
      await Promise.resolve(onAuthed({ token: res.token, user: res.user as AuthUser }));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErr(readableAuthFailure(raw));
      errorBuzz();
    } finally {
      setBusy(false);
    }
  }

  async function doSignUp() {
    if (password !== password2) {
      setErr("Passwords do not match");
      return;
    }
    if (!validatePassword()) return;
    setBusy(true);
    setErr(null);
    try {
      const role = experience === "BUSINESS" ? "OWNER" : "CUSTOMER";
      const res = await authSignup({ email: email.trim(), password, role });
      if (!res.ok || !res.token || !res.user) {
        setErr(readableAuthFailure(res.error ?? "sign_up_failed"));
        errorBuzz();
        return;
      }
      await Promise.resolve(onAuthed({ token: res.token, user: res.user as AuthUser }));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErr(readableAuthFailure(raw));
      errorBuzz();
    } finally {
      setBusy(false);
    }
  }

  const focusRefSoon = (r: React.RefObject<TextInput | null>) => {
    setTimeout(() => {
      r.current?.focus();
    }, 120);
  };

  const onSubmitSignInPassword = () => {
    setErr(null);
    setEmailErr(null);
    setPasswordErr(null);
    if (!validateEmail()) return;
    if (!validatePassword()) return;
    Keyboard.dismiss();
    void doSignIn();
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    void Haptics.selectionAsync();
    setErr(null);
    // Smooth, styled transition between sign-in and sign-up.
    const dir = m === "signup" ? 1 : -1;
    Animated.parallel([
      Animated.timing(modeOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(modeX, { toValue: -18 * dir, duration: 260, useNativeDriver: true })
    ]).start(() => {
      modeOpacity.setValue(0);
      modeX.setValue(18 * dir);
      setMode(m);
      Animated.parallel([
        Animated.timing(modeOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(modeX, { toValue: 0, duration: 360, useNativeDriver: true })
      ]).start();
    });
  };

  const pickExperience = (e: Experience) => {
    void Haptics.selectionAsync();
    setExperience(e);
    setPreferredExperience(e);
    setHasSeenDevice(true);
    void AsyncStorage.setItem("serveos.device.seen", "1");
    void AsyncStorage.setItem("serveos.device.preferredExperience", e);
  };

  return (
    <LinearGradient colors={[BG_DEEP, BG, "#1E1B4B"]} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={styles.root}>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          clearAllFieldErrors();
        }}
        accessible={false}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <Animated.View
            style={[
              styles.full,
              { paddingTop: Math.max(16, insets.top + 6), paddingBottom: Math.max(16, insets.bottom + 6) },
              { opacity: enterOpacity, transform: [{ translateY: enterY }] }
            ]}
          >
          {mode === "signin" ? (
            <View style={styles.phraseWrap}>
              <Animated.Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.phraseBig,
                  {
                    opacity: signinSwap.opacity,
                    transform: [{ translateX: signinSwap.x }],
                    color: swapColor(signinSwap.colorIndex)
                  }
                ]}
              >
                {signinSwap.text}
              </Animated.Text>
            </View>
          ) : null}

          <Animated.View
            style={{
              width: Math.min(520, screenW - PAD * 2),
              opacity: modeOpacity,
              transform: [{ translateX: modeX }],
              ...(mode === "signup" ? { flex: 1, alignSelf: "stretch" } : null)
            }}
          >
            {mode === "signin" ? (
              <View style={[styles.modal, { width: "100%" }]}>
                {err ? <Text style={styles.errText}>{err}</Text> : null}
                <Text style={styles.modalTitle}>Sign in</Text>
                <Text style={styles.label}>Email</Text>
                <Animated.View style={{ transform: [{ translateX: emailShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
                  <AnimatedTextInput
                    ref={signInEmailRef}
                    value={email}
                    onChangeText={(t) => {
                      if (busy) return;
                      setEmail(t);
                      if (emailErr) {
                        setEmailErr(null);
                        animateFieldError("email", false);
                      }
                      if (err) setErr(null);
                    }}
                    style={[
                      styles.input,
                      {
                        borderColor: emailErrAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["rgba(255,255,255,0.35)", "rgba(239,68,68,0.95)"]
                        }),
                        backgroundColor: emailErrAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["rgba(0,0,0,0.12)", "rgba(239,68,68,0.08)"]
                        })
                      }
                    ]}
                    placeholder="Enter your email"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoCorrect={false}
                    editable={!busy}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                      void Haptics.selectionAsync();
                      setEmailErr(null);
                      animateFieldError("email", false);
                      if (!validateEmail()) {
                        errorBuzz();
                        shake(emailShake, 1);
                        return;
                      }
                      focusRefSoon(signInPasswordRef);
                    }}
                  />
                </Animated.View>
                {emailErr ? <Text style={styles.fieldErr}>{emailErr.trim() ? emailErr : " "}</Text> : null}

                <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
                <Animated.View style={{ transform: [{ translateX: passwordShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
                  <View style={styles.signinInputWrap}>
                    <AnimatedTextInput
                      ref={signInPasswordRef}
                      value={password}
                      onChangeText={(t) => {
                        if (busy) return;
                        setPassword(t);
                        if (passwordErr) {
                          setPasswordErr(null);
                          animateFieldError("password", false);
                        }
                        if (signinBtnErr) setSigninBtnErr(null);
                        if (err) setErr(null);
                      }}
                      style={[
                        styles.input,
                        styles.signinInputWithEye,
                        {
                          borderColor: passwordErrAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["rgba(255,255,255,0.35)", "rgba(239,68,68,0.95)"]
                          }),
                          backgroundColor: passwordErrAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["rgba(0,0,0,0.12)", "rgba(239,68,68,0.08)"]
                          })
                        }
                      ]}
                      placeholder="Enter your password"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      secureTextEntry={!signInShowPassword}
                      textContentType="password"
                      editable={!busy}
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        void Haptics.selectionAsync();
                        onSubmitSignInPassword();
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setSignInShowPassword((s) => !s);
                      }}
                      style={({ pressed }) => [styles.signinEyeIcon, pressed && { opacity: 0.75 }]}
                      accessibilityRole="button"
                      accessibilityLabel={signInShowPassword ? "Hide password" : "Show password"}
                    >
                      <Text style={styles.signinEyeIconText}>{signInShowPassword ? "🙈" : "👁"}</Text>
                    </Pressable>
                  </View>
                </Animated.View>
                {passwordErr ? <Text style={styles.fieldErr}>{passwordErr}</Text> : null}

                <Animated.View style={{ transform: [{ translateX: signinBtnShake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }}>
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setEmailErr(null);
                      setPasswordErr(null);
                      setSigninBtnErr(null);
                      Keyboard.dismiss();
                      let ok = true;
                      if (!validateEmail()) {
                        ok = false;
                        errorBuzz();
                        shake(emailShake, 1);
                      }
                      if (!validatePassword()) {
                        ok = false;
                        errorBuzz();
                        shake(passwordShake, 1);
                      }
                      if (!ok) return;
                      void doSignIn();
                    }}
                    style={({ pressed }) => [styles.primary, pressed && { opacity: 0.95 }, busy && { opacity: 0.7 }]}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#1E1B4B" />
                    ) : signinBtnErr ? (
                      <Text style={styles.primaryTextErr}>{signinBtnErr}</Text>
                    ) : (
                      <Text style={styles.primaryText}>Sign in</Text>
                    )}
                  </Pressable>
                </Animated.View>

                <Text style={styles.subRow}>
                  Don’t have an account?{" "}
                  <Text
                    style={styles.link}
                    onPress={() => {
                      switchMode("signup");
                    }}
                  >
                    Create an account
                  </Text>
                </Text>
              </View>
            ) : (
              <Animated.View style={[styles.signupStage, wizardOpen || wizardExitInfiniteLoader ? styles.signupHidden : null]}>
                <Text style={[styles.signupHeader, { paddingTop: Math.max(18, insets.top + 12) }]}>Create your account</Text>

                <View style={styles.signupCenter}>
                  <Text style={styles.signupTitle}>Select your experience</Text>
                  <View style={styles.experienceRow}>
                    <Pressable
                      onPress={() => {
                        pickExperience("BUSINESS");
                        openWizard("BUSINESS");
                      }}
                      style={({ pressed }) => [styles.expBtn, styles.expBusiness, pressed && { opacity: 0.92 }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.expBtnText}>Business Account</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        pickExperience("GUEST");
                        openWizard("GUEST");
                      }}
                      style={({ pressed }) => [styles.expBtn, styles.expGuest, pressed && { opacity: 0.92 }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.expBtnText}>Guest Account</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.signupFooter}>
                  Already have an account?{" "}
                  <Text style={styles.link} onPress={() => switchMode("signin")}>
                    Sign in
                  </Text>
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {wizardOpen ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View
          style={[
            styles.wizardOverlay,
            { paddingTop: Math.max(12, insets.top + 10), paddingBottom: Math.max(12, insets.bottom + 10) }
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: wizardExitInfiniteLoader ? guestBlurFade : 1 }]}>
            <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>
          <KeyboardAvoidingView
            pointerEvents="box-none"
            style={{ width: "100%", alignItems: "center" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
          >
          <Animated.View
            style={[
              styles.wizardSheet,
              { opacity: wizardFade, transform: [{ translateY: wizardY }, { translateY: Animated.multiply(wizardShift, -1) }] }
            ]}
          >
            <View style={[styles.wizardCard, wizardFlow === "BUSINESS" ? styles.wizardCardBusiness : styles.wizardCardGuest]}>
              <Animated.View
                style={{
                  opacity: wizardExitInfiniteLoader ? guestWizardChromeFade : 1
                }}
              >
                <Text style={styles.wizardIntroTitle}>
                  {wizardFlow === "BUSINESS" ? "Create your business account" : "Create your personal account"}
                </Text>
                <Animated.Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.wizardIntroSub,
                    { opacity: wizardSwap.opacity, transform: [{ translateX: wizardSwap.x }], color: swapColor(wizardSwap.colorIndex) }
                  ]}
                >
                  {wizardSwap.text}
                </Animated.Text>

                <View style={styles.wizardStepRow}>
                  <Text style={styles.wizardStepText}>
                    Step {wizardStep + 1} of {totalSteps}
                  </Text>
                </View>
              </Animated.View>

              {wizardExitInfiniteLoader ? null : (
                <View
                  style={styles.wizardProgressTrack}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) progressTrackWRef.current = w;
                  }}
                >
                  <View
                    style={[
                      styles.wizardProgressFill,
                      {
                        width: `${Math.round(progress * 100)}%`,
                        backgroundColor:
                          progress >= 0.999
                            ? wizardFlow === "BUSINESS"
                              ? "rgba(59,130,246,0.95)"
                              : "rgba(34,197,94,0.95)"
                            : "rgba(255,255,255,0.92)"
                      }
                    ]}
                  />
                </View>
              )}

              <Animated.View
                style={{
                  opacity: wizardExitInfiniteLoader ? guestWizardChromeFade : 1
                }}
              >
                {wizErr ? <Text style={styles.wizardErr}>{wizErr}</Text> : null}

              <Animated.View style={[styles.wizardContent, { opacity: wizardStepOpacity, transform: [{ translateX: wizardStepX }] }]}>
                {wizardFlow === "GUEST" ? (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Basic Identity</Text>
                        <View style={styles.wizardRow2}>
                          <Animated.View style={{ flex: 1, transform: [{ translateX: Animated.multiply(wizShake.guestFirst, 8) }] }}>
                            <Text style={styles.wizardLabel}>First name</Text>
                            <AnimatedTextInput
                              value={guestFirst}
                              onChangeText={(t) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestFirst");
                                setGuestFirst(t);
                              }}
                              onFocus={(e) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestFirst");
                                onWizardFocus(e);
                              }}
                              style={[
                                styles.wizardInput,
                                { borderColor: wizBorderColor("guestFirst"), backgroundColor: wizBgColor("guestFirst") }
                              ]}
                              placeholder="First name"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              autoCapitalize="words"
                              textContentType="givenName"
                            />
                          </Animated.View>
                          <Animated.View style={{ flex: 1, transform: [{ translateX: Animated.multiply(wizShake.guestLast, 8) }] }}>
                            <Text style={styles.wizardLabel}>Last name</Text>
                            <AnimatedTextInput
                              value={guestLast}
                              onChangeText={(t) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestLast");
                                setGuestLast(t);
                              }}
                              onFocus={(e) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestLast");
                                onWizardFocus(e);
                              }}
                              style={[
                                styles.wizardInput,
                                { borderColor: wizBorderColor("guestLast"), backgroundColor: wizBgColor("guestLast") }
                              ]}
                              placeholder="Last name"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              autoCapitalize="words"
                              textContentType="familyName"
                            />
                          </Animated.View>
                        </View>
                        <Text style={styles.wizardLabel}>Email</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.guestEmail, 8) }] }}>
                          <AnimatedTextInput
                            value={email}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("guestEmail");
                              setEmail(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("guestEmail");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("guestEmail"), backgroundColor: wizBgColor("guestEmail") }
                            ]}
                            placeholder="Email"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            autoCorrect={false}
                          />
                        </Animated.View>
                        <Text style={styles.wizardLabel}>Mobile number</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.guestPhone, 8) }] }}>
                          <AnimatedTextInput
                            value={guestPhone}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("guestPhone");
                              setGuestPhone(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("guestPhone");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("guestPhone"), backgroundColor: wizBgColor("guestPhone") }
                            ]}
                            placeholder="Mobile number"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                          />
                        </Animated.View>

                        <CountrySelect value={guestCountry} onChange={setGuestCountry} />
                        
                      </>
                    ) : wizardStep === 1 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Access Security</Text>
                        <Text style={styles.wizardLabel}>Password</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.guestPassword, 8) }] }}>
                          <View style={styles.wizardInputWrap}>
                            <AnimatedTextInput
                              value={password}
                              onChangeText={(t) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestPassword");
                                if (wizConfirmStarted && password2.trim()) {
                                  const mismatch = t !== password2;
                                  setWizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                                  setWizFieldErrorSoft("guestPassword2", mismatch);
                                }
                                setPassword(t);
                              }}
                              onFocus={(e) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestPassword");
                                onWizardFocus(e);
                              }}
                              style={[
                                styles.wizardInput,
                                styles.wizardInputWithEye,
                                { borderColor: wizBorderColor("guestPassword"), backgroundColor: wizBgColor("guestPassword") }
                              ]}
                              placeholder="Password"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              secureTextEntry={wizConfirmEditing ? true : !wizShowPass}
                              textContentType="newPassword"
                            />
                            <Pressable
                              onPress={() => {
                                if (wizConfirmEditing) return;
                                void Haptics.selectionAsync();
                                setWizShowPass((s) => !s);
                              }}
                              style={({ pressed }) => [styles.wizardEyeIcon, pressed && { opacity: 0.75 }, wizConfirmEditing && { opacity: 0.35 }]}
                              accessibilityRole="button"
                            >
                              <Text style={styles.wizardEyeIconText}>{wizShowPass ? "🙈" : "👁"}</Text>
                            </Pressable>
                          </View>
                        </Animated.View>
                        <Text style={styles.wizardLabel}>Confirm Password</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.guestPassword2, 8) }] }}>
                          <View style={styles.wizardInputWrap}>
                            <AnimatedTextInput
                              value={password2}
                              onChangeText={(t) => {
                                if (!wizConfirmStarted) setWizConfirmStarted(true);
                                setWizConfirmEditing(true);
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestPassword2");
                                setPassword2(t);
                                const mismatch = t.trim().length > 0 && password.trim().length > 0 && t !== password;
                                setWizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                                setWizFieldErrorSoft("guestPassword2", mismatch);
                              }}
                              onFocus={(e) => {
                                if (!wizConfirmStarted) setWizConfirmStarted(true);
                                setWizConfirmEditing(true);
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("guestPassword2");
                                onWizardFocus(e);
                              }}
                              onBlur={() => setWizConfirmEditing(false)}
                              style={[
                                styles.wizardInput,
                                styles.wizardInputWithEye,
                                { borderColor: wizBorderColor("guestPassword2"), backgroundColor: wizBgColor("guestPassword2") }
                              ]}
                              placeholder="Confirm Password"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              secureTextEntry={!wizShowConfirmPass}
                              contextMenuHidden
                              textContentType="password"
                              autoCorrect={false}
                            />
                            <Pressable
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setWizShowConfirmPass((s) => !s);
                              }}
                              style={({ pressed }) => [styles.wizardEyeIcon, pressed && { opacity: 0.75 }]}
                              accessibilityRole="button"
                            >
                              <Text style={styles.wizardEyeIconText}>{wizShowConfirmPass ? "🙈" : "👁"}</Text>
                            </Pressable>
                          </View>
                          {wizConfirmStarted && wizConfirmMismatch ? <Text style={styles.fieldErr}>{wizConfirmMismatch}</Text> : null}
                        </Animated.View>
                      </>
                    ) : wizardStep === 2 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Preferences</Text>
                        <Text style={styles.wizardMuted}>Personalize your experience (optional).</Text>
                        <Text style={styles.wizardLabel}>Preferred language</Text>
                        <View style={styles.langRow}>
                          <Pressable
                            onPress={() => {
                              void Haptics.selectionAsync();
                              setGuestLanguage("EN");
                            }}
                            style={({ pressed }) => [
                              styles.langBtn,
                              guestLanguage === "EN" && styles.langBtnOn,
                              pressed && { opacity: 0.92 }
                            ]}
                          >
                            <Text style={[styles.langText, guestLanguage === "EN" && styles.langTextOn]}>English</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              // Swedish not connected yet → bounce back to English.
                              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                              setGuestLanguage("EN");
                            }}
                            style={({ pressed }) => [styles.langBtn, styles.langBtnDisabled, pressed && { opacity: 0.92 }]}
                          >
                            <Text style={styles.langTextDisabled}>Swedish</Text>
                          </Pressable>
                        </View>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.guestCity, 8) }] }}>
                          <CitySelect
                            country={guestCountry}
                            value={guestCity}
                            onChange={(c) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("guestCity");
                              setGuestCity(c);
                            }}
                            label="City / location"
                          />
                        </Animated.View>
                        <View style={styles.wizardToggleRow}>
                          <ThemedSwitch value={guestOffers} onValueChange={setGuestOffers} />
                          <Text style={styles.wizardToggleText}>Receive marketing offers</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.wizardFinishTitle}>Your account is ready</Text>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {wizardStep === 0 ? (
                      <>
                        <Text style={styles.wizardLabel}>Organisation number</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizOrgNumber, 8) }] }}>
                          <AnimatedTextInput
                            value={bizOrgNumber}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizOrgNumber");
                              setBizLookupMsg(null);
                              setBizOrgNumber(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizOrgNumber");
                              onWizardFocus(e);
                            }}
                            style={[styles.wizardInput, { borderColor: wizBorderColor("bizOrgNumber"), backgroundColor: wizBgColor("bizOrgNumber") }]}
                            placeholder="556123-4567"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            keyboardType="numbers-and-punctuation"
                          />
                        </Animated.View>

                        {bizLookupMsg ? <Text style={styles.fieldErr}>{bizLookupMsg}</Text> : null}
                      </>
                    ) : wizardStep === 1 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Business Identity</Text>
                        {bizCompanyFieldsLocked ? (
                          <>
                            <View style={styles.wizardRow2}>
                              <Animated.View style={{ flex: 1, minWidth: 0, transform: [{ translateX: Animated.multiply(wizShake.bizName, 8) }] }}>
                                <Text style={styles.wizardLabel}>Legal company name</Text>
                                <View style={styles.wizardInputWrap}>
                                  <AnimatedTextInput
                                    value={bizName}
                                    editable={false}
                                    style={[
                                      styles.wizardInput,
                                      styles.wizardInputWithEye,
                                      { borderColor: wizBorderColor("bizName"), backgroundColor: wizBgColor("bizName") }
                                    ]}
                                    placeholder="Business name"
                                    placeholderTextColor="rgba(255,255,255,0.35)"
                                  />
                                  <View
                                    style={styles.wizardLockIconWrap}
                                    pointerEvents="none"
                                    accessibilityElementsHidden
                                    importantForAccessibility="no-hide-descendants"
                                  >
                                    <Text style={styles.wizardLockIconText}>🔒</Text>
                                  </View>
                                </View>
                              </Animated.View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.wizardLabel}>Legal form</Text>
                                <View style={styles.wizardInputWrap}>
                                  <View style={[styles.wizardInput, styles.wizardInputWithEye]}>
                                    <Text style={styles.wizardLockedRegistryText} numberOfLines={1}>
                                      {bizLegalFormLocked.trim() ? bizLegalFormLocked : "—"}
                                    </Text>
                                  </View>
                                  <View
                                    style={styles.wizardLockIconWrap}
                                    pointerEvents="none"
                                    accessibilityElementsHidden
                                    importantForAccessibility="no-hide-descendants"
                                  >
                                    <Text style={styles.wizardLockIconText}>🔒</Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                            <View style={[styles.wizardRow2, { marginTop: 4 }]}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.wizardLabel}>Registration status</Text>
                                <View style={styles.wizardInputWrap}>
                                  <View style={[styles.wizardInput, styles.wizardInputWithEye]}>
                                    <Text style={styles.wizardLockedRegistryText} numberOfLines={1}>
                                      {bizRegStatusLocked.trim() ? bizRegStatusLocked : "—"}
                                    </Text>
                                  </View>
                                  <View
                                    style={styles.wizardLockIconWrap}
                                    pointerEvents="none"
                                    accessibilityElementsHidden
                                    importantForAccessibility="no-hide-descendants"
                                  >
                                    <Text style={styles.wizardLockIconText}>🔒</Text>
                                  </View>
                                </View>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.wizardLabel}>Postal code</Text>
                                <View style={styles.wizardInputWrap}>
                                  <View style={[styles.wizardInput, styles.wizardInputWithEye]}>
                                    <Text style={styles.wizardLockedRegistryText} numberOfLines={1}>
                                      {bizPostalLocked.trim() ? bizPostalLocked : "—"}
                                    </Text>
                                  </View>
                                  <View
                                    style={styles.wizardLockIconWrap}
                                    pointerEvents="none"
                                    accessibilityElementsHidden
                                    importantForAccessibility="no-hide-descendants"
                                  >
                                    <Text style={styles.wizardLockIconText}>🔒</Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.wizardLabel}>Legal company name</Text>
                            <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizName, 8) }] }}>
                              <View style={styles.wizardInputWrap}>
                                <AnimatedTextInput
                                  value={bizName}
                                  editable
                                  onChangeText={(t) => {
                                    if (wizardBtnErr) setWizardBtnErr(null);
                                    clearWizFieldError("bizName");
                                    setBizName(t);
                                  }}
                                  onFocus={(e) => {
                                    if (wizardBtnErr) setWizardBtnErr(null);
                                    clearWizFieldError("bizName");
                                    onWizardFocus(e);
                                  }}
                                  style={[styles.wizardInput, { borderColor: wizBorderColor("bizName"), backgroundColor: wizBgColor("bizName") }]}
                                  placeholder="Business name"
                                  placeholderTextColor="rgba(255,255,255,0.35)"
                                />
                              </View>
                            </Animated.View>
                          </>
                        )}
                        <Text style={styles.wizardLabel}>Contact person full name</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizContact, 8) }] }}>
                          <AnimatedTextInput
                            value={bizContact}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizContact");
                              setBizContact(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizContact");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("bizContact"), backgroundColor: wizBgColor("bizContact") }
                            ]}
                            placeholder="Full name"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            autoCapitalize="words"
                          />
                        </Animated.View>
                        <Text style={styles.wizardLabel}>Work email</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizEmail, 8) }] }}>
                          <AnimatedTextInput
                            value={email}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizEmail");
                              setEmail(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizEmail");
                              onWizardFocus(e);
                            }}
                            style={[styles.wizardInput, { borderColor: wizBorderColor("bizEmail"), backgroundColor: wizBgColor("bizEmail") }]}
                            placeholder="Work email"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            autoCorrect={false}
                          />
                        </Animated.View>
                        <Text style={styles.wizardLabel}>Mobile number</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizPhone, 8) }] }}>
                          <AnimatedTextInput
                            value={bizPhone}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizPhone");
                              setBizPhone(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizPhone");
                              onWizardFocus(e);
                            }}
                            style={[styles.wizardInput, { borderColor: wizBorderColor("bizPhone"), backgroundColor: wizBgColor("bizPhone") }]}
                            placeholder="Mobile number"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                          />
                        </Animated.View>
                      </>
                    ) : wizardStep === 2 ? (
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        nestedScrollEnabled
                        style={{ maxHeight: wizardBizDetailsScrollMaxH }}
                        contentContainerStyle={styles.wizardBusinessDetailsScroll}
                      >
                        <Text style={styles.wizardSectionTitle}>Business Details</Text>
                        <View style={[styles.wizardRow2, { marginTop: 10 }]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <CountrySelect
                              value={bizCountry}
                              onChange={setBizCountry}
                              locked={bizCompanyFieldsLocked}
                            />
                          </View>
                          <Animated.View style={{ flex: 1, minWidth: 0, transform: [{ translateX: Animated.multiply(wizShake.bizCity, 8) }] }}>
                            <CitySelect
                              country={bizCountry}
                              value={bizCity}
                              onChange={(c) => {
                                if (bizCompanyFieldsLocked) return;
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizCity");
                                setBizCity(c);
                              }}
                              locked={bizCompanyFieldsLocked}
                            />
                          </Animated.View>
                        </View>
                        <Text style={styles.wizardLabel}>Number of locations</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizLocations, 8) }] }}>
                          <AnimatedTextInput
                            value={bizLocations}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizLocations");
                              setBizLocations(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizLocations");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("bizLocations"), backgroundColor: wizBgColor("bizLocations") }
                            ]}
                            placeholder="1"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            keyboardType="number-pad"
                          />
                        </Animated.View>
                      </ScrollView>
                    ) : wizardStep === 3 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Business Address</Text>
                        <Text style={styles.wizardLabel}>Registered business address</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizAddress, 8) }] }}>
                          <View style={styles.wizardInputWrap}>
                            <AnimatedTextInput
                              value={bizAddress}
                              editable={!bizCompanyFieldsLocked}
                              onChangeText={(t) => {
                                if (bizCompanyFieldsLocked) return;
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizAddress");
                                setBizAddress(t);
                              }}
                              onFocus={(e) => {
                                if (bizCompanyFieldsLocked) return;
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizAddress");
                                onWizardFocus(e);
                              }}
                              style={[
                                styles.wizardInput,
                                bizCompanyFieldsLocked && styles.wizardInputWithEye,
                                { borderColor: wizBorderColor("bizAddress"), backgroundColor: wizBgColor("bizAddress") }
                              ]}
                              placeholder={bizCompanyFieldsLocked && !bizAddress.trim() ? "—" : "Address"}
                              placeholderTextColor="rgba(255,255,255,0.35)"
                            />
                            {bizCompanyFieldsLocked ? (
                              <View style={styles.wizardLockIconWrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                                <Text style={styles.wizardLockIconText}>🔒</Text>
                              </View>
                            ) : null}
                          </View>
                        </Animated.View>
                        <View style={styles.wizardLabelRow}>
                          <Text style={styles.wizardLabel}>Type of business</Text>
                          <Text style={styles.wizardOptional}>(Optional)</Text>
                        </View>
                        <View style={styles.wizardChips}>
                          {(["Restaurant", "Cafe", "Fast Food", "Bakery", "Ghost Kitchen", "Other"] as const).map((t) => (
                            <Pressable
                              key={t}
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setBizType(t);
                              }}
                              style={({ pressed }) => [styles.wizardChip, bizType === t && styles.wizardChipOn, pressed && { opacity: 0.92 }]}
                            >
                              <Text style={[styles.wizardChipText, bizType === t && styles.wizardChipTextOn]}>{t}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    ) : wizardStep === 4 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Operations Setup</Text>
                        <Text style={styles.wizardLabel}>Estimated monthly orders</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizMonthlyOrders, 8) }] }}>
                          <AnimatedTextInput
                            value={bizMonthlyOrders}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizMonthlyOrders");
                              setBizMonthlyOrders(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizMonthlyOrders");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("bizMonthlyOrders"), backgroundColor: wizBgColor("bizMonthlyOrders") }
                            ]}
                            placeholder="e.g. 1000"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            keyboardType="number-pad"
                          />
                        </Animated.View>
                        <View style={styles.wizardToggleRow}>
                          <ThemedSwitch value={bizNeedBookings} onValueChange={setBizNeedBookings} />
                          <Text style={styles.wizardToggleText}>Need bookings</Text>
                        </View>
                        <View style={styles.wizardToggleRow}>
                          <ThemedSwitch value={bizNeedDelivery} onValueChange={setBizNeedDelivery} />
                          <Text style={styles.wizardToggleText}>Need delivery/pickup</Text>
                        </View>
                        <Text style={styles.wizardLabel}>Current system used</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizCurrentSystem, 8) }] }}>
                          <AnimatedTextInput
                            value={bizCurrentSystem}
                            onChangeText={(t) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizCurrentSystem");
                              setBizCurrentSystem(t);
                            }}
                            onFocus={(e) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizCurrentSystem");
                              onWizardFocus(e);
                            }}
                            style={[
                              styles.wizardInput,
                              { borderColor: wizBorderColor("bizCurrentSystem"), backgroundColor: wizBgColor("bizCurrentSystem") }
                            ]}
                            placeholder="e.g. Toast, Square, none"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                          />
                        </Animated.View>
                      </>
                    ) : wizardStep === 5 ? (
                      <>
                        <Text style={styles.wizardSectionTitle}>Security & Ownership</Text>
                        <Text style={styles.wizardLabel}>Password</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizPassword, 8) }] }}>
                          <View style={styles.wizardInputWrap}>
                            <AnimatedTextInput
                              value={password}
                              onChangeText={(t) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizPassword");
                                if (wizConfirmStarted && password2.trim()) {
                                  const mismatch = t !== password2;
                                  setWizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                                  setWizFieldErrorSoft("bizPassword2", mismatch);
                                }
                                setPassword(t);
                              }}
                              onFocus={(e) => {
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizPassword");
                                onWizardFocus(e);
                              }}
                              style={[
                                styles.wizardInput,
                                styles.wizardInputWithEye,
                                { borderColor: wizBorderColor("bizPassword"), backgroundColor: wizBgColor("bizPassword") }
                              ]}
                              placeholder="Password"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              secureTextEntry={wizConfirmEditing ? true : !wizShowPass}
                              textContentType="newPassword"
                            />
                            <Pressable
                              onPress={() => {
                                if (wizConfirmEditing) return;
                                void Haptics.selectionAsync();
                                setWizShowPass((s) => !s);
                              }}
                              style={({ pressed }) => [styles.wizardEyeIcon, pressed && { opacity: 0.75 }, wizConfirmEditing && { opacity: 0.35 }]}
                              accessibilityRole="button"
                            >
                              <Text style={styles.wizardEyeIconText}>{wizShowPass ? "🙈" : "👁"}</Text>
                            </Pressable>
                          </View>
                        </Animated.View>
                        <Text style={styles.wizardLabel}>Confirm Password</Text>
                        <Animated.View style={{ transform: [{ translateX: Animated.multiply(wizShake.bizPassword2, 8) }] }}>
                          <View style={styles.wizardInputWrap}>
                            <AnimatedTextInput
                              value={password2}
                              onChangeText={(t) => {
                                if (!wizConfirmStarted) setWizConfirmStarted(true);
                                setWizConfirmEditing(true);
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizPassword2");
                                setPassword2(t);
                                const mismatch = t.trim().length > 0 && password.trim().length > 0 && t !== password;
                                setWizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                                setWizFieldErrorSoft("bizPassword2", mismatch);
                              }}
                              onFocus={(e) => {
                                if (!wizConfirmStarted) setWizConfirmStarted(true);
                                setWizConfirmEditing(true);
                                if (wizardBtnErr) setWizardBtnErr(null);
                                clearWizFieldError("bizPassword2");
                                onWizardFocus(e);
                              }}
                              onBlur={() => setWizConfirmEditing(false)}
                              style={[
                                styles.wizardInput,
                                styles.wizardInputWithEye,
                                { borderColor: wizBorderColor("bizPassword2"), backgroundColor: wizBgColor("bizPassword2") }
                              ]}
                              placeholder="Confirm Password"
                              placeholderTextColor="rgba(255,255,255,0.35)"
                              secureTextEntry={!wizShowConfirmPass}
                              contextMenuHidden
                              textContentType="password"
                              autoCorrect={false}
                            />
                            <Pressable
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setWizShowConfirmPass((s) => !s);
                              }}
                              style={({ pressed }) => [styles.wizardEyeIcon, pressed && { opacity: 0.75 }]}
                              accessibilityRole="button"
                            >
                              <Text style={styles.wizardEyeIconText}>{wizShowConfirmPass ? "🙈" : "👁"}</Text>
                            </Pressable>
                          </View>
                          {wizConfirmStarted && wizConfirmMismatch ? <Text style={styles.fieldErr}>{wizConfirmMismatch}</Text> : null}
                        </Animated.View>
                        <Animated.View style={[styles.wizardToggleRow, { transform: [{ translateX: Animated.multiply(wizShake.bizAcceptTerms, 8) }] }]}>
                          <ThemedSwitch
                            value={bizAcceptTerms}
                            onValueChange={(v) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizAcceptTerms");
                              setBizAcceptTerms(v);
                            }}
                          />
                          <Text style={styles.wizardToggleText}>Accept Terms</Text>
                        </Animated.View>
                        <Animated.View style={[styles.wizardToggleRow, { transform: [{ translateX: Animated.multiply(wizShake.bizAuthorized, 8) }] }]}>
                          <ThemedSwitch
                            value={bizAuthorized}
                            onValueChange={(v) => {
                              if (wizardBtnErr) setWizardBtnErr(null);
                              clearWizFieldError("bizAuthorized");
                              setBizAuthorized(v);
                            }}
                          />
                          <Text style={styles.wizardToggleText}>Authorized to represent business</Text>
                        </Animated.View>
                      </>
                    ) : null}
                  </>
                )}
              </Animated.View>

              <View style={styles.wizardBtnRow}>
                <Pressable
                  onPress={() => (wizardStep > 0 ? wizardBack() : closeWizard())}
                  style={({ pressed }) => [styles.wizardCancel, pressed && { opacity: 0.92 }]}
                  disabled={busy}
                >
                  <Text style={styles.wizardCancelText}>{wizardStep > 0 ? "Back" : "Cancel"}</Text>
                </Pressable>
                <Animated.View style={{ flex: 1, transform: [{ translateX: Animated.multiply(wizardBtnShake, 8) }] }}>
                  <Pressable
                    onPress={() => {
                      if (wizardFlow === "BUSINESS" && wizardStep === 0) {
                        void handleBusinessOrgStepContinue();
                        return;
                      }
                      wizardNext();
                    }}
                    style={({ pressed }) => [
                      styles.wizardNext,
                      wizardStep >= totalSteps - 1
                        ? wizardFlow === "BUSINESS"
                          ? styles.wizardNextBusiness
                          : styles.wizardNextGuest
                        : null,
                      pressed && { opacity: 0.96 },
                      (busy || bizLookupBusy) && { opacity: 0.75 }
                    ]}
                    disabled={busy || bizLookupBusy}
                  >
                    {bizLookupBusy && wizardFlow === "BUSINESS" && wizardStep === 0 ? (
                      <ActivityIndicator color="#0B1020" />
                    ) : wizardBtnErr ? (
                      <Text style={styles.primaryTextErr}>{wizardBtnErr}</Text>
                    ) : (
                      <Text
                        style={[
                          styles.wizardNextText,
                          wizardStep >= totalSteps - 1 && wizardFlow === "BUSINESS" && styles.wizardNextTextOnAccent
                        ]}
                      >
                        {wizardStep >= totalSteps - 1 ? (wizardFlow === "BUSINESS" ? "Launch Dashboard" : "Start Exploring") : "Continue"}
                      </Text>
                    )}
                  </Pressable>
                </Animated.View>
              </View>

                <Text style={styles.wizardProtect}>Your information is encrypted and protected.</Text>
              </Animated.View>
            </View>
          </Animated.View>
          </KeyboardAvoidingView>
        </View>
        </TouchableWithoutFeedback>
      ) : null}

      {wizardExitInfiniteLoader ? (
        <View style={[StyleSheet.absoluteFillObject, styles.wizardExitInfiniteLoaderRoot]} pointerEvents="auto">
          <View style={styles.wizardExitInfiniteLoaderColumn}>
            <Text style={styles.wizardExitLoaderHint}>Creating your account</Text>
            {wizardExitLoaderErr ? (
              <View style={styles.wizardExitLoaderErrBox}>
                <Text style={styles.wizardExitLoaderErrText}>{wizardExitLoaderErr}</Text>
                <View style={styles.wizardExitLoaderErrActions}>
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync();
                      void runWizardSignupFromLoaderRef.current();
                    }}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.wizardExitLoaderErrBtnPrimary,
                      pressed && !busy ? { opacity: 0.92 } : null,
                      busy && styles.wizardExitLoaderBtnDisabled
                    ]}
                  >
                    <Text style={styles.wizardExitLoaderErrBtnPrimaryText}>Try again</Text>
                  </Pressable>
                  <Pressable
                    onPress={dismissWizardExitToEditDetails}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.wizardExitLoaderErrBtnGhost,
                      pressed && !busy ? { opacity: 0.88 } : null,
                      busy && styles.wizardExitLoaderBtnDisabled
                    ]}
                  >
                    <Text style={styles.wizardExitLoaderErrBtnGhostText}>Edit details</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {!wizardExitInfiniteRing ? (
              <Animated.View
                style={{
                  alignSelf: "center",
                  width: guestMorphW,
                  height: guestMorphH,
                  borderRadius: guestMorphR,
                  backgroundColor: swapColor(infiniteLoaderSwap.colorIndex)
                }}
              />
            ) : (
              <Animated.View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  borderWidth: 5,
                  borderColor: LOADER_SWAP_DIM[infiniteLoaderSwap.colorIndex % 4] ?? LOADER_SWAP_DIM[0],
                  borderTopColor: swapColor(infiniteLoaderSwap.colorIndex),
                  borderRightColor: swapColor(infiniteLoaderSwap.colorIndex),
                  transform: [{ rotate: guestSpinDeg }]
                }}
              />
            )}
            {infiniteLoaderPhrases.length > 1 ? (
              <Animated.Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[
                  styles.wizardIntroSub,
                  styles.wizardExitInfinitePhrase,
                  {
                    opacity: infiniteLoaderSwap.opacity,
                    transform: [{ translateX: infiniteLoaderSwap.x }],
                    color: swapColor(infiniteLoaderSwap.colorIndex)
                  }
                ]}
              >
                {infiniteLoaderSwap.text}
              </Animated.Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  full: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: PAD },
  phraseWrap: { alignItems: "center", marginBottom: 18 },
  phraseTitle: { fontSize: 18, fontWeight: "800", color: "rgba(255,255,255,0.95)", marginBottom: 10, textAlign: "center" },
  phraseBig: { fontSize: 22, fontWeight: "900", letterSpacing: 0.2, textAlign: "center", paddingHorizontal: 18 },
  phrase: { fontSize: 20, fontWeight: "900", letterSpacing: 0.2, textAlign: "center", paddingHorizontal: 18 },
  modal: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#FFFFFF", textAlign: "center", marginBottom: 12 },
  topic: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center", marginBottom: 6, fontWeight: "600" },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.12)"
  },
  signinInputWrap: { width: "100%", position: "relative" },
  signinInputWithEye: { paddingRight: 48 },
  signinEyeIcon: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 6
  },
  signinEyeIconText: { fontSize: 16, color: "rgba(255,255,255,0.85)" },
  inputErr: {
    borderColor: "rgba(239,68,68,0.95)",
    backgroundColor: "rgba(239,68,68,0.08)"
  },
  fieldErr: { marginTop: 8, color: "rgba(254,202,202,0.98)", fontSize: 12, fontWeight: "700" },
  dropdown: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dropdownText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  dropdownChevron: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "900" },
  dropdownMenu: {
    width: "100%",
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(0,0,0,0.32)"
  },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 16 },
  dropdownItemText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  errText: { color: "#FECACA", textAlign: "center", paddingHorizontal: 4, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  primary: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    marginTop: 16
  },
  primaryText: { color: "#1E1B4B", fontSize: 16, fontWeight: "900" },
  primaryTextErr: { color: "#DC2626", fontSize: 16, fontWeight: "900" },
  subRow: { marginTop: 18, textAlign: "center", color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "600" },
  link: { color: "#FFFFFF", fontWeight: "900", textDecorationLine: "underline" }
  ,
  // --- Signup stage 1 (experience select) ---
  signupStage: { width: "100%", flex: 1 },
  signupHidden: { opacity: 0, transform: [{ scale: 0.98 }], pointerEvents: "none" as any },
  signupHeader: {
    fontSize: 20,
    fontWeight: "900",
    color: "rgba(255,255,255,0.96)",
    textAlign: "center",
    marginBottom: 18
  },
  signupCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  signupTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", textAlign: "center", marginBottom: 16 },
  experienceRow: { flexDirection: "row", gap: 14, width: "100%", justifyContent: "center" },
  expBtn: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  expGuest: { backgroundColor: "rgba(34,197,94,0.92)" },
  expBusiness: { backgroundColor: "rgba(59,130,246,0.92)" },
  expBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "center" },
  signupFooter: {
    marginTop: "auto",
    paddingBottom: 18,
    textAlign: "center",
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "600"
  },

  // --- Signup wizard overlay ---
  wizardExitInfiniteLoaderRoot: {
    zIndex: 80,
    elevation: 28,
    backgroundColor: "rgba(49,46,129,0.82)"
  },
  wizardExitLoaderHint: {
    color: "rgba(255,255,255,0.94)",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12
  },
  wizardExitLoaderErrBox: {
    width: "100%",
    maxWidth: 480,
    marginBottom: 24,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)"
  },
  wizardExitLoaderErrText: {
    color: "rgba(254,226,226,0.98)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20
  },
  wizardExitLoaderErrActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
    alignItems: "center"
  },
  wizardExitLoaderErrBtnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)"
  },
  wizardExitLoaderErrBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#312E81"
  },
  wizardExitLoaderErrBtnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)"
  },
  wizardExitLoaderErrBtnGhostText: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)"
  },
  wizardExitLoaderBtnDisabled: {
    opacity: 0.5
  },
  wizardExitInfiniteLoaderColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: PAD + 8
  },
  wizardExitInfinitePhrase: { marginTop: 28, maxWidth: 520, alignSelf: "center", width: "100%" },
  wizardOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PAD
  },
  wizardSheet: { width: "100%", maxWidth: 560 },
  wizardKicker: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "900" },
  wizardCancel: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)"
  },
  wizardCancelText: { color: "#FCA5A5", fontWeight: "900", fontSize: 13 },
  wizardCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  wizardCardGuest: { borderColor: "rgba(34,197,94,0.95)" },
  wizardCardBusiness: { borderColor: "rgba(59,130,246,0.95)" },
  wizardIntroTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", textAlign: "center" },
  wizardIntroSub: { marginTop: 8, color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: "600", textAlign: "center" },
  wizardStepRow: { marginTop: 14, marginBottom: 6, flexDirection: "row", justifyContent: "center" },
  wizardStepText: { color: "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: "900" },
  wizardProgressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  wizardProgressFill: { height: "100%", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999 },
  wizardErr: { marginTop: 12, color: "#FECACA", fontSize: 13, fontWeight: "900", textAlign: "center" },
  wizardContent: { marginTop: 14 },
  wizardLabel: { marginTop: 14, marginBottom: 8, color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "900" },
  wizardLabelRow: { marginTop: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  wizardOptional: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "900" },
  wizardInput: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 15,
    color: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.18)"
  },
  wizardLockedRegistryText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", flexShrink: 1 },
  wizardRow2: { flexDirection: "row", gap: 12, width: "100%" },
  wizardBusinessDetailsScroll: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 18
  },
  wizardSectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "center" },
  wizardMuted: { marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "700", textAlign: "center" },
  wizardInputWrap: { width: "100%", position: "relative" },
  wizardInputWithEye: { paddingRight: 44 },
  wizardLockIconWrap: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 6
  },
  wizardLockIconText: { fontSize: 13, lineHeight: 16 },
  wizardEyeIcon: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 6
  },
  wizardEyeIconText: { fontSize: 16, color: "rgba(255,255,255,0.82)" },
  wizardFinishTitle: { marginTop: 10, color: "#FFFFFF", fontSize: 18, fontWeight: "900", textAlign: "center" },
  wizardProtect: { marginTop: 28, color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "800", textAlign: "center" },
  wizardBtnRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  wizardToggleRow: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  wizardToggleText: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "800" },
  wizardChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  wizardChip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(0,0,0,0.18)" },
  wizardChipOn: { borderColor: "rgba(255,255,255,0.70)", backgroundColor: "rgba(255,255,255,0.14)" },
  wizardChipText: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "900" },
  wizardChipTextOn: { color: "#FFFFFF" },
  wizardNext: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center" },
  wizardNextGuest: { backgroundColor: "rgba(34,197,94,0.95)" },
  wizardNextBusiness: { backgroundColor: "rgba(59,130,246,0.95)" },
  wizardNextText: { color: "#0B1020", fontSize: 14, fontWeight: "900" },
  wizardNextTextOnAccent: { color: "#FFFFFF" },
  langRow: { flexDirection: "row", gap: 10, width: "100%" },
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center"
  },
  langBtnOn: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.50)" },
  langBtnDisabled: { opacity: 0.55 },
  langText: { color: "rgba(255,255,255,0.86)", fontWeight: "900" },
  langTextOn: { color: "#FFFFFF" },
  langTextDisabled: { color: "rgba(255,255,255,0.72)", fontWeight: "900" }
});
