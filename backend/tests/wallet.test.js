/**
 * wallet.test.js
 *
 * Tests for organization credit wallet, pre-flight balance checks,
 * atomic debits/credits, and transaction ledger.
 */

import { describe, expect, test, jest } from "@jest/globals";
import {
  assertSufficientCredits,
  creditWallet,
  debitWallet,
} from "../src/services/wallet.service.js";
import { CREDIT_COSTS, WELCOME_CREDIT_BONUS } from "../src/config/credits.config.js";

describe("Credit Policy & Cost Configuration", () => {
  test("defines correct credit costs for platform actions", () => {
    expect(CREDIT_COSTS.REPORT_PDF).toBe(5);
    expect(CREDIT_COSTS.REPORT_XLSX).toBe(2);
    expect(CREDIT_COSTS.REPORT_CSV).toBe(1);
    expect(CREDIT_COSTS.ASSISTANT_QUERY).toBe(3);
    expect(WELCOME_CREDIT_BONUS).toBe(50.0);
  });
});

describe("Wallet Service - Pre-flight Credit Check", () => {
  test("passes when organization has sufficient credits", async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: "wallet-1", organizationId: "org-1", balance: 50.0, currency: "INR" }],
      }),
    };

    await expect(assertSufficientCredits(mockClient, "org-1", 5)).resolves.toBe(true);
    await expect(assertSufficientCredits(mockClient, "org-1", 50)).resolves.toBe(true);
  });

  test("throws 402 INSUFFICIENT_CREDITS when balance is lower than required", async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: "wallet-1", organizationId: "org-1", balance: 2.0, currency: "INR" }],
      }),
    };

    await expect(assertSufficientCredits(mockClient, "org-1", 5)).rejects.toMatchObject({
      status: 402,
      code: "INSUFFICIENT_CREDITS",
    });
  });

  test("returns true for zero or invalid credit requirements", async () => {
    const mockClient = { query: jest.fn() };
    await expect(assertSufficientCredits(mockClient, "org-1", 0)).resolves.toBe(true);
    await expect(assertSufficientCredits(mockClient, "org-1", -5)).resolves.toBe(true);
  });
});

describe("Wallet Service - Atomic Debit & Credit Operations", () => {
  test("debitWallet deducts balance and records ledger transaction with employee tracking", async () => {
    const mockClient = {
      query: jest
        .fn()
        // 1. getOrCreateWallet lookup
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "wallet-1", organizationId: "org-1", balance: 50.0 }],
        })
        // 2. atomic UPDATE ... WHERE balance >= amount
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ balance: 45.0 }],
        })
        // 3. INSERT into wallet_transactions
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    const result = await debitWallet("user-123", "org-1", {
      amount: 5,
      referenceType: "report_export",
      description: "Exported PDF report",
      client: mockClient,
    });

    expect(result.success).toBe(true);
    expect(result.amount).toBe(5);
    expect(result.balanceAfter).toBe(45.0);

    // Verify ledger insert recorded employee user-123
    const insertCall = mockClient.query.mock.calls[2];
    expect(insertCall[0]).toContain("INSERT INTO wallet_transactions");
    expect(insertCall[1]).toContain("user-123");
    expect(insertCall[1]).toContain(45.0);
  });

  test("debitWallet throws 402 if atomic update fails due to race condition", async () => {
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "wallet-1", organizationId: "org-1", balance: 3.0 }],
        })
        // UPDATE matched 0 rows because concurrent request reduced balance
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }),
    };

    await expect(
      debitWallet("user-123", "org-1", {
        amount: 5,
        client: mockClient,
      }),
    ).rejects.toMatchObject({
      status: 402,
      code: "INSUFFICIENT_CREDITS",
    });
  });

  test("creditWallet increases balance and supports idempotency keys", async () => {
    const mockClient = {
      query: jest
        .fn()
        // 1. check idempotency
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        // 2. getOrCreateWallet
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: "wallet-1", organizationId: "org-1", balance: 45.0 }],
        })
        // 3. UPDATE balance
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ balance: 95.0 }],
        })
        // 4. INSERT ledger
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    const result = await creditWallet("user-123", "org-1", {
      amount: 50,
      idempotencyKey: "tx-key-abc",
      referenceType: "manual",
      description: "Support credit adjustment",
      client: mockClient,
    });

    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.balanceAfter).toBe(95.0);
  });

  test("creditWallet returns existing transaction if idempotency key was already processed", async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "tx-existing", amount: 100, balanceAfter: 150.0, createdAt: new Date() }],
      }),
    };

    const result = await creditWallet("user-123", "org-1", {
      amount: 100,
      idempotencyKey: "tx-already-done",
      client: mockClient,
    });

    expect(result.idempotent).toBe(true);
    expect(result.transactionId).toBe("tx-existing");
    expect(result.amount).toBe(100);
    expect(result.balanceAfter).toBe(150.0);
  });
});
