import { createHash, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD } from '$app/env/private';
import { error } from '@sveltejs/kit';
import type { User } from '#lib/auth/types.js';

export function adminUser(): User {
	return { id: 'admin', email: null, name: 'Admin', image: null };
}

export function verifyAdminPassword(password: string): void {
	const expected = ADMIN_PASSWORD;
	if (!expected) throw error(500, 'ADMIN_PASSWORD is not configured');

	const actual = createHash('sha256').update(password).digest();
	const match = createHash('sha256').update(expected).digest();
	if (!timingSafeEqual(actual, match)) throw error(401, 'Incorrect password');
}
