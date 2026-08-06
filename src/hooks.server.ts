import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '$lib/server/notes-sync/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);

	event.locals.syncUser = sessionCookie ? verifySessionCookieValue(sessionCookie) : null;

	return resolve(event);
};
