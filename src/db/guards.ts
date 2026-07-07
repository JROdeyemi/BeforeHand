/**
 * Beforehand — guarded data access for invariant-critical tables.
 *
 * THE RULE: a partner's answers (choices and compromise text) are never
 * readable by the other partner until the session is `report_ready`.
 * This module is the ONLY place allowed to query `answers` and `reports`.
 * Routes, server actions, and components import from here; they never
 * touch those tables directly. If you find yourself writing
 * `db.select().from(answers)` anywhere else — stop.
 *
 * Every exported reader takes the *requesting* user's id and scopes the
 * query to it server-side. There is deliberately no generic
 * "getAnswersForSession" — the type system shouldn't even offer the
 * unsafe query.
 */
import { and, eq, count } from "drizzle-orm";
import type { Db } from "./index";
import {
  answers,
  coupleSessions,
  customQuestions,
  questions,
  reports,
  submissions,
} from "./schema";

export class NotSessionMemberError extends Error {
  constructor() {
    super("You are not a member of this session.");
  }
}

export class ReportNotReadyError extends Error {
  constructor() {
    super("The report unlocks when both partners have submitted.");
  }
}

/** Resolve a session and assert the requesting user belongs to it. */
export async function getSessionForMember(
  db: Db,
  sessionId: string,
  userId: string,
) {
  const [session] = await db
    .select()
    .from(coupleSessions)
    .where(eq(coupleSessions.id, sessionId));
  if (
    !session ||
    (session.createdByUserId !== userId && session.partnerUserId !== userId)
  ) {
    // Same error whether the session doesn't exist or isn't theirs —
    // don't leak session existence.
    throw new NotSessionMemberError();
  }
  return session;
}

/** A user's own answers. Always safe: scoped to the requesting user. */
export async function getOwnAnswers(db: Db, sessionId: string, userId: string) {
  await getSessionForMember(db, sessionId, userId);
  return db
    .select()
    .from(answers)
    .where(and(eq(answers.sessionId, sessionId), eq(answers.userId, userId)));
}

/**
 * The partner's progress, as a bare percentage. This is the ONLY view
 * of the partner's answering activity that exists before report_ready —
 * never category breakdowns, never which questions.
 */
export async function getPartnerProgressPercent(
  db: Db,
  sessionId: string,
  requestingUserId: string,
): Promise<number> {
  const session = await getSessionForMember(db, sessionId, requestingUserId);
  const partnerId =
    session.createdByUserId === requestingUserId
      ? session.partnerUserId
      : session.createdByUserId;
  if (!partnerId) return 0;

  const applicable = await countApplicableQuestions(db, sessionId, partnerId);
  if (applicable === 0) return 0;

  const [{ value: answered }] = await db
    .select({ value: count() })
    .from(answers)
    .where(and(eq(answers.sessionId, sessionId), eq(answers.userId, partnerId)));

  return Math.min(100, Math.round((answered / applicable) * 100));
}

/**
 * The report — the only cross-partner read that exists, and only when
 * the session-level status says both have submitted.
 */
export async function getReportForMember(
  db: Db,
  sessionId: string,
  userId: string,
) {
  const session = await getSessionForMember(db, sessionId, userId);
  if (session.status !== "report_ready") {
    throw new ReportNotReadyError();
  }
  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.sessionId, sessionId));
  if (!report) throw new ReportNotReadyError();
  return report;
}

export async function hasSubmitted(db: Db, sessionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(submissions)
    .where(
      and(eq(submissions.sessionId, sessionId), eq(submissions.userId, userId)),
    );
  return Boolean(row);
}

/** Bank questions matching the session's stage + context, plus custom
 *  questions in the session (both partners answer all custom questions). */
export async function countApplicableQuestions(
  db: Db,
  sessionId: string,
  _forUserId: string,
) {
  const [session] = await db
    .select()
    .from(coupleSessions)
    .where(eq(coupleSessions.id, sessionId));
  if (!session) return 0;

  const bank = await db.select().from(questions).where(eq(questions.isActive, true));
  const applicableBank = bank.filter(
    (q) =>
      q.stages.includes(session.relationshipStage) &&
      (q.contexts.length === 0 ||
        q.contexts.includes(session.culturalContextSlug)),
  );

  const custom = await db
    .select()
    .from(customQuestions)
    .where(eq(customQuestions.sessionId, sessionId));

  return applicableBank.length + custom.length;
}
