"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { coupleSessions, culturalContexts, invitations } from "@/db/schema";
import { generateInviteToken } from "@/lib/tokens";
import { sendInvitationEmail } from "@/lib/email";

export type CreateSessionState = { error: string } | null;

const schema = z.object({
  stage: z.enum(["early_dating", "dating", "engaged", "married"]),
  contextSlug: z.string().min(1),
  partnerEmail: z.string().email("Please enter a valid email address."),
});

export async function createSession(
  _prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return { error: "Please sign in to continue." };
  }
  const userId = authSession.user.id;
  const userEmail = authSession.user.email ?? "";

  const parsed = schema.safeParse({
    stage: formData.get("stage"),
    contextSlug: formData.get("contextSlug"),
    partnerEmail: String(formData.get("partnerEmail") ?? "")
      .trim()
      .toLowerCase(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const { stage, contextSlug, partnerEmail } = parsed.data;

  if (partnerEmail === userEmail.toLowerCase()) {
    return { error: "You can't invite yourself." };
  }

  // Validate context exists and is active (guards tampered hidden inputs)
  const [ctx] = await db
    .select({ slug: culturalContexts.slug })
    .from(culturalContexts)
    .where(
      and(
        eq(culturalContexts.slug, contextSlug),
        eq(culturalContexts.isActive, true),
      ),
    );
  if (!ctx) {
    return { error: "Please select a valid cultural context." };
  }

  // Duplicate guard: don't create a second session to the same partner
  const [existing] = await db
    .select({ sessionId: coupleSessions.id })
    .from(coupleSessions)
    .innerJoin(invitations, eq(invitations.sessionId, coupleSessions.id))
    .where(
      and(
        eq(coupleSessions.createdByUserId, userId),
        eq(coupleSessions.status, "invited"),
        eq(invitations.invitedEmail, partnerEmail),
        isNull(invitations.acceptedAt),
      ),
    )
    .limit(1);
  if (existing) {
    redirect(`/sessions/${existing.sessionId}`);
  }

  // Create session + invitation atomically
  const token = generateInviteToken();
  const [{ sessionId }] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(coupleSessions)
      .values({
        createdByUserId: userId,
        relationshipStage: stage,
        culturalContextSlug: contextSlug,
        status: "invited",
      })
      .returning({ sessionId: coupleSessions.id });

    await tx.insert(invitations).values({
      sessionId: result[0].sessionId,
      invitedEmail: partnerEmail,
      token,
      channel: "email",
    });

    return result;
  });

  // Send invitation email (outside transaction; failure is non-fatal)
  const inviterName = authSession.user.name ?? userEmail;
  try {
    await sendInvitationEmail({ to: partnerEmail, inviterName, token });
  } catch (err) {
    console.error("[invitation] Email send failed for session", sessionId, err);
    redirect(`/sessions/${sessionId}?emailFailed=1`);
  }

  redirect(`/sessions/${sessionId}`);
}
