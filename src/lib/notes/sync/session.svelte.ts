import { browser } from '$app/environment';
import { getSyncUser, signIn, signOut } from './sync.remote';

export type SyncSessionStatus = 'unknown' | 'signed-out' | 'signed-in';

export const syncSession = $state({
	status: 'unknown' as SyncSessionStatus,
	email: null as string | null
});

export async function refreshSyncSession(): Promise<void> {
	if (!browser) return;

	try {
		const user = await getSyncUser();
		syncSession.email = user?.email ?? null;
		syncSession.status = user ? 'signed-in' : 'signed-out';
	} catch {
		syncSession.email = null;
		syncSession.status = 'signed-out';
	}
}

export async function signInWithCredential(credential: string): Promise<string> {
	const { email } = await signIn({ credential });

	syncSession.email = email;
	syncSession.status = 'signed-in';

	return email;
}

export async function signOutSyncSession(): Promise<void> {
	try {
		await signOut();
	} finally {
		syncSession.email = null;
		syncSession.status = 'signed-out';
	}
}
