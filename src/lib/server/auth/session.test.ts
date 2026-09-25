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
	});

	it('uses the cookie name Firebase Hosting forwards to Cloud Run', () => {
		expect(SESSION_COOKIE_NAME).toBe('__session');
	});

	it('round-trips a signed session and rejects tampering', () => {
		privateEnv.AUTH_SESSION_SECRET = 'a-test-secret-that-is-long-enough';

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
});
