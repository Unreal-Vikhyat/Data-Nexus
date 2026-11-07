import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendAccountLink({ to, subject, url, action }) {
  if (!env.SMTP_URL) {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return { delivered: false, developmentUrl: url };
    const error = new Error("Email delivery is not configured");
    error.status = 503;
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  const transport = nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: `Use this link to ${action}: ${url}`,
  });
  return { delivered: true };
}
