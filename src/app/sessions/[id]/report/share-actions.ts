"use server";

import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { coupleSessions, shareConsentApprovals, shareConsents, users } from "@/db/schema";
import {
  getReportForMember,
  getSessionForMember,
  NotSessionMemberError,
} from "@/db/guards";
import {
  sendCounselorShareEmail,
  sendShareNotificationEmail,
} from "@/lib/email";
import type { ReportPayload } from "@/lib/analysis";

type ActionResult = { error: string } | { ok: true };

async function getAuthedSession(sessionId: string) {
  const authSession = await auth();
  if (!authSession?.user?.id) return { error: "Not signed in." as const, userId: null, session: null };
  const userId = authSession.user.id;
  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) return { error: "Session not found." as const, userId: null, session: null };
    throw err;
  }
  if (session.status !== "report_ready") return { error: "Report is not ready." as const, userId: null, session: null };
  return { error: null, userId, session };
}

export async function requestShare(
  sessionId: string,
  counselorEmail: string,
): Promise<{ error: string } | { ok: true; shareConsentId: string }> {
  const { error, userId, session } = await getAuthedSession(sessionId);
  if (error) return { error };

  if (!counselorEmail.includes("@")) return { error: "Please enter a valid email address." };

  let shareConsentId = "";

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(coupleSessions)
      .where(eq(coupleSessions.id, sessionId))
      .for("update");

    if (!locked || locked.status !== "report_ready") return;

    const [existing] = await tx
      .select()
      .from(shareConsents)
      .where(and(eq(shareConsents.sessionId, sessionId), isNull(shareConsents.sharedAt)));

    if (existing) {
      shareConsentId = "__conflict__";
      return;
    }

    const [inserted] = await tx
      .insert(shareConsents)
      .values({ sessionId, counselorEmail, requestedByUserId: userId! })
      .returning({ id: shareConsents.id });

    await tx.insert(shareConsentApprovals).values({
      shareConsentId: inserted.id,
      userId: userId!,
    });

    shareConsentId = inserted.id;
  });

  if (shareConsentId === "__conflict__") {
    return { error: "A share request is already pending." };
  }
  if (!shareConsentId) {
    return { error: "Unable to create share request." };
  }

  return { ok: true, shareConsentId };
}

export async function approveShare(
  sessionId: string,
  shareConsentId: string,
): Promise<ActionResult> {
  const { error, userId, session } = await getAuthedSession(sessionId);
  if (error) return { error };

  let shouldExecuteShare = false;
  let counselorEmailAddr = "";

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(shareConsents)
      .where(eq(shareConsents.id, shareConsentId))
      .for("update");

    if (!locked || locked.sessionId !== sessionId) return;
    if (locked.requestedByUserId === userId) return; // approver ≠ requester (silent no-op; caller should not reach this)

    const existingApprovals = await tx
      .select()
      .from(shareConsentApprovals)
      .where(eq(shareConsentApprovals.shareConsentId, shareConsentId));

    const alreadyApproved = existingApprovals.some((a) => a.userId === userId);

    if (!alreadyApproved) {
      await tx.insert(shareConsentApprovals).values({ shareConsentId, userId: userId! });
    }

    // State-based check: execute whenever both approvals exist AND sharedAt IS NULL.
    // This makes the idempotent branch retry a previously failed send on re-approval.
    const currentApprovals = await tx
      .select()
      .from(shareConsentApprovals)
      .where(eq(shareConsentApprovals.shareConsentId, shareConsentId));

    if (currentApprovals.length >= 2 && locked.sharedAt === null) {
      await tx
        .update(shareConsents)
        .set({ sharedAt: new Date() })
        .where(eq(shareConsents.id, shareConsentId));
      shouldExecuteShare = true;
      counselorEmailAddr = locked.counselorEmail;
    }
  });

  if (!shouldExecuteShare) return { ok: true };

  // Fetch both partners' user records and the report outside the transaction.
  const partnerAId = session!.createdByUserId;
  const partnerBId = session!.partnerUserId;
  if (!partnerBId) return { error: "Session has no partner." };

  const [userA, userB] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, partnerAId)).then((r) => r[0]),
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, partnerBId)).then((r) => r[0]),
  ]);

  if (!userA || !userB) return { error: "Could not find partner accounts." };

  const nameA = userA.name ?? userA.email.split("@")[0];
  const nameB = userB.name ?? userB.email.split("@")[0];

  let report;
  try {
    report = await getReportForMember(db, sessionId, userId!);
  } catch {
    await db.update(shareConsents).set({ sharedAt: null }).where(eq(shareConsents.id, shareConsentId));
    return { error: "Could not load the report. Please try again." };
  }

  try {
    await sendCounselorShareEmail({
      to: counselorEmailAddr,
      nameA,
      nameB,
      payload: report.payload as ReportPayload,
      sharedAt: new Date(),
    });
  } catch (err) {
    console.error("[approveShare] Counselor email failed:", err);
    await db.update(shareConsents).set({ sharedAt: null }).where(eq(shareConsents.id, shareConsentId));
    return { error: "The share email failed to send. Please try approving again." };
  }

  // Partner notifications are non-fatal.
  await Promise.allSettled([
    sendShareNotificationEmail({ to: userA.email, recipientName: nameA, counselorEmail: counselorEmailAddr, sessionId }),
    sendShareNotificationEmail({ to: userB.email, recipientName: nameB, counselorEmail: counselorEmailAddr, sessionId }),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") console.error("[approveShare] Notification email failed:", r.reason);
    }
  });

  return { ok: true };
}

export async function declineShare(
  sessionId: string,
  shareConsentId: string,
): Promise<ActionResult> {
  const { error, userId, session: _session } = await getAuthedSession(sessionId);
  if (error) return { error };

  let roleError = "";
  let deleted = false;

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(shareConsents)
      .where(eq(shareConsents.id, shareConsentId))
      .for("update");

    if (!locked || locked.sessionId !== sessionId) {
      roleError = "Request not found.";
      return;
    }
    if (locked.requestedByUserId === userId) {
      roleError = "Use cancel to withdraw your own request.";
      return;
    }

    const result = await tx
      .delete(shareConsents)
      .where(and(eq(shareConsents.id, shareConsentId), isNull(shareConsents.sharedAt)))
      .returning({ id: shareConsents.id });

    deleted = result.length > 0;
  });

  if (roleError) return { error: roleError };
  if (!deleted) return { error: "This report has already been shared." };
  return { ok: true };
}

export async function cancelShare(
  sessionId: string,
  shareConsentId: string,
): Promise<ActionResult> {
  const { error, userId, session: _session } = await getAuthedSession(sessionId);
  if (error) return { error };

  let roleError = "";
  let deleted = false;

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(shareConsents)
      .where(eq(shareConsents.id, shareConsentId))
      .for("update");

    if (!locked || locked.sessionId !== sessionId) {
      roleError = "Request not found.";
      return;
    }
    if (locked.requestedByUserId !== userId) {
      roleError = "Only the person who made the request can cancel it.";
      return;
    }

    const result = await tx
      .delete(shareConsents)
      .where(and(eq(shareConsents.id, shareConsentId), isNull(shareConsents.sharedAt)))
      .returning({ id: shareConsents.id });

    deleted = result.length > 0;
  });

  if (roleError) return { error: roleError };
  if (!deleted) return { error: "This report has already been shared." };
  return { ok: true };
}
