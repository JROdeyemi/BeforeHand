"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function setDisplayName(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const returnTo = (formData.get("returnTo") as string | null) ?? "/sessions";

  if (!name || name.length > 100) {
    redirect(`/onboarding/name?error=1&returnTo=${encodeURIComponent(returnTo)}`);
  }

  await db.update(users).set({ name }).where(eq(users.id, session.user.id));
  redirect(returnTo);
}
