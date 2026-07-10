import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getOwnProgressByCategory,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import {
  getAllCategories,
  getCustomQuestionsForSession,
} from "@/db/queries";
import { CategoryProgressBar } from "@/components/category-progress-bar";
import { AddCustomQuestionForm } from "@/components/add-custom-question-form";
import { SubmitAnswersButton } from "@/components/submit-answers-button";
import { addCustomQuestion, submitAnswers } from "./actions";

export default async function AnswerOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect(`/signin?callbackUrl=/sessions/${id}/answer`);
  }
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

  const submitted = await hasSubmitted(db, id, userId);

  const [allCategories, progressByCategory, customQuestions] = await Promise.all([
    getAllCategories(db),
    getOwnProgressByCategory(db, id, userId),
    getCustomQuestionsForSession(db, id),
  ]);

  const progressMap = new Map(
    progressByCategory.map((p) => [p.categorySlug, p]),
  );
  const personalProgress = progressMap.get("personal");

  // Total remaining for submit gate
  let totalAnswered = 0;
  let totalQuestions = 0;
  for (const p of progressByCategory) {
    totalAnswered += p.answered;
    totalQuestions += p.total;
  }
  const remaining = totalQuestions - totalAnswered;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-candle">
            Your answers
          </p>
          <h1
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {submitted ? "Your answers are in." : "Answer at your own pace."}
          </h1>
        </div>
        {!submitted && (
          <p className="mt-1 text-sm text-ink-soft">
            {remaining === 0 ? (
              <span className="font-medium text-ink">All done ✓</span>
            ) : (
              <span>{remaining} left</span>
            )}
          </p>
        )}
      </div>

      {!submitted && (
        <p className="mt-3 text-sm text-ink-soft/70">
          Your answers are private until you both submit.
        </p>
      )}

      {/* Category list */}
      <ul className="mt-8 space-y-3">
        {allCategories.map((cat) => {
          const prog = progressMap.get(cat.slug) ?? { answered: 0, total: 0 };
          const complete = prog.total > 0 && prog.answered === prog.total;
          return (
            <li key={cat.slug}>
              <Link
                href={
                  submitted
                    ? `/sessions/${id}/answer/${cat.slug}`
                    : `/sessions/${id}/answer/${cat.slug}`
                }
                className="block rounded-xl border border-ink/10 bg-white px-5 py-4 transition-colors hover:border-ink/25"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{cat.name}</span>
                  {complete && (
                    <span className="text-xs text-green-600">Complete ✓</span>
                  )}
                </div>
                {prog.total > 0 ? (
                  <CategoryProgressBar
                    answered={prog.answered}
                    total={prog.total}
                  />
                ) : (
                  <p className="mt-1 text-xs text-ink-soft">
                    No questions for this stage
                  </p>
                )}
              </Link>
            </li>
          );
        })}

        {/* Personal / custom questions */}
        <li>
          <Link
            href={`/sessions/${id}/answer/personal`}
            className="block rounded-xl border border-ink/10 bg-white px-5 py-4 transition-colors hover:border-ink/25"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">Personal questions</span>
              {personalProgress &&
                personalProgress.answered === personalProgress.total &&
                personalProgress.total > 0 && (
                  <span className="text-xs text-green-600">Complete ✓</span>
                )}
            </div>
            {customQuestions.length > 0 ? (
              <CategoryProgressBar
                answered={personalProgress?.answered ?? 0}
                total={personalProgress?.total ?? customQuestions.length}
              />
            ) : (
              <p className="mt-1 text-xs text-ink-soft">
                No personal questions yet
              </p>
            )}
          </Link>
        </li>
      </ul>

      {/* Add custom question form (only before submission) */}
      {!submitted && (
        <AddCustomQuestionForm
          sessionId={id}
          onAdd={addCustomQuestion}
        />
      )}

      {/* Submit gate */}
      {!submitted && (
        <SubmitAnswersButton
          sessionId={id}
          remaining={remaining}
          onSubmit={submitAnswers}
        />
      )}

      {submitted && (
        <div className="mt-10 rounded-xl border border-candle/30 bg-candle/10 px-5 py-4 text-center">
          <p className="font-medium text-ink">
            You&rsquo;ve submitted your answers.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The report unlocks the moment your partner submits too.
          </p>
        </div>
      )}
    </main>
  );
}
