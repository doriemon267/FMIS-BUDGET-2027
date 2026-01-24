import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3005,
    strictPort: true, 
    allowedHosts: [
      'budget.fmis.local', // Ito ang importante para sa Nginx setup natin
    ],
  },
  // Dahil walang "build" block dito, automatic sa 'dist' folder niya ilalagay. 
  // PERFECT ito para sa PM2 serve config natin.
});