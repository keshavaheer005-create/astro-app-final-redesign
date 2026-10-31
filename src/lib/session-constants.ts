/**
 * Shared session constants — NO imports, safe in both server and client code.
 *
 * Kept separate from `session-token.ts` (which pulls in node:crypto) so the
 * client bundle never imports Node built-ins.
 */

/** Cookie name. Kept for compatibility with existing deployments. */
export const SESSION_COOKIE = 'selfsage_sid';

/**
 * Request header that carries the signed token when the browser cannot hold
 * cookies at all (embedded previews / strict third-party-cookie mode). The
 * header value is the SAME signed token the cookie would carry, so it goes
 * through exactly the same HMAC verification — nothing weaker.
 */
export const SESSION_TOKEN_HEADER = 'x-session-token';

/** localStorage key for the same token, used by the client to replay it. */
export const SESSION_TOKEN_STORAGE_KEY = 'astrovia:session-token';

/** How long a freshly issued session token stays valid. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
