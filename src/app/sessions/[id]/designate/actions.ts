"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  areAllCategoriesDesignated,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import { getAllCategories } from "@/db/queries";
import { categoryDesignations } from "@/db/schema";

export async function saveDesignations(
  sessionId: string,
  designations: Record<string, "core" | "flexible">,
): Promise<{ error: string } | void> {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return { error: "You must be signed in." };
  }
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) {
      return { error: "Session not found." };
    }
    throw err;
  }

  if (session.status !== "active") {
    return { error: "This session is not currently active." };
  }

  if (await hasSubmitted(db, sessionId, userId)) {
    return { error: "You have already submitted your answers." };
  }

  // Validate all categories are covered
  const allCategories = await getAllCategories(db);
  const categorySlugs = new Set(allCategories.map((c) => c.slug));
  for (const slug of categorySlugs) {
    if (!designations[slug] || !["core", "flexible"].includes(designations[slug])) {
      return { error: "Please designate every category before continuing." };
    }
  }
  if (Object.keys(designations).length < categorySlugs.size) {
    return { error: "Please designate every category before continuing." };
  }

  // Upsert all designations atomically
  await db.transaction(async (tx) => {
    for (const [categorySlug, designation] of Object.entries(designations)) {
      if (!categorySlugs.has(categorySlug)) continue;
      await tx
        .insert(categoryDesignations)
        .values({ sessionId, userId, categorySlug, designation })
        .onConflictDoUpdate({
          target: [
            categoryDesignations.sessionId,
            categoryDesignations.userId,
            categoryDesignations.categorySlug,
          ],
          set: { designation },
        });
    }
  });

  // Verify the save landed (guard against race where designations already exist)
  const allDone = await areAllCategoriesDesignated(db, sessionId, userId);
  if (!allDone) {
    return { error: "Some categories could not be saved. Please try again." };
  }

  redirect(`/sessions/${sessionId}/answer`);
}
