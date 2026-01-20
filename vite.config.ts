import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: getManualChunks(),
      },
    },
  },
});

function getManualChunks(): Record<string, string[]> {
  return {
    // PixiJS (~420 kB) - 가장 큰 의존성
    pixi: ["pixi.js", "@pixi/react"],
    // React (~140 kB)
    react: ["react", "react-dom"],
    // Tauri APIs (~30 kB)
    tauri: [
      "@tauri-apps/api",
      "@tauri-apps/plugin-fs",
      "@tauri-apps/plugin-shell",
    ],
    // 상태 관리 (~10 kB)
    vendor: ["zustand"],
  };
}
