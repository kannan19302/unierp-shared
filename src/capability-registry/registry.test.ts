/**
 * M02 exit criterion: "Every capability declares its contract in one place.
 * A capability with no registered provider is reported as unsatisfied rather
 * than failing at call time. A test enumerates all capabilities and asserts
 * each has a contract, an owner and at least one provider or an explicit
 * UNSATISFIED reason."
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerCapability,
  unregisterCapability,
  getAllCapabilities,
  bindProvider,
  unbindProvider,
  resolve,
  __resetCapabilityRegistryForTests,
} from "./registry";
import "./catalogue"; // registers the real four (email.send, object.store, dns.manage, llm.complete)

describe("M02 · capability registry", () => {
  it("the real catalogue is registered with a contract and an owner", () => {
    const all = getAllCapabilities();
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const cap of all) {
      expect(cap.id, "every capability needs an id").toBeTruthy();
      expect(cap.owner, `${cap.id} needs an owner`).toBeTruthy();
      expect(cap.description, `${cap.id} needs a description`).toBeTruthy();
    }
  });

  it("every registered capability resolves to READY (with a provider) or UNSATISFIED (with a stated reason) — never throws, never returns something untyped", () => {
    for (const cap of getAllCapabilities()) {
      const status = resolve(cap.id);
      if (status.state === "READY") {
        expect(status.providerIds.length).toBeGreaterThan(0);
      } else {
        expect(status.state).toBe("UNSATISFIED");
        expect(status.reason).toBeTruthy();
      }
    }
  });

  it("today, honestly: the four real capabilities have zero bound providers (M03 doesn't exist yet) — all UNSATISFIED", () => {
    for (const id of ["email.send", "object.store", "dns.manage", "llm.complete"]) {
      const status = resolve(id);
      expect(status.state, `${id} should be UNSATISFIED until M03 binds a provider`).toBe(
        "UNSATISFIED",
      );
    }
  });

  it("resolving an unknown capability id is UNSATISFIED, not a throw or undefined", () => {
    const status = resolve("nonexistent.capability");
    expect(status.state).toBe("UNSATISFIED");
    if (status.state === "UNSATISFIED") {
      expect(status.reason).toMatch(/no capability/i);
    }
  });

  describe("binding a provider changes UNSATISFIED to READY, and unbinding reverses it", () => {
    const THROWAWAY = "m02.throwaway.capability";

    beforeEach(() => {
      unregisterCapability(THROWAWAY);
    });

    it("registering with zero providers is UNSATISFIED; binding one makes it READY; unbinding the last one reverts to UNSATISFIED", () => {
      registerCapability({
        id: THROWAWAY,
        description: "Test-only throwaway capability",
        owner: "m02-test",
        input: [],
        output: [],
        requiredCredentials: [],
      });
      expect(resolve(THROWAWAY).state).toBe("UNSATISFIED");

      bindProvider(THROWAWAY, "provider-a");
      const bound = resolve(THROWAWAY);
      expect(bound.state).toBe("READY");
      if (bound.state === "READY") {
        expect(bound.providerIds).toEqual(["provider-a"]);
      }

      unbindProvider(THROWAWAY, "provider-a");
      expect(resolve(THROWAWAY).state).toBe("UNSATISFIED");

      unregisterCapability(THROWAWAY);
    });

    it("a capability registered with no owner is rejected — the exit criterion requires one, not a default", () => {
      expect(() =>
        registerCapability({
          id: THROWAWAY,
          description: "missing owner",
          owner: "",
          input: [],
          output: [],
          requiredCredentials: [],
        }),
      ).toThrow(/owner/i);
    });
  });

  it("__resetCapabilityRegistryForTests clears everything — test-only, documented rather than exercised destructively here", () => {
    expect(typeof __resetCapabilityRegistryForTests).toBe("function");
  });
});
