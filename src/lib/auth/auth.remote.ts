import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import {
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
	createSessionCookieValue,
	verifyGoogleCredential
} from '$lib/server/auth/session';

const LEGACY_SESSION_COOKIE_NAME = 'notes_sync_session';

export const getAuthUser = query(async () => getRequestEvent().locals.user);

export const signIn = command(
	v.object({ credential: v.pipe(v.string(), v.nonEmpty()) }),
	async ({ credential }) => {
		const event = getRequestEvent();
		const requestOrigin = event.request.headers.get('origin');
		if (requestOrigin && requestOrigin !== event.url.origin) {
			throw error(403, 'Sign-in origin did not match');
		}

		const user = await verifyGoogleCredential(credential);
		event.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(user), {
			path: '/',
			httpOnly: true,
			secure: !event.url.hostname.includes('localhost'),
			sameSite: 'lax',
			maxAge: SESSION_TTL_SECONDS
		});
		event.cookies.delete(LEGACY_SESSION_COOKIE_NAME, { path: '/' });
		return user;
	}
);

export const signOut = command(async () => {
	const event = getRequestEvent();
	event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	event.cookies.delete(LEGACY_SESSION_COOKIE_NAME, { path: '/' });
	return null;
});
