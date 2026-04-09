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
  const coverImageDataUri = await resolveImageDataUri(
    challenge.coverImageUrl || challenge.coverImage || challenge.image || challenge.imageUrl,
    baseUrl,
  );

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
  const titleLines = wrapText(String(challenge.title || ""), 36, 2);
  const participantLabel = challenge.challenged
    ? `${challengerSide} @${challengerName}  vs  ${challengedSide} @${challengedName}`
    : `${challengerSide} @${challengerName}  vs  OPEN`;
  const agentLine = [challengerAgent?.name, challengedAgent?.name].filter(Boolean).join("  |  ");
  const yesHolder = challengerSide === "YES"
    ? challengerName
    : challengedSide === "YES"
      ? challengedName
      : "Open";
  const noHolder = challengerSide === "NO"
    ? challengerName
    : challengedSide === "NO"
      ? challengedName
      : "Open";
  const normalizedStatus = statusLabel.toLowerCase();
  const statusBg = normalizedStatus.includes("resolved")
    ? "#e8fff4"
    : normalizedStatus.includes("active")
      ? "#eef4ff"
      : normalizedStatus.includes("pending")
        ? "#fff6e8"
        : "#eef2ff";
  const statusColor = normalizedStatus.includes("resolved")
    ? "#0f9f68"
    : normalizedStatus.includes("pending")
      ? "#c77b1a"
      : "#2453e6";
  const yesHolderDisplay = yesHolder === "Open" ? "Open Slot" : `@${yesHolder}`;
  const noHolderDisplay = noHolder === "Open" ? "Open Slot" : `@${noHolder}`;

  const coverMarkup = coverImageDataUri
    ? `<image href="${coverImageDataUri}" x="108" y="148" width="132" height="132" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)" />`
    : `
      <rect x="108" y="148" width="132" height="132" rx="24" fill="#e6ebf2" />
      <rect x="108" y="148" width="66" height="132" fill="#7a93c5" />
      <rect x="174" y="148" width="66" height="132" fill="#e78984" />
      <rect x="108" y="240" width="132" height="40" fill="#dac482" />
    `;

  const agentTextMarkup = agentLine
    ? `<text x="108" y="458" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" fill="#41506b">${escapeXml(agentLine)}</text>`
    : "";

  const logoMarkup = logoDataUri
    ? `<image href="${logoDataUri}" x="74" y="34" width="214" height="42" preserveAspectRatio="xMinYMin meet" />`
    : `<text x="76" y="64" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#ffffff">Bantah</text>`;

  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
          <stop stop-color="#7440FF" />
          <stop offset="0.58" stop-color="#8A5BFF" />
          <stop offset="1" stop-color="#5A2FE2" />
        </linearGradient>
        <radialGradient id="limeGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(930 548) rotate(19) scale(305 176)">
          <stop stop-color="#BEFF07" stop-opacity="0.38" />
          <stop offset="1" stop-color="#BEFF07" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="softWhiteGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(210 88) rotate(32) scale(240 150)">
          <stop stop-color="#FFFFFF" stop-opacity="0.16" />
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <clipPath id="coverClip">
          <rect x="108" y="148" width="132" height="132" rx="24" />
        </clipPath>
      </defs>

      <rect width="1200" height="630" fill="url(#bg)" />
      <rect width="1200" height="630" fill="url(#softWhiteGlow)" />
      <ellipse cx="930" cy="565" rx="255" ry="166" fill="url(#limeGlow)" />

      ${logoMarkup}

      <rect x="430" y="24" width="340" height="52" rx="26" fill="rgba(9,30,95,0.88)" stroke="rgba(255,255,255,0.32)" />
      <text x="600" y="56" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#ffffff">${escapeXml(`@${challengerName} vs @${challengedName}`)}</text>

      <rect x="18" y="84" width="1164" height="506" rx="28" fill="#fafcff" />
      <rect x="592" y="75" width="16" height="28" rx="8" fill="#2961ff" />

      ${coverMarkup}

      ${titleLines.map((line, index) => `
        <text x="108" y="${index === 0 ? 336 : 376}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#141821">${escapeXml(line)}</text>
      `).join("")}

      <text x="108" y="424" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#56657f">${escapeXml(participantLabel)}</text>
      ${agentTextMarkup}
      <text x="108" y="486" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#2b56de">Open on Bantah</text>

      <line x1="690" y1="144" x2="690" y2="532" stroke="#d5dce7" stroke-width="2" stroke-dasharray="5 6" />

      <rect x="766" y="158" width="174" height="46" rx="16" fill="${statusBg}" />
      <text x="853" y="188" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="${statusColor}">${escapeXml(statusLabel)}</text>

      <text x="766" y="244" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#1f9d61">YES</text>
      <text x="1062" y="244" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" text-anchor="end" fill="#151922">${escapeXml(yesHolderDisplay)}</text>

      <text x="766" y="292" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#e24a4a">NO</text>
      <text x="1062" y="292" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" text-anchor="end" fill="#151922">${escapeXml(noHolderDisplay)}</text>

      <line x1="766" y1="320" x2="1062" y2="320" stroke="#dbe2ee" stroke-width="2" />

      <text x="766" y="364" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6c7688">Stake</text>
      <text x="1062" y="364" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" text-anchor="end" fill="#151922">${escapeXml(stakeText)}</text>

      <text x="766" y="412" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6c7688">To win</text>
      <text x="766" y="470" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" fill="#151922">${escapeXml(payoutText)}</text>

      <text x="766" y="532" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#46566f">${escapeXml(chainLabel)}</text>
      <text x="1062" y="532" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" text-anchor="end" fill="#46566f">${escapeXml(`Ends ${deadlineLabel}`)}</text>
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
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
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
