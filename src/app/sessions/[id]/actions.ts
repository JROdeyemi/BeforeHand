"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { nudges, users } from "@/db/schema";
import {
  getLastNudgeSentAt,
  getSessionForMember,
  hasSubmitted,
  NotSessionMemberError,
} from "@/db/guards";
import { sendNudgeEmail } from "@/lib/email";
import { NUDGE_PRESETS } from "@/lib/nudge-presets";
import { eq } from "drizzle-orm";

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

export async function sendNudge(
  sessionId: string,
  message: string,
): Promise<{ error: string } | { ok: true }> {
  const authSession = await auth();
  if (!authSession?.user?.id) return { error: "Not signed in." };
  const userId = authSession.user.id;

  let session;
  try {
    session = await getSessionForMember(db, sessionId, userId);
  } catch (err) {
    if (err instanceof NotSessionMemberError) return { error: "Session not found." };
    throw err;
  }

  if (session.status !== "active") {
    return { error: "This session is no longer active." };
  }

  const partnerId =
    session.createdByUserId === userId
      ? session.partnerUserId
      : session.createdByUserId;

  if (!partnerId) {
    return { error: "Your partner hasn't joined yet." };
  }

  const partnerSubmitted = await hasSubmitted(db, sessionId, partnerId);
  if (partnerSubmitted) {
    return { error: "Your partner has already submitted." };
  }

  const lastSentAt = await getLastNudgeSentAt(db, sessionId, userId);
  if (lastSentAt) {
    const elapsed = Date.now() - lastSentAt.getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const hoursLeft = Math.ceil((RATE_LIMIT_MS - elapsed) / 3_600_000);
      return {
        error: `You already sent a nudge recently. Try again in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
      };
    }
  }

  const trimmed = message.trim();
  const isPreset = Object.prototype.hasOwnProperty.call(NUDGE_PRESETS, trimmed);
  const isCustom = !isPreset && trimmed.length >= 1 && trimmed.length <= 200;
  if (!isPreset && !isCustom) {
    return { error: "Please choose a preset or write a message (max 200 characters)." };
  }

  const displayText = isPreset ? NUDGE_PRESETS[trimmed] : trimmed;

  await db.insert(nudges).values({
    sessionId,
    fromUserId: userId,
    message: trimmed,
    channel: "email",
  });

  try {
    const [partnerUser] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, partnerId));

    if (partnerUser) {
      const senderName =
        authSession.user.name ?? authSession.user.email?.split("@")[0] ?? "Your partner";
      await sendNudgeEmail({
        to: partnerUser.email,
        senderName,
        messageText: displayText,
        sessionId,
      });
    }
  } catch (err) {
    console.error("[sendNudge] Email delivery failed:", err);
    // Non-fatal — nudge row is committed; partner will see it on next page load.
  }

  return { ok: true };
}
