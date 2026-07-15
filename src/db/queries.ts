/**
 * Beforehand — non-guarded reference queries.
 *
 * For reference/metadata tables only (cultural contexts, invitations,
 * session creator info). No answer or report data lives here — those go
 * through src/db/guards.ts exclusively.
 */
import { asc, desc, eq, or } from "drizzle-orm";
import type { Db } from "./index";
import {
  categories,
  coupleSessions,
  culturalContexts,
  customQuestions,
  invitations,
  questions,
  users,
} from "./schema";

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

/** All categories ordered by displayOrder. */
export async function getAllCategories(db: Db) {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.displayOrder));
}

/**
 * Active bank questions for one category, filtered to the session's
 * stage and cultural context. Stage/context filtering happens in JS
 * because those columns are arrays (matching the seed/guards pattern).
 */
export async function getApplicableQuestionsForCategory(
  db: Db,
  session: {
    relationshipStage: string;
    culturalContextSlug: string;
  },
  categorySlug: string,
) {
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.isActive, true))
    .orderBy(asc(questions.displayOrder));

  return rows.filter(
    (q) =>
      q.categorySlug === categorySlug &&
      (q.stages as string[]).includes(session.relationshipStage) &&
      (q.contexts.length === 0 ||
        q.contexts.includes(session.culturalContextSlug)),
  );
}

/**
 * All couple_sessions where the user is creator or partner, newest first.
 * Each row is enriched with the partner's email: from users if they've joined,
 * from the latest invitation if not.
 */
export async function getSessionsForUser(db: Db, userId: string) {
  const sessions = await db
    .select()
    .from(coupleSessions)
    .where(
      or(
        eq(coupleSessions.createdByUserId, userId),
        eq(coupleSessions.partnerUserId, userId),
      ),
    )
    .orderBy(desc(coupleSessions.createdAt));

  return Promise.all(
    sessions.map(async (session) => {
      const partnerId =
        session.createdByUserId === userId
          ? session.partnerUserId
          : session.createdByUserId;

      let partnerEmail: string | null = null;
      if (partnerId) {
        const [partner] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, partnerId));
        partnerEmail = partner?.email ?? null;
      } else {
        const [inv] = await db
          .select({ invitedEmail: invitations.invitedEmail })
          .from(invitations)
          .where(eq(invitations.sessionId, session.id))
          .orderBy(desc(invitations.sentAt))
          .limit(1);
        partnerEmail = inv?.invitedEmail ?? null;
      }

      return { ...session, partnerEmail };
    }),
  );
}

/**
 * All custom questions in a session — shown to both partners for answering,
 * without exposing which partner authored each one.
 */
export async function getCustomQuestionsForSession(db: Db, sessionId: string) {
  return db
    .select()
    .from(customQuestions)
    .where(eq(customQuestions.sessionId, sessionId))
    .orderBy(asc(customQuestions.createdAt));
}
