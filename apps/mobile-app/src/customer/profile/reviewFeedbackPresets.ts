/** Palette + face geometry per step — ported from signup feedback demo (GSAP). */
export type ReviewFeedbackStep = 0 | 1 | 2;

export type ReviewFeedbackPalette = {
  bgColor: string;
  indicatorColor: string;
  pathColor: string;
  smileColor: string;
  titleColor: string;
  trackColor: string;
  eyeWidth: number;
  eyeHeight: number;
  eyeRadius: number;
  eyeBg: string;
  textColor: string;
  smileUp: boolean;
  noteLabel: string;
  noteColor: string;
  inputSurface: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
};

export const REVIEW_FEEDBACK_PRESETS: ReviewFeedbackPalette[] = [
  {
    bgColor: "#fc7359",
    indicatorColor: "#790b02",
    pathColor: "#fc7359",
    smileColor: "#790b02",
    titleColor: "#790b02",
    trackColor: "#fc5b3e",
    eyeWidth: 56,
    eyeHeight: 56,
    eyeRadius: 28,
    eyeBg: "#790b02",
    textColor: "#790b02",
    smileUp: false,
    noteLabel: "BAD",
    noteColor: "#e33719",
    inputSurface: "#790b0224",
    inputBorder: "#790b0261",
    inputText: "#790b02",
    inputPlaceholder: "#790b0285"
  },
  {
    bgColor: "#dfa342",
    indicatorColor: "#482103",
    pathColor: "#dfa342",
    smileColor: "#482103",
    titleColor: "#482103",
    trackColor: "#b07615",
    eyeWidth: 100,
    eyeHeight: 20,
    eyeRadius: 36,
    eyeBg: "#482103",
    textColor: "#482103",
    smileUp: false,
    noteLabel: "NOT BAD",
    noteColor: "#b37716",
    inputSurface: "#48210324",
    inputBorder: "#48210361",
    inputText: "#482103",
    inputPlaceholder: "#48210385"
  },
  {
    bgColor: "#9fbe59",
    indicatorColor: "#0b2b03",
    pathColor: "#9fbe59",
    smileColor: "#0b2b03",
    titleColor: "#0b2b03",
    trackColor: "#698b1b",
    eyeWidth: 120,
    eyeHeight: 120,
    eyeRadius: 60,
    eyeBg: "#0b2b03",
    textColor: "#0b2b03",
    smileUp: true,
    noteLabel: "GOOD",
    noteColor: "#6e901d",
    inputSurface: "#0b2b0324",
    inputBorder: "#0b2b0361",
    inputText: "#0b2b03",
    inputPlaceholder: "#0b2b0385"
  }
];

export const REVIEW_SMILE_PATH =
  "M25.9742 0C39.941 0 51.2634 11.3183 51.2634 25.2802C51.2634 116.032 124.859 189.601 215.643 189.601C306.427 189.601 380.023 116.032 380.023 25.2802C380.023 11.3183 391.345 0 405.312 0C419.279 0 430.601 11.3183 430.601 25.2802C430.601 143.956 334.361 240.162 215.643 240.162C96.925 240.162 0.685059 143.956 0.685059 25.2802C0.685059 11.3183 12.0074 0 25.9742 0Z";
