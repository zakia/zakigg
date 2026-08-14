import type { AuthProviderCredentials, AuthProviderId } from './types';
import { renderGoogleSignInButton } from './google-signin';

type CredentialHandler<P extends AuthProviderId> = (
	credentials: AuthProviderCredentials[P]
) => void;

type AuthProviderButtonOptions = {
	colorScheme: 'light' | 'dark';
};

export function renderAuthProviderButton<P extends AuthProviderId>(
	provider: P,
	container: HTMLElement,
	onCredentials: CredentialHandler<P>,
	options: AuthProviderButtonOptions
): Promise<void> {
	switch (provider) {
		case 'google':
			return renderGoogleSignInButton(
				container,
				(credential) => onCredentials({ credential } as AuthProviderCredentials[P]),
				options
			);
	}
}
