import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "./",

  plugins: [react()],

  server: {
    port: 3005,
    open: false,
    proxy: {
      // Forward all API calls to the Express backend — same-origin as far as the browser is concerned
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      // Forward Socket.IO (WebSocket) to the backend
      '/socket.io': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      // Forward uploaded files (attachments, etc.)
      '/uploads': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
    },
  },

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