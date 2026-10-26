import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { listRepositoryCrafts } from '#lib/crafts/repository.remote.js';
import { getAccountStore } from '#lib/server/auth/users.js';
import {
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
	createSession,
	createSessionCookieValue
} from '#lib/server/auth/session.js';

const SignInSchema = v.object({
	email: v.optional(v.string()),
	password: v.pipe(v.string(), v.nonEmpty())
});

export const getSession = query(async () => getRequestEvent().locals.session);

export const signIn = command(SignInSchema, async ({ email, password }) => {
	const event = getRequestEvent();
	const requestOrigin = event.request.headers.get('origin');
	if (requestOrigin && requestOrigin !== event.url.origin) {
		throw error(403, 'Sign-in origin did not match');
	}

	const user = await getAccountStore().authenticate({ email, password });
	const session = createSession(user);
	event.locals.session = session;
	event.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(session), {
		path: '/',
		httpOnly: true,
		secure: !event.url.hostname.includes('localhost'),
		sameSite: 'lax',
		maxAge: SESSION_TTL_SECONDS
	});
	getSession().set(session);
	await listRepositoryCrafts().refresh();

	return session;
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	event.locals.session = null;
	event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	getSession().set(null);
	await listRepositoryCrafts().refresh();
	return null;
});
