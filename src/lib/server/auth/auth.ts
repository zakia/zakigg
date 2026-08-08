import { getRequestEvent } from '$app/server';
import { error, redirect } from '@sveltejs/kit';
import type { Session } from '$lib/auth/types';

type OptionalAuth = { required?: false; redirect?: false };
type RequiredAuth = { required: true; redirect?: false };
type RedirectAuth = { required?: boolean; redirect: true | string };
export type AuthOptions = OptionalAuth | RequiredAuth | RedirectAuth;

export function auth(): Session | null;
export function auth(options: RequiredAuth | RedirectAuth): Session;
export function auth(options?: AuthOptions): Session | null;
export function auth(options: AuthOptions = {}): Session | null {
	const { locals, url } = getRequestEvent();
	if (locals.session) return locals.session;

	if (options.redirect) {
		const signInPath = options.redirect === true ? '/' : options.redirect;
		const destination = new URL(signInPath, url.origin);
		destination.searchParams.set('returnTo', `${url.pathname}${url.search}`);
		redirect(303, `${destination.pathname}${destination.search}`);
	}

	if (options.required) error(401, 'Sign in to continue');
	return null;
}
