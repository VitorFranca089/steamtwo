import crypto from "node:crypto";

/** Generates an opaque, URL-safe token plus the SHA-256 hash that gets persisted. The raw token is only ever sent by e-mail, never stored. */
export function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
