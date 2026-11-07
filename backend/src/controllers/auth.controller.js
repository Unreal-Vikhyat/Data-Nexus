import * as authService from "../services/auth.service.js";
import { env } from "../config/env.js";
import { sessionCookieOptions } from "../services/auth.service.js";

export async function register(req, res) {
  const data = await authService.register(req.body);
  res.status(201).json({ success: true, message: "Account created. Sign in to continue.", data });
}

export async function login(req, res) {
  const session = await authService.login(req.body);
  res.cookie(env.COOKIE_NAME, session.token, sessionCookieOptions());
  const { token: _token, expiresAt, ...data } = session;
  res.json({ success: true, message: "Signed in", data: { ...data, expiresAt } });
}

export async function logout(req, res) {
  if (req.auth) await authService.revokeSession(req.auth.userId, req.auth.sessionId);
  res.clearCookie(env.COOKIE_NAME, { ...sessionCookieOptions(0), expires: new Date(0) });
  res.json({ success: true, message: "Signed out", data: {} });
}

export async function currentUser(req, res) {
  const data = await authService.getCurrentUser(req.auth.userId);
  res.json({ success: true, message: "Current user", data });
}

export async function forgotPassword(req, res) {
  const data = await authService.requestPasswordReset(req.body.email);
  res.json({ success: true, message: "If the account exists, password reset instructions have been sent.", data });
}

export async function resetPassword(req, res) {
  const data = await authService.resetPassword(req.body);
  res.json({ success: true, message: "Password updated. Please sign in again.", data });
}
