"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function updateDisplayName(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";

  if (!name || name.length > 100) {
    redirect("/profile?error=1");
  }

  await db.update(users).set({ name }).where(eq(users.id, session.user.id));
  redirect("/profile?saved=1");
}
