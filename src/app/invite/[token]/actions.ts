"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { coupleSessions, invitations } from "@/db/schema";
import { getInvitationByToken } from "@/db/queries";
import { assertTransition } from "@/lib/session-state";
import type { SessionStatus } from "@/lib/session-state";

export async function acceptInvitation(
  token: string,
  _formData: FormData,
): Promise<void> {
  const authSession = await auth();
  if (!authSession?.user?.id || !authSession.user.email) return;
  const userId = authSession.user.id;
  const userEmail = authSession.user.email;

  const invitation = await getInvitationByToken(db, token);
  if (!invitation) return;

  // Already accepted — redirect gracefully
  if (invitation.acceptedAt) {
    redirect(`/sessions/${invitation.sessionId}`);
  }

  // Server-side email guard (UI prevents this, but enforce here)
  if (userEmail.toLowerCase() !== invitation.invitedEmail.toLowerCase()) return;

  // State machine check
  const [coupleSession] = await db
    .select()
    .from(coupleSessions)
    .where(eq(coupleSessions.id, invitation.sessionId));
  if (!coupleSession) return;

  assertTransition(coupleSession.status as SessionStatus, "accept_invitation");

  // Accept with optimistic locks — both WHERE clauses prevent double-acceptance
  await db.transaction(async (tx) => {
    const updatedInvitation = await tx
      .update(invitations)
      .set({ acceptedAt: new Date(), acceptedByUserId: userId })
      .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt)))
      .returning({ id: invitations.id });

    if (!updatedInvitation[0]) {
      throw new Error("Invitation already accepted (race condition).");
    }

    const updatedSession = await tx
      .update(coupleSessions)
      .set({ partnerUserId: userId, status: "active" })
      .where(
        and(
          eq(coupleSessions.id, invitation.sessionId),
          eq(coupleSessions.status, "invited"),
        ),
      )
      .returning({ id: coupleSessions.id });

    if (!updatedSession[0]) {
      throw new Error("Session already activated (race condition).");
    }
  });

  redirect(`/sessions/${invitation.sessionId}`);
}
