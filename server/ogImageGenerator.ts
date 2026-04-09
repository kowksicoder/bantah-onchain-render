import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { CHALLENGE_PLATFORM_FEE_RATE } from "@shared/feeConfig";
import type { IStorage } from "./storage";

const CHAIN_LABELS: Record<number, string> = {
  8453: "Base",
  56: "BSC",
  42161: "Arbitrum",
  130: "Unichain",
  1: "Ethereum",
};

const BANTAH_BLUE_LOGO_PATH = path.resolve(process.cwd(), "client/public/assets/bantahblue.svg");

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTokenAmount(amount: unknown, tokenSymbol?: string | null): string {
  const numericAmount = Number(amount || 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const formattedAmount = Number.isInteger(safeAmount)
    ? safeAmount.toString()
    : safeAmount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      });
  const symbol = String(tokenSymbol || "").trim().toUpperCase() || "ETH";
  return `${formattedAmount} ${symbol}`;
}

function formatPayout(amount: unknown, tokenSymbol?: string | null): string {
  const numericAmount = Number(amount || 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const payout = safeAmount * 2 - safeAmount * CHALLENGE_PLATFORM_FEE_RATE;
  return formatTokenAmount(payout, tokenSymbol);
}

function formatDateLabel(value: unknown): string {
  if (!value) return "No deadline";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function resolveChainLabel(chainId: unknown): string {
  const numericChainId = Number(chainId);
  return CHAIN_LABELS[numericChainId] || `Chain ${numericChainId || "Unknown"}`;
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || current.length === 0) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(" ").length > lines.join(" ").length) {
    const lastIndex = Math.min(lines.length, maxLines) - 1;
    lines[lastIndex] = `${lines[lastIndex].replace(/\.\.\.$/, "").slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
  }

  return lines.slice(0, maxLines);
}

function guessMimeType(filePath: string): string {
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
    default:
      return "image/jpeg";
  }
}

async function toDataUri(buffer: Buffer, mimeType: string): Promise<string> {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function loadFileAsDataUri(filePath: string, mimeType = guessMimeType(filePath)): Promise<string | null> {
  try {
    const buffer = await fs.readFile(filePath);
    return toDataUri(buffer, mimeType);
  } catch {
    return null;
  }
}

async function loadRemoteImageAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const arrayBuffer = await response.arrayBuffer();
    return toDataUri(Buffer.from(arrayBuffer), contentType);
  } catch {
    return null;
  }
}

async function resolveImageDataUri(source: unknown, baseUrl: string): Promise<string | null> {
  const raw = String(source || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;

  if (/^https?:\/\//i.test(raw)) {
    return loadRemoteImageAsDataUri(raw);
  }

  if (raw.startsWith("/attached_assets/")) {
    const absolutePath = path.resolve(process.cwd(), raw.slice(1));
    const localData = await loadFileAsDataUri(absolutePath);
    if (localData) return localData;
    return loadRemoteImageAsDataUri(`${baseUrl}${raw}`);
  }

  if (raw.startsWith("/assets/")) {
    const assetPath = path.resolve(process.cwd(), "client/public", raw.replace(/^\/assets\//, "assets/"));
    return loadFileAsDataUri(assetPath);
  }

  if (raw.startsWith("/")) {
    return loadRemoteImageAsDataUri(`${baseUrl}${raw}`);
  }

  return null;
}

async function buildChallengeCardSvg(challenge: any, storage: IStorage, baseUrl: string): Promise<string> {
  const logoDataUri = (await loadFileAsDataUri(BANTAH_BLUE_LOGO_PATH, "image/svg+xml")) || "";
  const coverImageDataUri = await resolveImageDataUri(challenge.coverImageUrl, baseUrl);

  const challengerAgent = challenge.challengerAgentId
    ? await storage.getAgentById(String(challenge.challengerAgentId))
    : undefined;
  const challengedAgent = challenge.challengedAgentId
    ? await storage.getAgentById(String(challenge.challengedAgentId))
    : undefined;

  const challengerName = challengerAgent?.name
    || challenge.challengerUser?.username
    || challenge.challengerUser?.firstName
    || "Open";
  const challengedName = challengedAgent?.name
    || challenge.challengedUser?.username
    || challenge.challengedUser?.firstName
    || "Open";

  const challengerSide = String(challenge.challengerSide || "").toUpperCase() || "OPEN";
  const challengedSide = String(challenge.challengedSide || "").toUpperCase() || "OPEN";
  const stakeText = formatTokenAmount(challenge.amount, challenge.tokenSymbol);
  const payoutText = formatPayout(challenge.amount, challenge.tokenSymbol);
  const statusLabel = String(challenge.status || "open").toUpperCase();
  const deadlineLabel = formatDateLabel(challenge.dueDate);
  const chainLabel = resolveChainLabel(challenge.chainId);
  const titleLines = wrapText(String(challenge.title || ""), 34, 2);
  const participantLabel = challenge.challenged
    ? `${challengerSide} @${challengerName}  vs  ${challengedSide} @${challengedName}`
    : `${challengerSide} @${challengerName}  vs  OPEN`;
  const agentLine = [challengerAgent?.name, challengedAgent?.name].filter(Boolean).join("  •  ");
  const statusColor = challengedSide === "NO" ? "#ef4444" : "#22c55e";
  const sideChipBg = challengedSide === "NO" ? "#fde7e7" : "#e8ffe0";

  const coverMarkup = coverImageDataUri
    ? `<image href="${coverImageDataUri}" x="128" y="163" width="88" height="88" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)" />`
    : `
      <rect x="128" y="163" width="88" height="88" rx="20" fill="#e6ebf2" />
      <rect x="128" y="163" width="44" height="88" fill="#7a93c5" />
      <rect x="172" y="163" width="44" height="88" fill="#e78984" />
      <rect x="128" y="225" width="88" height="26" fill="#dac482" />
    `;

  const agentTextMarkup = agentLine
    ? `<text x="128" y="374" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" fill="#41506b">${escapeXml(agentLine)}</text>`
    : "";

  const logoMarkup = logoDataUri
    ? `<image href="${logoDataUri}" x="446" y="528" width="306" height="62" preserveAspectRatio="xMinYMin meet" />`
    : `<text x="600" y="568" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" text-anchor="middle" fill="#ffffff">Bantah</text>`;

  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
          <stop stop-color="#133fd0" />
          <stop offset="1" stop-color="#0b1d57" />
        </linearGradient>
        <linearGradient id="glow" x1="760" y1="530" x2="1060" y2="620" gradientUnits="userSpaceOnUse">
          <stop stop-color="#24e6a3" stop-opacity="0.35" />
          <stop offset="1" stop-color="#24e6a3" stop-opacity="0" />
        </linearGradient>
        <clipPath id="coverClip">
          <rect x="128" y="163" width="88" height="88" rx="20" />
        </clipPath>
      </defs>

      <rect width="1200" height="630" fill="url(#bg)" />
      <ellipse cx="930" cy="565" rx="240" ry="160" fill="url(#glow)" />

      ${Array.from({ length: 27 }).map((_, row) =>
        Array.from({ length: 53 }).map((__, col) => {
          const x = 18 + col * 22;
          const y = 18 + row * 22;
          return `<rect x="${x}" y="${y}" width="4" height="4" fill="rgba(255,255,255,${(row + col) % 2 === 0 ? 0.24 : 0.10})" />`;
        }).join("")
      ).join("")}

      <rect x="465" y="16" width="273" height="46" rx="23" fill="rgba(9,30,95,0.88)" stroke="rgba(255,255,255,0.4)" />
      <text x="602" y="45" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#ffffff">${escapeXml(`@${challengerName} vs @${challengedName}`)}</text>

      <rect x="96" y="130" width="1004" height="344" rx="26" fill="#fafcff" />
      <rect x="592" y="121" width="16" height="28" rx="8" fill="#2961ff" />

      ${coverMarkup}

      ${titleLines.map((line, index) => `
        <text x="128" y="${index === 0 ? 314 : 354}" font-family="Arial, Helvetica, sans-serif" font-size="33" font-weight="700" fill="#141821">${escapeXml(line)}</text>
      `).join("")}

      <text x="128" y="408" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#56657f">${escapeXml(participantLabel)}</text>
      ${agentTextMarkup}
      <text x="128" y="438" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#2b56de">Open on Bantah</text>

      <line x1="682" y1="154" x2="682" y2="450" stroke="#d5dce7" stroke-width="2" stroke-dasharray="5 6" />

      <rect x="758" y="178" width="132" height="54" rx="16" fill="${sideChipBg}" />
      <text x="824" y="214" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="${statusColor}">${escapeXml(challengedSide)}</text>

      <text x="758" y="272" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6c7688">Stake</text>
      <text x="1048" y="272" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="end" fill="#151922">${escapeXml(stakeText)}</text>

      <text x="758" y="324" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6c7688">Status</text>
      <text x="1048" y="324" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="end" fill="#151922">${escapeXml(statusLabel)}</text>

      <text x="758" y="376" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6c7688">To win</text>
      <text x="758" y="444" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" fill="#151922">${escapeXml(payoutText)}</text>

      <text x="758" y="474" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#46566f">${escapeXml(`${chainLabel}  |  Ends ${deadlineLabel}`)}</text>

      ${logoMarkup}
    </svg>
  `;
}

async function generateEventSvg(event: any): Promise<string> {
  const title = escapeXml(String(event.title || "Bantah event"));
  const category = escapeXml(String(event.category || "general").toUpperCase());
  const participantCount = Number(event.participantCount || 0);
  const entryFee = escapeXml(String(event.entryFee || "0"));

  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
          <stop stop-color="#0f8b6f" />
          <stop offset="1" stop-color="#0a5d4d" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)" />
      <rect x="90" y="104" width="1020" height="422" rx="30" fill="rgba(255,255,255,0.96)" />
      <text x="130" y="180" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#0f172a">Bantah Event</text>
      <text x="130" y="264" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#0f172a">${title}</text>
      <text x="130" y="342" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#475569">Category: ${category}</text>
      <text x="130" y="386" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#475569">Entry fee: ${entryFee}</text>
      <text x="130" y="430" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#475569">Participants: ${participantCount}</text>
    </svg>
  `;
}

export function setupOGImageRoutes(app: any, storage: IStorage) {
  app.get("/api/og/challenges/:id.png", async (req: Request, res: Response) => {
    try {
      const challengeId = Number(req.params.id);
      const challenge = await storage.getChallengeById(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const svg = await buildChallengeCardSvg(challenge, storage, baseUrl);
      const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=900");
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error generating challenge OG image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  app.get("/api/og/challenge/:id", async (req: Request, res: Response) => {
    req.url = `/api/og/challenges/${req.params.id}.png`;
    res.redirect(302, `/api/og/challenges/${req.params.id}.png`);
  });

  app.get("/api/og/event/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      const event = await storage.getEventById(eventId);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const svg = await generateEventSvg(event);
      const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=900");
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error generating event OG image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}
