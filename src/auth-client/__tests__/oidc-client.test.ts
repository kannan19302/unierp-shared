import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OidcClient, OidcError } from "../oidc-client.js";

/**
 * Minimal fake browser globals — no jsdom in this package. sessionStorage and
 * fetch are the only browser APIs OidcClient touches; a hand-rolled Map-backed
 * stub is simpler and faster than pulling in jsdom for one module.
 */
function fakeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const config = {
  issuer: "http://localhost:3005",
  clientId: "unierp-tenant-apps",
  redirectUri: "http://localhost:4003/auth/callback",
  scope: ["openid", "profile", "erp.read"],
};

describe("OidcClient", () => {
  let originalWindow: typeof globalThis.window | undefined;
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;
    (globalThis as unknown as { window: unknown }).window = {
      sessionStorage: fakeSessionStorage(),
      location: { pathname: "/dashboard", search: "?tab=invoices" },
    };
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
  });

  describe("buildAuthorizeUrl", () => {
    it("builds a well-formed /oidc/authorize URL with PKCE, state and nonce", async () => {
      const client = new OidcClient(config);
      const url = new URL(await client.buildAuthorizeUrl());

      expect(url.origin + url.pathname).toBe("http://localhost:3005/oidc/authorize");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("client_id")).toBe("unierp-tenant-apps");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:4003/auth/callback",
      );
      expect(url.searchParams.get("scope")).toBe("openid profile erp.read");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(url.searchParams.get("state")).toBeTruthy();
      expect(url.searchParams.get("nonce")).toBeTruthy();
    });

    it("defaults returnTo to the current path and query", async () => {
      const client = new OidcClient(config);
      await client.buildAuthorizeUrl();

      const raw = window.sessionStorage.getItem("unierp.oidc.pending");
      expect(JSON.parse(raw!).returnTo).toBe("/dashboard?tab=invoices");
    });

    it("honours an explicit returnTo override", async () => {
      const client = new OidcClient(config);
      await client.buildAuthorizeUrl({ returnTo: "/settings/billing" });

      const raw = window.sessionStorage.getItem("unierp.oidc.pending");
      expect(JSON.parse(raw!).returnTo).toBe("/settings/billing");
    });

    it("generates a fresh verifier/state/nonce on every call", async () => {
      const client = new OidcClient(config);
      const url1 = new URL(await client.buildAuthorizeUrl());
      const url2 = new URL(await client.buildAuthorizeUrl());

      expect(url1.searchParams.get("state")).not.toBe(url2.searchParams.get("state"));
      expect(url1.searchParams.get("code_challenge")).not.toBe(
        url2.searchParams.get("code_challenge"),
      );
    });
  });

  describe("handleCallback", () => {
    it("exchanges the code and returns tokens plus the original returnTo", async () => {
      const client = new OidcClient(config);
      const authorizeUrl = new URL(await client.buildAuthorizeUrl({ returnTo: "/apps" }));
      const state = authorizeUrl.searchParams.get("state")!;

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          access_token: "at.jwt.here",
          id_token: "id.jwt.here",
          refresh_token: "rt-opaque",
          expires_in: 900,
          scope: "openid profile erp.read",
        }),
      }) as unknown as typeof fetch;

      const callback = `http://localhost:4003/auth/callback?code=abc123&state=${state}`;
      const result = await client.handleCallback(callback);

      expect(result.tokens.accessToken).toBe("at.jwt.here");
      expect(result.tokens.refreshToken).toBe("rt-opaque");
      expect(result.returnTo).toBe("/apps");
    });

    it("posts the correct grant to /oidc/token", async () => {
      const client = new OidcClient(config);
      const authorizeUrl = new URL(await client.buildAuthorizeUrl());
      const state = authorizeUrl.searchParams.get("state")!;
      const verifier = JSON.parse(
        window.sessionStorage.getItem("unierp.oidc.pending")!,
      ).verifier;

      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({
          access_token: "at",
          expires_in: 900,
          scope: "openid",
        }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await client.handleCallback(
        `http://localhost:4003/auth/callback?code=the-code&state=${state}`,
      );

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("http://localhost:3005/oidc/token");
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        grant_type: "authorization_code",
        code: "the-code",
        redirect_uri: "http://localhost:4003/auth/callback",
        code_verifier: verifier,
        client_id: "unierp-tenant-apps",
      });
    });

    it("clears the pending flow even when the exchange fails, so it cannot be replayed", async () => {
      const client = new OidcClient(config);
      const authorizeUrl = new URL(await client.buildAuthorizeUrl());
      const state = authorizeUrl.searchParams.get("state")!;

      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ error: "invalid_grant", error_description: "nope" }),
      }) as unknown as typeof fetch;

      await expect(
        client.handleCallback(
          `http://localhost:4003/auth/callback?code=x&state=${state}`,
        ),
      ).rejects.toThrow(OidcError);

      expect(window.sessionStorage.getItem("unierp.oidc.pending")).toBeNull();
    });

    it("rejects a state mismatch — the CSRF defence — before ever calling the token endpoint", async () => {
      const client = new OidcClient(config);
      await client.buildAuthorizeUrl();

      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        client.handleCallback(
          "http://localhost:4003/auth/callback?code=x&state=attacker-supplied-state",
        ),
      ).rejects.toThrow(/state did not match/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces an IdP error response (e.g. access_denied) without attempting exchange", async () => {
      const client = new OidcClient(config);
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        client.handleCallback(
          "http://localhost:4003/auth/callback?error=access_denied&error_description=nope",
        ),
      ).rejects.toThrow(OidcError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a callback with no pending flow in storage (replay of an old link)", async () => {
      const client = new OidcClient(config);
      await expect(
        client.handleCallback(
          "http://localhost:4003/auth/callback?code=x&state=whatever",
        ),
      ).rejects.toThrow(/No pending authorization flow/);
    });

    it("refuses a callback missing the authorization code", async () => {
      const client = new OidcClient(config);
      await client.buildAuthorizeUrl();
      await expect(
        client.handleCallback("http://localhost:4003/auth/callback?state=x"),
      ).rejects.toThrow(/No authorization code/);
    });
  });

  describe("refresh", () => {
    it("posts the refresh_token grant and returns the rotated token set", async () => {
      const client = new OidcClient(config);
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({
          access_token: "new-at",
          refresh_token: "new-rt",
          expires_in: 900,
          scope: "openid",
        }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await client.refresh("old-rt");

      expect(result.accessToken).toBe("new-at");
      expect(result.refreshToken).toBe("new-rt");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toMatchObject({
        grant_type: "refresh_token",
        refresh_token: "old-rt",
        client_id: "unierp-tenant-apps",
      });
    });

    it("throws when the IdP rejects the refresh token", async () => {
      const client = new OidcClient(config);
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ error: "invalid_grant", error_description: "revoked" }),
      }) as unknown as typeof fetch;

      await expect(client.refresh("dead-token")).rejects.toThrow(OidcError);
    });
  });

  describe("buildLogoutUrl", () => {
    it("builds the RP-initiated logout URL with client_id and the redirect target", () => {
      const client = new OidcClient(config);
      const url = new URL(client.buildLogoutUrl("http://localhost:4000/"));

      expect(url.origin + url.pathname).toBe("http://localhost:3005/oidc/end_session");
      expect(url.searchParams.get("client_id")).toBe("unierp-tenant-apps");
      expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
        "http://localhost:4000/",
      );
    });
  });
});
