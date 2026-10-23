import { describe, it, expect, vi } from 'vitest';
import { merchantGroups } from './merchants';
import { consolidateMerchantRules } from './merchant-rules';
import { categorizeWithAi, type CategoryClassifier, type TagProposal } from './ai';
import { approveLearning, previewLearning } from './learning';
import { DEFAULT_CATEGORIES, CATEGORY_IDS } from './category-model';
import {
	applyRules,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory,
	type Rule
} from './processing';
import { emptyWorkspace, persistWorkspace, loadWorkspace } from './workspace-storage';
const descriptions = [
	'PRESTO FARE/QZ6BMGRHN6 TORONTO',
	'PRESTO FARE/QZPCX7BLXX TORONTO',
	'AMZN MKTP CA*5R50X7GI0 866-216-1072',
	'AMZN MKTP CA*5R7Z12G2I 866-216-1072'
];
function rows(names = descriptions) {
	const data = readCsv(
		'Date,Description,Amount\n' + names.map((name) => `2026-10-01,${name},-10`).join('\n')
	);
	return normalizeTransactions(
		data,
		defaultImportOptions(data.headers, 'synthetic.csv', 'merchants'),
		[]
	).transactions;
}
const proposal = (tx: ReturnType<typeof rows>): TagProposal =>
	tx.map((row, i) => ({
		transactionId: row.id,
		categoryId: i < 2 ? CATEGORY_IDS.Transport : CATEGORY_IDS.Shopping
	}));
describe('merchant grouping and deterministic rules', () => {
	it('extracts stable PRESTO and AMZN prefixes without modifying original facts', () => {
		const tx = rows(),
			snapshot = structuredClone(tx);
		expect([...merchantGroups(tx).values()]).toEqual([
			'PRESTO FARE',
			'PRESTO FARE',
			'AMZN MKTP CA',
			'AMZN MKTP CA'
		]);
		expect(tx).toEqual(snapshot);
	});
	it('requires distinct reference evidence and avoids generic processors, unrelated brands and differing bank labels', () => {
		const names = [
			'PRESTO FARE/QZ6BMGRHN6 TORONTO',
			'PRESTO FARE/QZ6BMGRHN6 TORONTO',
			'SQ *123456 TORONTO',
			'SQ *654321 TORONTO',
			'AMZN PRIME*5R50X7GI0',
			'AMZN MKTP CA*5R7Z12G2I'
		];
		expect(merchantGroups(rows(names)).size).toBe(0);
		const tx = rows()
			.slice(0, 2)
			.map((row, i) => ({ ...row, sourceCategory: i ? 'Business' : 'Transport' }));
		expect(merchantGroups(tx).size).toBe(0);
	});
	it('groups changing branch numbers without discarding meaningful merchant names', () => {
		const tx = rows([
			'LOCAL COFFEE 001 TORONTO',
			'LOCAL COFFEE 002 TORONTO',
			'ONLINE BILL PAYMENT 123456',
			'ONLINE BILL PAYMENT 654321'
		]);
		expect([...merchantGroups(tx).values()]).toEqual(['LOCAL COFFEE', 'LOCAL COFFEE']);
	});
	it('keeps differing accounts and bank money directions separate while grouping card refunds', () => {
		const tx = rows().slice(0, 2);
		expect(merchantGroups([tx[0], { ...tx[1], accountType: 'cash' }]).size).toBe(0);
		expect(merchantGroups([tx[0], { ...tx[1], amountCents: 1000 }]).size).toBe(0);
		expect(
			merchantGroups(
				tx.map((row, i) => ({ ...row, accountType: 'credit', amountCents: i ? 1000 : -1000 }))
			).size
		).toBe(2);
	});
	it('classifies each merchant once and expands suggestions to all requested transactions', async () => {
		const classify: CategoryClassifier = vi.fn(
			async (input: Parameters<CategoryClassifier>[0]) => ({
				assignments: input.transactions.map((row) => ({
					t: row.t,
					c: row.d === 'PRESTO FARE' ? 'Transport' : 'Shopping and Personal'
				}))
			})
		);
		const tx = rows();
		expect(
			await categorizeWithAi(
				classify,
				tx,
				DEFAULT_CATEGORIES,
				new AbortController().signal,
				undefined,
				'',
				[],
				[]
			)
		).toEqual(proposal(tx));
		expect(vi.mocked(classify).mock.calls[0][0].transactions.map((row) => row.d)).toEqual([
			'PRESTO FARE',
			'AMZN MKTP CA'
		]);
	});
	it('learns two reusable rules and tags unseen references with token boundaries', () => {
		const tx = rows();
		const result = approveLearning(tx, proposal(tx), tx, [], DEFAULT_CATEGORIES);
		expect(result.rules.map((rule) => [rule.keyword, rule.match])).toEqual([
			['AMZN MKTP CA', 'merchant'],
			['PRESTO FARE', 'merchant']
		]);
		const future = rows([
			'PRESTO FARE/NEW987654 TORONTO',
			'AMZN MKTP CA*NEW987654 866-216-1072',
			'NOT PRESTO FARE/NEW987654',
			'PRESTO FARES/NEW987654',
			'AMZN PRIME*NEW987654'
		]);
		expect(applyRules(future, result.rules).map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Transport,
			CATEGORY_IDS.Shopping,
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Uncategorized
		]);
		expect(result.transactions.every((row) => row.categoryOverride === null)).toBe(true);
	});
	it('can learn a merchant rule from one selected row using other imported descriptions as evidence', () => {
		const tx = rows();
		const result = approveLearning(
			tx,
			proposal(tx).slice(0, 1),
			tx.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.rules[0]).toMatchObject({ keyword: 'PRESTO FARE', match: 'merchant' });
		expect(result.updatedCount).toBe(2);
	});
	it('protects manual exceptions and rejects conflicting group proposals or existing rules', () => {
		const tx = rows();
		const conflicting = proposal(tx);
		conflicting[1].categoryId = CATEGORY_IDS.Business;
		expect(previewLearning(tx, conflicting, [], DEFAULT_CATEGORIES).conflicts).toHaveLength(1);
		const manual = setCategory(tx, tx[1].id, CATEGORY_IDS.Business);
		const result = approveLearning(
			manual,
			proposal(manual).slice(0, 1),
			manual.slice(0, 1),
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Business);
		expect(result.transactions[1].categoryOverride?.source).toBe('manual');
		const rules: Rule[] = [
			{
				keyword: tx[1].description,
				categoryId: CATEGORY_IDS.Business,
				match: 'exact',
				source: 'manual'
			}
		];
		expect(previewLearning(tx, proposal(tx), rules, DEFAULT_CATEGORIES).conflicts).toHaveLength(1);
	});
	it('consolidates existing AI exact rules after reload while preserving user rules, scopes, IDs and amounts', () => {
		const tx = rows();
		const rules: Rule[] = proposal(tx).map((mapping, i) => ({
			keyword: tx[i].description,
			categoryId: mapping.categoryId,
			match: 'exact',
			source: 'ai',
			direction: 'out'
		}));
		const manual: Rule = { keyword: 'OTHER', categoryId: CATEGORY_IDS.Business, source: 'manual' };
		let raw = '';
		persistWorkspace(
			{ setItem: (_key, value) => (raw = value) },
			{
				...emptyWorkspace(),
				rules: [...rules, manual],
				transactions: tx,
				imports: [
					{
						id: 'merchants',
						name: 'synthetic.csv',
						count: 4,
						amountMode: 'signed',
						expenses: 'negative'
					}
				]
			}
		);
		const loaded = loadWorkspace({ getItem: () => raw });
		expect(loaded.rules).toHaveLength(3);
		expect(loaded.rules).toContainEqual(manual);
		expect(
			loaded.rules
				.filter((rule) => rule.match === 'merchant')
				.every((rule) => rule.direction === 'out')
		).toBe(true);
		expect(loaded.transactions.map((row) => [row.id, row.amountCents, row.description])).toEqual(
			tx.map((row) => [row.id, row.amountCents, row.description])
		);
		expect(loaded.transactions.map((row) => row.categoryId)).toEqual(
			proposal(tx).map((item) => item.categoryId)
		);
		expect(consolidateMerchantRules(loaded.transactions, loaded.rules, loaded.categories)).toEqual(
			loaded.rules
		);
	});
	it('does not consolidate conflicting, manually authored or historical scoped rules', () => {
		const tx = rows().slice(0, 2);
		const rules: Rule[] = tx.map((row) => ({
			keyword: row.description,
			categoryId: CATEGORY_IDS.Transport,
			match: 'exact',
			source: 'ai'
		}));
		for (const changed of [
			rules.map((rule, i) => ({
				...rule,
				categoryId: i ? CATEGORY_IDS.Business : rule.categoryId
			})),
			rules.map((rule) => ({ ...rule, source: 'manual' as const })),
			rules.map((rule) => ({ ...rule, excludedTransactionIds: [tx[0].id] }))
		]) {
			expect(consolidateMerchantRules(tx, changed, DEFAULT_CATEGORIES)).toEqual(changed);
		}
	});
	it('does not relearn a saved merchant rule', () => {
		const tx = rows();
		const result = approveLearning(tx, proposal(tx), tx, [], DEFAULT_CATEGORIES);
		expect(
			approveLearning(
				result.transactions,
				proposal(result.transactions),
				result.transactions,
				result.rules,
				DEFAULT_CATEGORIES
			).savedCount
		).toBe(0);
	});
});
