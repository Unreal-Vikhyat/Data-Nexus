import { readFile } from "node:fs/promises";
import { describe, expect, test } from "@jest/globals";

describe("tenant security configuration", () => {
  test("forces RLS for all phase 1 and 2 organization-owned tables", async () => {
    const sql = await readFile(new URL("../src/database/migrations/001_identity_and_tenants.sql", import.meta.url), "utf8");
    for (const table of ["organizations", "organization_members", "auth_sessions", "invitations"]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"));
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`, "i"));
    }
    expect(sql).toContain("rolsuper OR rolbypassrls");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("ALTER TABLE users ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON FUNCTION app.lookup_user_for_auth(text) FROM PUBLIC");
    expect(sql).toContain("REVOKE ALL ON FUNCTION app.lookup_password_reset_token(text) FROM PUBLIC");
  });

  test("keeps the runtime role separate from table ownership by granting only DML", async () => {
    const sql = await readFile(new URL("../src/database/migrations/001_identity_and_tenants.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON users, organizations, organization_members,/);
    expect(sql).not.toMatch(/GRANT\s+ALL\s+ON\s+ALL\s+TABLES\s+TO\s+nexus_app/i);
  });
});
