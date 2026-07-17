import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getPartnerProgressPercent,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import { getInvitationForSession } from "@/db/queries";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailFailed?: string }>;
}) {
  const { id } = await params;
  const { emailFailed } = await searchParams;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect(`/signin?callbackUrl=/sessions/${id}`);
  }

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
        const submitted = await hasSubmitted(db, id, authSession.user.id);

        if (submitted) {
          const partnerPct = await getPartnerProgressPercent(
            db,
            id,
            authSession.user.id,
          );
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
                The report unlocks the moment your partner submits. They&rsquo;re{" "}
                <span className="font-medium text-ink">{partnerPct}% done</span>.
              </p>
              <button
                type="button"
                disabled
                className="mt-8 rounded-xl border border-ink/20 px-5 py-2.5 text-sm text-ink-soft opacity-50"
              >
                Send a nudge — coming soon
              </button>
            </div>
          );
        }

        const allDesignated = await areAllCategoriesDesignated(
          db,
          id,
          authSession.user.id,
        );
        const ctaHref = allDesignated
          ? `/sessions/${id}/answer`
          : `/sessions/${id}/designate`;
        const ctaLabel = allDesignated
          ? "Continue answering"
          : "Get started";

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
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-xl bg-ink px-6 py-3 font-medium text-white"
            >
              {ctaLabel}
            </Link>
          </div>
        );
      })()}

      {(session.status === "report_ready" || session.status === "closed") && (
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
        </div>
      )}
    </main>
  );
}
