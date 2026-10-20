/**
 * Server startup checks (Next.js `instrumentation.ts`).
 *
 * A production build with a missing or guessable `SESSION_SECRET` cannot be
 * allowed to sign sessions: forgery is a one-line cookie edit otherwise, and
 * the app now persists private chart/chat data that a forged session would
 * unlock.
 *
 * This hook deliberately does NOT throw. Next.js catches instrumentation errors
 * per request and logs them as "an error occurred while loading instrumentation
 * hook" on every visit — noisy, and it never actually stopped the server.
 * Instead:
 *   • one loud, actionable banner is logged at boot;
 *   • `/api` (the Render health check path) answers 503 until it is fixed, so
 *     the deploy is marked unhealthy and the previous version keeps serving;
 *   • session signing itself fails closed (see `getSessionSecret`).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { inspectSessionSecret } = await import('@/lib/env');
  const found = inspectSessionSecret();

  if (found.fatal) {
    const rule = '='.repeat(78);
    console.error(
      [
        '',
        rule,
        '[security] SESSION_SECRET is missing or not production-grade.',
        `           ${found.problems.join('; ')}`,
        '',
        '           This deployment cannot sign anyone in until it is fixed:',
        '           Render -> your service -> Environment -> add SESSION_SECRET',
        '           Generate one with:  openssl rand -hex 32',
        '',
        '           For a throwaway demo only:',
        '           ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1',
        '',
        '           GET /api reports this as unhealthy (HTTP 503) until fixed.',
        rule,
        '',
      ].join('\n'),
    );
    return;
  }

  if (found.problems.length > 0) {
    console.warn(
      `[security] ${found.problems.join('; ')}. ` +
        'Fine for local development; never deploy with the fallback secret.',
    );
  }
}
