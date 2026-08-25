import { describe, expect, it } from "vitest";
import { CONTROL_CENTER_APPS } from "@kannan19302/contracts";
import { PERMISSION_REGISTRY } from "./registry";

describe("control-center permission registry", () => {
  it("derives one canonical app-entry permission for every catalogued app", () => {
    const expected = CONTROL_CENTER_APPS.map(
      (app) => `${app.permissionNamespace}.access`,
    );
    const actual = PERMISSION_REGISTRY.filter(
      (permission) =>
        permission.action === "access" &&
        (permission.module === "pcc" || permission.module === "occ"),
    ).map((permission) => permission.code);

    expect(actual).toHaveLength(44);
    expect(new Set(actual).size).toBe(44);
    expect(actual).toEqual(expected);
  });
});
