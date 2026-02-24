import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env (VITE_PRODUCTION_MODE) from .env, .env.local, .env.[mode], etc.
  const env = loadEnv(mode, process.cwd(), "");
  const isProductionMode = env.VITE_PRODUCTION_MODE === "true";

  // Kapag hindi true ang VITE_PRODUCTION_MODE → build sa IIS path (dev/staging).
  // Kapag true → build sa default 'dist' (production).
  const outDir = isProductionMode
    ? "dist"
    : path.resolve("C:\\inetpub\\wwwroot\\fmis-budget-client");

  // Sa IIS path huwag i-empty ang folder: may aspnet_client at system files na locked.
  const emptyOutDir = isProductionMode;

  return {
  plugins: [react()],

  // 1. DEVELOPMENT SERVER SETTINGS
  // Ito ang settings habang nagko-code ka pa (npm run dev)
  server: {
    port: 3005,
    host: true, // Listen on all IPs (Network Access)
    allowedHosts: ["budget.fmis.local", "localhost", "127.0.0.1", "budget.nia.gov.ph"],
  },

  // 2. PRODUCTION BUILD SETTINGS
  // Ito ang settings pag nag-run ka na ng (npm run build)
  build: {
    outDir,
    // SECURITY: Itago ang original code sa browser DevTools
    sourcemap: false, 

    // PERFORMANCE: Gamitin ang mabilis na minifier
    minify: 'esbuild',

    // CLEANUP: Empty lang kapag 'dist'; sa IIS path hindi para iwas EPERM sa aspnet_client
    emptyOutDir,

    // OPTIMIZATION & CACHING STRATEGY
    rollupOptions: {
      output: {
        // A. VENDOR CHUNKING
        // Ihiwalay ang lahat ng libraries (node_modules) sa 'vendor.js'
        // Resulta: Mabilis mag-load ang app dahil naka-cache lang ang libraries.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },

        // B. FILE HASHING (Cache Busting)
        // Format: assets/filename-HASH.js
        // Resulta: Pag nagbago ka ng code, magbabago ang Hash, kaya pipilitin
        // ng browser na i-download ang bago (Automatic Update).
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  };
});