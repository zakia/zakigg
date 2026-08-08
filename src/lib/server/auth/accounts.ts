import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { User } from '$lib/auth/types';
import type { ExternalIdentity } from './providers';

export async function resolveUser(identity: ExternalIdentity): Promise<User> {
	const allowedEmail = env.AUTH_ALLOWED_EMAIL || env.NOTES_SYNC_ALLOWED_EMAIL;
	if (!allowedEmail) throw error(500, 'AUTH_ALLOWED_EMAIL is not configured');
	if (!identity.email || !identity.emailVerified) {
		throw error(401, 'A verified email address is required');
	}
	if (identity.email.toLowerCase() !== allowedEmail.toLowerCase()) {
		throw error(403, 'This account is not allowed');
	}

	return {
		// Keep the existing storage namespace stable. Once another provider is
		// linked, the account resolver can map both identities to this opaque ID.
		id: identity.subject,
		email: identity.email,
		name: identity.name,
		image: identity.image
	};
}
