import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EDGE_EXECUTABLE = "C:/Program Files/Microsoft/Edge/Application/msedge.exe";
const OUTPUT_DIR = path.resolve(__dirname, "..", "..", "challenge-screenshots");

const TARGETS = [
  {
    key: "offchain",
    url: "https://bantahoffchain.up.railway.app/",
    expected: 6,
  },
  {
    key: "onchain",
    url: "https://bantahonchain.up.railway.app/",
    expected: 6,
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function markChallengeCards(page) {
  return page.evaluate(() => {
    const existing = new Set(
      Array.from(document.querySelectorAll("[data-shot-card]")).map((el) => el.getAttribute("data-shot-card"))
    );

    const textLooksLikeCard = (text) =>
      /Stake/i.test(text) &&
      /Win/i.test(text) &&
      (/VS/i.test(text) || /Yes/i.test(text) || /No/i.test(text));

    const isReasonableCardBox = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width >= 260 && rect.height >= 130 && rect.height <= 900;
    };

    const candidates = [];
    const headers = Array.from(document.querySelectorAll('[data-testid="link-challenge-detail"], h1, h2, h3, h4, h5, h6, span, button'));

    for (const node of headers) {
      let current = node;
      for (let depth = 0; depth < 10 && current; depth += 1) {
        const text = current.innerText || "";
        if (textLooksLikeCard(text) && isReasonableCardBox(current)) {
          candidates.push(current);
          break;
        }
        current = current.parentElement;
      }
    }

    const unique = [];
    for (const el of candidates) {
      if (!unique.some((u) => u === el)) unique.push(el);
    }

    // Keep mostly card-like nodes and avoid huge wrappers.
    const filtered = unique.filter((el) => {
      const text = el.innerText || "";
      const stakeCount = (text.match(/Stake/gi) || []).length;
      const winCount = (text.match(/Win/gi) || []).length;
      return stakeCount >= 1 && stakeCount <= 2 && winCount >= 1 && winCount <= 2;
    });

    filtered.forEach((el, idx) => {
      const existingId = el.getAttribute("data-shot-card");
      if (existingId) return;
      let idNum = idx + 1;
      while (existing.has(String(idNum))) idNum += 1;
      const id = String(idNum);
      el.setAttribute("data-shot-card", id);
      existing.add(id);
    });

    return document.querySelectorAll("[data-shot-card]").length;
  });
}

async function captureCards(page, target, outDir) {
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(5_000);

  let marked = await markChallengeCards(page);
  let attempts = 0;
  while (marked < target.expected && attempts < 12) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1200);
    marked = await markChallengeCards(page);
    attempts += 1;
  }

  const cards = page.locator("[data-shot-card]");
  const count = await cards.count();
  const toCapture = Math.min(target.expected, count);

  for (let i = 0; i < toCapture; i += 1) {
    const card = cards.nth(i);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const shotPath = path.join(outDir, `${target.key}-challenge-${String(i + 1).padStart(2, "0")}.png`);
    await card.screenshot({ path: shotPath });
  }

  const pagePath = path.join(outDir, `${target.key}-full-page.png`);
  await page.screenshot({ path: pagePath, fullPage: true });

  return { found: count, captured: toCapture };
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  for (const target of TARGETS) {
    await ensureDir(path.join(OUTPUT_DIR, target.key));
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE_EXECUTABLE,
  });

  try {
    for (const target of TARGETS) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 2200 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const outDir = path.join(OUTPUT_DIR, target.key);
      const result = await captureCards(page, target, outDir);
      console.log(`[${target.key}] found=${result.found} captured=${result.captured} output=${outDir}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

