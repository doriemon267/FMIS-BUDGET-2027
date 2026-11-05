import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",

  plugins: [react(), tailwindcss()],

  server: {
    port: 3005,
    open: false,
    // Explicitly set HMR client port para maiwasan ang socket drops
    hmr: {
      clientPort: 3005,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        secure: false,
      },
      // Pansamantalang alisin o i-disable ang ws proxy kung direktang kumokonekta ang socket.io client
      '/socket.io': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        ws: false, // Gawing false para iwasan ang Node stream aborts
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5005',
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