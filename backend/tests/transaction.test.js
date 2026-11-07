import { describe, expect, test } from "@jest/globals";
import { withTenantTransaction } from "../src/database/transaction.js";

function fakePool(membershipExists = true) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql: sql.trim(), params });
      if (sql.includes("SELECT role FROM organization_members")) {
        return membershipExists
          ? { rowCount: 1, rows: [{ role: "owner" }] }
          : { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() { calls.push({ sql: "RELEASE", params: [] }); },
  };
  return { calls, connect: async () => client };
}

describe("tenant transaction context", () => {
  test("sets identity first, proves membership, then sets transaction-local tenant context", async () => {
    const pool = fakePool();
    const result = await withTenantTransaction("user-1", "org-1", async (client) => {
      await client.query("SELECT protected data");
      return "done";
    }, pool);

    expect(result).toBe("done");
    const userContext = pool.calls.findIndex(({ sql }) => sql.includes("app.current_user_id"));
    const membership = pool.calls.findIndex(({ sql }) => sql.includes("SELECT role FROM organization_members"));
    const orgContext = pool.calls.findIndex(({ sql }) => sql.includes("app.current_organization_id"));
    expect(userContext).toBeLessThan(membership);
    expect(membership).toBeLessThan(orgContext);
    expect(pool.calls[orgContext].params).toEqual(["org-1"]);
    expect(pool.calls.at(-2).sql).toBe("COMMIT");
    expect(pool.calls.at(-1).sql).toBe("RELEASE");
    expect(pool.calls[userContext].sql).toContain("set_config('app.current_user_id', $1, true)");
    expect(pool.calls[orgContext].sql).toContain("set_config('app.current_organization_id', $1, true)");
  });

  test("rejects a non-member before setting tenant context and rolls back", async () => {
    const pool = fakePool(false);
    await expect(withTenantTransaction("user-1", "org-other", async () => "unreachable", pool))
      .rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
    expect(pool.calls.some(({ sql }) => sql.includes("app.current_organization_id"))).toBe(false);
    expect(pool.calls.some(({ sql }) => sql === "ROLLBACK")).toBe(true);
    expect(pool.calls.at(-1).sql).toBe("RELEASE");
  });

  test("rolls back errors so pooled connections cannot retain tenant context", async () => {
    const pool = fakePool();
    await expect(withTenantTransaction("user-1", "org-1", async () => {
      throw new Error("operation failed");
    }, pool)).rejects.toThrow("operation failed");
    expect(pool.calls.some(({ sql }) => sql === "ROLLBACK")).toBe(true);
    expect(pool.calls.at(-1).sql).toBe("RELEASE");
  });
});
