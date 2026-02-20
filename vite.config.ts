import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/@supabase")) return "supabase-vendor";
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion")) return "motion-vendor";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "charts-vendor";
          if (id.includes("node_modules/date-fns")) return "date-vendor";
          return undefined;
        },
      },
    },
  },
}));
