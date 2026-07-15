import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { getSessionsForUser } from "@/db/queries";

const STAGE_LABELS: Record<string, string> = {
  early_dating: "Early Dating",
  dating: "Dating",
  engaged: "Engaged",
  married: "Married",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Setting up",
  invited: "Awaiting partner",
  active: "In progress",
  report_ready: "Report ready",
  closed: "Closed",
};

function statusClass(status: string) {
  if (status === "active") return "text-candle-deep";
  if (status === "report_ready") return "text-green-600";
  return "text-ink-soft";
}

export default async function SessionsPage() {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect("/signin?callbackUrl=/sessions");
  }

  const sessions = await getSessionsForUser(db, authSession.user.id);
  const nonClosed = sessions.filter((s) => s.status !== "closed");

  if (nonClosed.length === 0) {
    redirect("/sessions/new");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
        Your sessions
      </h1>
      <ul className="mt-8 space-y-4">
        {nonClosed.map((session) => (
          <li key={session.id}>
            <Link
              href={`/sessions/${session.id}`}
              className="block rounded-lg border border-ink/10 p-5 transition hover:border-candle"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">
                  {STAGE_LABELS[session.relationshipStage] ??
                    session.relationshipStage}
                </span>
                <span className={`text-sm ${statusClass(session.status)}`}>
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {session.partnerEmail ?? "No partner yet"}
              </p>
              <p className="mt-1 text-xs text-ink-soft/60">
                Started{" "}
                {session.createdAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-ink-soft">
        <Link
          href="/sessions/new"
          className="underline underline-offset-4 hover:text-ink"
        >
          Start a new session
        </Link>
      </p>
    </main>
  );
}
