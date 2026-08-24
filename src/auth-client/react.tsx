import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
export { OidcClient, type OidcClientConfig, type TokenSet } from "./oidc-client.js";
import { OidcClient, type OidcClientConfig, type TokenSet } from "./oidc-client.js";
import type { UniErpAccessTokenClaims } from "./verify-access-token.js";
import { decodeJwt } from "jose";

/**
 * `<UniErpAuthProvider>` / `useSession()` / `usePermissions()`.
 *
 * Tokens live in React state — in memory, in this tab, for this page load —
 * and nowhere else this module controls. That is a deliberate trade against
 * convenience: `localStorage` survives a refresh, but it is also the first
 * place an XSS payload looks, which is exactly how tenant-apps' previous
 * implementation was storing its access token. A page reload here means a
 * silent re-authentication (via the refresh token, itself never touched by
 * this module beyond the one call it makes to exchange it) rather than a
 * token an attacker's injected script could simply read.
 *
 * Claims are decoded client-side for display purposes only (`useSession`'s
 * `claims`); this is NOT a trust boundary. Every server request still carries
 * the token and is verified server-side against the JWKS — decoding without
 * verifying here only ever drives what the UI shows, never an authorization
 * decision an attacker could profit from forging.
 */

export interface UniErpAuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  claims: UniErpAccessTokenClaims | null;
  accessToken: string | null;
  signIn: (options?: { returnTo?: string }) => Promise<void>;
  signOut: (options?: { postLogoutRedirectUri?: string }) => void;
  /** For a Route Handler / API call the provider itself doesn't make. */
  getAccessToken: () => string | null;
  /**
   * Pathname of this client's registered `redirectUri`, so a guard can tell
   * whether the browser is currently ON the page that establishes the session.
   */
  callbackPath: string;
}

const UniErpAuthContext = createContext<UniErpAuthContextValue | null>(null);

export interface UniErpAuthProviderProps {
  config: OidcClientConfig;
  /**
   * Called once on mount to recover a session without a full-page redirect —
   * e.g. reading an httpOnly refresh cookie the platform's own Route Handler
   * set, and exchanging it. Omit for a platform with no persistence story yet;
   * the provider then simply starts unauthenticated until `signIn` runs.
   */
  restoreSession?: () => Promise<TokenSet | null>;
  /** Where post-logout should land; defaults to the Global Platform Wizard. */
  defaultPostLogoutRedirectUri?: string;
  children: ReactNode;
}

export function UniErpAuthProvider(props: UniErpAuthProviderProps): ReactElement {
  const client = useMemo(() => new OidcClient(props.config), [props.config]);
  const callbackPath = useMemo(() => {
    try {
      return new URL(props.config.redirectUri).pathname;
    } catch {
      return "/auth/callback";
    }
  }, [props.config.redirectUri]);
  const [tokens, setTokens] = useState<TokenSet | null>(null);
  const [status, setStatus] = useState<UniErpAuthContextValue["status"]>("loading");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(
    (tokenSet: TokenSet) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      // Two renewal strategies, depending on how this app chose to hold its
      // refresh token:
      //
      //  * tokenSet.refreshToken present — this app keeps it in memory (the
      //    OidcClient's own default) and refresh calls client.refresh()
      //    directly.
      //  * absent, but restoreSession was supplied — this app instead holds
      //    the refresh token server-side behind an httpOnly cookie (the
      //    stricter pattern the Platform Wizard uses) and renewal means
      //    calling restoreSession() again, which re-derives a fresh access
      //    token from that cookie without ever exposing the refresh token to
      //    this component.
      //
      // Without this fallback, a server-held-refresh-token app would silently
      // stop renewing the moment the first token expired — restoreSession
      // only ever runs once, on mount, and there would be nothing after it.
      if (!tokenSet.refreshToken && !props.restoreSession) return;

      const delay = Math.max(tokenSet.expiresAt - Date.now() - 60_000, 5_000);
      refreshTimer.current = setTimeout(async () => {
        try {
          const next = tokenSet.refreshToken
            ? await client.refresh(tokenSet.refreshToken)
            : await props.restoreSession!();
          if (!next) throw new Error("session could not be restored");
          setTokens(next);
          scheduleRefresh(next);
        } catch {
          // The refresh token was rejected — revoked, rotated elsewhere,
          // expired. There is nothing to recover; the user re-authenticates
          // on their next action rather than being silently signed out mid-task.
          setTokens(null);
          setStatus("unauthenticated");
        }
      }, delay);
    },
    [client, props.restoreSession],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await props.restoreSession?.().catch(() => null);
      if (cancelled) return;
      if (restored) {
        setTokens(restored);
        setStatus("authenticated");
        scheduleRefresh(restored);
      } else {
        setStatus("unauthenticated");
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // Intentionally run once: restoreSession is a mount-time recovery step,
    // not a value the provider re-subscribes to on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (options?: { returnTo?: string }) => {
      const url = await client.buildAuthorizeUrl(options);
      window.location.assign(url);
    },
    [client],
  );

  const signOut = useCallback(
    (options?: { postLogoutRedirectUri?: string }) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const logoutUrl = client.buildLogoutUrl(
        options?.postLogoutRedirectUri ??
          props.defaultPostLogoutRedirectUri ??
          "http://localhost:4000/",
      );

      // Navigate without first publishing `unauthenticated`. Otherwise a
      // <RequireSession> consumer can observe that intermediate state, launch
      // a new authorization request, and overwrite /oidc/end_session before
      // the IdP revokes the shared session. `replace` also keeps the protected
      // page out of browser history after logout.
      window.location.replace(logoutUrl);
    },
    [client, props.defaultPostLogoutRedirectUri],
  );

  const getAccessToken = useCallback(() => tokens?.accessToken ?? null, [tokens]);

  const claims = useMemo<UniErpAccessTokenClaims | null>(() => {
    if (!tokens?.accessToken) return null;
    try {
      return decodeJwt(tokens.accessToken) as UniErpAccessTokenClaims;
    } catch {
      return null;
    }
  }, [tokens]);

  const value = useMemo<UniErpAuthContextValue>(
    () => ({
      status,
      claims,
      accessToken: tokens?.accessToken ?? null,
      signIn,
      signOut,
      getAccessToken,
      callbackPath,
    }),
    [status, claims, tokens, signIn, signOut, getAccessToken, callbackPath],
  );

  return (
    <UniErpAuthContext.Provider value={value}>
      {props.children}
    </UniErpAuthContext.Provider>
  );
}

export function useSession(): UniErpAuthContextValue {
  const ctx = useContext(UniErpAuthContext);
  if (!ctx) {
    throw new Error("useSession() must be called within <UniErpAuthProvider>");
  }
  return ctx;
}

export function usePermissions(): {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (candidates: string[]) => boolean;
} {
  const { claims } = useSession();
  const permissions = claims?.permissions ?? [];
  return {
    permissions,
    hasPermission: (permission) => permissions.includes(permission),
    hasAnyPermission: (candidates) => candidates.some((p) => permissions.includes(p)),
  };
}

export function useTenant(): { tenantId: string | null } {
  const { claims } = useSession();
  return { tenantId: claims?.tenantId ?? null };
}

/**
 * Returns the current access token as an `Authorization` header object.
 *
 * Drop-in replacement for the legacy `localStorage.getItem("token")` pattern
 * that was scattered across dozens of components. The token lives in memory
 * only (see this file's top comment), so this is the ONLY correct way for a
 * React component to get an auth header — reading localStorage re-introduces
 * the XSS exposure this whole design exists to prevent.
 */
export function useAuthHeaders(): {
  getAuthHeaders: () => HeadersInit;
  getToken: () => string | null;
} {
  const { getAccessToken } = useSession();
  return {
    getAuthHeaders: useCallback((): HeadersInit => {
      const token = getAccessToken();
      return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    }, [getAccessToken]),
    getToken: getAccessToken,
  };
}

/**
 * A `fetch` wrapper that automatically injects the in-memory access token.
 *
 * This is the recommended replacement for every component that used to do:
 *   `const token = localStorage.getItem("token");`
 *   `fetch(url, { headers: { Authorization: \`Bearer \${token}\` } })`
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const data = await authFetch("/api/v1/some/resource");
 */
export function useAuthFetch(): (
  url: string,
  init?: RequestInit,
) => Promise<Response> {
  const { getAccessToken } = useSession();
  return useCallback(
    (url: string, init?: RequestInit) => {
      const token = getAccessToken();
      const headers = new Headers(init?.headers);
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(url, { ...init, headers, credentials: "include" });
    },
    [getAccessToken],
  );
}

/**
 * `<RequireSession>` — the client-side enforcement point every platform
 * shares, proven live in the Global Platform Wizard (W4) before being reused
 * here for the other eight platforms (W6).
 *
 * Middleware CANNOT do this job under this stack's security posture: the
 * access token lives in memory only (never in a cookie, never in
 * localStorage — see this file's top comment), so Edge middleware has
 * nothing readable to verify before a page renders. Mirroring the token into
 * a JS-readable cookie so middleware COULD check it would reopen exactly the
 * exposure this design avoids. The trade this stack makes instead: the
 * client redirects to sign-in the moment `status` resolves to
 * "unauthenticated", and the API independently verifies every request's
 * bearer token server-side regardless of what the browser ever rendered —
 * the browser-side gate is a UX convenience, not the security boundary.
 */
export function RequireSession({
  children,
  fallback = null,
  requiredPermissions,
}: {
  children: ReactNode;
  /** Shown while status is "loading" or immediately after an unauthenticated
   * redirect is triggered, before the browser navigates away. */
  fallback?: ReactNode;
  /** Optional defence-in-depth check — see usePermissions' own caveat: the
   * API is still the authoritative enforcement point for any denied action. */
  requiredPermissions?: string[];
}): ReactElement {
  const { status, claims, signIn, callbackPath } = useSession();

  // The OIDC callback route is the page that ESTABLISHES the session, so it is
  // the one page this guard must never act on. While it runs the code
  // exchange, status is legitimately "unauthenticated" — guarding it sent the
  // browser back to /oidc/authorize, which issued a fresh code, which landed
  // back here, which was still unauthenticated: a redirect loop that spins
  // forever on "Completing sign-in…" and never POSTs the refresh token.
  //
  // Apps that mount the guard below the root (see provider-admin-os's
  // RootAuthProvider / ControlPlaneGate split) sidestep this by keeping
  // /auth/callback outside the gate. Handling it here means mounting
  // <RequireSession> at the root layout — which every other platform does — is
  // no longer a trap.
  const onCallbackRoute =
    typeof window !== "undefined" && window.location.pathname === callbackPath;

  useEffect(() => {
    if (onCallbackRoute) return;
    if (status === "unauthenticated") {
      void signIn({ returnTo: window.location.pathname + window.location.search });
    }
  }, [status, signIn, onCallbackRoute]);

  if (onCallbackRoute) {
    return <>{children}</>;
  }

  if (status !== "authenticated") {
    return <>{fallback}</>;
  }

  if (requiredPermissions?.length) {
    const permissions = claims?.permissions ?? [];
    const missing = requiredPermissions.some((p) => !permissions.includes(p));
    if (missing) return <>{fallback}</>;
  }

  return <>{children}</>;
}
