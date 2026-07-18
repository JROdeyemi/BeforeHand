import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getActiveShareRequest,
  getLastCompletedShare,
  getLastNudgeSentAt,
  getOwnProgressPercent,
  getPartnerProgressPercent,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import { getInvitationForSession } from "@/db/queries";
import { users } from "@/db/schema";
import { requireNamedUser } from "@/lib/require-named-user";
import { ProgressRing } from "@/components/progress-ring";
import { NudgePicker } from "@/components/nudge-picker";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailFailed?: string }>;
}) {
  const { id } = await params;
  const { emailFailed } = await searchParams;

  const { session: authSession } = await requireNamedUser(`/sessions/${id}`);

  let session;
  try {
    session = await getSessionForMember(db, id, authSession.user.id);
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

  const invitation = await getInvitationForSession(db, id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = invitation ? `${appUrl}/invite/${invitation.token}` : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Email-failure banner */}
      {emailFailed === "1" && (
        <div className="mb-10 rounded-xl border border-candle/40 bg-candle/10 px-5 py-4">
          <p className="font-medium text-ink">
            The invitation email didn&rsquo;t send — but your session is ready.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Share this link with your partner directly:
          </p>
          {inviteUrl && (
            <input
              readOnly
              value={inviteUrl}
              className="mt-3 w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm text-ink-soft outline-none"
            />
          )}
        </div>
      )}

      {session.status === "invited" && (
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-candle">
            Waiting
          </p>
          <h1
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Waiting for your partner to accept
          </h1>
          <p className="mt-4 text-ink-soft">
            We&rsquo;ve sent{" "}
            <span className="font-medium text-ink">
              {invitation?.invitedEmail ?? "your partner"}
            </span>{" "}
            an invitation. Once they accept, you&rsquo;ll both be able to start
            answering questions.
          </p>
          {inviteUrl && emailFailed !== "1" && (
            <div className="mt-8">
              <p className="text-sm font-medium text-ink">
                If the email didn&rsquo;t arrive, share this link directly:
              </p>
              <input
                readOnly
                value={inviteUrl}
                className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm text-ink-soft outline-none"
              />
            </div>
          )}
        </div>
      )}

      {session.status === "active" && await (async () => {
        const userId = authSession.user.id;
        const partnerId =
          session.createdByUserId === userId
            ? session.partnerUserId
            : session.createdByUserId;

        const [
          submitted,
          ownPct,
          partnerPct,
          partnerUser,
          lastNudgeSentAt,
          partnerHasSubmitted,
        ] = await Promise.all([
          hasSubmitted(db, id, userId),
          getOwnProgressPercent(db, id, userId),
          getPartnerProgressPercent(db, id, userId),
          partnerId
            ? db
                .select({ name: users.name, email: users.email })
                .from(users)
                .where(eq(users.id, partnerId))
                .then((r) => r[0] ?? null)
            : Promise.resolve(null),
          getLastNudgeSentAt(db, id, userId),
          partnerId ? hasSubmitted(db, id, partnerId) : Promise.resolve(false),
        ]);

        const partnerDisplayName =
          partnerUser?.name ??
          partnerUser?.email?.split("@")[0] ??
          "Your partner";
        const partnerFirstName = partnerDisplayName.split(" ")[0];

        if (submitted) {
          return (
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-candle">
                Waiting
              </p>
              <h1
                className="mt-2 text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your answers are in.
              </h1>
              <p className="mt-4 text-ink-soft">
                The report unlocks the moment your partner submits.
              </p>
              <div className="mt-6 flex gap-6">
                <ProgressRing pct={ownPct} label="You" />
                <ProgressRing pct={partnerPct} label={partnerFirstName} />
              </div>
              <NudgePicker
                sessionId={id}
                initialLastSentAt={lastNudgeSentAt?.toISOString() ?? null}
              />
            </div>
          );
        }

        const allDesignated = await areAllCategoriesDesignated(
          db,
          id,
          userId,
        );
        const ctaHref = allDesignated
          ? `/sessions/${id}/answer`
          : `/sessions/${id}/designate`;
        const ctaLabel = allDesignated ? "Continue answering" : "Get started";

        return (
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-candle">
              Active
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You&rsquo;re both in.
            </h1>
            <p className="mt-4 text-ink-soft">
              Answer privately at your own pace. The report unlocks when you
              both submit.
            </p>
            <p className="mt-2 text-sm text-ink-soft/70">
              Your answers are private until you both submit.
            </p>
            <div className="mt-6 flex gap-6">
              <ProgressRing pct={ownPct} label="You" />
              <ProgressRing pct={partnerPct} label={partnerFirstName} />
            </div>
            {!partnerHasSubmitted && (
              <NudgePicker
                sessionId={id}
                initialLastSentAt={lastNudgeSentAt?.toISOString() ?? null}
              />
            )}
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-xl bg-ink px-6 py-3 font-medium text-white"
            >
              {ctaLabel}
            </Link>
          </div>
        );
      })()}

      {(session.status === "report_ready" || session.status === "closed") && await (async () => {
        const userId = authSession.user.id;
        const [shareData, lastCompleted] = await Promise.all([
          getActiveShareRequest(db, id, userId),
          getLastCompletedShare(db, id, userId),
        ]);

        const partnerId =
          session.createdByUserId === userId
            ? session.partnerUserId
            : session.createdByUserId;
        const partnerUser = partnerId
          ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, partnerId)).then((r) => r[0] ?? null)
          : null;
        const partnerFirstName = (partnerUser?.name ?? partnerUser?.email?.split("@")[0] ?? "Your partner").split(" ")[0];

        return (
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-candle">
              Session
            </p>
            <h1
              className="mt-2 text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your report is ready.
            </h1>
            <p className="mt-4 text-ink-soft">
              Both of you have submitted. Your compatibility report is now
              available.
            </p>
            <Link
              href={`/sessions/${id}/report`}
              className="mt-8 inline-block rounded-xl bg-ink px-6 py-3 font-medium text-white"
            >
              View report &rarr;
            </Link>
            {shareData && shareData.request.requestedByUserId === userId && (
              <p className="mt-4 text-sm text-ink-soft">
                Waiting for {partnerFirstName} to approve a counselor share.
              </p>
            )}
            {shareData && shareData.request.requestedByUserId !== userId && (
              <p className="mt-4 text-sm text-ink-soft">
                {partnerFirstName} requested a counselor share.
              </p>
            )}
            {!shareData && lastCompleted?.sharedAt && (
              <p className="mt-4 text-sm text-ink-soft">
                Report shared with {lastCompleted.counselorEmail}.
              </p>
            )}
          </div>
        );
      })()}
    </main>
  );
}
