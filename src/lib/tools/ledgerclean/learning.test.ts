import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, UNCATEGORIZED_ID } from './category-model';
import {
	applyRules,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory,
	type Rule
} from './processing';
import { approveLearning, previewLearning } from './learning';
import {
	emptyWorkspace,
	loadWorkspace,
	persistWorkspace,
	WORKSPACE_KEY
} from './workspace-storage';
function rows() {
	const data = readCsv(
		'Date,Description,Amount\n2026-10-01,Local Studio,-50\n2026-10-02,Local Studio,-60\n2026-10-03,Other Merchant,-20'
	);
	return normalizeTransactions(data, defaultImportOptions(data.headers, 'test.csv', 'test'), [])
		.transactions;
}
describe('rules as categorization source of truth', () => {
	it('saves a rule, categorizes every matching row, and repeats after reload and future import without AI overrides', () => {
		const tx = rows();
		const result = approveLearning(
			tx,
			[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			[tx[0]],
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.savedCount).toBe(1);
		expect(result.updatedCount).toBe(2);
		expect(
			result.transactions
				.slice(0, 2)
				.every(
					(row) =>
						row.categoryId === CATEGORY_IDS.Entertainment &&
						row.categoryOverride === null &&
						row.categorySource === 'automatic'
				)
		).toBe(true);
		expect(
			applyRules(
				[{ ...tx[0], id: 'future', description: ' local   studio ', date: '2026-11-01' }],
				result.rules
			)[0].categoryId
		).toBe(CATEGORY_IDS.Entertainment);
		expect(
			applyRules([{ ...tx[0], description: 'Local Studio Supplies' }], result.rules)[0].categoryId
		).toBe(UNCATEGORIZED_ID);
		let raw = '';
		persistWorkspace(
			{ setItem: (_key, value) => (raw = value) },
			{
				...emptyWorkspace(),
				...result,
				imports: [
					{ id: 'test', name: 'test.csv', count: 3, amountMode: 'signed', expenses: 'negative' }
				]
			}
		);
		expect(JSON.parse(raw).transactions[0]).not.toHaveProperty('categoryId');
		const loaded = loadWorkspace({ getItem: (key) => (key === WORKSPACE_KEY ? raw : null) });
		expect(loaded.transactions.map((row) => row.categoryId)).toEqual(
			result.transactions.map((row) => row.categoryId)
		);
		const renamed = {
			...DEFAULT_CATEGORIES,
			[CATEGORY_IDS.Entertainment]: {
				...DEFAULT_CATEGORIES[CATEGORY_IDS.Entertainment],
				name: 'Fun'
			}
		};
		expect(applyRules(loaded.transactions, loaded.rules, renamed)[0].categoryId).toBe(
			CATEGORY_IDS.Entertainment
		);
	});
	it('previews all affected rows while keeping explicit manual exceptions', () => {
		const tx = setCategory(rows(), 'test:3', CATEGORY_IDS.Business);
		const proposal = [{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }];
		expect(
			previewLearning(tx, proposal, [], DEFAULT_CATEGORIES).affected.map((row) => row.id)
		).toEqual([tx[0].id]);
		const result = approveLearning(tx, proposal, [tx[0]], [], DEFAULT_CATEGORIES);
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Business);
		expect(result.transactions[1].categoryOverride?.source).toBe('manual');
	});
	it('blocks conflicting proposals atomically rather than storing AI one-off overrides', () => {
		const tx = rows();
		const mappings = [
			{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment },
			{ transactionId: tx[1].id, categoryId: CATEGORY_IDS.Business }
		];
		expect(() => approveLearning(tx, mappings, tx.slice(0, 2), [], DEFAULT_CATEGORIES)).toThrow(
			'conflicting'
		);
		const rules: Rule[] = [
			{
				keyword: 'STUDIO',
				categoryId: CATEGORY_IDS.Dining,
				source: 'manual',
				match: 'contains'
			}
		];
		expect(() =>
			approveLearning(tx, mappings.slice(0, 1), tx.slice(0, 1), rules, DEFAULT_CATEGORIES)
		).toThrow('conflicting');
		expect(tx[0].categoryOverride).toBeNull();
		expect(rules[0].categoryId).toBe(CATEGORY_IDS.Dining);
	});
	it('does not duplicate or change any existing matching rule', () => {
		const tx = rows();
		const rule: Rule = {
			keyword: 'LOCAL STUDIO',
			categoryId: CATEGORY_IDS.Entertainment,
			match: 'exact',
			source: 'ai'
		};
		const classified = applyRules(tx, [rule]);
		const result = approveLearning(
			classified,
			[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			classified.slice(0, 1),
			[rule],
			DEFAULT_CATEGORIES
		);
		expect(result.rules).toEqual([rule]);
		expect(result.savedCount).toBe(0);
		expect(result.transactions[0].categoryOverride).toBeNull();
		expect(() =>
			approveLearning(
				classified,
				[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Business }],
				classified.slice(0, 1),
				[rule],
				DEFAULT_CATEGORIES
			)
		).toThrow('conflicting');
	});
	it('does not create a rule or an override for an uncertain result', () => {
		const tx = rows();
		const result = approveLearning(
			tx,
			[{ transactionId: tx[0].id, categoryId: UNCATEGORIZED_ID }],
			tx.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.savedCount).toBe(0);
		expect(result.transactions[0].categoryOverride).toBeNull();
	});
	it('editing or deleting a learned rule immediately rederives its categories', () => {
		const tx = rows();
		const result = approveLearning(
			tx,
			[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			tx.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(
			applyRules(result.transactions, [{ ...result.rules[0], categoryId: CATEGORY_IDS.Health }])[0]
				.categoryId
		).toBe(CATEGORY_IDS.Health);
		expect(applyRules(result.transactions, [])[0].categoryId).toBe(UNCATEGORIZED_ID);
	});
	it('scopes spending rules so chequing deposits remain income and card refunds share the expense category', () => {
		const tx = rows().map((row) => ({ ...row, accountType: 'cash' as const }));
		const bank = approveLearning(
			tx,
			[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			tx.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		const deposit = { ...tx[0], id: 'deposit', amountCents: 5000, categoryId: CATEGORY_IDS.Income };
		expect(applyRules([deposit], bank.rules)[0].categoryId).toBe(CATEGORY_IDS.Income);
		const card = tx.map((row) => ({ ...row, accountType: 'credit' as const }));
		const credit = approveLearning(
			card,
			[{ transactionId: card[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			card.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(
			applyRules([{ ...card[0], id: 'refund', amountCents: 5000 }], credit.rules)[0].categoryId
		).toBe(CATEGORY_IDS.Entertainment);
		expect(applyRules([deposit], credit.rules)[0].categoryId).toBe(CATEGORY_IDS.Income);
	});
	it('does not modify selected manual overrides when suggesting global rules', () => {
		const tx = setCategory(rows(), 'test:2', CATEGORY_IDS.Health);
		const result = approveLearning(
			tx,
			[{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }],
			tx.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.rules).toEqual([]);
		expect(result.transactions[0].categoryId).toBe(CATEGORY_IDS.Health);
	});
	it('rejects stale, incomplete, duplicate, missing and out-of-scope references before writing rules', () => {
		const tx = rows();
		const proposal = [{ transactionId: tx[0].id, categoryId: CATEGORY_IDS.Entertainment }];
		expect(() =>
			approveLearning(
				setCategory(tx, tx[0].id, CATEGORY_IDS.Dining),
				proposal,
				tx.slice(0, 1),
				[],
				DEFAULT_CATEGORIES
			)
		).toThrow('changed');
		expect(() =>
			approveLearning(tx, [...proposal, ...proposal], tx.slice(0, 1), [], DEFAULT_CATEGORIES)
		).toThrow();
		expect(() => approveLearning(tx, [], tx.slice(0, 1), [], DEFAULT_CATEGORIES)).toThrow();
		expect(() =>
			approveLearning(
				tx,
				[{ ...proposal[0], transactionId: 'missing' }],
				tx.slice(0, 1),
				[],
				DEFAULT_CATEGORIES
			)
		).toThrow();
		expect(() =>
			approveLearning(
				tx,
				[{ ...proposal[0], categoryId: 'missing' }],
				tx.slice(0, 1),
				[],
				DEFAULT_CATEGORIES
			)
		).toThrow();
	});
});
