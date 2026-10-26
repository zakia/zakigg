import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dev } from '$app/env';
import { GCS_BUCKET } from '$app/env/private';
import { error } from '@sveltejs/kit';
import type { User } from '#lib/auth/types.js';
import { getAssetBucket } from '#lib/server/assets/gcs.js';
import { adminUser, verifyAdminPassword } from './admin';

const ACCOUNTS_OBJECT_PATH = 'auth/users.json';

export type StoredAccount = User & {
	role: 'admin' | 'member';
	passwordHash: string;
	createdAt: string;
};

export type AccountPersistence = {
	read(): Promise<StoredAccount[]>;
	write(accounts: StoredAccount[]): Promise<void>;
};

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const derived = scryptSync(password, salt, 64).toString('hex');
	return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
	const [scheme, salt, expectedHex] = storedHash.split('$');
	if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
	const actual = scryptSync(password, salt, 64);
	const expected = Buffer.from(expectedHex, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

export function createAccountStore(persistence?: AccountPersistence) {
	const byId = new Map<string, StoredAccount>();
	const byEmail = new Map<string, StoredAccount>();
	let hydrated = !persistence;
	let hydrationPromise: Promise<void> | null = null;
	let writes: Promise<unknown> = Promise.resolve();

	function indexAccounts(accounts: StoredAccount[]) {
		byId.clear();
		byEmail.clear();
		for (const account of accounts) {
			byId.set(account.id, account);
			if (account.email) {
				byEmail.set(account.email.trim().toLowerCase(), account);
			}
		}
		hydrated = true;
	}

	async function ensureHydrated() {
		if (hydrated || !persistence) return;
		hydrationPromise ??= persistence
			.read()
			.then(indexAccounts)
			.finally(() => {
				hydrationPromise = null;
			});
		await hydrationPromise;
	}

	function toUser(account: StoredAccount): User {
		return {
			id: account.id,
			email: account.email,
			name: account.name,
			image: account.image
		};
	}

	return {
		async list(): Promise<User[]> {
			await ensureHydrated();
			return [...byId.values()].map(toUser);
		},
		async getById(id: string): Promise<User | null> {
			await ensureHydrated();
			const account = byId.get(id);
			return account ? toUser(account) : null;
		},
		async create(input: {
			id?: string;
			email: string;
			name?: string | null;
			image?: string | null;
			password: string;
			role?: 'admin' | 'member';
		}): Promise<User> {
			const created = writes.then(async () => {
				await ensureHydrated();
				const normalizedEmail = input.email.trim().toLowerCase();
				if (!normalizedEmail) throw error(400, 'Email is required');
				if (byEmail.has(normalizedEmail)) {
					throw error(409, 'An account with this email already exists');
				}
				const account: StoredAccount = {
					id: input.id ?? `user_${randomBytes(12).toString('hex')}`,
					email: normalizedEmail,
					name: input.name ?? null,
					image: input.image ?? null,
					role: input.role ?? 'member',
					passwordHash: hashPassword(input.password),
					createdAt: new Date().toISOString()
				};
				byId.set(account.id, account);
				byEmail.set(normalizedEmail, account);
				if (persistence) {
					await persistence.write([...byId.values()]);
				}
				return toUser(account);
			});
			writes = created.catch(() => {});
			return created;
		},
		async authenticate(credentials: { email?: string; password: string }): Promise<User> {
			await ensureHydrated();
			const normalizedEmail = credentials.email?.trim().toLowerCase();
			if (normalizedEmail) {
				const account = byEmail.get(normalizedEmail);
				if (!account || !verifyPasswordHash(credentials.password, account.passwordHash)) {
					throw error(401, 'Incorrect email or password');
				}
				return toUser(account);
			}
			verifyAdminPassword(credentials.password);
			return adminUser();
		}
	};
}

export function createGcsAccountPersistence(bucket = getAssetBucket()): AccountPersistence {
	return {
		async read() {
			const file = bucket.file(ACCOUNTS_OBJECT_PATH);
			try {
				const [buffer] = await file.download();
				const parsed: unknown = JSON.parse(buffer.toString('utf8'));
				return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
			} catch (cause) {
				if ((cause as { code?: number })?.code === 404) return [];
				throw cause;
			}
		},
		async write(accounts) {
			await bucket
				.file(ACCOUNTS_OBJECT_PATH)
				.save(Buffer.from(JSON.stringify(accounts, null, '\t') + '\n', 'utf8'), {
					contentType: 'application/json; charset=utf-8',
					resumable: false
				});
		}
	};
}

let accountStore: ReturnType<typeof createAccountStore> | null = null;

export function getAccountStore() {
	if (accountStore) return accountStore;
	accountStore = createAccountStore(!dev && GCS_BUCKET ? createGcsAccountPersistence() : undefined);
	return accountStore;
}
