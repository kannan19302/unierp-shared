import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet, type JWK } from "jose";
import { requireSession, requirePlatform, requirePermissions } from "../route-guards.js";

const ISSUER = "http://localhost:3005";

describe("route guards", () => {
  let privateKey: CryptoKey;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
    publicJwk.kid = "test-kid";
    jwks = createLocalJWKSet({ keys: [publicJwk] });
  });

  async function sign(claims: Record<string, unknown>): Promise<string> {
    return new SignJWT({ sid: "sess-1", tenantId: "t1", permissions: [], ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setSubject("usr-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
  }

  describe("requireSession", () => {
    it("admits a genuine token", async () => {
      const token = await sign({});
      const result = await requireSession(token, { issuer: ISSUER, jwks });
      expect(result.ok).toBe(true);
    });

    it("refuses when there is no token at all", async () => {
      const result = await requireSession(undefined, { issuer: ISSUER, jwks });
      expect(result).toEqual({ ok: false, reason: "no_token" });
    });

    it("refuses a forged token without leaking why beyond invalid_token", async () => {
      const result = await requireSession("not-a-jwt", { issuer: ISSUER, jwks });
      expect(result).toEqual({ ok: false, reason: "invalid_token" });
    });
  });

  describe("requirePlatform", () => {
    it("admits a token minted for the requested platform", async () => {
      const token = await sign({ plat: "P3" });
      const result = await requirePlatform(token, "P3", { issuer: ISSUER, jwks });
      expect(result.ok).toBe(true);
    });

    it("refuses a token minted for a DIFFERENT platform — stops a marketplace token being replayed against the provider console", async () => {
      const token = await sign({ plat: "P7" });
      const result = await requirePlatform(token, "P2", { issuer: ISSUER, jwks });
      expect(result).toMatchObject({ ok: false, reason: "wrong_platform" });
    });

    it("refuses a token with no platform binding at all", async () => {
      const token = await sign({ plat: null });
      const result = await requirePlatform(token, "P3", { issuer: ISSUER, jwks });
      expect(result).toMatchObject({ ok: false, reason: "wrong_platform" });
    });
  });

  describe("requirePermissions", () => {
    it("admits a token holding every required permission", async () => {
      const token = await sign({
        permissions: ["finance.invoice.read", "finance.invoice.write"],
      });
      const result = await requirePermissions(
        token,
        ["finance.invoice.read"],
        { issuer: ISSUER, jwks },
      );
      expect(result.ok).toBe(true);
    });

    it("refuses when even one required permission is missing", async () => {
      const token = await sign({ permissions: ["finance.invoice.read"] });
      const result = await requirePermissions(
        token,
        ["finance.invoice.read", "finance.invoice.approve"],
        { issuer: ISSUER, jwks },
      );
      expect(result).toMatchObject({ ok: false, reason: "missing_permission" });
    });

    it("this is defence-in-depth only — an empty permission set is not automatically refused if none are required", async () => {
      const token = await sign({ permissions: [] });
      const result = await requirePermissions(token, [], { issuer: ISSUER, jwks });
      expect(result.ok).toBe(true);
    });

    it("checks token validity before permissions", async () => {
      const result = await requirePermissions(undefined, ["x"], {
        issuer: ISSUER,
        jwks,
      });
      expect(result).toEqual({ ok: false, reason: "no_token" });
    });
  });
});
