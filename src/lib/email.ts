import { Resend } from "resend";

const resend = new Resend(process.env.AUTH_RESEND_KEY);

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
      ${inviterName} has invited you to Beforehand.
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
      If you don't know ${inviterName}, you can safely ignore this email.
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
      Your report is ready, ${viewerName}.
    </h1>
    <p style="font-size:16px;line-height:1.7;color:#303a4e;margin:0 0 16px;">
      You and ${partnerName} have both submitted your answers. Your report is now
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
      A little nudge from ${senderName} 💛
    </h1>
    <p style="font-size:20px;line-height:1.6;color:#1c2331;margin:0 0 36px;font-style:italic;">
      &ldquo;${messageText}&rdquo;
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
