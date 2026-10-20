/**
 * Server-side environment checks.
 *
 * Security prerequisite for persisting more private data on the client: a
 * deployment must not run with a guessable session secret. Anyone who can read
 * this repository can forge a session cookie when the fallback secret is in
 * use, so in production a weak/missing secret is a hard failure rather than a
 * console warning.
 *
 * Escape hatch for demos: `ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1`.
 */
export const INSECURE_DEV_SECRET = 'selfsage-dev-secret-2024';

/** Minimum length for a production session secret (hex-32 = 16 bytes, 64 = 32 bytes). */
export const MIN_SECRET_LENGTH = 32;

const PLACEHOLDERS = new Set([
  'change-me',
  'change-me-to-a-long-random-string',
  'changeme',
  'secret',
  'selfsage',
  'astrovia',
  'password',
]);

export interface SessionSecretInspection {
  secret: string | null;
  /** Human-readable reasons the configured secret is not production-grade. */
  problems: string[];
  /** True when the app must refuse to serve requests with this secret. */
  fatal: boolean;
  isProduction: boolean;
}

export function inspectSessionSecret(
  env: Record<string, string | undefined> = process.env,
): SessionSecretInspection {
  const isProduction = env.NODE_ENV === 'production';
  const raw = (env.SESSION_SECRET ?? '').trim();
  const problems: string[] = [];

  if (!raw) {
    problems.push('SESSION_SECRET is not set');
  } else if (raw === INSECURE_DEV_SECRET) {
    problems.push('SESSION_SECRET is the public development fallback');
  } else if (PLACEHOLDERS.has(raw.toLowerCase())) {
    problems.push('SESSION_SECRET is a documented placeholder value');
  } else if (raw.length < MIN_SECRET_LENGTH) {
    problems.push(`SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`);
  }

  const allowInsecure = env.ASTROVIA_ALLOW_INSECURE_SESSION_SECRET === '1';
  return {
    secret: raw || null,
    problems,
    fatal: isProduction && problems.length > 0 && !allowInsecure,
    isProduction,
  };
}

let cached: string | null | undefined;
let warned = false;

/**
 * The secret used to sign session cookies.
 *
 * Outside production the development fallback keeps local work easy. In
 * production an insecure secret throws here (fail closed) — `instrumentation.ts`
 * also refuses to boot the server in that case, so this should never be the
 * first thing to notice.
 */
export function getSessionSecret(): string {
  if (cached !== undefined && cached !== null) return cached;
  const found = inspectSessionSecret();
  if (!found.fatal) {
    if (found.problems.length && !warned) {
      warned = true;
      console.warn(
        `[security] ${found.problems.join('; ')}. ` +
          'Using a development secret — generate one with `openssl rand -hex 32`. ' +
          'Set ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1 to silence the production guard.',
      );
    }
    cached = found.secret ?? INSECURE_DEV_SECRET;
    return cached;
  }
  throw new Error(
    `[security] Refusing to sign sessions: ${found.problems.join('; ')}. ` +
      'Set a strong SESSION_SECRET (32+ random characters) before deploying.',
  );
}

/** Test hook — clears the memoised secret. */
export function resetSessionSecretForTests(): void {
  cached = undefined;
  warned = false;
}
