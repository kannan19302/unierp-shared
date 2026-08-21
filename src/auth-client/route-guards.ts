import { verifyAccessToken, type UniErpAccessTokenClaims } from "./verify-access-token.js";
import type { createRemoteJWKSet } from "jose";

/**
 * Edge-safe route guards for Next.js middleware.
 *
 * The point of these existing at all: tenant-apps' `middleware.ts` used to
 * decode a JWT payload with a base64 split and no signature check, because
 * middleware runs on the Edge runtime and nobody had wired a WebCrypto-based
 * verifier in. These are real signature verification, safe to call from
 * middleware, a Route Handler, or a server component.
 */

export type GuardResult =
  | { ok: true; claims: UniErpAccessTokenClaims }
  | { ok: false; reason: "no_token" | "invalid_token" | "wrong_platform" | "missing_permission" };

/** Verifies the bearer/cookie token is a genuine, signed, revocable session. */
export async function requireSession(
  token: string | undefined | null,
  params: { issuer: string; jwks?: ReturnType<typeof createRemoteJWKSet> },
): Promise<GuardResult> {
  if (!token) return { ok: false, reason: "no_token" };
  try {
    const claims = await verifyAccessToken(token, params);
    return { ok: true, claims };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

/**
 * Verifies the token AND that it was minted for this specific platform.
 *
 * The `plat` claim is what stops a token issued for the marketplace being
 * replayed against, say, the tenant admin console — each platform's own
 * middleware should call this with its own platform code, not just check that
 * the token verifies at all.
 */
export async function requirePlatform(
  token: string | undefined | null,
  platformCode: string,
  params: { issuer: string; jwks?: ReturnType<typeof createRemoteJWKSet> },
): Promise<GuardResult> {
  const result = await requireSession(token, params);
  if (!result.ok) return result;
  if (result.claims.plat !== platformCode) {
    return { ok: false, reason: "wrong_platform" };
  }
  return result;
}

/**
 * Verifies the token AND that it carries every one of the required
 * permissions — the client-side mirror of a route the API guards with
 * `@Permissions(...)`. This is defence-in-depth: the API is still the
 * authoritative check on every data request; this only stops the browser from
 * rendering a page the user cannot use, the same relationship tenant-apps'
 * middleware already documents for its own plane-2 boundary.
 */
export async function requirePermissions(
  token: string | undefined | null,
  permissions: string[],
  params: { issuer: string; jwks?: ReturnType<typeof createRemoteJWKSet> },
): Promise<GuardResult> {
  const result = await requireSession(token, params);
  if (!result.ok) return result;
  const missing = permissions.some((p) => !result.claims.permissions.includes(p));
  if (missing) return { ok: false, reason: "missing_permission" };
  return result;
}
