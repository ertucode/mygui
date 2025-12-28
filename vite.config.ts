import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  base: "./",
  build: {
    outDir: "dist-react",
    sourcemap: true,
    minify: false, // Disable minification to preserve function names
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        preview: path.resolve(__dirname, "preview.html"),
      },
      output: {
        // Preserve original names for better debugging
        compact: false,
      },
    },
  },
  server: {
    port: 5123,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/ui"),
      "@common": path.resolve(__dirname, "./src/common"),
    },
  },
});
