/// <reference types="bun-types" />
/**
 * Session cookie hardening: signed, expiring, tamper-proof, legacy-upgradable.
 */
import { describe, expect, test } from 'bun:test';
import {
  SESSION_TTL_MS,
  isPlausibleUserId,
  signLegacySessionToken,
  signSessionToken,
  verifySessionToken,
} from '../../src/lib/session-token';

const SECRET = 'a'.repeat(64);
const USER = 'clx7f2m9k0001abcd';

describe('session token v2', () => {
  test('round-trips a signed token', () => {
    const token = signSessionToken(USER, SECRET);
    const verified = verifySessionToken(token, SECRET);
    expect(verified?.userId).toBe(USER);
    expect(verified?.needsUpgrade).toBe(false);
  });

  test('rejects a token signed with another secret', () => {
    const token = signSessionToken(USER, SECRET);
    expect(verifySessionToken(token, 'b'.repeat(64))).toBeNull();
  });

  test('rejects a tampered user id', () => {
    const token = signSessionToken(USER, SECRET);
    const forged = token.replace(USER, 'clx7f2m9k0002abcd');
    expect(verifySessionToken(forged, SECRET)).toBeNull();
  });

  test('expires after the TTL', () => {
    const issued = Date.now() - SESSION_TTL_MS - 1000;
    const token = signSessionToken(USER, SECRET, issued);
    expect(verifySessionToken(token, SECRET, { now: Date.now() })).toBeNull();
    // ...but is valid just inside the window.
    expect(verifySessionToken(token, SECRET, { now: issued + SESSION_TTL_MS - 1000 })?.userId).toBe(USER);
  });

  test('rejects a token dated far in the future', () => {
    const token = signSessionToken(USER, SECRET, Date.now() + 60 * 60 * 1000);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  test('rejects malformed input', () => {
    for (const bad of ['', '.', 'v2', 'v2.', 'v2..', `v2.${USER}`, `v2.${USER}.notanumber.sig`, null, undefined]) {
      expect(verifySessionToken(bad as string, SECRET)).toBeNull();
    }
  });

  test('rejects ids that are not plausible user ids', () => {
    expect(isPlausibleUserId('short')).toBe(false);
    expect(isPlausibleUserId('has space inside')).toBe(false);
    expect(isPlausibleUserId(USER)).toBe(true);
  });
});

describe('legacy session cookie migration', () => {
  test('accepts a valid v1 token and flags it for upgrade', () => {
    const legacy = signLegacySessionToken(USER, SECRET);
    const verified = verifySessionToken(legacy, SECRET);
    expect(verified?.userId).toBe(USER);
    expect(verified?.needsUpgrade).toBe(true);
  });

  test('can refuse v1 tokens outright', () => {
    const legacy = signLegacySessionToken(USER, SECRET);
    expect(verifySessionToken(legacy, SECRET, { legacy: 'reject' })).toBeNull();
  });

  test('rejects a v1 token with a broken signature', () => {
    const legacy = signLegacySessionToken(USER, SECRET);
    expect(verifySessionToken(`${legacy.slice(0, -3)}fff`, SECRET)).toBeNull();
  });
});
