import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  generateNonce,
} from "./pkce.js";

/**
 * A minimal, dependency-free OIDC authorization-code + PKCE client for the
 * browser.
 *
 * Replaces what tenant-apps' login page did before: writing the access token
 * to `localStorage` (readable by any script on the page — the exact thing an
 * XSS payload goes looking for) and a middleware that decoded a JWT payload
 * without ever checking its signature. Tokens here are held in memory only
 * and never written to any browser storage this module controls; verification
 * uses the real JWKS (see `verify-access-token.ts`).
 *
 * PKCE state (verifier / expected state / nonce / return-to path) is kept in
 * `sessionStorage` across the redirect to the IdP and back — it is not a
 * secret (the verifier is useless without also possessing the authorization
 * code, which never touches storage) and `sessionStorage` is the correct
 * lifetime: gone when the tab closes, not shared across tabs racing the same
 * flow.
 */

const STORAGE_KEY = "unierp.oidc.pending";

export interface OidcClientConfig {
  /** e.g. "http://localhost:3005" — the IdP that issued this platform's client. */
  issuer: string;
  clientId: string;
  /** Must exactly match one of the client's registered redirect URIs. */
  redirectUri: string;
  /** Space-separated scope string, or an array joined the same way. */
  scope: string | string[];
}

export interface TokenSet {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope: string;
}

interface PendingFlow {
  verifier: string;
  state: string;
  nonce: string;
  returnTo: string;
}

export class OidcClient {
  constructor(private readonly config: OidcClientConfig) {}

  /**
   * Builds the /oidc/authorize URL and stashes the PKCE material needed to
   * complete the flow. Call `window.location.assign()` on the result — this
   * method does not navigate itself, so the caller can log the destination or
   * show a "redirecting…" state first if it wants to.
   */
  async buildAuthorizeUrl(options?: { returnTo?: string }): Promise<string> {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);
    const state = generateState();
    const nonce = generateNonce();

    const pending: PendingFlow = {
      verifier,
      state,
      nonce,
      returnTo: options?.returnTo ?? window.location.pathname + window.location.search,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

    const scope = Array.isArray(this.config.scope)
      ? this.config.scope.join(" ")
      : this.config.scope;

    const url = new URL("/oidc/authorize", this.config.issuer);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  /**
   * Completes the flow from the callback page: validates `state`, exchanges
   * the code for tokens, and returns them along with the path the user was
   * originally headed to (deep-link handoff survives the login round trip).
   *
   * Throws on a state mismatch or an IdP error response — the caller decides
   * how to present that, but it must never silently proceed with an
   * unauthenticated session on failure.
   */
  async handleCallback(
    callbackUrl: URL | string,
  ): Promise<{ tokens: TokenSet; returnTo: string }> {
    const url = typeof callbackUrl === "string" ? new URL(callbackUrl) : callbackUrl;

    const error = url.searchParams.get("error");
    if (error) {
      throw new OidcError(
        error,
        url.searchParams.get("error_description") ?? "Authorization failed",
      );
    }

    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    if (!code) {
      throw new OidcError("invalid_response", "No authorization code in callback");
    }

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY); // single-use regardless of outcome
    if (!raw) {
      throw new OidcError(
        "invalid_response",
        "No pending authorization flow found for this callback",
      );
    }
    const pending = JSON.parse(raw) as PendingFlow;

    // Constant-time comparison is not the point here — `state` is a CSRF
    // token defended by unguessability, not secrecy, so a plain compare is
    // correct and a timing side-channel teaches an attacker nothing they
    // could not already try by brute force.
    if (returnedState !== pending.state) {
      throw new OidcError(
        "invalid_response",
        "state did not match — possible CSRF or a stale callback",
      );
    }

    const tokenRes = await fetch(new URL("/oidc/token", this.config.issuer), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: pending.verifier,
        client_id: this.config.clientId,
      }),
    });
    const body = await tokenRes.json();
    if (body.error) {
      throw new OidcError(body.error, body.error_description ?? "Token exchange failed");
    }

    return {
      tokens: toTokenSet(body),
      returnTo: pending.returnTo,
    };
  }

  /**
   * Exchanges a refresh token for a fresh access token. The IdP rotates the
   * refresh token on every use (see idp's OidcTokenService) — the caller MUST
   * persist the returned `refreshToken`, not the one it called with, or the
   * next refresh will fail as reuse of an already-rotated token.
   */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const res = await fetch(new URL("/oidc/token", this.config.issuer), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.clientId,
      }),
    });
    const body = await res.json();
    if (body.error) {
      throw new OidcError(body.error, body.error_description ?? "Refresh failed");
    }
    return toTokenSet(body);
  }

  /**
   * Builds the RP-initiated logout URL. Navigating to it ends the session at
   * the IdP (and therefore at every other platform sharing it) — not just
   * this tab's copy of the token.
   */
  buildLogoutUrl(postLogoutRedirectUri: string): string {
    const url = new URL("/oidc/end_session", this.config.issuer);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
    return url.toString();
  }
}

export class OidcError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

function toTokenSet(body: {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}): TokenSet {
  return {
    accessToken: body.access_token,
    idToken: body.id_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    scope: body.scope,
  };
}
