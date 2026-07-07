import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config - React plugin gives us JSX support + fast refresh in dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
