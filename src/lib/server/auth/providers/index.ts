import type { AuthProviderCredentials, AuthProviderId } from '$lib/auth/types';
import { googleProvider } from './google';
import type { ExternalIdentity } from './types';

export async function verifyProviderIdentity<P extends AuthProviderId>(
	provider: P,
	credentials: AuthProviderCredentials[P]
): Promise<ExternalIdentity> {
	switch (provider) {
		case 'google':
			return googleProvider.verify((credentials as AuthProviderCredentials['google']).credential);
	}
}

export type { ExternalIdentity } from './types';
