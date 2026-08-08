import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';
import type { AuthProvider } from './types';

let oauthClient: OAuth2Client | null = null;

function getClientId(): string {
	const clientId = env.PUBLIC_GOOGLE_CLIENT_ID;
	if (!clientId) throw error(500, 'PUBLIC_GOOGLE_CLIENT_ID is not configured');

	return clientId;
}

export const googleProvider: AuthProvider<string> = {
	async verify(credential) {
		const clientId = getClientId();
		oauthClient ??= new OAuth2Client(clientId);

		try {
			const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
			const payload = ticket.getPayload();

			if (!payload?.sub || !payload.email || !payload.email_verified) {
				throw error(401, 'Google account is missing a verified identity');
			}

			return {
				provider: 'google',
				subject: payload.sub,
				email: payload.email,
				emailVerified: true,
				name: payload.name ?? null,
				image: payload.picture ?? null
			};
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
			throw error(401, 'Invalid Google credential');
		}
	}
};
