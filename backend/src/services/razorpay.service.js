/**
 * razorpay.service.js
 *
 * Razorpay payment gateway integration service:
 * - Order creation
 * - Timing-safe HMAC SHA-256 signature verification
 */

import Razorpay from "razorpay";
import crypto from "node:crypto";
import { env } from "../config/env.js";

// Initialize Razorpay SDK client with our credentials
export const razorpayClient = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a server-side order with Razorpay.
 * Locks the amount in paise (e.g. ₹299 = 29900 paise).
 */
export async function createRazorpayOrder({
  amountInPaise,
  currency = "INR",
  receipt,
  notes = {},
}) {
  const parsedAmount = Math.round(Number(amountInPaise));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid amount in paise for Razorpay order");
  }

  const options = {
    amount: parsedAmount,
    currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
  };

  return razorpayClient.orders.create(options);
}

/**
 * Verify Razorpay payment signature cryptographically.
 * Signature formula: HMAC_SHA256(order_id + "|" + payment_id, secret)
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}