import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import Markdown from "unplugin-vue-markdown/vite";
import VueRouter from "unplugin-vue-router/vite";
import vuetify from "vite-plugin-vuetify";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

export default defineConfig({
  // Shown in the About dialog; set from package.json so `npm version` keeps it current.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // This ensures assets (JS/CSS) load from the correct subfolder
  base: "/",
  plugins: [
    vue({
      include: [/\.vue$/, /\.md$/], // treats .md files as Vue components
    }),
    VueRouter(),
    vuetify({ autoImport: true }),
    Markdown({
      markdownItOptions: {
        html: true,
        linkify: true,
        typographer: true,
      },
    }),
  ],
  build: {
    outDir: "dist", // Keep it standard for the action
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
