/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F2F4F6",
        "paper-raised": "#FFFFFF",
        ink: "#191F28",
        "ink-soft": "#333D4B", // 설명·본문: 보조(ink-faint)보다 확실히 진하게
        "ink-faint": "#5B6573", // 흰색·#F2F4F6 위 작은 글자 4.5:1 이상
        line: "#E5E8EB",
        // shortcut: "amber" token now holds the trust-blue accent; rename across components if the palette changes again
        amber: "#1B64DA", // 작은 파란 글자·흰 글자 버튼 모두 4.5:1 이상
        "amber-soft": "#E8F3FF",
        "brand-blue": "#2B4C7E",
        "brand-blue-soft": "#E9EEF6",
        green: "#1E7A4C",
        "green-soft": "#E3F2EA",
        red: "#C0392B",
        up: "#C81E5A", // 상승: 공포 게이지의 주홍빛 빨강과 구분되는 자홍빛, 작은 글자 대비 5:1
        down: "#1B64DA", // 하락
        "red-soft": "#FBE6E3",
      },
      // 가독성: 보조 글자 12→13px, 본문 14→15px (Pretendard 기준)
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
      },
      // Motion identity (Corporate): one curve, three durations (150/250/400ms)
      transitionTimingFunction: { brand: "cubic-bezier(0.2, 0, 0, 1)" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: { from: { opacity: "0", transform: "translateY(-4px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "sheet-up": { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-up": "fade-up 400ms cubic-bezier(0.2, 0, 0, 1) both",
        "fade-in": "fade-in 250ms cubic-bezier(0.2, 0, 0, 1) both",
        pop: "pop 150ms cubic-bezier(0.2, 0, 0, 1) both",
        "sheet-up": "sheet-up 400ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
      },
      fontFamily: {
        // Headings use Pretendard bold (fintech standard); "serif" key kept so components stay unchanged
        serif: ["'Pretendard Variable'", "Pretendard", "sans-serif"],
        sans: ["'Pretendard Variable'", "Pretendard", "sans-serif"],
        mono: ["'Pretendard Variable'", "Pretendard", "sans-serif"], // figures: tabular-nums set globally
      },
    },
  },
  plugins: [],
};
