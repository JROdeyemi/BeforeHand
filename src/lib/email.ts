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
