import { browser } from '$app/environment';
import { getAuthUser, signIn, signOut } from './auth.remote';

export type AuthSessionStatus = 'unknown' | 'signed-out' | 'signed-in';

export const authSession = $state({
	status: 'unknown' as AuthSessionStatus,
	user: null as { email: string } | null
});

let refreshPromise: Promise<void> | null = null;

export function initializeAuthSession(): Promise<void> {
	if (!browser || authSession.status !== 'unknown') return Promise.resolve();
	return refreshAuthSession();
}

export function refreshAuthSession(): Promise<void> {
	if (!browser) return Promise.resolve();

	refreshPromise ??= loadAuthSession().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}

async function loadAuthSession(): Promise<void> {
	try {
		const user = await getAuthUser();
		authSession.user = user ? { email: user.email } : null;
		authSession.status = user ? 'signed-in' : 'signed-out';
	} catch {
		authSession.user = null;
		authSession.status = 'signed-out';
	}
}

export async function signInWithGoogleCredential(credential: string): Promise<string> {
	const { email } = await signIn({ credential });

	authSession.user = { email };
	authSession.status = 'signed-in';

	return email;
}

export async function signOutAuthSession(): Promise<void> {
	try {
		await signOut();
	} finally {
		authSession.user = null;
		authSession.status = 'signed-out';
	}
}
