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
        // Shared React/CommonJS helpers must not pull optional Pixi into Studio.
        manualChunks(id) {
          if (
            id.includes("commonjsHelpers") ||
            /\/node_modules\/(react|react-dom|scheduler)\//.test(id)
          )
            return "react";
          if (/\/node_modules\/(@pixi\/|pixi\.js\/)/.test(id)) return "pixi";
          if (id.includes("/node_modules/@tauri-apps/")) return "tauri";
          if (id.includes("/node_modules/zustand/")) return "vendor";
        },
      },
    },
  },
});
