import { db } from "@/db";
import { getActiveContexts } from "@/db/queries";
import { requireNamedUser } from "@/lib/require-named-user";
import SessionWizard from "./wizard";

export default async function NewSessionPage() {
  await requireNamedUser("/sessions/new");

  const contexts = await getActiveContexts(db);

  return (
    <main>
      <SessionWizard contexts={contexts} />
    </main>
  );
}
