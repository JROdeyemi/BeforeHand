import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { getActiveContexts } from "@/db/queries";
import SessionWizard from "./wizard";

export default async function NewSessionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/sessions/new");
  }

  const contexts = await getActiveContexts(db);

  return (
    <main>
      <SessionWizard contexts={contexts} />
    </main>
  );
}
