import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#faf6ee",
        paper: "#fffdf8",
        ink: "#2c2419",
        "ink-soft": "#6b5f4d",
        brown: "#8a5a2b",
        "brown-dark": "#6e4521",
        sage: "#7a9b76",
        "sage-soft": "#eaf2e8",
        rust: "#c1543a",
        "rust-soft": "#fbeae6",
        yellow: "#e0a93a",
        "yellow-soft": "#fbf1dd",
        line: "#ece3d3",
        // ── New design system (public booking page) ──────────────────────
        surface: "#F8F7F4",
        surface2: "#F1EFEA",
        slate: "#14171A",
        "slate-soft": "#6B6A66",
        line2: "#E4E2DC",
        accent: "#FF4D1C",
        "accent-ink": "#FFF4EE",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        heading: ["var(--font-heading)", "sans-serif"],
        sans2: ["var(--font-sans2)", "sans-serif"],
        mono2: ["var(--font-mono2)", "monospace"],
      },
      borderRadius: {
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
