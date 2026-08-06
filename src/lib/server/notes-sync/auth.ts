import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';

export const SESSION_COOKIE_NAME = 'notes_sync_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

let oauthClient: OAuth2Client | null = null;

function getSessionSecret(): string {
	const secret = env.NOTES_SYNC_SESSION_SECRET;
	if (!secret) throw error(500, 'NOTES_SYNC_SESSION_SECRET is not configured');

	return secret;
}

export function getGoogleClientId(): string {
	const clientId = publicEnv.PUBLIC_GOOGLE_CLIENT_ID;
	if (!clientId) throw error(500, 'PUBLIC_GOOGLE_CLIENT_ID is not configured');

	return clientId;
}

// Verifies a Google Identity Services ID-token credential and enforces the
// single-user allowlist. Returns the verified email.
export async function verifyGoogleCredential(credential: string): Promise<string> {
	const clientId = getGoogleClientId();
	const allowedEmail = env.NOTES_SYNC_ALLOWED_EMAIL;

	if (!allowedEmail) throw error(500, 'NOTES_SYNC_ALLOWED_EMAIL is not configured');

	oauthClient ??= new OAuth2Client(clientId);

	let email: string | undefined;
	let emailVerified: boolean | undefined;

	try {
		const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: clientId });
		const payload = ticket.getPayload();
		email = payload?.email;
		emailVerified = payload?.email_verified;
	} catch {
		throw error(401, 'Invalid Google credential');
	}

	if (!email || !emailVerified) throw error(401, 'Google account email is not verified');
	if (email.toLowerCase() !== allowedEmail.toLowerCase()) {
		throw error(403, 'This account is not allowed to sync notes');
	}

	return email;
}

// Stateless session cookie: base64url(email).expiryEpochSeconds.hmac
export function createSessionCookieValue(email: string): string {
	const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
	const encodedEmail = Buffer.from(email, 'utf8').toString('base64url');
	const signature = signSession(encodedEmail, expiry);

	return `${encodedEmail}.${expiry}.${signature}`;
}

export function verifySessionCookieValue(value: string): { email: string } | null {
	const [encodedEmail, expiryRaw, signature] = value.split('.');
	if (!encodedEmail || !expiryRaw || !signature) return null;

	const expiry = Number(expiryRaw);
	if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return null;

	let expected: string;
	try {
		expected = signSession(encodedEmail, expiry);
	} catch {
		// Session secret not configured; treat every session as invalid.
		return null;
	}

	const expectedBuffer = Buffer.from(expected);
	const actualBuffer = Buffer.from(signature);
	if (expectedBuffer.length !== actualBuffer.length) return null;
	if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

	return { email: Buffer.from(encodedEmail, 'base64url').toString('utf8') };
}

export function assertSyncUser(locals: App.Locals): { email: string } {
	if (!locals.syncUser) throw error(401, 'Sign in to sync notes');

	return locals.syncUser;
}

function signSession(encodedEmail: string, expiry: number): string {
	return createHmac('sha256', getSessionSecret())
		.update(`${encodedEmail}.${expiry}`)
		.digest('base64url');
}
