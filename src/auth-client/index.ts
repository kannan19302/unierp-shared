/**
 * `@kannan19302/shared/auth-client` — the one browser/Edge auth
 * implementation every UniERP platform shares.
 *
 * Before this, tenant-apps stored its access token in `localStorage` and
 * decoded JWT payloads in middleware without checking the signature — two
 * separate defects that a shared, reviewed implementation removes by
 * construction rather than by convention each app has to remember to follow.
 */

export { OidcClient, OidcError, type OidcClientConfig, type TokenSet } from "./oidc-client.js";
export {
  verifyAccessToken,
  createUniErpJwks,
  hasAllPermissions,
  hasAnyPermission,
  type UniErpAccessTokenClaims,
} from "./verify-access-token.js";
export {
  requireSession,
  requirePlatform,
  requirePermissions,
  type GuardResult,
} from "./route-guards.js";
export {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateState,
  generateNonce,
} from "./pkce.js";

// React hooks live at a SEPARATE entry point — @kannan19302/shared/auth-client/react —
// so that Edge middleware, Node route handlers, and anything else importing the
// core client is never forced to have react installed. See react.tsx for why.
