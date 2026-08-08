import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);

	event.locals.user = sessionCookie ? verifySessionCookieValue(sessionCookie) : null;

	return resolve(event);
};
