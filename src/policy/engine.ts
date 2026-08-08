/**
 * PolicyEngine — control-plane permission authority.
 *
 * All access-control decisions that cross the tenant/provider boundary are
 * made here. The engine is a single, stable target for unit testing: a
 * regression in `hasPermission` or the namespace check can be caught before
 * it reaches a guard at runtime.
 *
 * § C02 of the Track-C implementation plan defines the control-plane staff
 * roles whose permissions are assigned exclusively from the `system.*` and
 * `platform.*` namespaces. Those namespaces are the authoritative list in
 * `CONTROL_PLANE_NAMESPACES`; nothing in a `tenant.*` or `admin.*` or `saas.*`
 * namespace is ever granted to a provider-staff role.
 */

import { CONTROL_PLANE_NAMESPACES, hasPermission } from "../utils/index.js";

// ─── Staff role definitions ────────────────────────────────────────────────

/**
 * The provider staff role identifiers.
 * These are internal-only — they are never seeded into a customer tenant.
 */
export const CONTROL_PLANE_ROLE = {
  /** Platform administrator — full control-plane authority. */
  PLATFORM_ADMIN: "platform.admin",
  /** SRE / infrastructure — operations and health visibility. */
  SRE: "platform.sre",
  /** Tier-1 support — read-only tenant context. */
  SUPPORT_L1: "platform.support.l1",
  /** Tier-2 support — read + limited impersonation when tenant-consented. */
  SUPPORT_L2: "platform.support.l2",
  /** Billing operations — commercial read/write, no lifecycle mutations. */
  BILLING: "platform.billing",
  /** Security operations — audit log, session revocation, key rotation. */
  SECURITY: "platform.security",
} as const;

export type ControlPlaneRole =
  (typeof CONTROL_PLANE_ROLE)[keyof typeof CONTROL_PLANE_ROLE];

/**
 * The minimum permission set for each provider staff role.
 *
 * These are lower bounds: the platform admin console enforces the role→permission
 * mapping at token-issuance time. The runtime guards check individual tokens.
 *
 * Invariants:
 *  - No entry in any role's permission set touches a tenant-scoped namespace.
 *  - Wildcard `*` is never granted here — ever.
 *  - The `BILLING` role may NOT suspend, purge, or migrate tenants.
 *  - The `SUPPORT_L1` role is read-only.
 */
export const CONTROL_PLANE_ROLE_PERMISSIONS: Record<
  ControlPlaneRole,
  string[]
> = {
  [CONTROL_PLANE_ROLE.PLATFORM_ADMIN]: [
    "system.tenant.read",
    "system.tenant.create",
    "system.tenant.update",
    "system.tenant.suspend",
    "system.tenant.unsuspend",
    "system.tenant.offboard",
    "system.tenant.purge",
    "system.tenant.export",
    "system.tenant.lifecycle.read",
    "system.superadmin.access",
    "system.analytics.read",
    "system.health.read",
    "system.operations.read",
    "system.operations.backup",
  ],
  [CONTROL_PLANE_ROLE.SRE]: [
    "system.health.read",
    "system.analytics.read",
    "system.operations.read",
    "system.operations.backup",
    "system.tenant.lifecycle.read",
    "system.tenant.read",
  ],
  [CONTROL_PLANE_ROLE.SUPPORT_L1]: [
    "system.tenant.read",
    "system.tenant.lifecycle.read",
    "system.health.read",
  ],
  [CONTROL_PLANE_ROLE.SUPPORT_L2]: [
    "system.tenant.read",
    "system.tenant.lifecycle.read",
    "system.health.read",
    "system.analytics.read",
  ],
  [CONTROL_PLANE_ROLE.BILLING]: [
    "system.tenant.read",
    "system.analytics.read",
  ],
  [CONTROL_PLANE_ROLE.SECURITY]: [
    "system.tenant.read",
    "system.health.read",
    "system.analytics.read",
    "system.superadmin.access",
  ],
};

// ─── PolicyEngine ──────────────────────────────────────────────────────────

/**
 * Static policy-evaluation helpers for the control plane.
 *
 * The class form makes it easy to import just the engine in tests without
 * pulling in the entire guard infrastructure, and to stub it in unit tests
 * for controller layers.
 */
export class PolicyEngine {
  /**
   * Returns `true` when `permission` lives in a control-plane namespace
   * (`system.*` or `platform.*`).
   *
   * A tenant-scoped wildcard such as `*` or `finance.*` must never satisfy
   * a control-plane permission. This method is the source of truth for that
   * determination; all guards call it rather than re-implementing the check.
   */
  static isControlPlane(permission: string): boolean {
    return CONTROL_PLANE_NAMESPACES.some(
      (ns) =>
        permission === ns ||
        permission.startsWith(`${ns}.`),
    );
  }

  /**
   * Returns `true` when the given `userPermissions` array satisfies the
   * `required` permission, applying the namespace-boundary rule: a
   * tenant-scoped wildcard (`*`, `admin.*`, etc.) never satisfies a
   * control-plane permission.
   *
   * Delegates to `hasPermission` in `@kannan19302/shared`, which encodes
   * the boundary rule. This method exists so tests can call one well-named
   * entry point rather than the lower-level utility.
   */
  static check(userPermissions: string[], required: string): boolean {
    return hasPermission(userPermissions, required);
  }

  /**
   * Returns the permissions assigned to a given provider staff role.
   * Returns an empty array for unknown roles (fail-closed).
   */
  static permissionsForRole(role: ControlPlaneRole): string[] {
    return CONTROL_PLANE_ROLE_PERMISSIONS[role] ?? [];
  }
}
