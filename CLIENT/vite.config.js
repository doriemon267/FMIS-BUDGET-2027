import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "./",

  plugins: [react()],

  optimizeDeps: {
    include: ["@dnd-kit/core", "@dnd-kit/sortable"],
  },

  build: {
    outDir: path.resolve(__dirname, "../SERVER/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
