import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom/") || id.includes("node_modules/react/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "supabase-vendor";
          }
          if (id.includes("node_modules/pdfjs-dist/")) {
            return "pdfjs-vendor";
          }
          if (
            id.includes("node_modules/mammoth/") ||
            id.includes("node_modules/jszip/") ||
            id.includes("node_modules/pako/") ||
            id.includes("node_modules/lie/") ||
            id.includes("node_modules/immediate/") ||
            id.includes("node_modules/underscore/") ||
            id.includes("node_modules/@xmldom/") ||
            id.includes("node_modules/saxes/")
          ) {
            return "docx-vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 550,
    target: "es2020",
  },
});
