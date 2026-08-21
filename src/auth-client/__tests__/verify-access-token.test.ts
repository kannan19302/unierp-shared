import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet, type JWK } from "jose";
import {
  verifyAccessToken,
  hasAllPermissions,
  hasAnyPermission,
} from "../verify-access-token.js";

const ISSUER = "http://localhost:3005";

describe("verifyAccessToken", () => {
  let privateKey: CryptoKey;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
    publicJwk.kid = "test-kid";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";
    jwks = createLocalJWKSet({ keys: [publicJwk] });
  });

  async function sign(claims: Record<string, unknown>): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setSubject("usr-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);
  }

  it("verifies a genuine token signed by the real key", async () => {
    const token = await sign({
      sid: "sess-1",
      tenantId: "t1",
      realm: "tenant",
      roles: ["tenant-admin"],
      permissions: ["finance.invoice.read"],
      scope: "openid erp.read",
      typ: "session",
    });

    const claims = await verifyAccessToken(token, { issuer: ISSUER, jwks });
    expect(claims.sub).toBe("usr-1");
    expect(claims.tenantId).toBe("t1");
  });

  it("rejects a token signed by a different key entirely", async () => {
    const otherPair = await generateKeyPair("RS256");
    const forged = await new SignJWT({ sid: "sess-1", tenantId: "t1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setSubject("usr-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(otherPair.privateKey);

    await expect(
      verifyAccessToken(forged, { issuer: ISSUER, jwks }),
    ).rejects.toThrow();
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await new SignJWT({ sid: "sess-1", tenantId: "t1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer("http://evil.test")
      .setSubject("usr-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);

    await expect(
      verifyAccessToken(token, { issuer: ISSUER, jwks }),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({ sid: "sess-1", tenantId: "t1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(ISSUER)
      .setSubject("usr-1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
      .sign(privateKey);

    await expect(
      verifyAccessToken(token, { issuer: ISSUER, jwks }),
    ).rejects.toThrow();
  });

  it("rejects a validly-signed token that carries no sid — the same class of bypass W0 closed server-side", async () => {
    // This is exactly the shape the deleted provider-console dev-token action
    // minted: real signature, real issuer, no sid, so it could never be
    // revoked. The check must exist here too, not only in the NestJS guards —
    // a relying party's own middleware is a second place that bypass could
    // recur if this were only enforced server-side.
    const token = await sign({
      tenantId: "t1",
      permissions: ["*", "system.superadmin.access"],
    });

    await expect(
      verifyAccessToken(token, { issuer: ISSUER, jwks }),
    ).rejects.toThrow(/session id/);
  });

  it("rejects a token whose alg does not match any published key", async () => {
    const token = await new SignJWT({ sid: "sess-1", tenantId: "t1" })
      .setProtectedHeader({ alg: "RS256", kid: "unknown-kid" })
      .setIssuer(ISSUER)
      .setSubject("usr-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);

    await expect(
      verifyAccessToken(token, { issuer: ISSUER, jwks }),
    ).rejects.toThrow();
  });
});

describe("permission helpers", () => {
  const claims = { permissions: ["finance.invoice.read", "saas.read"] };

  it("hasAllPermissions requires every listed permission", () => {
    expect(hasAllPermissions(claims, ["finance.invoice.read"])).toBe(true);
    expect(
      hasAllPermissions(claims, ["finance.invoice.read", "saas.read"]),
    ).toBe(true);
    expect(
      hasAllPermissions(claims, ["finance.invoice.read", "hr.employee.read"]),
    ).toBe(false);
  });

  it("hasAnyPermission requires only one match", () => {
    expect(hasAnyPermission(claims, ["hr.employee.read", "saas.read"])).toBe(
      true,
    );
    expect(hasAnyPermission(claims, ["hr.employee.read"])).toBe(false);
  });

  it("both treat an empty requirement list as trivially satisfied/unsatisfied consistently", () => {
    expect(hasAllPermissions(claims, [])).toBe(true); // vacuously true
    expect(hasAnyPermission(claims, [])).toBe(false); // no candidate matched
  });
});
