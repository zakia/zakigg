import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { ADMIN_PASSWORD } from '$app/env/private';
import { adminUser } from '#lib/server/auth/admin.js';
import {
	createSession,
	SESSION_COOKIE_NAME,
	verifySessionCookieValue
} from '#lib/server/auth/session.js';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);

	event.locals.session = sessionCookie ? verifySessionCookieValue(sessionCookie) : null;

	// Dev-only convenience: when no admin password is configured, treat the local
	// session as an admin so the private editor is reachable without signing in.
	// Prod always requires a valid signed session.
	if (!event.locals.session && dev && !ADMIN_PASSWORD) {
		event.locals.session = createSession(adminUser());
	}

	return resolve(event);
};
