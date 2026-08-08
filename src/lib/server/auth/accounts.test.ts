import { afterEach, describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted<Record<string, string | undefined>>(() => ({}));

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));

import { resolveUser } from './accounts';

const identity = {
	provider: 'test-provider',
	subject: 'provider-subject',
	email: 'owner@example.com',
	emailVerified: true,
	name: 'Owner',
	image: null
};

describe('auth account resolution', () => {
	afterEach(() => {
		delete privateEnv.AUTH_ALLOWED_EMAIL;
	});

	it('maps a provider identity to the provider-independent user shape', async () => {
		privateEnv.AUTH_ALLOWED_EMAIL = 'owner@example.com';

		await expect(resolveUser(identity)).resolves.toEqual({
			id: 'provider-subject',
			email: 'owner@example.com',
			name: 'Owner',
			image: null
		});
	});

	it('applies account access policy outside the provider adapter', async () => {
		privateEnv.AUTH_ALLOWED_EMAIL = 'someone-else@example.com';

		await expect(resolveUser(identity)).rejects.toMatchObject({ status: 403 });
	});
});
