import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005,
    host: true, // Listen on all interfaces so http://budget.fmis.local:3005 works (hosts: 127.0.0.1 budget.fmis.local)
    allowedHosts: ["budget.fmis.local", "localhost", "127.0.0.1"],
    // Pwedeng i-enable ang https dito kung kailangan sa local dev
  },
  build: {
    // 1. Tatanggalin nito ang link sa original source code sa browser DevTools
    sourcemap: false, 
    
    // 2. I-minify ang code (default ang esbuild, na mabilis at secure)
    minify: 'esbuild',
    
    // 3. Opsyonal: Nililinis ang dist folder bawat build para walang lumang files
    emptyOutDir: true,

    // 4. Pinapaliit ang size ng chunks para mas mabilis i-load sa IIS
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 3005,
//     // https: {

//     // }
//   },
// });
