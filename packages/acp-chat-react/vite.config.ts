import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        browser: resolve(__dirname, "src/index.browser.ts"),
      },
      name: "AcpChatReact",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "@base-ui-components/react", "@acp/chat-core"],
    },
  },
});