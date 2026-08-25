import { describe, expect, it } from "vitest";
import { parseRolePermissions } from "./index";

describe("parseRolePermissions", () => {
  it("normalizes array and legacy JSON-string values deterministically", () => {
    expect(parseRolePermissions(["b.read", "a.read", "b.read", 7])).toEqual([
      "a.read",
      "b.read",
    ]);
    expect(parseRolePermissions('["b.read","a.read"]')).toEqual([
      "a.read",
      "b.read",
    ]);
  });

  it("fails closed for malformed or non-list values", () => {
    expect(parseRolePermissions("not-json")).toEqual([]);
    expect(parseRolePermissions({ permission: "*" })).toEqual([]);
    expect(parseRolePermissions(null)).toEqual([]);
  });
});
