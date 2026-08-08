import { browser } from '$app/environment';
import { getSession, signIn, signOut } from './auth.remote';
import type { AuthProviderCredentials, AuthProviderId, Session, User } from './types';

const state = $state({
	ready: false,
	session: null as Session | null
});

let refreshPromise: Promise<void> | null = null;

async function refresh(): Promise<void> {
	if (!browser) return;

	refreshPromise ??= loadSession().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}

async function loadSession(): Promise<void> {
	try {
		state.session = await getSession();
	} catch {
		state.session = null;
	} finally {
		state.ready = true;
	}
}

async function startSignIn<P extends AuthProviderId>(
	provider: P,
	credentials: AuthProviderCredentials[P]
): Promise<User> {
	const session = await signIn({ provider, credentials } as Parameters<typeof signIn>[0]);
	state.session = session;
	state.ready = true;
	return session.user;
}

async function endSession(): Promise<void> {
	try {
		await signOut();
	} finally {
		state.session = null;
		state.ready = true;
	}
}

export const auth = {
	get ready() {
		return state.ready;
	},
	get user() {
		return state.session?.user ?? null;
	},
	refresh,
	signIn: startSignIn,
	signOut: endSession
};
