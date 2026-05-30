import { cp, mkdir, stat } from "fs/promises";
import path from "path";

const rootDir = process.cwd();
const distPublicDir = path.join(rootDir, "dist", "public");

const staticCopies = [
  {
    from: path.join(rootDir, "public"),
    to: distPublicDir,
    label: "root public assets",
  },
  {
    from: path.join(rootDir, "map"),
    to: path.join(distPublicDir, "map"),
    label: "map assets",
  },
  {
    from: path.join(rootDir, "attached_assets"),
    to: path.join(distPublicDir, "attached_assets"),
    label: "attached assets",
  },
];

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

await mkdir(distPublicDir, { recursive: true });

for (const copy of staticCopies) {
  if (!(await pathExists(copy.from))) {
    console.log(`[vercel-build] skipped missing ${copy.label}: ${copy.from}`);
    continue;
  }

  await cp(copy.from, copy.to, { recursive: true, force: true });
  console.log(`[vercel-build] copied ${copy.label}`);
}
