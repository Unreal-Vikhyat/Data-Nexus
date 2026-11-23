/**
 * razorpay.test.js
 *
 * Unit tests for Razorpay payment service and cryptographic signature verification.
 */

import { describe, expect, test } from "@jest/globals";
import crypto from "node:crypto";
import { env } from "../src/config/env.js";
import { verifyPaymentSignature } from "../src/services/razorpay.service.js";
import { createOrderSchema, verifyPaymentSchema } from "../src/schemas/billing.schemas.js";
import { CREDIT_PACKS } from "../src/config/credits.config.js";

describe("Razorpay Signature Verification", () => {
  const orderId = "order_EKwxwAgItmmXdp";
  const paymentId = "pay_G32X3f832vdfb";

  test("accepts a cryptographically valid HMAC-SHA256 signature", () => {
    // Generate authentic signature using local secret
    const authenticSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: authenticSignature,
    });

    expect(isValid).toBe(true);
  });

  test("rejects an invalid or tampered signature", () => {
    const fakeSignature = "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: fakeSignature,
    });

    expect(isValid).toBe(false);
  });

  test("rejects when orderId or paymentId is altered", () => {
    const authenticSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = verifyPaymentSignature({
      orderId: "order_different_order",
      paymentId,
      signature: authenticSignature,
    });

    expect(isValid).toBe(false);
  });

  test("returns false when any required argument is missing", () => {
    expect(verifyPaymentSignature({ orderId: null, paymentId, signature: "abc" })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId: null, signature: "abc" })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: null })).toBe(false);
  });
});

describe("Razorpay Request Schemas", () => {
  test("validates createOrderSchema against allowed packs", () => {
    expect(createOrderSchema.safeParse({ packId: "pack_starter" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ packId: "pack_growth" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ packId: "pack_scale" }).success).toBe(true);
    expect(createOrderSchema.safeParse({ packId: "pack_unlimited" }).success).toBe(false);
  });

  test("validates verifyPaymentSchema requires all cryptographic components", () => {
    const validPayload = {
      orderId: "order_123",
      paymentId: "pay_456",
      signature: "sig_789",
      packId: "pack_growth",
    };

    expect(verifyPaymentSchema.safeParse(validPayload).success).toBe(true);

    const invalidPayload = { ...validPayload, signature: "" };
    expect(verifyPaymentSchema.safeParse(invalidPayload).success).toBe(false);
  });

  test("ensures all credit packs have valid prices in paise and INR currency", () => {
    expect(CREDIT_PACKS.length).toBeGreaterThan(0);
    for (const pack of CREDIT_PACKS) {
      expect(pack.priceInPaise).toBeGreaterThan(0);
      expect(pack.currency).toBe("INR");
      expect(pack.credits).toBeGreaterThan(0);
    }
  });
});