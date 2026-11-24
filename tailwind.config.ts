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
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
