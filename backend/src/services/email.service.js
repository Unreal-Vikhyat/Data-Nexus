import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/**
 * Sends a transactional email using Brevo's REST API (v3)
 */
export async function sendBrevoEmail({ to, subject, htmlContent, textContent }) {
  const senderEmail = env.BREVO_SENDER_EMAIL || (env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] || env.EMAIL_FROM);
  const senderName = env.BREVO_SENDER_NAME || (env.EMAIL_FROM.match(/^([^<]+)/)?.[1]?.trim() || "Data-Nexus");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent: textContent || subject,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`Brevo API error (${response.status}): ${errorBody}`);
    error.status = response.status;
    error.code = "BREVO_API_ERROR";
    throw error;
  }

  const data = await response.json();
  return { delivered: true, messageId: data.messageId };
}

/**
 * Sends a workspace invite email with a styled 'Join Workspace' button
 */
export async function sendWorkspaceInviteEmail({ to, workspaceName, inviteUrl }) {
  if (!env.BREVO_API_KEY && !env.SMTP_URL) {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      return { delivered: false, developmentUrl: inviteUrl };
    }
    const error = new Error("Email delivery is not configured");
    error.status = 503;
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const subject = `You've been invited to join ${workspaceName} on Data Nexus`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #334155; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .badge { display: inline-block; background-color: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
    .desc { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
    .btn-wrapper { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
    .footer { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 20px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Workspace Invite</span>
    <h1 class="title">Join ${workspaceName}</h1>
    <p class="desc">
      You've been invited to collaborate on <strong>${workspaceName}</strong> in Data Nexus.
      Click the button below to join the workspace.
    </p>
    <div class="btn-wrapper">
      <a href="${inviteUrl}" class="btn" target="_blank">Join Workspace</a>
    </div>
    <p class="desc" style="font-size: 13px; text-align: center; color: #64748b;">
      If you don't have an account yet, you'll be prompted to register. If you already have an account, simply log in to accept.
    </p>
    <div class="footer">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${inviteUrl}" style="color: #4f46e5;">${inviteUrl}</a>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `You have been invited to join ${workspaceName} on Data Nexus.\n\nClick the link below to accept the invitation, register, or log in:\n${inviteUrl}`;

  if (env.BREVO_API_KEY) {
    const result = await sendBrevoEmail({ to, subject, htmlContent, textContent });
    return { delivered: result.delivered, messageId: result.messageId };
  }

  const transport = nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: textContent,
    html: htmlContent,
  });
  return { delivered: true };
}

/**
 * Backward compatibility for password resets & generic account links
 */
export async function sendAccountLink({ to, subject, url, action }) {
  if (!env.BREVO_API_KEY && !env.SMTP_URL) {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return { delivered: false, developmentUrl: url };
    const error = new Error("Email delivery is not configured");
    error.status = 503;
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const textContent = `Use this link to ${action}: ${url}`;
  const htmlContent = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Data Nexus</h2>
      <p>Use the link below to ${action}:</p>
      <p><a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px;">Continue</a></p>
      <p style="font-size: 12px; color: #666;">Or copy: ${url}</p>
    </div>
  `;

  if (env.BREVO_API_KEY) {
    return sendBrevoEmail({ to, subject, htmlContent, textContent });
  }

  const transport = nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: textContent,
    html: htmlContent,
  });
  return { delivered: true };
}
