import { describe, expect, it } from 'vitest';
import {
	exportTransactions,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory
} from './processing';
import { CATEGORY_IDS } from './category-model';
import { identifyTransactions, planImport, transactionIdentity } from './identity';
function rows(text = '2026-10-01,Corner Shop,-10\n2026-10-01,Corner Shop,-10', file = 'first') {
	const csv = readCsv(`Date,Description,Amount\n${text}`);
	return normalizeTransactions(csv, defaultImportOptions(csv.headers, `${file}.csv`, file))
		.transactions;
}
describe('overlapping CSV identity', () => {
	it('keeps repeated identical purchases within a file and skips matching occurrences across exports', () => {
		const first = rows();
		expect(planImport([], [{ transactions: first }])[0].added).toHaveLength(2);
		const incoming = rows(
			'2026-10-01,corner   shop,-10\n2026-10-01,Corner Shop,-10\n2026-10-01,Corner Shop,-10\n2026-10-02,Corner Shop,-10',
			'overlap'
		);
		const plan = planImport(first, [{ transactions: incoming }])[0];
		expect(plan.duplicates).toHaveLength(2);
		expect(plan.added.map((row) => row.date)).toEqual(['2026-10-01', '2026-10-02']);
	});
	it('deduplicates across multiple staged files regardless of filename or row ordering', () => {
		const first = rows();
		const next = rows('2026-10-02,Elsewhere,-20\n2026-10-01,Corner Shop,-10', 'renamed');
		const plan = planImport(
			[],
			[{ transactions: first }, { transactions: next }, { transactions: [...next].reverse() }]
		);
		expect(plan.map((file) => file.added.length)).toEqual([2, 1, 0]);
		expect(plan.map((file) => file.duplicates.length)).toEqual([0, 1, 2]);
	});
	it('separates accounts, currencies, dates, signs and distinct description references', () => {
		const row = rows()[0];
		for (const changed of [
			{ ...row, account: 'Other card' },
			{ ...row, currency: 'USD' },
			{ ...row, date: '2026-10-02' },
			{ ...row, amountCents: 1000 },
			{ ...row, description: 'Corner Shop #2' }
		]) {
			expect(transactionIdentity(changed)).not.toBe(transactionIdentity(row));
			expect(planImport([row], [{ transactions: [changed] }])[0].added).toHaveLength(1);
		}
		expect(
			transactionIdentity({ ...row, description: ' CORNER\tSHOP ', account: 'main ACCOUNT' })
		).toBe(transactionIdentity(row));
	});
	it('lets users keep possible duplicates and preserves existing IDs and overrides', async () => {
		const existing = setCategory(
			await identifyTransactions([], rows()),
			'unused',
			CATEGORY_IDS.Dining
		);
		const edited = setCategory(existing, existing[0].id, CATEGORY_IDS.Dining);
		const plan = planImport(edited, [{ transactions: rows(), keepDuplicates: true }])[0];
		const added = await identifyTransactions(edited, plan.added);
		expect(plan.duplicates).toHaveLength(0);
		expect(new Set([...edited, ...added].map((row) => row.id)).size).toBe(4);
		expect(edited[0].categoryOverride?.categoryId).toBe(CATEGORY_IDS.Dining);
		expect(planImport(edited, [{ transactions: rows() }])[0].duplicates).toHaveLength(2);
	});
	it('generates stable SHA-256 IDs with occurrence suffixes independent of import metadata', async () => {
		const first = await identifyTransactions([], rows());
		const second = await identifyTransactions([], rows(undefined, 'other-file'));
		expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
		expect(first[0].id).toMatch(/^tx_[a-f0-9]{64}_1$/);
		expect(first[1].id).toBe(first[0].id.replace(/_1$/, '_2'));
		expect(transactionIdentity({ ...first[0], categoryId: CATEGORY_IDS.Shopping })).toBe(
			transactionIdentity(first[0])
		);
	});
	it('preserves account scopes through CSV export and reimport', () => {
		const tx = rows().map((row, index) => ({
			...row,
			account: index ? 'Other card' : 'Main card'
		}));
		const csv = readCsv(exportTransactions(tx));
		const parsed = normalizeTransactions(
			csv,
			defaultImportOptions(csv.headers, 'export.csv', 'export')
		).transactions;
		expect(parsed.map((row) => row.account)).toEqual(['Main card', 'Other card']);
		expect(planImport(tx, [{ transactions: parsed }])[0].duplicates).toHaveLength(2);
	});
	it('keeps historical IDs after corrections and avoids reusing an occupied hash ID', async () => {
		const row = (await identifyTransactions([], rows('2026-10-01,Corner Shop,-10')))[0];
		const corrected = { ...row, amountCents: 1000 };
		const incoming = await identifyTransactions([corrected], [rows()[0]]);
		expect(incoming[0].id).not.toBe(corrected.id);
		expect(incoming[0].id).toMatch(/_2$/);
	});
});
