import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_CATEGORIES, CATEGORY_IDS } from './category-model';
import { categorizeWithAi, type CategoryClassifier, type TagProposal } from './ai';
import { approveLearning, previewLearning, reviewLearningGroups } from './learning';
import {
	applyRules,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory,
	ruleKey,
	type Rule
} from './processing';
const categories = DEFAULT_CATEGORIES;
function rows(names = ['LOCAL STUDIO', 'LOCAL STUDIO* TORONTO', 'OTHER MERCHANT']) {
	const csv = readCsv(
		'Date,Description,Amount\n' + names.map((name) => `2026-10-01,${name},-10`).join('\n')
	);
	return normalizeTransactions(csv, defaultImportOptions(csv.headers, 'test.csv', 'reconsider'))
		.transactions;
}
const old: Rule = {
	keyword: '^LOCAL STUDIO(?:\\*.*)?$',
	match: 'regex',
	direction: 'out',
	categoryId: CATEGORY_IDS.Entertainment,
	source: 'manual'
};
const unrelated: Rule = {
	keyword: 'OTHER MERCHANT',
	match: 'exact',
	categoryId: CATEGORY_IDS.Business,
	source: 'manual'
};
function classifier(category = 'Health') {
	return vi.fn<CategoryClassifier>(async (input) => ({
		assignments: input.transactions.map((row) => ({
			t: row.t,
			c: category,
			confidence: { score: 0.8, margin: 0.3 }
		}))
	}));
}
const approve = (proposal: TagProposal) => proposal.map((item) => ({ ...item, reviewed: true }));
describe('explicit merchant reconsideration', () => {
	it('keeps approved rules on default runs but classifies a selected saved group without using its own rule as evidence', async () => {
		const rules = [old, unrelated];
		const tx = applyRules(rows(), rules);
		const generate = classifier();
		await categorizeWithAi(
			generate,
			tx.slice(0, 2),
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			rules
		);
		expect(generate).not.toHaveBeenCalled();
		const proposal = await categorizeWithAi(
			generate,
			tx.slice(0, 2),
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			rules,
			{ reconsider: true }
		);
		const input = generate.mock.calls[0][0];
		expect(input.transactions).toHaveLength(1);
		expect(input.transactions[0].currentCategory).toBeUndefined();
		expect(input.rules?.some((rule) => rule.keyword === old.keyword)).toBe(false);
		expect(input.rules?.some((rule) => rule.keyword === unrelated.keyword)).toBe(true);
		expect(
			proposal.every(
				(item) =>
					item.reconsidered &&
					item.categoryId === CATEGORY_IDS.Health &&
					JSON.stringify(item.replacesRule) === JSON.stringify(old)
			)
		).toBe(true);
		expect(reviewLearningGroups(tx.slice(0, 2), tx, proposal, rules, categories)[0].selected).toBe(
			false
		);
		expect(() => approveLearning(tx, proposal, tx.slice(0, 2), rules, categories)).toThrow(
			'Review reconsidered'
		);
		const preview = previewLearning(tx, approve(proposal), rules, categories);
		expect(preview.rules[0]).toMatchObject({
			keyword: old.keyword,
			match: old.match,
			direction: old.direction,
			categoryId: CATEGORY_IDS.Health
		});
		expect(preview.conflicts).toEqual([]);
		const result = approveLearning(tx, approve(proposal), tx.slice(0, 2), rules, categories);
		expect(result.rules).toHaveLength(2);
		expect(result.rules).toContainEqual(unrelated);
		expect(result.rules.find((rule) => ruleKey(rule) === ruleKey(old))?.confidence?.score).toBe(
			0.8
		);
		expect(result.transactions.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Health,
			CATEGORY_IDS.Health,
			CATEGORY_IDS.Business
		]);
		expect(applyRules(rows(['LOCAL STUDIO* NEW BRANCH']), result.rules)[0].categoryId).toBe(
			CATEGORY_IDS.Health
		);
	});
	it('refreshes scores for the same category only after approval', async () => {
		const tx = applyRules(rows(), [old]);
		const proposal = await categorizeWithAi(
			classifier('Entertainment'),
			tx.slice(0, 2),
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			[old],
			{ reconsider: true }
		);
		const result = approveLearning(tx, approve(proposal), tx.slice(0, 2), [old], categories);
		expect(result.savedCount).toBe(1);
		expect(result.updatedCount).toBe(0);
		expect(result.rules[0].confidence).toEqual({ score: 0.8, margin: 0.3 });
	});
	it('rejects stale or forged replacement snapshots, without bypassing unrelated rule conflicts', async () => {
		const tx = applyRules(rows(), [old]);
		const proposal = await categorizeWithAi(
			classifier(),
			tx.slice(0, 2),
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			[old],
			{ reconsider: true }
		);
		expect(() =>
			approveLearning(
				tx,
				approve(proposal),
				tx.slice(0, 2),
				[{ ...old, confidence: { score: 0.1, margin: 0.01 } }],
				categories
			)
		).toThrow('saved rule changed');
		expect(() =>
			approveLearning(
				tx,
				approve(proposal).map((item) => ({ ...item, replacesRule: unrelated })),
				tx.slice(0, 2),
				[old],
				categories
			)
		).toThrow('saved rule changed');
		expect(() =>
			approveLearning(
				tx,
				approve(proposal).map(({ transactionId, categoryId, confidence, reviewed }) => ({
					transactionId,
					categoryId,
					confidence,
					reviewed
				})),
				tx.slice(0, 2),
				[old],
				categories
			)
		).toThrow('conflicting');
	});
	it('preserves explicit transaction exceptions and learns from selected manual rows for future imports', async () => {
		const tx = setCategory(applyRules(rows(), [old]), rows()[1].id, CATEGORY_IDS.Shopping);
		const proposal = await categorizeWithAi(
			classifier(),
			tx.slice(0, 2),
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			[old],
			{ reconsider: true }
		);
		const result = approveLearning(tx, approve(proposal), tx.slice(0, 2), [old], categories);
		expect(result.transactions[0].categoryId).toBe(CATEGORY_IDS.Health);
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Shopping);
		expect(result.transactions[1].categoryOverride?.source).toBe('manual');
		const manual = setCategory(
			rows(['UNMATCHED MERCHANT']),
			rows(['UNMATCHED MERCHANT'])[0].id,
			CATEGORY_IDS.Shopping
		);
		const learned = await categorizeWithAi(
			classifier(),
			manual,
			categories,
			new AbortController().signal,
			undefined,
			'',
			manual,
			[],
			{ reconsider: true }
		);
		const approved = approveLearning(manual, approve(learned), manual, [], categories);
		expect(approved.rules).toHaveLength(1);
		expect(approved.transactions[0].categoryId).toBe(CATEGORY_IDS.Shopping);
		expect(applyRules(rows(['UNMATCHED MERCHANT']), approved.rules)[0].categoryId).toBe(
			CATEGORY_IDS.Health
		);
	});
	it('does not classify income, repayments, savings transfers or excluded transactions even on explicit request', async () => {
		const tx = rows().map((row, i) =>
			i === 0
				? { ...row, amountCents: 1000, categoryId: CATEGORY_IDS.Income }
				: i === 1
					? {
							...row,
							description: 'PAYMENT RECEIVED - THANK YOU',
							categoryId: CATEGORY_IDS.Savings
						}
					: { ...row, budgetOverride: 'exclude' as const }
		);
		const generate = classifier();
		await categorizeWithAi(
			generate,
			tx,
			categories,
			new AbortController().signal,
			undefined,
			'',
			tx,
			[],
			{ reconsider: true }
		);
		expect(generate).not.toHaveBeenCalled();
	});
});
