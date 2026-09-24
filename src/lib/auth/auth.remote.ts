import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { adminUser, verifyAdminPassword } from '$lib/server/auth/admin';
import {
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
	createSession,
	createSessionCookieValue
} from '$lib/server/auth/session';

const SignInSchema = v.object({
	password: v.pipe(v.string(), v.nonEmpty())
});

export const getSession = query(async () => getRequestEvent().locals.session);

export const signIn = command(SignInSchema, async ({ password }) => {
	const event = getRequestEvent();
	const requestOrigin = event.request.headers.get('origin');
	if (requestOrigin && requestOrigin !== event.url.origin) {
		throw error(403, 'Sign-in origin did not match');
	}

	verifyAdminPassword(password);
	const session = createSession(adminUser());
	event.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(session), {
		path: '/',
		httpOnly: true,
		secure: !event.url.hostname.includes('localhost'),
		sameSite: 'lax',
		maxAge: SESSION_TTL_SECONDS
	});

	return session;
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	return null;
});
