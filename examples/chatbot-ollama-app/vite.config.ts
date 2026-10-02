import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3031",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  }
});
