import type { Config } from "tailwindcss";
import preset from "@serveos/core-theme/tailwind-preset";

export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../core/loading/src/**/*.{ts,tsx}",
    "../../core/ambient/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;

