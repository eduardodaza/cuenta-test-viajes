/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(260 20% 98%)",
        foreground: "hsl(260 30% 12%)",
        primary: {
          DEFAULT: "hsl(12 85% 55%)",
          soft: "hsl(12 85% 55% / 0.08)",
        },
        accent: "hsl(260 60% 30%)",
        muted: "hsl(260 10% 45%)",
        border: "hsl(260 30% 12% / 0.1)",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      letterSpacing: {
        widest2: "0.3em",
      },
      boxShadow: {
        manifest: "0 32px 64px -16px rgba(0,0,0,0.08)",
      },
      keyframes: {
        revealUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        reveal: "revealUp 0.8s cubic-bezier(0.19,1,0.22,1) both",
      },
    },
  },
  plugins: [],
};
