/**
 * PKCE (RFC 7636) primitives for the browser.
 *
 * Uses Web Crypto (`crypto.subtle`) rather than Node's `crypto` module
 * deliberately: this code runs in the browser and in Next.js Edge middleware,
 * neither of which has the Node API, and Web Crypto is the one crypto surface
 * both environments share.
 */

const VERIFIER_BYTE_LENGTH = 32;

/** A cryptographically random code verifier, base64url-encoded per RFC 7636 §4.1. */
export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(VERIFIER_BYTE_LENGTH));
  return base64UrlEncode(bytes);
}

/** BASE64URL(SHA-256(verifier)) — the S256 code challenge. */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/** A random `state` value binding the callback to the request that started it. */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
}

/** A random `nonce`, replayed into the id_token to prove it answers this flow. */
export function generateNonce(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
