import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getOwnDesignations,
  getSessionForMember,
  NotSessionMemberError,
} from "@/db/guards";
import { getAllCategories } from "@/db/queries";
import { DesignationForm } from "@/components/designation-form";
import { saveDesignations } from "./actions";

export default async function DesignatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect(`/signin?callbackUrl=/sessions/${id}/designate`);
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

  // Already designated — don't force them back through this screen
  if (await areAllCategoriesDesignated(db, id, userId)) {
    redirect(`/sessions/${id}/answer`);
  }

  const [allCategories, existing] = await Promise.all([
    getAllCategories(db),
    getOwnDesignations(db, id, userId),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-candle">
        Before you answer
      </p>
      <h1
        className="mt-2 text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        What matters most to you?
      </h1>
      <p className="mt-4 text-ink-soft">
        Mark each topic as <strong className="text-ink">Core</strong> or{" "}
        <strong className="text-ink">Flexible</strong> before you start
        answering. Core means conflicts here are non-negotiable for you. If
        either of you marks a topic core, we treat it as core in the final
        report.
      </p>
      <p className="mt-3 text-sm text-ink-soft/70">
        Your designations are private until the report unlocks.
      </p>

      <DesignationForm
        sessionId={id}
        categories={allCategories}
        existing={existing}
        onSave={saveDesignations}
      />
    </main>
  );
}
