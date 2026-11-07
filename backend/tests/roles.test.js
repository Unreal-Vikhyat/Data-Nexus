import { describe, expect, test } from "@jest/globals";
import { roleMeetsMinimum } from "../src/utils/roles.js";

describe("workspace role hierarchy", () => {
  test("grants the minimum access only to the required role and above", () => {
    expect(roleMeetsMinimum("viewer", "viewer")).toBe(true);
    expect(roleMeetsMinimum("viewer", "editor")).toBe(false);
    expect(roleMeetsMinimum("editor", "editor")).toBe(true);
    expect(roleMeetsMinimum("admin", "editor")).toBe(true);
    expect(roleMeetsMinimum("owner", "admin")).toBe(true);
  });

  test("rejects unknown roles", () => {
    expect(roleMeetsMinimum("superuser", "viewer")).toBe(false);
    expect(roleMeetsMinimum("owner", "root")).toBe(false);
  });
});
