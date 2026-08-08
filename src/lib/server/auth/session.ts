import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';

// Firebase Hosting only forwards this specially named cookie to Cloud Run.
export const SESSION_COOKIE_NAME = '__session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthUser = {
	sub: string;
	email: string;
};

type SessionPayload = AuthUser & { expiresAt: number };

let oauthClient: OAuth2Client | null = null;

function getSessionSecret(): string {
	const secret = env.AUTH_SESSION_SECRET || env.NOTES_SYNC_SESSION_SECRET;
	if (!secret) throw error(500, 'AUTH_SESSION_SECRET is not configured');

	return secret;
}

export function getGoogleClientId(): string {
	const clientId = publicEnv.PUBLIC_GOOGLE_CLIENT_ID;
	if (!clientId) throw error(500, 'PUBLIC_GOOGLE_CLIENT_ID is not configured');

	return clientId;
}

export async function verifyGoogleCredential(credential: string): Promise<AuthUser> {
	const clientId = getGoogleClientId();
	const allowedEmail = getAllowedEmail();
	if (!allowedEmail) throw error(500, 'AUTH_ALLOWED_EMAIL is not configured');

	oauthClient ??= new OAuth2Client(clientId);

	try {
		const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
		const payload = ticket.getPayload();
		const email = payload?.email;
		const sub = payload?.sub;

		if (!sub || !email || !payload.email_verified) {
			throw error(401, 'Google account is missing a verified identity');
		}
		if (email.toLowerCase() !== allowedEmail.toLowerCase()) {
			throw error(403, 'This account is not allowed');
		}

		return { sub, email };
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		throw error(401, 'Invalid Google credential');
	}
}

export function createSessionCookieValue(user: AuthUser): string {
	const payload: SessionPayload = {
		...user,
		expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${encodedPayload}.${signSession(encodedPayload)}`;
}

export function verifySessionCookieValue(value: string): AuthUser | null {
	const [encodedPayload, signature] = value.split('.');
	if (!encodedPayload || !signature) return null;

	let expected: string;
	try {
		expected = signSession(encodedPayload);
	} catch {
		return null;
	}

	const expectedBuffer = Buffer.from(expected);
	const actualBuffer = Buffer.from(signature);
	if (expectedBuffer.length !== actualBuffer.length) return null;
	if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

	try {
		const payload = JSON.parse(
			Buffer.from(encodedPayload, 'base64url').toString('utf8')
		) as Partial<SessionPayload>;
		const allowedEmail = getAllowedEmail();

		if (
			typeof payload.sub !== 'string' ||
			typeof payload.email !== 'string' ||
			typeof payload.expiresAt !== 'number' ||
			payload.expiresAt * 1000 < Date.now() ||
			!allowedEmail ||
			payload.email.toLowerCase() !== allowedEmail.toLowerCase()
		)
			return null;

		return { sub: payload.sub, email: payload.email };
	} catch {
		return null;
	}
}

export function assertAuthUser(locals: App.Locals): AuthUser {
	if (!locals.user) throw error(401, 'Sign in to continue');
	return locals.user;
}

function signSession(encodedPayload: string): string {
	return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
}

function getAllowedEmail(): string | undefined {
	return env.AUTH_ALLOWED_EMAIL || env.NOTES_SYNC_ALLOWED_EMAIL;
}
