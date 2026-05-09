import {
  bantahBroWalletActionSchema,
  type BantahBroWalletAction,
} from "./bantahBroWallet";

function base64UrlEncodeUtf8(input: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64url");
  }

  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeUtf8(input: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64url").toString("utf8");
  }

  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeBantahBroWalletActionParam(action: BantahBroWalletAction) {
  const validated = bantahBroWalletActionSchema.parse(action);
  return base64UrlEncodeUtf8(JSON.stringify(validated));
}

export function decodeBantahBroWalletActionParam(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const decoded = base64UrlDecodeUtf8(raw);
    return bantahBroWalletActionSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
}
