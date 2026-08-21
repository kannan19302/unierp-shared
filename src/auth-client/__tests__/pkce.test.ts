import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  generateNonce,
} from "../pkce.js";

describe("PKCE primitives", () => {
  it("generates a verifier of sufficient length and entropy", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();

    expect(v1).not.toBe(v2);
    // RFC 7636 requires 43-128 chars; 32 random bytes base64url-encode to 43.
    expect(v1.length).toBeGreaterThanOrEqual(43);
  });

  it("produces a verifier with no padding or non-urlsafe characters", () => {
    const v = generateCodeVerifier();
    expect(v).not.toMatch(/[+/=]/);
  });

  it("derives BASE64URL(SHA-256(verifier)) exactly, matching a reference implementation", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);

    const reference = createHash("sha256")
      .update(verifier)
      .digest("base64url");

    expect(challenge).toBe(reference);
  });

  it("derives the same challenge from the same verifier every time", async () => {
    const verifier = "fixed-verifier-for-determinism-check";
    const a = await deriveCodeChallenge(verifier);
    const b = await deriveCodeChallenge(verifier);
    expect(a).toBe(b);
  });

  it("derives different challenges for different verifiers", async () => {
    const a = await deriveCodeChallenge("verifier-one");
    const b = await deriveCodeChallenge("verifier-two");
    expect(a).not.toBe(b);
  });

  it("generates unpredictable, distinct state and nonce values", () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateNonce()).not.toBe(generateNonce());
    expect(generateState()).not.toBe(generateNonce());
  });
});
