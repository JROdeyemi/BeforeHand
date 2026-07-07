import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { getInvitationByToken, getInviterForSession } from "@/db/queries";
import { acceptInvitation } from "./actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await getInvitationByToken(db, token);

  // Invalid or already used — same message to prevent token enumeration
  if (!invitation || invitation.acceptedAt) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1
          className="text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          This invitation link isn&rsquo;t valid.
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          It may have already been used, or the link may be incorrect.
        </p>
      </main>
    );
  }

  const authSession = await auth();
  const inviter = await getInviterForSession(db, invitation.sessionId);
  const inviterName = inviter?.name ?? inviter?.email ?? "Someone";

  // Case 1: Not signed in → sign-in form (email pre-filled, readonly)
  if (!authSession?.user) {
    async function requestMagicLink(_formData: FormData) {
      "use server";
      await signIn("resend", {
        email: invitation!.invitedEmail,
        redirectTo: `/invite/${token}`,
        redirect: false,
      });
      redirect("/signin/check-email");
    }

    return (
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-sm uppercase tracking-[0.2em] text-candle">
          Invitation
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {inviterName} has invited you to Beforehand.
        </h1>
        <p className="mt-4 text-ink-soft">
          Sign in to accept &mdash; no password needed.
        </p>
        <form action={requestMagicLink} className="mt-8 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Your email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={invitation.invitedEmail}
            readOnly
            className="rounded-lg border border-ink/20 bg-linen px-4 py-3 text-ink outline-none"
          />
          <button
            type="submit"
            className="mt-2 rounded-full bg-ink px-6 py-3 font-medium text-linen transition hover:bg-ink-soft"
          >
            Send sign-in link
          </button>
        </form>
        <p className="mt-6 text-xs text-ink-soft/60">
          We&rsquo;ll send a one-click link to {invitation.invitedEmail}. After
          signing in, you&rsquo;ll return here to accept.
        </p>
      </main>
    );
  }

  // Case 2: Signed in as wrong email → sign-out prompt
  if (
    authSession.user.email?.toLowerCase() !==
    invitation.invitedEmail.toLowerCase()
  ) {
    async function doSignOut(_formData: FormData) {
      "use server";
      await signOut({ redirectTo: `/invite/${token}` });
    }

    return (
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-sm uppercase tracking-[0.2em] text-candle">
          Invitation
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Wrong account
        </h1>
        <p className="mt-4 text-ink-soft">
          This invitation was sent to{" "}
          <span className="font-medium text-ink">
            {invitation.invitedEmail}
          </span>
          . You&rsquo;re currently signed in as{" "}
          <span className="font-medium">{authSession.user.email}</span>.
        </p>
        <form action={doSignOut} className="mt-6">
          <button
            type="submit"
            className="text-sm text-candle-deep underline underline-offset-2"
          >
            Sign out and try again
          </button>
        </form>
      </main>
    );
  }

  // Case 3: Signed in as correct email → accept
  const boundAccept = acceptInvitation.bind(null, token);

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <p className="text-sm uppercase tracking-[0.2em] text-candle">
        Invitation
      </p>
      <h1
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {inviterName} wants to do Beforehand with you.
      </h1>
      <div className="mt-6 space-y-4 text-ink-soft">
        <p>
          Each of you answers questions about money, family, faith, intimacy,
          and more &mdash; privately, in your own time, without being watched.
        </p>
        <p>
          When you&rsquo;ve both submitted, your answers unlock for both of you
          at the same moment: where you align, where there&rsquo;s tension, and
          what&rsquo;s non-negotiable.
        </p>
        <p
          className="italic text-ink/70"
          style={{ fontFamily: "var(--font-display)" }}
        >
          &ldquo;Before I ask for your hand&hellip; let&rsquo;s talk.&rdquo;
        </p>
      </div>
      <form action={boundAccept} className="mt-8">
        <button
          type="submit"
          className="rounded-full bg-ink px-8 py-3 font-medium text-linen transition hover:bg-ink-soft"
        >
          Accept and get started
        </button>
      </form>
    </main>
  );
}
