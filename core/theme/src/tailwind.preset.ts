import type { Config } from "tailwindcss";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        // Core
        bg: "#000D19",
        text: "#FFFFFF",
        accent: "#3B82F6",

        // Surfaces
        surface: {
          1: "#111111",
          2: "#1A1A1A",
          hover: "#222222"
        },

        // Text (secondary)
        muted: "#A1A1AA",
        inactive: "#71717A",

        // System
        success: "#22C55E",
        error: "#EF4444",
        warning: "#F59E0B",
        info: "#3B82F6",

        // Restaurant energy (sparingly)
        promo: "#F97316",
        highlight: "#EAB308"
      },
      boxShadow: {
        "glow-blue": "0 0 0 1px rgba(59,130,246,0.18), 0 0 40px rgba(59,130,246,0.26)"
      },
      fontFamily: {
        ui: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        customer: ["Poppins", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        branding: ["Satoshi", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"]
      }
    }
  }
};

export default preset;

