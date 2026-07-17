import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getMySpotlights,
  getOwnAnswers,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import {
  getAllCategories,
  getApplicableQuestionsForCategory,
  getCustomQuestionsForSession,
} from "@/db/queries";
import { requireNamedUser } from "@/lib/require-named-user";
import { AnswerCard } from "@/components/answer-card";
import { saveAnswer, toggleSpotlight } from "../actions";

export default async function CategoryAnswerPage({
  params,
}: {
  params: Promise<{ id: string; categorySlug: string }>;
}) {
  const { id, categorySlug } = await params;

  const { session: authSession } = await requireNamedUser(
    `/sessions/${id}/answer/${categorySlug}`,
  );
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, id, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-ink-soft">
            This session doesn&rsquo;t exist or you don&rsquo;t have access.
          </p>
        </main>
      );
    }
    throw err;
  }

  if (session.status !== "active") {
    redirect(`/sessions/${id}`);
  }

  if (!(await areAllCategoriesDesignated(db, id, userId))) {
    redirect(`/sessions/${id}/designate`);
  }

  const [submitted, mySpotlights] = await Promise.all([
    hasSubmitted(db, id, userId),
    getMySpotlights(db, id, userId),
  ]);
  const spotlitQuestionIds = new Set(
    mySpotlights
      .map((s) => s.questionId ?? s.customQuestionId)
      .filter(Boolean) as string[],
  );
  const isPersonal = categorySlug === "personal";

  // Load questions and existing answers
  const userAnswers = await getOwnAnswers(db, id, userId);
  const answerByQuestionId = new Map(
    userAnswers
      .filter((a) => a.questionId)
      .map((a) => [a.questionId!, a]),
  );
  const answerByCustomId = new Map(
    userAnswers
      .filter((a) => a.customQuestionId)
      .map((a) => [a.customQuestionId!, a]),
  );

  type QuestionItem = {
    key: string;
    text: string;
    questionId: string | null;
    customQuestionId: string | null;
    existingAnswer: { choice: "fully_on_board" | "open_to_discussing" | "dealbreaker"; compromiseText: string | null } | null;
  };

  let categoryName = "Personal questions";
  let items: QuestionItem[] = [];

  if (isPersonal) {
    const custom = await getCustomQuestionsForSession(db, id);
    items = custom.map((cq) => {
      const ans = answerByCustomId.get(cq.id);
      return {
        key: cq.id,
        text: cq.text,
        questionId: null,
        customQuestionId: cq.id,
        existingAnswer: ans
          ? { choice: ans.choice, compromiseText: ans.compromiseText }
          : null,
      };
    });
  } else {
    const allCategories = await getAllCategories(db);
    const cat = allCategories.find((c) => c.slug === categorySlug);
    if (!cat) {
      redirect(`/sessions/${id}/answer`);
    }
    categoryName = cat.name;

    const bankQuestions = await getApplicableQuestionsForCategory(
      db,
      session,
      categorySlug,
    );
    items = bankQuestions.map((q) => {
      const ans = answerByQuestionId.get(q.id);
      return {
        key: q.id,
        text: q.text,
        questionId: q.id,
        customQuestionId: null,
        existingAnswer: ans
          ? { choice: ans.choice, compromiseText: ans.compromiseText }
          : null,
      };
    });
  }

  const answeredCount = items.filter((i) => i.existingAnswer !== null).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Back link */}
      <Link
        href={`/sessions/${id}/answer`}
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← All topics
      </Link>

      <div className="mt-6 flex items-end justify-between">
        <h1
          className="text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {categoryName}
        </h1>
        <span className="mb-1 text-sm text-ink-soft">
          {answeredCount}/{items.length}
        </span>
      </div>

      {submitted && (
        <p className="mt-2 text-sm text-ink-soft">
          Your answers are locked. The report unlocks when your partner submits.
        </p>
      )}

      {items.length === 0 && (
        <p className="mt-8 text-ink-soft">
          {isPersonal
            ? "No personal questions have been added yet."
            : "No questions for this topic at your relationship stage."}
        </p>
      )}

      {/* Question cards */}
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <AnswerCard
            key={item.key}
            sessionId={id}
            questionId={item.questionId}
            customQuestionId={item.customQuestionId}
            questionText={item.text}
            existing={item.existingAnswer}
            disabled={submitted}
            onSave={saveAnswer}
            isSpotlit={spotlitQuestionIds.has(item.key)}
            onToggleSpotlight={toggleSpotlight}
          />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="mt-10">
        <Link
          href={`/sessions/${id}/answer`}
          className="text-sm text-ink-soft hover:text-ink"
        >
          ← Back to all topics
        </Link>
      </div>
    </main>
  );
}
