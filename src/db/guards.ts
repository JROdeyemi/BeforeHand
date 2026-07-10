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
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "./index";
import {
  answers,
  categories,
  categoryDesignations,
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

export class SubmitNotReadyError extends Error {
  constructor(remaining: number) {
    super(
      `${remaining} question${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} an answer before you can submit.`,
    );
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
 *
 * Counts only answers joined to currently-applicable questions so that
 * a deactivated question does not inflate the partner's apparent progress.
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

  const answered = await countAnsweredApplicable(db, sessionId, partnerId, session);
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

  const [{ value: customCount }] = await db
    .select({ value: count() })
    .from(customQuestions)
    .where(eq(customQuestions.sessionId, sessionId));

  return applicableBank.length + customCount;
}

/**
 * Own category designations (core/flexible) as a slug → value map.
 * Safe to return to the requesting user only.
 */
export async function getOwnDesignations(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<Record<string, "core" | "flexible">> {
  await getSessionForMember(db, sessionId, userId);
  const rows = await db
    .select()
    .from(categoryDesignations)
    .where(
      and(
        eq(categoryDesignations.sessionId, sessionId),
        eq(categoryDesignations.userId, userId),
      ),
    );
  return Object.fromEntries(rows.map((r) => [r.categorySlug, r.designation]));
}

/**
 * True when the user has designated every category in the DB for this session.
 * Required before answering begins.
 */
export async function areAllCategoriesDesignated(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  await getSessionForMember(db, sessionId, userId);
  const [{ total }] = await db
    .select({ total: count() })
    .from(categories);
  const [{ designated }] = await db
    .select({ designated: count() })
    .from(categoryDesignations)
    .where(
      and(
        eq(categoryDesignations.sessionId, sessionId),
        eq(categoryDesignations.userId, userId),
      ),
    );
  return total > 0 && designated >= total;
}

/**
 * Per-category own progress — safe to show to the requesting user.
 * Counts only answers joined to currently-active applicable questions,
 * so deactivated questions do not inflate progress.
 * Custom questions appear under the "personal" key.
 *
 * NEVER call this for the partner — use getPartnerProgressPercent instead.
 */
export async function getOwnProgressByCategory(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<{ categorySlug: string; answered: number; total: number }[]> {
  const session = await getSessionForMember(db, sessionId, userId);

  // All currently-active bank questions
  const bank = await db
    .select({
      id: questions.id,
      categorySlug: questions.categorySlug,
      stages: questions.stages,
      contexts: questions.contexts,
    })
    .from(questions)
    .where(eq(questions.isActive, true));

  // Filter to questions applicable for this session's stage + context
  const applicable = bank.filter(
    (q) =>
      q.stages.includes(session.relationshipStage) &&
      (q.contexts.length === 0 ||
        q.contexts.includes(session.culturalContextSlug)),
  );

  const byCategory = new Map<string, { answered: number; total: number }>();

  if (applicable.length > 0) {
    const applicableIds = applicable.map((q) => q.id);
    const userBankAnswers = await db
      .select({ questionId: answers.questionId })
      .from(answers)
      .where(
        and(
          eq(answers.sessionId, sessionId),
          eq(answers.userId, userId),
          isNotNull(answers.questionId),
          inArray(answers.questionId, applicableIds),
        ),
      );
    const answeredIds = new Set(userBankAnswers.map((a) => a.questionId));

    for (const q of applicable) {
      const entry = byCategory.get(q.categorySlug) ?? { answered: 0, total: 0 };
      entry.total++;
      if (answeredIds.has(q.id)) entry.answered++;
      byCategory.set(q.categorySlug, entry);
    }
  }

  // Custom questions appear under a "personal" bucket
  const custom = await db
    .select({ id: customQuestions.id })
    .from(customQuestions)
    .where(eq(customQuestions.sessionId, sessionId));

  if (custom.length > 0) {
    const customIds = custom.map((c) => c.id);
    const [{ value: answeredCustom }] = await db
      .select({ value: count() })
      .from(answers)
      .where(
        and(
          eq(answers.sessionId, sessionId),
          eq(answers.userId, userId),
          inArray(answers.customQuestionId, customIds),
        ),
      );
    byCategory.set("personal", {
      answered: answeredCustom,
      total: custom.length,
    });
  }

  return Array.from(byCategory.entries()).map(([categorySlug, counts]) => ({
    categorySlug,
    ...counts,
  }));
}

/**
 * True when the user has answered every currently-applicable question
 * (bank + custom). This is the authoritative server-side submit gate.
 * Throws SubmitNotReadyError if not ready, so callers can propagate
 * the remaining count to the UI.
 */
export async function canSubmit(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<true> {
  const session = await getSessionForMember(db, sessionId, userId);
  const answered = await countAnsweredApplicable(db, sessionId, userId, session);
  const total = await countApplicableQuestions(db, sessionId, userId);
  if (answered < total) throw new SubmitNotReadyError(total - answered);
  if (total === 0) throw new SubmitNotReadyError(0);
  return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type SessionRow = Awaited<ReturnType<typeof getSessionForMember>>;

/**
 * Count how many currently-applicable questions (bank + custom) a user
 * has answered. Used by canSubmit and getPartnerProgressPercent.
 * Counts only answers joined to active questions so deactivated questions
 * do not inflate the numerator.
 */
async function countAnsweredApplicable(
  db: Db,
  sessionId: string,
  userId: string,
  session: SessionRow,
): Promise<number> {
  // Bank questions
  const bank = await db
    .select({ id: questions.id, stages: questions.stages, contexts: questions.contexts })
    .from(questions)
    .where(eq(questions.isActive, true));
  const applicableBank = bank.filter(
    (q) =>
      q.stages.includes(session.relationshipStage) &&
      (q.contexts.length === 0 ||
        q.contexts.includes(session.culturalContextSlug)),
  );

  let answeredBank = 0;
  if (applicableBank.length > 0) {
    const ids = applicableBank.map((q) => q.id);
    const [{ value }] = await db
      .select({ value: count() })
      .from(answers)
      .where(
        and(
          eq(answers.sessionId, sessionId),
          eq(answers.userId, userId),
          inArray(answers.questionId, ids),
        ),
      );
    answeredBank = value;
  }

  // Custom questions
  const custom = await db
    .select({ id: customQuestions.id })
    .from(customQuestions)
    .where(eq(customQuestions.sessionId, sessionId));

  let answeredCustom = 0;
  if (custom.length > 0) {
    const ids = custom.map((c) => c.id);
    const [{ value }] = await db
      .select({ value: count() })
      .from(answers)
      .where(
        and(
          eq(answers.sessionId, sessionId),
          eq(answers.userId, userId),
          inArray(answers.customQuestionId, ids),
        ),
      );
    answeredCustom = value;
  }

  return answeredBank + answeredCustom;
}
