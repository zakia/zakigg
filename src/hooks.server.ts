import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { adminUser } from '$lib/server/auth/admin';
import {
	createSession,
	SESSION_COOKIE_NAME,
	verifySessionCookieValue
} from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);

	event.locals.session = sessionCookie ? verifySessionCookieValue(sessionCookie) : null;

	// Dev-only convenience: when no admin password is configured, treat the local
	// session as an admin so the private editor is reachable without signing in.
	// Prod always requires a valid signed session.
	if (!event.locals.session && dev && !env.ADMIN_PASSWORD) {
		event.locals.session = createSession(adminUser());
	}

	return resolve(event);
};
