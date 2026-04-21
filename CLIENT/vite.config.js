import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Para sa modern ESM directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Base path para sa relative loading ng assets
  base: "./",

  plugins: [react()],

  resolve: {
    alias: {
      // Shortcut para sa malinis na imports (e.g., import X from "@/components/X")
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 3005, // Ang address na bibisitahin mo sa browser (DEV)
    strictPort: true, // Mag-e-error pag occupied ang 3005 imbes na mag-auto switch
    proxy: {
      // Kapag ang frontend ay tumawag sa "/api", ipapasa ito sa Express (5005)
      "/api": {
        target: "http://localhost:5005",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  optimizeDeps: {
    include: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },

  build: {
    // Dito ilalagay ni Vite ang files para mabasa ni Node/Express
    outDir: path.resolve(__dirname, "../SERVER/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",

    rollupOptions: {
      output: {
        // Maayos na code splitting para sa performance
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            if (id.includes("@dnd-kit")) {
              return "vendor-dnd";
            }
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