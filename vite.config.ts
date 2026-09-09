/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Phosphor ships six weights per icon (~270 KB for the icons we use); the app renders only regular and fill
 * (see IconWeight in src/ui/icons.tsx). Drop the other four from the production bundle.
 */
function phosphorUsedWeightsOnly(): Plugin {
  return {
    name: "phosphor-used-weights-only",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (!/@phosphor-icons\/react\/dist\/defs\/[^/]+\.es\.js$/.test(id)) return null;
      return { code: code.replace(/\[\s*"(?:bold|duotone|light|thin)",[\s\S]*?\n  \],?/g, ""), map: null };
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), phosphorUsedWeightsOnly()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "eslint-rules/**/*.test.js", "tests/**/*.test.js"],
    clearMocks: true,
  },
}));
