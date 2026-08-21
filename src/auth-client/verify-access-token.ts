import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * Verifies an access token against the IdP's real public key set.
 *
 * This is the piece that was missing everywhere before: tenant-apps'
 * middleware.ts decoded the JWT payload with a base64 split — no signature
 * check at all — because Next.js middleware runs on the Edge runtime, which
 * has no Node `crypto`, and nobody wired in a WebCrypto-based verifier. `jose`
 * is WebCrypto-native, so `createRemoteJWKSet` + `jwtVerify` work unmodified in
 * middleware, a Route Handler, or a plain browser script — one implementation,
 * every runtime this platform's relying parties actually run in.
 *
 * The JWKS is fetched once per process and cached (with the key set refreshed
 * automatically on a `kid` miss, e.g. after the IdP rotates a signing key) —
 * `createRemoteJWKSet` handles that; callers should build one `jwks` per
 * process, not per request.
 */

export interface UniErpAccessTokenClaims extends JWTPayload {
  sid: string;
  tenantId: string;
  realm: "tenant" | "provider";
  roles: string[];
  permissions: string[];
  scope: string;
  plat: string | null;
  mfaVerified: boolean;
  amr: string[];
  typ: "session";
  act?: { agentId: string };
}

export function createUniErpJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  return createRemoteJWKSet(new URL("/oidc/jwks.json", issuer));
}

export async function verifyAccessToken(
  token: string,
  params: { issuer: string; jwks?: ReturnType<typeof createRemoteJWKSet> },
): Promise<UniErpAccessTokenClaims> {
  const jwks = params.jwks ?? createUniErpJwks(params.issuer);
  const { payload } = await jwtVerify(token, jwks, { issuer: params.issuer });

  // A token that verifies but lacks `sid` cannot be revoked — the same defect
  // W0 closed in the NestJS guards, checked again here because a relying
  // party's own middleware is a second place that same bypass could recur if
  // this check ever lived only server-side.
  if (typeof payload.sid !== "string" || !payload.sid) {
    throw new Error("Access token has no session id and cannot be trusted");
  }

  return payload as UniErpAccessTokenClaims;
}

/** True if the claims include every one of the given permissions. */
export function hasAllPermissions(
  claims: Pick<UniErpAccessTokenClaims, "permissions">,
  required: string[],
): boolean {
  return required.every((permission) => claims.permissions.includes(permission));
}

/** True if the claims include at least one of the given permissions. */
export function hasAnyPermission(
  claims: Pick<UniErpAccessTokenClaims, "permissions">,
  candidates: string[],
): boolean {
  return candidates.some((permission) => claims.permissions.includes(permission));
}
