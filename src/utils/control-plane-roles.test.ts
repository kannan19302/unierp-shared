import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasPermission } from "./index";

/**
 * The control-plane role definitions, mirrored from
 * packages/database/prisma/seed-platform.ts.
 *
 * They are restated here rather than imported because that module pulls in
 * PrismaClient, and @kannan19302/shared must not depend on the database package —
 * the architecture gate forbids the edge. The `roles match the provisioner`
 * test below is what keeps the two in step: it fails if the provisioner's
 * grants change without this list changing too.
 */
const PLATFORM_OWNER = ["system.*", "platform.*", "pcc.*"];
const PLATFORM_SUPPORT = [
  "system.tenant.read",
  "system.tenant.lifecycle.read",
  "system.health.read",
  "system.analytics.read",
  "platform.audit.read",
  "system.support.read",
  "system.audit.read",
  "system.invoice.read",
  "system.subscription.read",
  "system.dunning.read",
  "system.metering.read",
  "system.quota.read",
  "system.plan.read",
  "system.flags.read",
  "system.upgrade.read",
  "system.migration.read",
  "system.offboarding.read",
  "system.import.read",
  "system.broadcast.read",
  "system.release.read",
  "system.clusters.read",
  "system.domain.read",
  "system.whitelabel.read",
  "system.residency.read",
  "system.isolation.read",
  "system.sla.read",
  "system.backup.read",
  "system.security.read",
  "system.soc.read",
  "system.operations.read",
];

/** A customer's most privileged role. */
const TENANT_SUPER_ADMIN = ["*"];

describe("control-plane role provisioning", () => {
  describe("Platform Owner", () => {
    it("can reach the control plane", () => {
      // Before the provisioner existed nothing granted these, so the control
      // plane was correct but unusable — fail-closed with no key cut.
      expect(hasPermission(PLATFORM_OWNER, "system.tenant.delete")).toBe(true);
      expect(hasPermission(PLATFORM_OWNER, "system.tenant.suspend")).toBe(true);
      expect(hasPermission(PLATFORM_OWNER, "platform.config.write")).toBe(true);
      expect(hasPermission(PLATFORM_OWNER, "pcc.security.access")).toBe(true);
    });

    it("carries no tenant-business authority", () => {
      // Being platform staff must not silently confer the ability to read a
      // customer's ledger. That is a separate, auditable grant.
      expect(hasPermission(PLATFORM_OWNER, "finance.invoice.read")).toBe(false);
      expect(hasPermission(PLATFORM_OWNER, "hr.employee.read")).toBe(false);
    });
  });

  describe("Platform Support", () => {
    it("can read control-plane state for triage", () => {
      expect(hasPermission(PLATFORM_SUPPORT, "system.tenant.read")).toBe(true);
      expect(hasPermission(PLATFORM_SUPPORT, "platform.audit.read")).toBe(true);
    });

    it("cannot suspend, delete or offboard a tenant", () => {
      // The support role is the reason the grants are enumerated rather than
      // wildcarded: `system.*` would make triage access destructive.
      expect(hasPermission(PLATFORM_SUPPORT, "system.tenant.delete")).toBe(
        false,
      );
      expect(hasPermission(PLATFORM_SUPPORT, "system.tenant.suspend")).toBe(
        false,
      );
      expect(hasPermission(PLATFORM_SUPPORT, "platform.config.write")).toBe(
        false,
      );
    });
  });

  it("matches the grants the provisioner actually writes", () => {
    // Read as text rather than imported: seed-platform.ts pulls in
    // PrismaClient, and @kannan19302/shared must not depend on @kannan19302/database.
    // This is what stops the mirrored constants above from drifting into a
    // test that passes while the real roles say something else.
    const provisioner = join(
      dirname(fileURLToPath(import.meta.url)),
      // ../../data, not ../../database: the package directory was renamed from
      // `database` to `data` and this path was not updated, so existsSync went
      // false and the guard below failed on every run. The whole point of this
      // test is to catch the mirrored constants drifting from the provisioner,
      // and it could not read the provisioner at all.
      "../../../data/prisma/seed-platform.ts",
    );
    expect(
      existsSync(provisioner),
      `control-plane provisioner not found at ${provisioner} — if it moved, update this test`,
    ).toBe(true);

    const src = readFileSync(provisioner, "utf8");
    const grantsFor = (roleKey: string): string[] => {
      const block = new RegExp(
        `${roleKey}:\\s*\\{[\\s\\S]*?permissions:\\s*\\[([^\\]]*)\\]`,
      ).exec(src);
      const body = block?.[1];
      if (body === undefined) {
        throw new Error(
          `no permissions block for ${roleKey} in ${provisioner}`,
        );
      }
      return [...body.matchAll(/["'`]([^"'`]+)["'`]/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      );
    };

    expect(grantsFor("PLATFORM_OWNER")).toEqual(PLATFORM_OWNER);
    expect(grantsFor("PLATFORM_SUPPORT")).toEqual(PLATFORM_SUPPORT);
  });

  describe("tenant roles stay out of the control plane", () => {
    it("denies a customer Super Admin, whose grant is the global wildcard", () => {
      // This is the confirmed escalation from PLATFORM_ARCHITECTURE § 1.2:
      // every customer administrator could suspend, export or offboard any
      // other tenant. `*` is broad within a tenant and means nothing outside.
      expect(hasPermission(TENANT_SUPER_ADMIN, "system.tenant.delete")).toBe(
        false,
      );
      expect(hasPermission(TENANT_SUPER_ADMIN, "platform.config.write")).toBe(
        false,
      );
      expect(hasPermission(TENANT_SUPER_ADMIN, "pcc.security.access")).toBe(false);
    });

    it("still grants a customer Super Admin everything inside the tenant", () => {
      expect(hasPermission(TENANT_SUPER_ADMIN, "finance.invoice.void")).toBe(
        true,
      );
      expect(hasPermission(TENANT_SUPER_ADMIN, "admin.user.create")).toBe(true);
    });

    it("denies a module wildcard that merely looks control-plane-adjacent", () => {
      expect(hasPermission(["systems.*"], "system.tenant.delete")).toBe(false);
      expect(hasPermission(["admin.*"], "platform.config.write")).toBe(false);
    });
  });
});
