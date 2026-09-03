/**
 * M02 — the capability registry itself.
 *
 * Every platform capability declares its contract here, once, via
 * `registerCapability`. `resolve()` is the mechanism the exit criterion
 * names: asking for a capability with no bound provider returns a typed
 * `UNSATISFIED` result rather than the caller finding out by a crash three
 * layers deep at request time. `bindProvider`/`unbindProvider` are the
 * minimal attachment points M03's real provider registry (credentials,
 * health, pricing, discovery) hangs off of — this file does not implement
 * provider selection or health; it only tracks which provider ids exist for
 * a capability, which is what "reported as unsatisfied" needs to be true
 * before M03 exists at all.
 */
import type { CapabilityContract, CapabilityStatus } from "./types.js";

const _capabilities = new Map<string, CapabilityContract>();
const _providers = new Map<string, Set<string>>();

/** Register (or replace) a capability's contract. */
export function registerCapability(contract: CapabilityContract): void {
  if (!contract.id) {
    throw new Error("registerCapability: contract.id must not be empty");
  }
  if (!contract.owner) {
    throw new Error(
      `registerCapability(${contract.id}): every capability must declare an owner`,
    );
  }
  _capabilities.set(contract.id, contract);
  if (!_providers.has(contract.id)) {
    _providers.set(contract.id, new Set());
  }
}

export function unregisterCapability(id: string): void {
  _capabilities.delete(id);
  _providers.delete(id);
}

export function getCapability(id: string): CapabilityContract | undefined {
  return _capabilities.get(id);
}

export function getAllCapabilities(): CapabilityContract[] {
  return [..._capabilities.values()];
}

/** Attach a provider id to a capability. The provider itself is M03's model. */
export function bindProvider(capabilityId: string, providerId: string): void {
  if (!_capabilities.has(capabilityId)) {
    throw new Error(
      `bindProvider: no capability registered with id "${capabilityId}"`,
    );
  }
  _providers.get(capabilityId)!.add(providerId);
}

export function unbindProvider(capabilityId: string, providerId: string): void {
  _providers.get(capabilityId)?.delete(providerId);
}

/**
 * The mechanism the exit criterion requires: a capability with no bound
 * provider resolves to a typed UNSATISFIED result. Nothing that calls
 * `resolve()` first can fail at call time from an absent provider — it can
 * only fail from what it does with an UNSATISFIED result, which is a defect
 * in that caller, not in this registry.
 */
export function resolve(capabilityId: string): CapabilityStatus {
  const contract = _capabilities.get(capabilityId);
  if (!contract) {
    return {
      state: "UNSATISFIED",
      reason: `No capability "${capabilityId}" is registered.`,
    };
  }
  const providerIds = [...(_providers.get(capabilityId) ?? [])];
  if (providerIds.length === 0) {
    return {
      state: "UNSATISFIED",
      reason: `Capability "${capabilityId}" has a contract but no bound provider.`,
    };
  }
  return { state: "READY", providerIds };
}

export function __resetCapabilityRegistryForTests(): void {
  _capabilities.clear();
  _providers.clear();
}
