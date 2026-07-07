import { randomBytes } from "node:crypto";

/**
 * Invitation tokens: unguessable, single-use, never expiring (sessions
 * never expire) but consumed on acceptance. 32 random bytes = 256 bits.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}
