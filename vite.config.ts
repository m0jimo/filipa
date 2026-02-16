import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "fs";
import path from "path";

/**
 * Vite plugin that inlines public/*.svg files into the built output
 * by replacing URL references with base64 data URIs in both JS bundles
 * and index.html (covers direct HTML references after viteSingleFile inlines JS).
 */
const inlineSvgAssets = () => {
  const publicDir = path.resolve(__dirname, "public");

  const assetsDir = path.resolve(__dirname, "src/assets");

  const findSvg = (filename: string): string | null => {
    for (const dir of [publicDir, assetsDir]) {
      const p = path.join(dir, filename);
      if (fs.existsSync(p)) return p;
    }
    return null;
  };

  const replaceSvgUrls = (content: string): string =>
    content.replace(/(['"])([^'"]*\.svg)\1/g, (_match, quote, src) => {
      const filename = path.basename(src);
      const svgPath = findSvg(filename);
      if (!svgPath) return `${quote}${src}${quote}`;
      const base64 = fs.readFileSync(svgPath).toString("base64");
      return `${quote}data:image/svg+xml;base64,${base64}${quote}`;
    });

  return {
    name: "inline-svg-assets",
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code) {
          chunk.code = replaceSvgUrls(chunk.code);
        }
      }
    },
    transformIndexHtml: replaceSvgUrls,
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), inlineSvgAssets(), viteSingleFile()],
  base: "./", // This is the key change - use relative paths
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
