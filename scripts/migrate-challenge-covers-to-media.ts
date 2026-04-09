import fs from "fs/promises";
import path from "path";
import { pool } from "../server/db";
import { storeUploadedImage } from "../server/mediaStorage";

type ChallengeCoverRow = {
  id: number;
  cover_image_url: string | null;
};

function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".jpg":
    case ".jpeg":
    case ".jfif":
    default:
      return "image/jpeg";
  }
}

async function main() {
  const result = await pool.query<ChallengeCoverRow>(
    `SELECT id, cover_image_url
       FROM challenges
      WHERE cover_image_url LIKE '/attached_assets/%'
      ORDER BY id ASC`,
  );

  let migrated = 0;
  let missing = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const rawUrl = String(row.cover_image_url || "").trim();
    if (!rawUrl) {
      skipped += 1;
      continue;
    }

    const filename = rawUrl.replace(/^\/attached_assets\//, "");
    const filePath = path.resolve(process.cwd(), "attached_assets", filename);

    try {
      const buffer = await fs.readFile(filePath);
      const stored = await storeUploadedImage(
        {
          buffer,
          mimetype: detectMimeType(filePath),
          originalname: filename,
        },
        { prefix: "challenge-cover" },
      );

      await pool.query(
        `UPDATE challenges
            SET cover_image_url = $1
          WHERE id = $2`,
        [stored.imageUrl, row.id],
      );

      migrated += 1;
      console.log(`migrated challenge ${row.id} -> ${stored.imageUrl}`);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        missing += 1;
        console.warn(`missing file for challenge ${row.id}: ${filePath}`);
        continue;
      }
      console.error(`failed challenge ${row.id}:`, error?.message || error);
    }
  }

  console.log(
    JSON.stringify({
      total: result.rows.length,
      migrated,
      missing,
      skipped,
    }),
  );
}

main()
  .catch((error) => {
    console.error("challenge cover migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
