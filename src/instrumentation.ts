/**
 * Server startup checks (Next.js `instrumentation.ts`).
 *
 * Runs once per server process before requests are served. A production build
 * with a missing or guessable `SESSION_SECRET` refuses to boot: session
 * forgery is a one-line cookie edit otherwise, and this app now persists
 * private chart/chat data on the device that is protected by that session.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { inspectSessionSecret } = await import('@/lib/env');
  const found = inspectSessionSecret();

  if (found.fatal) {
    const message =
      `[security] Refusing to start: ${found.problems.join('; ')}. ` +
      'Set SESSION_SECRET to at least 32 random characters (e.g. `openssl rand -hex 32`), ' +
      'or set ASTROVIA_ALLOW_INSECURE_SESSION_SECRET=1 for a throwaway demo.';
    console.error(message);
    throw new Error(message);
  }

  if (found.problems.length > 0) {
    console.warn(
      `[security] ${found.problems.join('; ')}. ` +
        'Fine for local development; never deploy with the fallback secret.',
    );
  }
}
