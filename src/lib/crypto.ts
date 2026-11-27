import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { serverEnv } from "@/lib/env";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** HMAC-SHA256 of `message`, base64url. `purpose` separates keys for different uses. */
export function sign(purpose: string, message: string): string {
  return createHmac("sha256", `${purpose}:${serverEnv.appSecret}`).update(message).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomKey(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** 6-digit PIN, never starting with 0 (so spreadsheets don't drop it). */
export function generatePin(): string {
  return String(randomInt(100000, 1000000));
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return ["scrypt", salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scryptAsync(pin, Buffer.from(saltB64, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}
