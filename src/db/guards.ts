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
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "./index";
import { analyzeSession } from "@/lib/analysis";
import {
  answers,
  categories,
  categoryDesignations,
  coupleSessions,
  customQuestions,
  nudges,
  questions,
  shareConsentApprovals,
  shareConsents,
  reports,
  spotlights,
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
 * A user's own spotlights. Always safe: scoped to the requesting user.
 * The other partner's spotlights are only readable via computeReportPayload
 * (which requires report_ready status).
 */
export async function getMySpotlights(
  db: Db,
  sessionId: string,
  userId: string,
) {
  await getSessionForMember(db, sessionId, userId);
  return db
    .select()
    .from(spotlights)
    .where(
      and(eq(spotlights.sessionId, sessionId), eq(spotlights.userId, userId)),
    );
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
 * The requesting user's own progress, as a bare percentage.
 * Always safe — a user may read their own completion state.
 */
export async function getOwnProgressPercent(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<number> {
  const session = await getSessionForMember(db, sessionId, userId);
  const applicable = await countApplicableQuestions(db, sessionId, userId);
  if (applicable === 0) return 0;
  const answered = await countAnsweredApplicable(db, sessionId, userId, session);
  return Math.min(100, Math.round((answered / applicable) * 100));
}

/**
 * The sentAt timestamp of the most recent nudge this user sent in this
 * session, or null if they have never sent one. Used to enforce the 24h
 * rate limit server-side and to hydrate the UI's initial sent state.
 */
export async function getLastNudgeSentAt(
  db: Db,
  sessionId: string,
  fromUserId: string,
): Promise<Date | null> {
  await getSessionForMember(db, sessionId, fromUserId);
  const [row] = await db
    .select({ sentAt: nudges.sentAt })
    .from(nudges)
    .where(and(eq(nudges.sessionId, sessionId), eq(nudges.fromUserId, fromUserId)))
    .orderBy(desc(nudges.sentAt))
    .limit(1);
  return row?.sentAt ?? null;
}

/**
 * The report — the only cross-partner read that exists, and only when
 * the session-level status says both have submitted.
 *
 * Self-heals if the payload is {} (the one Phase-4 placeholder row).
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

  if (isEmptyPayload(report.payload)) {
    const payload = await computeReportPayload(db, sessionId, session);
    await db
      .update(reports)
      .set({ payload })
      .where(eq(reports.sessionId, sessionId));
    return { ...report, payload };
  }

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

/**
 * The active (not yet executed) share request for this session, plus all
 * approval rows collected so far. Returns null if no pending request exists.
 *
 * "Active" means sharedAt IS NULL — the request was created but the share
 * has not been sent yet.
 */
export async function getActiveShareRequest(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<{
  request: typeof shareConsents.$inferSelect;
  approvals: (typeof shareConsentApprovals.$inferSelect)[];
} | null> {
  await getSessionForMember(db, sessionId, userId);
  const [request] = await db
    .select()
    .from(shareConsents)
    .where(and(eq(shareConsents.sessionId, sessionId), isNull(shareConsents.sharedAt)));
  if (!request) return null;
  const approvals = await db
    .select()
    .from(shareConsentApprovals)
    .where(eq(shareConsentApprovals.shareConsentId, request.id));
  return { request, approvals };
}

/**
 * The most recently executed share for this session (sharedAt IS NOT NULL),
 * or null if the report has never been shared with a counselor.
 */
export async function getLastCompletedShare(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<typeof shareConsents.$inferSelect | null> {
  await getSessionForMember(db, sessionId, userId);
  const [row] = await db
    .select()
    .from(shareConsents)
    .where(and(eq(shareConsents.sessionId, sessionId), isNotNull(shareConsents.sharedAt)))
    .orderBy(desc(shareConsents.sharedAt))
    .limit(1);
  return row ?? null;
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

// ---------------------------------------------------------------------------
// Report generation — the one cross-partner read outside getReportForMember
// ---------------------------------------------------------------------------

function isEmptyPayload(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Object.keys(payload).length === 0
  );
}

/**
 * Fetch both partners' answers, designations, and applicable questions, then
 * run the pure analysis engine and return the payload.
 *
 * ONLY safe to call when:
 * (a) inside the second-submission transaction (subCount === 2), or
 * (b) session.status === "report_ready" (self-healing path in getReportForMember).
 *
 * Accepts DbOrTx so it works both inside a transaction (tx) and outside (db).
 */
export async function computeReportPayload(
  db: DbOrTx,
  sessionId: string,
  session: SessionRow,
) {
  const { createdByUserId, partnerUserId } = session;
  if (!partnerUserId) throw new Error("Session has no partner — cannot compute report.");

  // Fetch both partners' answers (the one cross-partner read allowed here)
  const [rawAnswersA, rawAnswersB] = await Promise.all([
    db.select().from(answers).where(
      and(eq(answers.sessionId, sessionId), eq(answers.userId, createdByUserId)),
    ),
    db.select().from(answers).where(
      and(eq(answers.sessionId, sessionId), eq(answers.userId, partnerUserId)),
    ),
  ]);

  // Fetch both partners' designations
  const [rawDesigA, rawDesigB] = await Promise.all([
    db.select().from(categoryDesignations).where(
      and(
        eq(categoryDesignations.sessionId, sessionId),
        eq(categoryDesignations.userId, createdByUserId),
      ),
    ),
    db.select().from(categoryDesignations).where(
      and(
        eq(categoryDesignations.sessionId, sessionId),
        eq(categoryDesignations.userId, partnerUserId),
      ),
    ),
  ]);

  // Fetch applicable bank questions (active, matching stage + context)
  const allBank = await db
    .select()
    .from(questions)
    .where(eq(questions.isActive, true));
  const applicableBank = allBank.filter(
    (q) =>
      q.stages.includes(session.relationshipStage) &&
      (q.contexts.length === 0 || q.contexts.includes(session.culturalContextSlug)),
  );

  // Fetch custom questions, categories, and both partners' spotlights
  const [rawCustom, rawCategories, rawSpotlightsA, rawSpotlightsB] =
    await Promise.all([
      db.select().from(customQuestions).where(eq(customQuestions.sessionId, sessionId)),
      db.select().from(categories),
      db.select().from(spotlights).where(
        and(eq(spotlights.sessionId, sessionId), eq(spotlights.userId, createdByUserId)),
      ),
      db.select().from(spotlights).where(
        and(eq(spotlights.sessionId, sessionId), eq(spotlights.userId, partnerUserId)),
      ),
    ]);

  return analyzeSession({
    session: { stage: session.relationshipStage, culturalContextSlug: session.culturalContextSlug },
    partnerAUserId: createdByUserId,
    partnerBUserId: partnerUserId,
    answersA: rawAnswersA.map((a) => ({
      questionId: a.questionId,
      customQuestionId: a.customQuestionId,
      choice: a.choice,
      compromiseText: a.compromiseText,
    })),
    answersB: rawAnswersB.map((b) => ({
      questionId: b.questionId,
      customQuestionId: b.customQuestionId,
      choice: b.choice,
      compromiseText: b.compromiseText,
    })),
    designationsA: Object.fromEntries(rawDesigA.map((d) => [d.categorySlug, d.designation])),
    designationsB: Object.fromEntries(rawDesigB.map((d) => [d.categorySlug, d.designation])),
    bankQuestions: applicableBank.map((q) => ({
      id: q.id,
      categorySlug: q.categorySlug,
      text: q.text,
      displayOrder: q.displayOrder,
      partnerView: q.partnerView,
    })),
    customQuestions: rawCustom.map((q) => ({
      id: q.id,
      categorySlug: q.categorySlug ?? "personal",
      text: q.text,
      displayOrder: 0,
    })),
    categories: rawCategories.map((c) => ({
      slug: c.slug,
      displayOrder: c.displayOrder,
    })),
    spotlightsA: rawSpotlightsA.map((s) => ({
      questionId: s.questionId,
      customQuestionId: s.customQuestionId,
    })),
    spotlightsB: rawSpotlightsB.map((s) => ({
      questionId: s.questionId,
      customQuestionId: s.customQuestionId,
    })),
  });
}
