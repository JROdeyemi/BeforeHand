import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  getReportForMember,
  getSessionForMember,
  NotSessionMemberError,
  ReportNotReadyError,
} from "@/db/guards";
import { users } from "@/db/schema";
import { requireNamedUser } from "@/lib/require-named-user";
import type {
  DealbreakerFlagEntry,
  ReportPayload,
  SpotlightEntry,
  TensionEntry,
} from "@/lib/analysis";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { session: authSession } = await requireNamedUser(`/sessions/${id}/report`);
  const userId = authSession.user.id;

  let report: Awaited<ReturnType<typeof getReportForMember>>;
  try {
    report = await getReportForMember(db, id, userId);
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
    if (err instanceof ReportNotReadyError) {
      redirect(`/sessions/${id}`);
    }
    throw err;
  }

  const session = await getSessionForMember(db, id, userId);
  const partnerUserId =
    session.createdByUserId === userId
      ? session.partnerUserId
      : session.createdByUserId;

  const [viewerUser, partnerUser] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).then((r) => r[0]),
    partnerUserId
      ? db.select().from(users).where(eq(users.id, partnerUserId)).then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  const viewerName = viewerUser?.name ?? viewerUser?.email ?? "You";
  const partnerName = partnerUser?.name ?? partnerUser?.email ?? "Your partner";

  // payload is JSONB — cast it; the shape was written by analyzeSession
  const payload = report.payload as ReportPayload;

  // Determine which partner is A vs B (A = createdByUserId)
  const viewerIsA = session.createdByUserId === userId;

  function viewerEntry(entry: DealbreakerFlagEntry | TensionEntry) {
    return viewerIsA ? entry.partner_a : entry.partner_b;
  }
  function partnerEntry(entry: DealbreakerFlagEntry | TensionEntry) {
    return viewerIsA ? entry.partner_b : entry.partner_a;
  }

  const choiceLabel: Record<string, string> = {
    fully_on_board: "Fully on board",
    open_to_discussing: "Open to discussing",
    dealbreaker: "This is a dealbreaker for me",
  };

  function resolvePlaceholders(template: string, name: string): string {
    return template
      .replace(/\{name\}/g, name)
      .replace(/\{their\}/g, "their")
      .replace(/\{them\}/g, "them")
      .replace(/\{they\}/g, "they")
      .replace(/\{theirs\}/g, "theirs");
  }

  const hasFlags = payload.dealbreaker_flags.length > 0;
  const hasTensions = payload.tensions.length > 0;
  const hasCustomFlags = payload.custom_questions.dealbreaker_flags.length > 0;
  const hasCustomTensions = payload.custom_questions.tensions.length > 0;
  const hasCoverage = payload.coverage_notes.length > 0;
  const heavyFlags = payload.summary.dealbreaker_flags >= 5;

  const viewerSpotlights = viewerIsA
    ? (payload.spotlights?.partner_a ?? [])
    : (payload.spotlights?.partner_b ?? []);
  const partnerSpotlights = viewerIsA
    ? (payload.spotlights?.partner_b ?? [])
    : (payload.spotlights?.partner_a ?? []);
  const hasSpotlights = viewerSpotlights.length > 0 || partnerSpotlights.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">

      {/* Header */}
      <p className="text-sm uppercase tracking-[0.2em] text-candle">
        Compatibility report
      </p>
      <h1
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {viewerName} &amp; {partnerName}
      </h1>
      <p className="mt-3 text-ink-soft">
        {payload.session.stage.replace(/_/g, " ")}
        {payload.session.cultural_context !== "universal"
          ? ` · ${payload.session.cultural_context}`
          : ""}
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Section 0 — Spotlights                                              */}
      {/* ------------------------------------------------------------------ */}
      {hasSpotlights && (
        <section className="mt-14">
          <h2
            className="text-xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Questions marked as important
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Questions either of you flagged as&nbsp;&ldquo;this matters to
            me&rdquo; while answering.
          </p>

          {viewerSpotlights.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium text-ink">
                {viewerName} marked these
              </p>
              <div className="space-y-4">
                {viewerSpotlights.map((entry) => (
                  <SpotlightCard
                    key={entry.question_id}
                    entry={entry}
                    viewerIsA={viewerIsA}
                    viewerName={viewerName}
                    partnerName={partnerName}
                    choiceLabel={choiceLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {partnerSpotlights.length > 0 && (
            <div className={viewerSpotlights.length > 0 ? "mt-8" : "mt-6"}>
              <p className="mb-3 text-sm font-medium text-ink">
                {partnerName} marked these
              </p>
              <div className="space-y-4">
                {partnerSpotlights.map((entry) => (
                  <SpotlightCard
                    key={entry.question_id}
                    entry={entry}
                    viewerIsA={viewerIsA}
                    viewerName={viewerName}
                    partnerName={partnerName}
                    choiceLabel={choiceLabel}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Dealbreaker Flags                                       */}
      {/* ------------------------------------------------------------------ */}
      {hasFlags && (
        <section className="mt-14">
          <h2
            className="text-xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dealbreaker flags
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            One of you holds a firm position while the other is fully on board
            with the opposite. These are the conversations to have first.
          </p>

          <div className="mt-6 space-y-6">
            {payload.dealbreaker_flags.map((flag) => (
              <FlagCard
                key={flag.question_id}
                entry={flag}
                viewerLabel={choiceLabel[viewerEntry(flag).choice]}
                partnerLabel={choiceLabel[partnerEntry(flag).choice]}
                viewerName={viewerName}
                partnerName={partnerName}
                partnerViewText={
                  flag.partner_view_template
                    ? resolvePlaceholders(flag.partner_view_template, partnerName)
                    : undefined
                }
              />
            ))}
          </div>

          {heavyFlags && (
            <p className="mt-8 rounded-xl border border-candle/30 bg-candle/10 px-5 py-4 text-sm text-ink">
              Many couples find it helpful to work through results like these
              with a counselor. When you&rsquo;re both ready, you&rsquo;ll be
              able to share this report with a counselor of your choice.
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Tension Areas                                           */}
      {/* ------------------------------------------------------------------ */}
      {hasTensions && (
        <section className="mt-14">
          <h2
            className="text-xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tension areas
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Places where your answers differ — and where at least one of you
            has offered a starting point for the conversation.
          </p>

          <div className="mt-6 space-y-6">
            {payload.tensions.map((tension) => (
              <TensionCard
                key={tension.question_id}
                entry={tension}
                viewerChoice={viewerEntry(tension).choice}
                viewerCompromise={viewerEntry(tension).compromise_text}
                partnerChoice={partnerEntry(tension).choice}
                partnerCompromise={partnerEntry(tension).compromise_text}
                viewerName={viewerName}
                partnerName={partnerName}
                choiceLabel={choiceLabel}
                partnerViewText={
                  tension.partner_view_template
                    ? resolvePlaceholders(tension.partner_view_template, partnerName)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Alignment Areas                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-14">
        <h2
          className="text-xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Where you align
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Categories where you answered in the same direction.
        </p>

        <div className="mt-6 space-y-3">
          {payload.alignment.by_category
            .filter((c) => c.aligned_count > 0)
            .sort((a, b) => b.aligned_count / b.total - a.aligned_count / a.total)
            .map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between rounded-xl border border-ink/10 px-5 py-3"
              >
                <span className="font-medium text-ink capitalize">
                  {cat.category.replace(/_/g, " ")}
                </span>
                <span className="text-sm text-ink-soft">
                  {cat.aligned_count} of {cat.total} in sync
                </span>
              </div>
            ))}
        </div>

        {payload.alignment.shared_dealbreakers.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-medium text-ink">
              Shared non-negotiables
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              You both drew a firm line here. That&rsquo;s meaningful.
            </p>
            <ul className="mt-4 space-y-2">
              {payload.alignment.shared_dealbreakers.map((item) => (
                <li
                  key={item.question_id}
                  className="rounded-xl border border-ink/10 px-5 py-3 text-sm text-ink"
                >
                  {item.question_text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Custom questions section                                             */}
      {/* ------------------------------------------------------------------ */}
      {(hasCustomFlags || hasCustomTensions || payload.custom_questions.aligned.length > 0) && (
        <section className="mt-14">
          <h2
            className="text-xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your questions
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            The questions one of you added for this session.
          </p>

          {hasCustomFlags && (
            <div className="mt-6 space-y-6">
              {payload.custom_questions.dealbreaker_flags.map((flag) => (
                <FlagCard
                  key={flag.question_id}
                  entry={flag}
                  viewerLabel={choiceLabel[viewerEntry(flag).choice]}
                  partnerLabel={choiceLabel[partnerEntry(flag).choice]}
                  viewerName={viewerName}
                  partnerName={partnerName}
                />
              ))}
            </div>
          )}

          {hasCustomTensions && (
            <div className="mt-6 space-y-6">
              {payload.custom_questions.tensions.map((tension) => (
                <TensionCard
                  key={tension.question_id}
                  entry={tension}
                  viewerChoice={viewerEntry(tension).choice}
                  viewerCompromise={viewerEntry(tension).compromise_text}
                  partnerChoice={partnerEntry(tension).choice}
                  partnerCompromise={partnerEntry(tension).compromise_text}
                  viewerName={viewerName}
                  partnerName={partnerName}
                  choiceLabel={choiceLabel}
                  partnerViewText={undefined}
                />
              ))}
            </div>
          )}

          {payload.custom_questions.aligned.length > 0 && (
            <ul className="mt-6 space-y-2">
              {payload.custom_questions.aligned.map((item) => (
                <li
                  key={item.question_id}
                  className="flex items-center gap-3 rounded-xl border border-ink/10 px-5 py-3 text-sm text-ink"
                >
                  <span className="text-candle">✓</span>
                  {item.question_text}
                </li>
              ))}
            </ul>
          )}

          {payload.custom_questions.shared_dealbreakers.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-ink">Shared non-negotiables</p>
              <ul className="mt-3 space-y-2">
                {payload.custom_questions.shared_dealbreakers.map((item) => (
                  <li
                    key={item.question_id}
                    className="rounded-xl border border-ink/10 px-5 py-3 text-sm text-ink"
                  >
                    {item.question_text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Coverage note                                                        */}
      {/* ------------------------------------------------------------------ */}
      {hasCoverage && (
        <section className="mt-14">
          <p className="rounded-xl border border-ink/10 px-5 py-4 text-sm text-ink-soft">
            {payload.coverage_notes.reduce((n, note) => n + note.excluded_question_ids.length, 0)}{" "}
            question{payload.coverage_notes.reduce((n, note) => n + note.excluded_question_ids.length, 0) === 1 ? "" : "s"} were
            excluded from your report because one or both of you hadn&rsquo;t
            answered them at the time of submission.
          </p>
        </section>
      )}

      <div className="mt-16 border-t border-ink/10 pt-10 text-center text-sm text-ink-soft">
        <p>Beforehand doesn&rsquo;t tell you what to do.</p>
        <p className="mt-1">It shows you what&rsquo;s true.</p>
      </div>

    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FlagCard({
  entry,
  viewerLabel,
  partnerLabel,
  viewerName,
  partnerName,
  partnerViewText,
}: {
  entry: DealbreakerFlagEntry;
  viewerLabel: string;
  partnerLabel: string;
  viewerName: string;
  partnerName: string;
  partnerViewText?: string;
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-5 ${
        entry.is_core
          ? "border-candle/50 bg-candle/5"
          : "border-ink/15 bg-white"
      }`}
    >
      {entry.is_core && (
        <p className="mb-3 text-xs uppercase tracking-[0.15em] text-candle">
          Core category
        </p>
      )}
      <p className="font-medium text-ink">{entry.question_text}</p>
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-ink-soft">
          <span className="font-medium text-ink">You</span> said:{" "}
          {viewerLabel}
        </p>
        <div>
          {partnerViewText && (
            <p className="mb-1 text-xs italic text-ink-soft">
              How {partnerName} sees it: &ldquo;{partnerViewText}&rdquo;
            </p>
          )}
          <p className="text-ink-soft">
            <span className="font-medium text-ink">{partnerName}</span> said:{" "}
            {partnerLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function TensionCard({
  entry,
  viewerChoice,
  viewerCompromise,
  partnerChoice,
  partnerCompromise,
  viewerName,
  partnerName,
  choiceLabel,
  partnerViewText,
}: {
  entry: TensionEntry;
  viewerChoice: string;
  viewerCompromise: string | null;
  partnerChoice: string;
  partnerCompromise: string | null;
  viewerName: string;
  partnerName: string;
  choiceLabel: Record<string, string>;
  partnerViewText?: string;
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-5 ${
        entry.elevated
          ? "border-candle/40 bg-candle/5"
          : "border-ink/15 bg-white"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        {entry.is_core && (
          <span className="text-xs uppercase tracking-[0.15em] text-candle">
            Core
          </span>
        )}
        {entry.elevated && (
          <span className="text-xs uppercase tracking-[0.15em] text-ink-soft">
            One firm position
          </span>
        )}
      </div>
      <p className="font-medium text-ink">{entry.question_text}</p>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-ink-soft">
            <span className="font-medium text-ink">You</span> said:{" "}
            {choiceLabel[viewerChoice]}
          </p>
          {viewerCompromise && (
            <p className="mt-1.5 rounded-lg bg-ink/5 px-4 py-2.5 text-ink">
              &ldquo;{viewerCompromise}&rdquo;
            </p>
          )}
        </div>
        <div>
          {partnerViewText && (
            <p className="mb-1 text-xs italic text-ink-soft">
              How {partnerName} sees it: &ldquo;{partnerViewText}&rdquo;
            </p>
          )}
          <p className="text-ink-soft">
            <span className="font-medium text-ink">{partnerName}</span> said:{" "}
            {choiceLabel[partnerChoice]}
          </p>
          {partnerCompromise && (
            <p className="mt-1.5 rounded-lg bg-ink/5 px-4 py-2.5 text-ink">
              &ldquo;{partnerCompromise}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotlightCard({
  entry,
  viewerIsA,
  viewerName,
  partnerName,
  choiceLabel,
}: {
  entry: SpotlightEntry;
  viewerIsA: boolean;
  viewerName: string;
  partnerName: string;
  choiceLabel: Record<string, string>;
}) {
  const viewerAnswer = viewerIsA ? entry.partner_a : entry.partner_b;
  const partnerAnswer = viewerIsA ? entry.partner_b : entry.partner_a;
  return (
    <div className="rounded-xl border border-ink/15 bg-white px-5 py-4">
      <p className="font-medium text-ink">{entry.question_text}</p>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-ink-soft">
          <span className="font-medium text-ink">You</span> said:{" "}
          {viewerAnswer ? choiceLabel[viewerAnswer.choice] : <em>no answer</em>}
        </p>
        {viewerAnswer?.compromise_text && (
          <p className="rounded-lg bg-ink/5 px-4 py-2.5 text-ink">
            &ldquo;{viewerAnswer.compromise_text}&rdquo;
          </p>
        )}
        <p className="text-ink-soft">
          <span className="font-medium text-ink">{partnerName}</span> said:{" "}
          {partnerAnswer ? choiceLabel[partnerAnswer.choice] : <em>no answer</em>}
        </p>
        {partnerAnswer?.compromise_text && (
          <p className="rounded-lg bg-ink/5 px-4 py-2.5 text-ink">
            &ldquo;{partnerAnswer.compromise_text}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
