import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        rim: "rgb(var(--rim) / <alpha-value>)",
        "rim-strong": "rgb(var(--rim-strong) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        "brand-soft": "rgb(var(--brand-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        control: "10px",
        panel: "14px",
      },
      animation: {
        "slide-in": "slideIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        skeleton: "skeleton 1.6s ease-in-out infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        skeleton: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.65" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
