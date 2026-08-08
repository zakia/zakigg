import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted<Record<string, string | undefined>>(() => ({}));

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));

import {
	SESSION_COOKIE_NAME,
	createSession,
	createSessionCookieValue,
	verifySessionCookieValue
} from './session';

describe('auth session cookie', () => {
	afterEach(() => {
		delete privateEnv.AUTH_SESSION_SECRET;
		delete privateEnv.AUTH_ALLOWED_EMAIL;
	});

	it('uses the cookie name Firebase Hosting forwards to Cloud Run', () => {
		expect(SESSION_COOKIE_NAME).toBe('__session');
	});

	it('round-trips a signed session and rejects tampering', () => {
		privateEnv.AUTH_SESSION_SECRET = 'a-test-secret-that-is-long-enough';
		privateEnv.AUTH_ALLOWED_EMAIL = 'owner@example.com';

		const session = createSession({
			id: 'app-user-id',
			email: 'owner@example.com',
			name: 'Owner',
			image: 'https://example.com/avatar.png'
		});
		const value = createSessionCookieValue(session);

		expect(verifySessionCookieValue(value)).toEqual(session);
		expect(verifySessionCookieValue(`${value.slice(0, -1)}x`)).toBeNull();
	});

	it('keeps existing Google-subject sessions valid during migration', () => {
		privateEnv.AUTH_SESSION_SECRET = 'a-test-secret-that-is-long-enough';
		privateEnv.AUTH_ALLOWED_EMAIL = 'owner@example.com';
		const encoded = Buffer.from(
			JSON.stringify({
				sub: 'legacy-google-subject',
				email: 'owner@example.com',
				expiresAt: Math.floor(Date.now() / 1000) + 60
			})
		).toString('base64url');
		const signature = createHmac('sha256', privateEnv.AUTH_SESSION_SECRET)
			.update(encoded)
			.digest('base64url');

		expect(verifySessionCookieValue(`${encoded}.${signature}`)).toEqual({
			user: {
				id: 'legacy-google-subject',
				email: 'owner@example.com',
				name: null,
				image: null
			},
			expires: expect.any(Number)
		});
	});
});
