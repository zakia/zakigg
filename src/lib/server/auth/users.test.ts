import { describe, expect, it } from 'vitest';
import { createAccountStore, type StoredAccount } from './users';

describe('In-memory KV account store', () => {
	it('creates, persists, and authenticates multiple user accounts in memory', async () => {
		let persisted: StoredAccount[] = [];
		const store = createAccountStore({
			async read() {
				return persisted;
			},
			async write(accounts) {
				persisted = accounts;
			}
		});

		const alice = await store.create({
			email: 'Alice@Example.com',
			name: 'Alice',
			password: 'correct-horse-battery-staple'
		});

		expect(alice.email).toBe('alice@example.com');
		expect(persisted).toHaveLength(1);
		expect(persisted[0].passwordHash).toMatch(/^scrypt\$/);

		const signedIn = await store.authenticate({
			email: 'alice@example.com',
			password: 'correct-horse-battery-staple'
		});
		expect(signedIn).toEqual(alice);

		await expect(
			store.authenticate({
				email: 'alice@example.com',
				password: 'wrong-password'
			})
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects duplicate emails', async () => {
		const store = createAccountStore();
		await store.create({ email: 'user@example.com', password: 'password-1' });

		await expect(
			store.create({ email: 'USER@example.com', password: 'password-2' })
		).rejects.toMatchObject({ status: 409 });
	});
});
