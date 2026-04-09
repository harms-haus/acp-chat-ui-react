import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@harms-haus/acp-chat-core": path.resolve(__dirname, "../../packages/acp-chat-core/src"),
      "@harms-haus/acp-chat-react": path.resolve(__dirname, "../../packages/acp-chat-react/src"),
    },
  },
  server: {
    watch: {
      ignored: [
        "**/node_modules/**",
        "!**/packages/acp-chat-core/**",
        "!**/packages/acp-chat-react/**",
      ],
    },
  },
  build: {
    outDir: "dist",
  },
});