import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Preto elegante — cor principal da identidade CPA
        navy: {
          50:  "#f5f5f5",
          100: "#ebebeb",
          200: "#d1d1d1",
          300: "#a8a8a8",
          400: "#737373",
          500: "#4d4d4d",
          600: "#333333",
          700: "#222222",
          800: "#111111",
          900: "#080808",
        },
        // Dourado CPA — cor de destaque
        gold: {
          50:  "#faf8f0",
          100: "#f3ecda",
          200: "#e5d0a8",
          300: "#d4b860",
          400: "#c9a84c",
          500: "#c4a44a",
          600: "#a88830",
          700: "#8a6e22",
          800: "#6e571b",
          900: "#584616",
        },
        // Fundo marfim quente
        cream: "#f8f7f5",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
