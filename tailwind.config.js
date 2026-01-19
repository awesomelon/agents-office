/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "office-bg": "#2a2a3d",
        "office-floor": "#3d3d5c",
        "office-wall": "#4a4a6a",
        "inbox-bg": "#1a1a2e",
        "agent-idle": "#6b7280",
        "agent-working": "#22c55e",
        "agent-error": "#ef4444",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
    },
  },
  plugins: [],
};
