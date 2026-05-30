import { build } from "esbuild";
import fs from "fs";
import path from "path";

const functionDir = path.resolve(".vercel/output/functions/api/[...slug].func");
const outfile = path.join(functionDir, "api/[...slug].js");

if (!fs.existsSync(functionDir)) {
  throw new Error(`Vercel function output was not found: ${functionDir}`);
}

fs.mkdirSync(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: ["api/[...slug].ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  external: ["./vite"],
  logLevel: "info",
});

console.log(`[vercel-bundle-output] bundled API function to ${outfile}`);
