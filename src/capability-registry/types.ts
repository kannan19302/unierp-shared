/**
 * M02 — the capability catalogue's type contract.
 *
 * A "capability" is something the platform can DO on a provider's behalf —
 * `email.send`, `object.store`, `dns.manage`, `llm.complete` — as distinct
 * from a specific provider's implementation of it. Track M's invariant is
 * that no capability may be satisfied by exactly one hard-coded provider;
 * this file is what a provider (M03) attaches itself to, and what the router
 * (M06) selects among.
 */

/** A field a provider must supply to be bound to this capability (M03). */
export interface CredentialField {
  name: string;
  description: string;
  secret: boolean;
}

/** A resource kind this capability, once invoked, can bring into being (M07). */
export type ResourceKind = string;

export interface CapabilityContract {
  /** Dot-namespaced, e.g. "email.send", "object.store", "llm.complete". */
  id: string;
  description: string;
  /** The team/module accountable for this capability's contract — never blank. */
  owner: string;
  /** Named input fields the operation accepts. Not yet a full JSON-Schema/zod
   *  shape — kept to names+descriptions until a real operation exists to
   *  validate against, per the "don't build ahead of a real caller" rule. */
  input: Array<{ name: string; description: string; required: boolean }>;
  output: Array<{ name: string; description: string }>;
  requiredCredentials: CredentialField[];
  /** Populated as adapters are built (M05) — declared now so the shape is stable. */
  resourceKinds?: ResourceKind[];
}

export type CapabilityStatus =
  | { state: "READY"; providerIds: string[] }
  | { state: "UNSATISFIED"; reason: string };
