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
        canvas: "#090b0f",
        surface: "#0f1117",
        elevated: "#141720",
        rim: "#1c2030",
        brand: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: ["var(--font-jb-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "slide-in": "slideIn 0.2s ease-out forwards",
        "fade-in": "fadeIn 0.35s ease-out forwards",
        skeleton: "skeleton 1.5s ease-in-out infinite",
        "spin-slow": "spin 2s linear infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
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
