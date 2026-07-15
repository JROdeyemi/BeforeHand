import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { getSessionsForUser } from "@/db/queries";

export default async function Home() {
  const session = await auth();
  const isSignedIn = Boolean(session?.user?.id);

  let ctaHref = "/signin";
  let ctaLabel = "Start the conversation";
  if (isSignedIn && session?.user?.id) {
    const userSessions = await getSessionsForUser(db, session.user.id);
    const hasActive = userSessions.some((s) => s.status !== "closed");
    ctaHref = hasActive ? "/sessions" : "/sessions/new";
    ctaLabel = hasActive ? "Continue" : "Create a session";
  }

  return (
    <main>
      {/* Hero */}
      <section className="bg-ink text-linen">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center">
          <p className="mb-6 text-sm uppercase tracking-[0.3em] text-candle">
            Beforehand
          </p>
          <h1
            className="text-4xl leading-tight sm:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Before I ask for your hand&hellip;
            <br />
            <span className="italic text-candle">let&rsquo;s talk.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-linen/80">
            The conversations couples avoid are the ones that decide
            everything. Beforehand asks them for you &mdash; privately, in
            your own time &mdash; then shows you both, at the same moment,
            exactly where you stand.
          </p>
          <div className="mt-10">
            <Link
              href={ctaHref}
              className="inline-block rounded-full bg-candle px-8 py-3 font-medium text-ink transition hover:bg-candle-deep hover:text-linen"
            >
              {ctaLabel}
            </Link>
          </div>
          <p className="mt-6 text-sm text-linen/50">
            A mirror, not a verdict. Your answers stay private until you both
            submit.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2
          className="text-center text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          How it works
        </h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">Answer alone</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Each of you answers honest questions about money, family, faith,
              intimacy, and more &mdash; privately, without being watched, at
              your own pace.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Three honest options</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Fully on board. Open to discussing &mdash; with your compromise
              in your own words. Or a dealbreaker. No vague middle ground.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">See the truth together</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              When you&rsquo;ve both submitted, your report unlocks for both
              of you at once: where you align, where there&rsquo;s tension,
              and what&rsquo;s non-negotiable.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
