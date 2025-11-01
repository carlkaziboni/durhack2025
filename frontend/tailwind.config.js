/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b1020",
        panel: "#121833",
        card: "#0f1730",
        text: "#e8eefc",
        muted: "#a7b2d6",
        accent: "#7aa2ff",
        good: "#3bd1a5",
        warn: "#ffd166",
        bad: "#ff6b6b",
        border: "#22305a",
      },
    },
  },
  plugins: [],
};
