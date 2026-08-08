import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import type { AuthProviderCredentials, AuthProviderId } from './types';
import { resolveUser } from '$lib/server/auth/accounts';
import { verifyProviderIdentity } from '$lib/server/auth/providers';
import {
	SESSION_COOKIE_NAME,
	SESSION_TTL_SECONDS,
	createSession,
	createSessionCookieValue
} from '$lib/server/auth/session';

const LEGACY_SESSION_COOKIE_NAME = 'notes_sync_session';

const SignInSchema = v.variant('provider', [
	v.object({
		provider: v.literal('google'),
		credentials: v.object({ credential: v.pipe(v.string(), v.nonEmpty()) })
	})
]);

export const getSession = query(async () => getRequestEvent().locals.session);

export const signIn = command(SignInSchema, async ({ provider, credentials }) => {
	const event = getRequestEvent();
	const requestOrigin = event.request.headers.get('origin');
	if (requestOrigin && requestOrigin !== event.url.origin) {
		throw error(403, 'Sign-in origin did not match');
	}

	const identity = await verifyProviderIdentity(
		provider as AuthProviderId,
		credentials as AuthProviderCredentials[AuthProviderId]
	);
	const session = createSession(await resolveUser(identity));
	event.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(session), {
		path: '/',
		httpOnly: true,
		secure: !event.url.hostname.includes('localhost'),
		sameSite: 'lax',
		maxAge: SESSION_TTL_SECONDS
	});
	event.cookies.delete(LEGACY_SESSION_COOKIE_NAME, { path: '/' });

	return session;
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	event.cookies.delete(LEGACY_SESSION_COOKIE_NAME, { path: '/' });
	return null;
});
