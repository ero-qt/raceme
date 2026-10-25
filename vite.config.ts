import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { normalizeBasePath } from "./src/shared/base-path.ts";

const basePath = normalizeBasePath(process.env.RACEME_BASE_PATH ?? "");

export default defineConfig({
  base: `${basePath}/`,
  plugins: [solid(), vanillaExtractPlugin()],
  build: { outDir: "dist/client", target: "es2022" },
  server: {
    proxy: {
      [`${basePath}/api`]: { target: "http://127.0.0.1:8790", ws: true, changeOrigin: false },
    },
  },
});
