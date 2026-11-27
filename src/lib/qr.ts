import "server-only";
import { safeEqual, sign } from "@/lib/crypto";

/** A new QR code every 15 seconds. A scanned code is accepted for its own window and the next one (≤ 30 s). */
export const QR_WINDOW_MS = 15_000;

function windowAt(ms: number) {
  return Math.floor(ms / QR_WINDOW_MS);
}

export function currentQrToken(now = Date.now()) {
  const w = windowAt(now);
  return {
    token: `${w.toString(36)}.${sign("qr", String(w)).slice(0, 22)}`,
    expiresAt: (w + 1) * QR_WINDOW_MS,
  };
}

export function verifyQrToken(token: string, now = Date.now()): boolean {
  const [wPart, sig] = token.split(".");
  if (!wPart || !sig) return false;
  const w = parseInt(wPart, 36);
  if (!Number.isFinite(w)) return false;
  const current = windowAt(now);
  if (w !== current && w !== current - 1) return false;
  return safeEqual(sig, sign("qr", String(w)).slice(0, 22));
}
