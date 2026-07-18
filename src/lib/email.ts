import { Resend } from "resend";
import type { ReportPayload } from "@/lib/analysis";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendInvitationEmail({
  to,
  inviterName,
  token,
}: {
  to: string;
  inviterName: string;
  token: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/invite/${token}`;
  const safeInviterName = escapeHtml(inviterName);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;">
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#1c2331;">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.2em;color:#d8a24a;margin:0 0 16px;">
      Beforehand
    </p>
    <h1 style="font-size:28px;font-weight:normal;margin:0 0 20px;line-height:1.3;">
      ${safeInviterName} has invited you to Beforehand.
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 16px;">
      Each of you answers questions about money, family, faith, intimacy, and
      more — privately, in your own time, without being watched.
    </p>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 28px;">
      When you've both submitted, your answers unlock for both of you at the
      same moment: where you align, where there's tension, and what's
      non-negotiable.
    </p>
    <p style="font-style:italic;font-size:20px;color:#1c2331;margin:0 0 36px;">
      "Before I ask for your hand… let's talk."
    </p>
    <a href="${acceptUrl}"
       style="display:inline-block;background:#1c2331;color:#f6f4ef;text-decoration:none;
              padding:14px 32px;border-radius:100px;font-family:sans-serif;
              font-size:15px;font-weight:500;">
      Accept and get started →
    </a>
    <p style="font-size:13px;color:#303a4e;margin-top:48px;line-height:1.6;">
      This invitation doesn't expire.<br>
      If you don't know ${safeInviterName}, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`.trim();

  const text = `${inviterName} has invited you to Beforehand.

Each of you answers questions about money, family, faith, intimacy, and more — privately, in your own time, without being watched.

When you've both submitted, your answers unlock for both of you at the same moment: where you align, where there's tension, and what's non-negotiable.

"Before I ask for your hand… let's talk."

Accept and get started: ${acceptUrl}

This invitation doesn't expire. If you don't know ${inviterName}, you can safely ignore this email.`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Beforehand <onboarding@resend.dev>",
    to,
    subject: `${inviterName} has invited you to Beforehand`,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendReportReadyEmail({
  sessionId,
  toA,
  toB,
  nameA,
  nameB,
}: {
  sessionId: string;
  toA: string;
  toB: string;
  nameA: string;
  nameB: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const reportUrl = `${appUrl}/sessions/${sessionId}/report`;

  function buildEmail(viewerName: string, partnerName: string) {
    const safeViewerName = escapeHtml(viewerName);
    const safePartnerName = escapeHtml(partnerName);
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;">
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#1c2331;">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.2em;color:#d8a24a;margin:0 0 16px;">
      Beforehand
    </p>
    <h1 style="font-size:28px;font-weight:normal;margin:0 0 20px;line-height:1.3;">
      Your report is ready, ${safeViewerName}.
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 16px;">
      You and ${safePartnerName} have both submitted your answers. Your report is now
      available — it shows where you align, where there&rsquo;s tension, and what
      each of you holds as a non-negotiable.
    </p>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 28px;">
      This is a good conversation to have together.
    </p>
    <p style="font-style:italic;font-size:20px;color:#1c2331;margin:0 0 36px;">
      &ldquo;Before I ask for your hand&hellip; let&rsquo;s talk.&rdquo;
    </p>
    <a href="${reportUrl}"
       style="display:inline-block;background:#1c2331;color:#f6f4ef;text-decoration:none;
              padding:14px 32px;border-radius:100px;font-family:sans-serif;
              font-size:15px;font-weight:500;">
      View your report &rarr;
    </a>
  </div>
</body>
</html>`.trim();

    const text = `Your report is ready, ${viewerName}.

You and ${partnerName} have both submitted your answers. Your report is now available — it shows where you align, where there's tension, and what each of you holds as a non-negotiable.

This is a good conversation to have together.

"Before I ask for your hand… let's talk."

View your report: ${reportUrl}`;

    return { html, text };
  }

  const emailA = buildEmail(nameA, nameB);
  const emailB = buildEmail(nameB, nameA);

  const from = process.env.EMAIL_FROM ?? "Beforehand <onboarding@resend.dev>";
  const subject = "Your Beforehand report is ready";

  const [resA, resB] = await Promise.all([
    resend.emails.send({ from, to: toA, subject, html: emailA.html, text: emailA.text }),
    resend.emails.send({ from, to: toB, subject, html: emailB.html, text: emailB.text }),
  ]);

  if (resA.error) throw new Error(`Resend error (A): ${resA.error.message}`);
  if (resB.error) throw new Error(`Resend error (B): ${resB.error.message}`);
}

export async function sendNudgeEmail({
  to,
  senderName,
  messageText,
  sessionId,
}: {
  to: string;
  senderName: string;
  messageText: string;
  sessionId: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const sessionUrl = `${appUrl}/sessions/${sessionId}`;
  const safeSenderName = escapeHtml(senderName);
  const safeMessageText = escapeHtml(messageText);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;">
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#1c2331;">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.2em;color:#d8a24a;margin:0 0 16px;">
      Beforehand
    </p>
    <h1 style="font-size:28px;font-weight:normal;margin:0 0 20px;line-height:1.3;">
      A little nudge from ${safeSenderName} 💛
    </h1>
    <p style="font-size:20px;line-height:1.6;color:#1c2331;margin:0 0 36px;font-style:italic;">
      &ldquo;${safeMessageText}&rdquo;
    </p>
    <a href="${sessionUrl}"
       style="display:inline-block;background:#1c2331;color:#f6f4ef;text-decoration:none;
              padding:14px 32px;border-radius:100px;font-family:sans-serif;
              font-size:15px;font-weight:500;">
      Open your session &rarr;
    </a>
    <p style="font-size:13px;color:#303a4e;margin-top:48px;line-height:1.6;">
      &ldquo;Before I ask for your hand&hellip; let&rsquo;s talk.&rdquo;
    </p>
  </div>
</body>
</html>`.trim();

  const text = `A little nudge from ${senderName} 💛

"${messageText}"

Open your session: ${sessionUrl}

"Before I ask for your hand… let's talk."`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Beforehand <onboarding@resend.dev>",
    to,
    subject: `A little nudge from ${senderName} 💛`,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendShareNotificationEmail({
  to,
  recipientName,
  counselorEmail,
  sessionId,
}: {
  to: string;
  recipientName: string;
  counselorEmail: string;
  sessionId: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const reportUrl = `${appUrl}/sessions/${sessionId}/report`;
  const safeRecipientName = escapeHtml(recipientName);
  const safeCounselorEmail = escapeHtml(counselorEmail);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;">
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:48px 24px;color:#1c2331;">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.2em;color:#d8a24a;margin:0 0 16px;">
      Beforehand
    </p>
    <h1 style="font-size:28px;font-weight:normal;margin:0 0 20px;line-height:1.3;">
      Your report was shared, ${safeRecipientName}.
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 28px;">
      With both partners&rsquo; consent, your Beforehand compatibility report
      was shared with <strong>${safeCounselorEmail}</strong>.
    </p>
    <a href="${reportUrl}"
       style="display:inline-block;background:#1c2331;color:#f6f4ef;text-decoration:none;
              padding:14px 32px;border-radius:100px;font-family:sans-serif;
              font-size:15px;font-weight:500;">
      View your report &rarr;
    </a>
    <p style="font-size:13px;color:#303a4e;margin-top:48px;line-height:1.6;">
      &ldquo;Before I ask for your hand&hellip; let&rsquo;s talk.&rdquo;
    </p>
  </div>
</body>
</html>`.trim();

  const text = `Your report was shared, ${recipientName}.

With both partners' consent, your Beforehand compatibility report was shared with ${counselorEmail}.

View your report: ${reportUrl}

"Before I ask for your hand… let's talk."`;

  const { error: notifyError } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Beforehand <onboarding@resend.dev>",
    to,
    subject: "Your Beforehand report was shared",
    html,
    text,
  });

  if (notifyError) {
    throw new Error(`Resend error: ${notifyError.message}`);
  }
}

const CHOICE_LABEL: Record<string, string> = {
  fully_on_board: "Fully on board",
  open_to_discussing: "Open to discussing",
  dealbreaker: "This is a dealbreaker",
};

export async function sendCounselorShareEmail({
  to,
  nameA,
  nameB,
  payload,
  sharedAt,
}: {
  to: string;
  nameA: string;
  nameB: string;
  payload: ReportPayload;
  sharedAt: Date;
}): Promise<void> {
  const safeNameA = escapeHtml(nameA);
  const safeNameB = escapeHtml(nameB);
  const sharedDate = sharedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function choiceStr(choice: string) {
    return CHOICE_LABEL[choice] ?? choice;
  }

  function answerRow(name: string, choice: string, compromise: string | null) {
    const safeC = compromise ? escapeHtml(compromise) : null;
    return `<tr><td style="padding:6px 0;vertical-align:top;width:120px;font-size:14px;color:#303a4e;"><strong>${name}</strong></td><td style="padding:6px 0 6px 12px;vertical-align:top;font-size:14px;color:#1c2331;">${choiceStr(choice)}${safeC ? `<br><span style="color:#303a4e;font-style:italic;">&ldquo;${safeC}&rdquo;</span>` : ""}</td></tr>`;
  }

  // Spotlights
  const spA = payload.spotlights?.partner_a ?? [];
  const spB = payload.spotlights?.partner_b ?? [];
  let spotlightsHtml = "";
  let spotlightsText = "";
  if (spA.length > 0 || spB.length > 0) {
    spotlightsHtml = `<h2 style="font-size:20px;font-weight:normal;margin:40px 0 8px;">Questions they flagged as important</h2>`;
    if (spA.length > 0) {
      spotlightsHtml += `<p style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#d8a24a;margin:16px 0 8px;">${safeNameA}</p><ul style="margin:0;padding:0 0 0 20px;">` + spA.map((s) => `<li style="font-size:14px;color:#1c2331;margin-bottom:4px;">${escapeHtml(s.question_text)}</li>`).join("") + `</ul>`;
      spotlightsText += `\n${nameA} flagged:\n` + spA.map((s) => `  - ${s.question_text}`).join("\n");
    }
    if (spB.length > 0) {
      spotlightsHtml += `<p style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#d8a24a;margin:16px 0 8px;">${safeNameB}</p><ul style="margin:0;padding:0 0 0 20px;">` + spB.map((s) => `<li style="font-size:14px;color:#1c2331;margin-bottom:4px;">${escapeHtml(s.question_text)}</li>`).join("") + `</ul>`;
      spotlightsText += `\n${nameB} flagged:\n` + spB.map((s) => `  - ${s.question_text}`).join("\n");
    }
  }

  // Dealbreaker flags (bank + custom)
  const allFlags = [...payload.dealbreaker_flags, ...payload.custom_questions.dealbreaker_flags];
  let flagsHtml = "";
  let flagsText = "";
  if (allFlags.length > 0) {
    flagsHtml = `<h2 style="font-size:20px;font-weight:normal;margin:40px 0 8px;">Dealbreaker Flags</h2><p style="font-size:14px;color:#303a4e;margin:0 0 16px;">One holds a firm position; the other is fully on board with the opposite.</p>`;
    for (const f of allFlags) {
      flagsHtml += `<div style="border:1px solid #e0d9cc;border-radius:10px;padding:16px;margin-bottom:12px;"><p style="font-size:14px;font-weight:600;color:#1c2331;margin:0 0 10px;">${escapeHtml(f.question_text)}</p><table style="border-collapse:collapse;width:100%;">${answerRow(safeNameA, f.partner_a.choice, f.partner_a.compromise_text)}${answerRow(safeNameB, f.partner_b.choice, f.partner_b.compromise_text)}</table></div>`;
      flagsText += `\n${f.question_text}\n  ${nameA}: ${choiceStr(f.partner_a.choice)}\n  ${nameB}: ${choiceStr(f.partner_b.choice)}\n`;
    }
  }

  // Tensions (bank + custom)
  const allTensions = [...payload.tensions, ...payload.custom_questions.tensions];
  let tensionsHtml = "";
  let tensionsText = "";
  if (allTensions.length > 0) {
    tensionsHtml = `<h2 style="font-size:20px;font-weight:normal;margin:40px 0 8px;">Tension Areas</h2><p style="font-size:14px;color:#303a4e;margin:0 0 16px;">Answers differ, with starting points for conversation.</p>`;
    for (const t of allTensions) {
      tensionsHtml += `<div style="border:1px solid #e0d9cc;border-radius:10px;padding:16px;margin-bottom:12px;"><p style="font-size:14px;font-weight:600;color:#1c2331;margin:0 0 10px;">${escapeHtml(t.question_text)}</p><table style="border-collapse:collapse;width:100%;">${answerRow(safeNameA, t.partner_a.choice, t.partner_a.compromise_text)}${answerRow(safeNameB, t.partner_b.choice, t.partner_b.compromise_text)}</table></div>`;
      tensionsText += `\n${t.question_text}\n  ${nameA}: ${choiceStr(t.partner_a.choice)}${t.partner_a.compromise_text ? ` — "${t.partner_a.compromise_text}"` : ""}\n  ${nameB}: ${choiceStr(t.partner_b.choice)}${t.partner_b.compromise_text ? ` — "${t.partner_b.compromise_text}"` : ""}\n`;
    }
  }

  // Shared non-negotiables (bank + custom)
  const allShared = [...payload.alignment.shared_dealbreakers, ...payload.custom_questions.shared_dealbreakers];
  let sharedHtml = "";
  let sharedText = "";
  if (allShared.length > 0) {
    sharedHtml = `<h2 style="font-size:20px;font-weight:normal;margin:40px 0 8px;">Shared Non-Negotiables</h2><p style="font-size:14px;color:#303a4e;margin:0 0 12px;">Both hold firm positions on the same side.</p><ul style="margin:0;padding:0 0 0 20px;">` + allShared.map((s) => `<li style="font-size:14px;color:#1c2331;margin-bottom:6px;">${escapeHtml(s.question_text)}</li>`).join("") + `</ul>`;
    sharedText = `\nShared Non-Negotiables:\n` + allShared.map((s) => `  - ${s.question_text}`).join("\n") + "\n";
  }

  // Category alignment
  const cats = payload.alignment.by_category.filter((c) => c.aligned_count > 0);
  let alignHtml = "";
  let alignText = "";
  if (cats.length > 0) {
    alignHtml = `<h2 style="font-size:20px;font-weight:normal;margin:40px 0 8px;">Category Alignment</h2><table style="border-collapse:collapse;width:100%;margin-top:8px;">` + cats.map((c) => `<tr><td style="font-size:14px;color:#1c2331;padding:4px 0;text-transform:capitalize;">${escapeHtml(c.category.replace(/_/g, " "))}</td><td style="font-size:14px;color:#303a4e;padding:4px 0 4px 16px;text-align:right;">${c.aligned_count}/${c.total} aligned</td></tr>`).join("") + `</table>`;
    alignText = `\nCategory Alignment:\n` + cats.map((c) => `  ${c.category.replace(/_/g, " ")}: ${c.aligned_count}/${c.total} aligned`).join("\n") + "\n";
  }

  const stageDisplay = escapeHtml(payload.session.stage.replace(/_/g, " "));
  const contextHtml = payload.session.cultural_context !== "universal" ? ` &middot; ${escapeHtml(payload.session.cultural_context)}` : "";
  const contextText = payload.session.cultural_context !== "universal" ? ` · ${payload.session.cultural_context}` : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4ef;">
  <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:48px 24px;color:#1c2331;">
    <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.2em;color:#d8a24a;margin:0 0 16px;">Beforehand &mdash; Compatibility Report</p>
    <h1 style="font-size:28px;font-weight:normal;margin:0 0 12px;line-height:1.3;">${safeNameA} &amp; ${safeNameB}</h1>
    <p style="font-size:14px;color:#303a4e;margin:0 0 4px;">${stageDisplay}${contextHtml}</p>
    <p style="font-size:13px;color:#303a4e;margin:0 0 28px;">Shared with your consent on ${escapeHtml(sharedDate)}.</p>
    <p style="font-size:15px;line-height:1.7;color:#303a4e;margin:0 0 8px;">Beforehand is a relationship compatibility platform. Each partner answers questions privately across topics like money, family, faith, and intimacy. When both submit, their answers unlock simultaneously and this report is generated &mdash; showing where they align, where there is tension, and what each holds as non-negotiable.</p>
    <p style="font-size:15px;line-height:1.7;color:#303a4e;margin:0 0 28px;">Both ${safeNameA} and ${safeNameB} consented to sharing this report with you.</p>
    <hr style="border:none;border-top:1px solid #e0d9cc;margin:0 0 8px;">
    ${spotlightsHtml}
    ${flagsHtml}
    ${tensionsHtml}
    ${sharedHtml}
    ${alignHtml}
    <hr style="border:none;border-top:1px solid #e0d9cc;margin:40px 0 16px;">
    <p style="font-size:13px;color:#303a4e;line-height:1.6;">Shared via Beforehand with the consent of both partners.<br>&ldquo;Before I ask for your hand&hellip; let&rsquo;s talk.&rdquo;</p>
  </div>
</body>
</html>`.trim();

  const text = `Beforehand — Compatibility Report
${nameA} & ${nameB}
${payload.session.stage.replace(/_/g, " ")}${contextText}
Shared on ${sharedDate}.

Beforehand is a relationship compatibility platform. Each partner answers questions privately across topics like money, family, faith, and intimacy. When both submit, this report is generated — showing where they align, where there is tension, and what each holds as non-negotiable.

Both ${nameA} and ${nameB} consented to sharing this report with you.

---
${spotlightsText}
DEALBREAKER FLAGS
${flagsText || "None.\n"}
TENSION AREAS
${tensionsText || "None.\n"}
${sharedText}${alignText}
---
Shared via Beforehand with the consent of both partners.
"Before I ask for your hand… let's talk."`;

  const { error: counselorError } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Beforehand <onboarding@resend.dev>",
    to,
    subject: `Compatibility Report — ${nameA} & ${nameB} (via Beforehand)`,
    html,
    text,
  });

  if (counselorError) {
    throw new Error(`Resend error: ${counselorError.message}`);
  }
}
