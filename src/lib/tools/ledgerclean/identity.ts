import { normalizeDescription, type Transaction } from './processing';

export function transactionIdentity(row: Transaction): string {
	return JSON.stringify([
		normalizeDescription(row.account || 'Main account'),
		row.date,
		normalizeDescription(row.description),
		row.amountCents,
		row.currency.toUpperCase()
	]);
}

export type ImportBatch = { transactions: Transaction[]; keepDuplicates?: boolean };
/** Preserve multiplicity within a file; overlapping exports keep the largest observed count. */
export function planImport(existing: readonly Transaction[], batches: readonly ImportBatch[]) {
	const counts = new Map<string, number>();
	for (const row of existing) {
		const key = transactionIdentity(row);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return batches.map((batch) => {
		const seen = new Map<string, number>();
		const added: Transaction[] = [];
		const duplicates: Transaction[] = [];
		for (const row of batch.transactions) {
			const key = transactionIdentity(row);
			const occurrence = (seen.get(key) ?? 0) + 1;
			seen.set(key, occurrence);
			if (!batch.keepDuplicates && occurrence <= (counts.get(key) ?? 0)) duplicates.push(row);
			else added.push(row);
		}
		for (const [key, count] of seen)
			counts.set(
				key,
				batch.keepDuplicates
					? (counts.get(key) ?? 0) + count
					: Math.max(counts.get(key) ?? 0, count)
			);
		return { added, duplicates };
	});
}

/** Stable opaque IDs; existing IDs and edits survive every overlapping upload. */
export async function identifyTransactions(
	existing: readonly Transaction[],
	incoming: readonly Transaction[]
): Promise<Transaction[]> {
	const counts = new Map<string, number>();
	const ids = new Set(existing.map((row) => row.id));
	for (const row of existing) {
		const key = transactionIdentity(row);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const hashes = new Map<string, Promise<string>>();
	return Promise.all(
		incoming.map(async (row) => {
			const key = transactionIdentity(row);
			let occurrence = (counts.get(key) ?? 0) + 1;
			counts.set(key, occurrence);
			if (!hashes.has(key))
				hashes.set(
					key,
					crypto.subtle
						.digest('SHA-256', new TextEncoder().encode(key))
						.then((bytes) =>
							Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join(
								''
							)
						)
				);
			const hash = await hashes.get(key)!;
			let id = `tx_${hash}_${occurrence}`;
			// Sign/account corrections can change the fingerprint without changing the historical ID.
			while (ids.has(id)) id = `tx_${hash}_${++occurrence}`;
			ids.add(id);
			return { ...row, id };
		})
	);
}
