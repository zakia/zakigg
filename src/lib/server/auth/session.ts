import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { Session, User } from '$lib/auth/types';

// Firebase Hosting only forwards this specially named cookie to Cloud Run.
export const SESSION_COOKIE_NAME = '__session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = Session & { issuedAt: number };
type LegacySessionPayload = {
	sub: string;
	email: string;
	expiresAt: number;
};

function getSessionSecret(): string {
	const secret = env.AUTH_SESSION_SECRET || env.NOTES_SYNC_SESSION_SECRET;
	if (!secret) throw error(500, 'AUTH_SESSION_SECRET is not configured');

	return secret;
}

export function createSession(user: User): Session {
	return {
		user,
		expires: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
	};
}

export function createSessionCookieValue(session: Session): string {
	const payload: SessionPayload = {
		...session,
		issuedAt: Math.floor(Date.now() / 1000)
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${encodedPayload}.${signSession(encodedPayload)}`;
}

export function verifySessionCookieValue(value: string): Session | null {
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
		) as Partial<SessionPayload & LegacySessionPayload>;

		const session = parseCurrentSession(payload) ?? parseLegacySession(payload);
		if (!session || session.expires * 1000 < Date.now()) return null;
		if (!isAllowedEmail(session.user.email)) return null;

		return session;
	} catch {
		return null;
	}
}

function parseCurrentSession(payload: Partial<SessionPayload>): Session | null {
	const user = payload.user;
	if (
		!user ||
		typeof user.id !== 'string' ||
		(user.email !== null && typeof user.email !== 'string') ||
		(user.name !== null && typeof user.name !== 'string') ||
		(user.image !== null && typeof user.image !== 'string') ||
		typeof payload.expires !== 'number'
	)
		return null;

	return { user, expires: payload.expires };
}

function parseLegacySession(payload: Partial<LegacySessionPayload>): Session | null {
	if (
		typeof payload.sub !== 'string' ||
		typeof payload.email !== 'string' ||
		typeof payload.expiresAt !== 'number'
	)
		return null;

	return {
		user: {
			id: payload.sub,
			email: payload.email,
			name: null,
			image: null
		},
		expires: payload.expiresAt
	};
}

function signSession(encodedPayload: string): string {
	return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url');
}

function isAllowedEmail(email: string | null): boolean {
	const allowedEmail = env.AUTH_ALLOWED_EMAIL || env.NOTES_SYNC_ALLOWED_EMAIL;
	return Boolean(email && allowedEmail && email.toLowerCase() === allowedEmail.toLowerCase());
}
