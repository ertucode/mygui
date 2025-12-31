import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// stripFinalCssPlugin.ts
import type { Plugin } from "vite";
import type { OutputAsset } from "rollup";

export interface StripFinalCssOptions {
  shouldStrip: (line: string) => boolean;
}

export function stripCssPlugin(): Plugin {
  return {
    name: "strip-css",
    enforce: "post",

    transform(code, id) {
      // if (!id.includes(".css")) return null;
      const lines = code.split("\n");
      for (const line of lines) {
        if (line.includes(":where")) {
          const indexOf = line.indexOf(":where");
          const around = line.slice(indexOf - 80, indexOf + 80);
          throw new Error(around);
        }
      }
      return null;

      // const next = code.replace(/UNWANTED_MARKER[\s\S]*?;/g, "");
      // return next === code ? null : { code: next, map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    stripCssPlugin(),
    {
      name: "strip-css",
      apply: "build",
      generateBundle(_, bundle) {
        for (const file of Object.values(bundle)) {
          if (
            file.type === "asset" &&
            typeof file.source === "string" &&
            file.fileName.endsWith(".css")
          ) {
            for (let i = 0; i < file.source.length; i = i + 600) {
              const chunk = file.source.slice(i, i + 600);
              if (chunk.includes(":where")) {
                console.log("=============");
                console.log(chunk);
                console.log("=============");
              }
            }
          }
        }
      },
    },
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
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist-electron", "dist-react"],
  },
});
