/**
 * Beforehand — non-guarded reference queries.
 *
 * For reference/metadata tables only (cultural contexts, invitations,
 * session creator info). No answer or report data lives here — those go
 * through src/db/guards.ts exclusively.
 */
import { desc, eq } from "drizzle-orm";
import type { Db } from "./index";
import { coupleSessions, culturalContexts, invitations, users } from "./schema";

/** All active cultural contexts, ordered by slug. */
export async function getActiveContexts(db: Db) {
  return db
    .select()
    .from(culturalContexts)
    .where(eq(culturalContexts.isActive, true))
    .orderBy(culturalContexts.slug);
}

/** Look up an invitation by its token. Returns undefined if not found. */
export async function getInvitationByToken(db: Db, token: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token));
  return row ?? undefined;
}

/** Most recent invitation for a session (by sentAt). */
export async function getInvitationForSession(db: Db, sessionId: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.sessionId, sessionId))
    .orderBy(desc(invitations.sentAt))
    .limit(1);
  return row ?? undefined;
}

/** The session creator's id, name, and email. */
export async function getInviterForSession(db: Db, sessionId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(coupleSessions)
    .innerJoin(users, eq(users.id, coupleSessions.createdByUserId))
    .where(eq(coupleSessions.id, sessionId));
  return row ?? undefined;
}
