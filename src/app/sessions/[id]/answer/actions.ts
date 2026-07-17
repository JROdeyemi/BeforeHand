"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  canSubmit,
  computeReportPayload,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
  SubmitNotReadyError,
} from "@/db/guards";
import { sendReportReadyEmail } from "@/lib/email";
import {
  answers,
  coupleSessions,
  customQuestions,
  questions,
  reports,
  submissions,
  users,
} from "@/db/schema";
import { assertTransition } from "@/lib/session-state";

type SaveAnswerResult = { error: string } | { ok: true };

export async function saveAnswer(
  sessionId: string,
  questionId: string | null,
  customQuestionId: string | null,
  choice: "fully_on_board" | "open_to_discussing" | "dealbreaker",
  compromiseText: string | null,
): Promise<SaveAnswerResult> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { error: "Not signed in." };
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) return { error: "Session not found." };
    throw err;
  }

  if (session.status !== "active") return { error: "Session is not active." };
  if (await hasSubmitted(db, sessionId, userId)) {
    return { error: "Your answers are locked after submission." };
  }
  if (!(await areAllCategoriesDesignated(db, sessionId, userId))) {
    return { error: "Please designate all categories before answering." };
  }

  // Exactly one question source
  if (
    (questionId === null) === (customQuestionId === null)
  ) {
    return { error: "Exactly one of questionId or customQuestionId must be set." };
  }

  // Validate bank question applicability
  if (questionId !== null) {
    const [q] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));
    if (!q || !q.isActive) return { error: "Question not found or inactive." };
    if (!(q.stages as string[]).includes(session.relationshipStage)) {
      return { error: "Question does not apply to this session's stage." };
    }
    if (
      q.contexts.length > 0 &&
      !q.contexts.includes(session.culturalContextSlug)
    ) {
      return { error: "Question does not apply to this session's cultural context." };
    }
  }

  // Validate custom question belongs to this session
  if (customQuestionId !== null) {
    const [cq] = await db
      .select()
      .from(customQuestions)
      .where(eq(customQuestions.id, customQuestionId));
    if (!cq || cq.sessionId !== sessionId) {
      return { error: "Custom question not found in this session." };
    }
  }

  // Validate compromise text
  const trimmed =
    compromiseText !== null ? compromiseText.trim() : null;
  if (choice === "open_to_discussing") {
    if (!trimmed) {
      return {
        error: "Please describe what a compromise would look like for you.",
      };
    }
  } else {
    // Explicit null so the DB constraint is satisfied when switching away
    // from open_to_discussing
  }

  const finalCompromise =
    choice === "open_to_discussing" ? trimmed : null;

  // Upsert
  if (questionId !== null) {
    await db
      .insert(answers)
      .values({
        sessionId,
        userId,
        questionId,
        customQuestionId: null,
        choice,
        compromiseText: finalCompromise,
      })
      .onConflictDoUpdate({
        target: [answers.sessionId, answers.userId, answers.questionId],
        targetWhere: sql`${answers.questionId} IS NOT NULL`,
        set: { choice, compromiseText: finalCompromise, updatedAt: new Date() },
      });
  } else {
    await db
      .insert(answers)
      .values({
        sessionId,
        userId,
        questionId: null,
        customQuestionId,
        choice,
        compromiseText: finalCompromise,
      })
      .onConflictDoUpdate({
        target: [answers.sessionId, answers.userId, answers.customQuestionId],
        targetWhere: sql`${answers.customQuestionId} IS NOT NULL`,
        set: { choice, compromiseText: finalCompromise, updatedAt: new Date() },
      });
  }

  return { ok: true };
}

export async function submitAnswers(
  sessionId: string,
): Promise<{ error: string } | void> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { error: "Not signed in." };
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) return { error: "Session not found." };
    throw err;
  }

  if (session.status !== "active") return { error: "Session is not active." };
  if (await hasSubmitted(db, sessionId, userId)) {
    redirect(`/sessions/${sessionId}`);
  }

  try {
    await canSubmit(db, sessionId, userId);
  } catch (err) {
    if (err instanceof SubmitNotReadyError) return { error: err.message };
    throw err;
  }

  let reportJustGenerated = false;

  await db.transaction(async (tx) => {
    // Lock the session row to serialize concurrent submissions.
    // Without this, two simultaneous submits both count 1 and the session
    // never reaches report_ready.
    const [locked] = await tx
      .select()
      .from(coupleSessions)
      .where(eq(coupleSessions.id, sessionId))
      .for("update");

    if (!locked || locked.status !== "active") return;

    // Re-check inside the transaction: the other partner may have submitted
    // between our outer check and this lock
    const [existing] = await tx
      .select()
      .from(submissions)
      .where(
        and(eq(submissions.sessionId, sessionId), eq(submissions.userId, userId)),
      );
    if (existing) return;

    await tx.insert(submissions).values({ sessionId, userId });

    const [{ value: subCount }] = await tx
      .select({ value: count() })
      .from(submissions)
      .where(eq(submissions.sessionId, sessionId));

    if (subCount === 2) {
      const newStatus = assertTransition(locked.status, "second_submission");
      await tx
        .update(coupleSessions)
        .set({ status: newStatus, reportGeneratedAt: new Date() })
        .where(eq(coupleSessions.id, sessionId));

      const payload = await computeReportPayload(tx, sessionId, locked);
      await tx.insert(reports).values({ sessionId, payload });
      reportJustGenerated = true;
    }
  });

  if (reportJustGenerated) {
    // Fetch both users' details for the email notification.
    // Fire-and-forget: email failure must not block the redirect.
    void (async () => {
      try {
        const session = await db
          .select()
          .from(coupleSessions)
          .where(eq(coupleSessions.id, sessionId))
          .then((rows) => rows[0]);
        if (!session?.partnerUserId) return;

        const [userA, userB] = await Promise.all([
          db.select().from(users).where(eq(users.id, session.createdByUserId)).then((r) => r[0]),
          db.select().from(users).where(eq(users.id, session.partnerUserId)).then((r) => r[0]),
        ]);
        if (!userA || !userB) return;

        await sendReportReadyEmail({
          sessionId,
          toA: userA.email,
          toB: userB.email,
          nameA: userA.name ?? userA.email,
          nameB: userB.name ?? userB.email,
        });
      } catch {
        // Email failures are non-fatal
      }
    })();
  }

  redirect(`/sessions/${sessionId}`);
}

export async function addCustomQuestion(
  sessionId: string,
  text: string,
  categorySlug: string | null,
): Promise<{ error: string } | { ok: true }> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { error: "Not signed in." };
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) return { error: "Session not found." };
    throw err;
  }

  if (session.status !== "active") return { error: "Session is not active." };
  if (await hasSubmitted(db, sessionId, userId)) {
    return { error: "You cannot add questions after submitting." };
  }

  const trimmed = text.trim();
  if (!trimmed) return { error: "Question text cannot be empty." };
  if (trimmed.length > 400) {
    return { error: "Question text must be 400 characters or fewer." };
  }

  await db.insert(customQuestions).values({
    sessionId,
    authorUserId: userId,
    categorySlug: categorySlug ?? null,
    text: trimmed,
  });

  revalidatePath(`/sessions/${sessionId}/answer`);
  return { ok: true };
}
