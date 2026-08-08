import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted<Record<string, string | undefined>>(() => ({}));

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { SESSION_COOKIE_NAME, createSessionCookieValue, verifySessionCookieValue } from './session';

describe('auth session cookie', () => {
	afterEach(() => {
		delete privateEnv.AUTH_SESSION_SECRET;
		delete privateEnv.AUTH_ALLOWED_EMAIL;
	});

	it('uses the cookie name Firebase Hosting forwards to Cloud Run', () => {
		expect(SESSION_COOKIE_NAME).toBe('__session');
	});

	it('round-trips a signed user and rejects tampering', () => {
		privateEnv.AUTH_SESSION_SECRET = 'a-test-secret-that-is-long-enough';
		privateEnv.AUTH_ALLOWED_EMAIL = 'owner@example.com';

		const value = createSessionCookieValue({ sub: 'google-user-id', email: 'owner@example.com' });

		expect(verifySessionCookieValue(value)).toEqual({
			sub: 'google-user-id',
			email: 'owner@example.com'
		});
		expect(verifySessionCookieValue(`${value.slice(0, -1)}x`)).toBeNull();
	});
});
