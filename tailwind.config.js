/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F4",
        "paper-raised": "#FFFFFF",
        ink: "#16233F",
        "ink-soft": "#4B5670",
        "ink-faint": "#8A90A0",
        line: "#E4E6E1",
        amber: "#C98A2E",
        "amber-soft": "#F3E3C8",
        "brand-blue": "#3D5A80",
        "brand-blue-soft": "#E4EAF1",
        green: "#4F7942",
        "green-soft": "#E5EEE1",
        red: "#B5493A",
        "red-soft": "#F3E1DD",
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Noto Sans KR'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
