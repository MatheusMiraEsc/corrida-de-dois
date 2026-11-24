import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token secreto do jogador: 32 bytes aleatórios em base64url (mostrado só uma vez). */
export function generatePlayerToken(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda apenas o SHA-256 (hex) do token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Comparação em tempo constante, para não vazar informação pelo tempo de resposta. */
export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
