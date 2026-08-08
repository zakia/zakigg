import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '$lib/auth/types';

const request = vi.hoisted(() => ({
	locals: { session: null as Session | null },
	url: new URL('https://example.com/notes?view=recent')
}));

vi.mock('$app/server', () => ({ getRequestEvent: () => request }));

import { auth } from './auth';

describe('server auth facade', () => {
	beforeEach(() => {
		request.locals.session = null;
	});

	it('returns null when authentication is optional', () => {
		expect(auth()).toBeNull();
	});

	it('returns the current session', () => {
		const session: Session = {
			user: { id: 'user-id', email: 'owner@example.com', name: null, image: null },
			expires: Math.floor(Date.now() / 1000) + 60
		};
		request.locals.session = session;

		expect(auth({ required: true })).toBe(session);
	});

	it('throws 401 when authentication is required', () => {
		expect(() => auth({ required: true })).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('redirects to sign in while preserving the current URL', () => {
		expect(() => auth({ redirect: '/sign-in' })).toThrowError(
			expect.objectContaining({
				status: 303,
				location: '/sign-in?returnTo=%2Fnotes%3Fview%3Drecent'
			})
		);
	});
});
