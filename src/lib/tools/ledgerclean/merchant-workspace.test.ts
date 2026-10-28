import { describe, expect, it } from 'vitest';
import { budgetFlow } from './activity';
import {
	combinedMerchantRule,
	merchantSpending,
	previewMerchantRule,
	workspaceMerchantGroups
} from './merchant-workspace';
import { DEFAULT_CATEGORIES, CATEGORY_IDS } from './category-model';
import {
	applyRules,
	readCsv,
	normalizeTransactions,
	defaultImportOptions,
	setCategory,
	saveRule,
	ruleKey,
	type Rule
} from './processing';
import {
	emptyWorkspace,
	loadWorkspace,
	persistWorkspace,
	validateWorkspace
} from './workspace-storage';
import { patternError, regexMatches } from './rule-pattern';
const categories = DEFAULT_CATEGORIES;
function rows(
	names = ['NAME-CHEAP.COM', 'NAME-CHEAP.COM', 'NAME-CHEAP.COM* OSPAKY PHOENIX', 'LOCAL CAFE']
) {
	const data = readCsv(
		'Date,Description,Amount\n' + names.map((name) => `2026-10-01,${name},-10`).join('\n')
	);
	return normalizeTransactions(
		data,
		defaultImportOptions(data.headers, 'synthetic.csv', 'test'),
		[]
	).transactions;
}
function merge(tx = rows(), rules: Rule[] = []) {
	const groups = workspaceMerchantGroups(tx, rules, categories).filter((group) =>
		group.rule.keyword.startsWith('NAME-CHEAP')
	);
	const rule = { ...combinedMerchantRule(groups), categoryId: CATEGORY_IDS.Business };
	return { tx, groups, rule, result: previewMerchantRule(tx, rules, categories, groups, rule) };
}
describe('merchant workspace', () => {
	it('sums expenses minus refunds by currency and omits income, transfers and exclusions', () => {
		const tx = rows(['MERCHANT', 'MERCHANT', 'MERCHANT', 'MERCHANT', 'MERCHANT', 'MERCHANT']);
		const all = tx.map((row, i) => ({
			...row,
			amountCents: [-1000, 200, -500, -900, -700, 400][i],
			currency: i === 2 ? 'USD' : 'CAD',
			categoryId: i === 5 ? CATEGORY_IDS.Income : CATEGORY_IDS.Dining,
			...(i === 3
				? { budgetOverride: 'transfer' as const }
				: i === 4
					? { budgetOverride: 'exclude' as const }
					: {})
		}));
		expect(merchantSpending(all, categories)).toEqual([
			{ currency: 'CAD', amountCents: 800 },
			{ currency: 'USD', amountCents: 500 }
		]);
		expect(merchantSpending([], categories)).toEqual([]);
	});
	it('combines unmatched merchants as one substring rule without changing transaction facts', () => {
		const { tx, rule, result } = merge();
		expect(rule).toMatchObject({ keyword: 'NAME-CHEAP.COM', match: 'contains' });
		expect(result.rules).toHaveLength(1);
		expect(result.matches).toHaveLength(3);
		expect(
			result.transactions.slice(0, 3).every((row) => row.categoryId === CATEGORY_IDS.Business)
		).toBe(true);
		expect(
			result.transactions.map(({ id, description, date, amountCents }) => ({
				id,
				description,
				date,
				amountCents
			}))
		).toEqual(
			tx.map(({ id, description, date, amountCents }) => ({ id, description, date, amountCents }))
		);
		expect(
			workspaceMerchantGroups(result.transactions, result.rules, categories).map(
				(group) => group.transactions.length
			)
		).toEqual([3, 1]);
	});
	it('replaces selected saved rules even with different categories, keeping other rules', () => {
		const tx = rows();
		const rules: Rule[] = [
			{
				keyword: tx[0].description,
				categoryId: CATEGORY_IDS.Shopping,
				match: 'exact',
				direction: 'out',
				field: 'description',
				source: 'manual'
			},
			{
				keyword: tx[2].description,
				categoryId: CATEGORY_IDS.Business,
				match: 'exact',
				direction: 'out',
				field: 'description',
				source: 'ai'
			},
			{
				keyword: 'LOCAL CAFE',
				categoryId: CATEGORY_IDS.Dining,
				match: 'exact',
				source: 'manual'
			}
		];
		const { result } = merge(applyRules(tx, rules), rules);
		expect(result.rules).toHaveLength(2);
		expect(result.rules).toContainEqual(rules[2]);
		expect(result.transactions[0].categoryId).toBe(CATEGORY_IDS.Business);
	});
	it('persists the combined regex and matches new descriptions after reload', () => {
		const { tx, groups, rule } = merge();
		const regex = { ...rule, match: 'regex' as const, keyword: '^NAME-?CHEAP\\.COM(?:\\*.*)?$' };
		const result = previewMerchantRule(tx, [], categories, groups, regex);
		let raw = '';
		persistWorkspace(
			{ setItem: (_key, value) => (raw = value) },
			{
				...emptyWorkspace(),
				rules: result.rules,
				transactions: result.transactions,
				imports: [
					{
						id: 'test',
						name: 'synthetic.csv',
						count: tx.length,
						amountMode: 'signed',
						expenses: 'negative'
					}
				]
			}
		);
		const saved = loadWorkspace({ getItem: () => raw });
		expect(saved.rules[0].keyword).toBe(regex.keyword);
		expect(
			applyRules(rows(['namecheap.com* NEW REFERENCE', 'OTHER NAMECHEAP.COM']), saved.rules).map(
				(row) => row.categoryId
			)
		).toEqual([CATEGORY_IDS.Business, CATEGORY_IDS.Uncategorized]);
		expect(
			workspaceMerchantGroups(saved.transactions, saved.rules, categories)[0].transactions
		).toHaveLength(3);
	});
	it('keeps manual transaction exceptions', () => {
		const tx = rows();
		const { result } = merge(setCategory(tx, tx[1].id, CATEGORY_IDS.Shopping));
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Shopping);
		expect(result.transactions[1].categoryOverride?.source).toBe('manual');
		expect(result.transactions[0].categoryId).toBe(CATEGORY_IDS.Business);
	});
	it('shows extra unmatched transactions and blocks overlapping saved groups', () => {
		const { tx, groups, rule } = merge();
		expect(
			previewMerchantRule(tx, [], categories, groups, { ...rule, keyword: '.', match: 'regex' })
				.matches
		).toHaveLength(4);
		const other: Rule = {
			keyword: 'LOCAL CAFE',
			categoryId: CATEGORY_IDS.Shopping,
			source: 'manual'
		};
		expect(() =>
			previewMerchantRule(tx, [other], categories, groups, {
				...rule,
				keyword: '.',
				match: 'regex'
			})
		).toThrow('overlaps another saved merchant');
	});
	it('rejects patterns that miss selected transactions and incompatible money scopes', () => {
		const { tx, groups, rule } = merge();
		expect(() =>
			previewMerchantRule(tx, [], categories, groups, { ...rule, match: 'exact' })
		).toThrow('every transaction');
		expect(() =>
			combinedMerchantRule([
				groups[0],
				{ ...groups[1], rule: { ...groups[1].rule, direction: 'in' } }
			])
		).toThrow('same account type');
		expect(() =>
			previewMerchantRule(tx, [], categories, groups, { ...rule, direction: 'in' })
		).toThrow('scope changed');
	});
	it('retains historical exceptions while editing or combining saved rules', () => {
		const tx = rows();
		const old: Rule = {
			keyword: 'NAME-CHEAP.COM',
			match: 'contains',
			categoryId: CATEGORY_IDS.Business,
			field: 'description',
			direction: 'out',
			source: 'manual',
			excludedTransactionIds: [tx[1].id]
		};
		const group = workspaceMerchantGroups(tx, [old], categories)[0];
		const draft = combinedMerchantRule([group]);
		expect(draft.excludedTransactionIds).toEqual([tx[1].id]);
		const result = previewMerchantRule(tx, [old], categories, [group], {
			...draft,
			categoryId: CATEGORY_IDS.Shopping
		});
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Uncategorized);
	});
	it('uses approved predicates as editable merchant groups', () => {
		const tx = rows();
		const rules: Rule[] = [
			{ keyword: 'NAME-CHEAP', categoryId: CATEGORY_IDS.Business, source: 'manual' }
		];
		const groups = workspaceMerchantGroups(tx, rules, categories);
		expect(groups[0]).toMatchObject({ saved: true, rule: rules[0] });
		expect(groups[0].transactions).toHaveLength(3);
		const rule = { ...combinedMerchantRule([groups[0]]), categoryId: CATEGORY_IDS.Shopping };
		const result = previewMerchantRule(tx, rules, categories, [groups[0]], rule);
		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].source).toBe('manual');
	});
	it('keeps credit refunds grouped but excludes structural repayments', () => {
		const tx = rows([
			'NAME-CHEAP.COM',
			'NAME-CHEAP.COM* REFUND',
			'PAYMENT RECEIVED - THANK YOU'
		]).map((row, i) => ({ ...row, accountType: 'credit' as const, amountCents: i ? 1000 : -1000 }));
		const groups = workspaceMerchantGroups(tx, [], categories);
		expect(groups).toHaveLength(2);
		const rule = {
			...combinedMerchantRule(groups),
			keyword: 'NAME-CHEAP.COM',
			categoryId: CATEGORY_IDS.Business
		};
		const result = previewMerchantRule(tx, [], categories, groups, rule);
		expect(result.transactions[1].categoryId).toBe(CATEGORY_IDS.Business);
		expect(budgetFlow(result.transactions[2], categories)).toBe('transfer');
	});
});
describe('merchant regex matching', () => {
	it('preserves escapes and regex semantics in keys and validation', () => {
		const rule: Rule = { keyword: '\\d+', match: 'regex', categoryId: CATEGORY_IDS.Business };
		expect(saveRule([], rule)[0].keyword).toBe('\\d+');
		expect(ruleKey(rule)).not.toBe(ruleKey({ ...rule, keyword: '\\D+' }));
		expect(regexMatches('name-?cheap\\.com', 'NAME-CHEAP.COM')).toBe(true);
		expect(regexMatches('\\d+', 'ABC')).toBe(false);
	});
	it('rejects malformed/unsupported regex and corrupted saved patterns', () => {
		expect(patternError('[', 'regex')).toMatch('Invalid regex');
		expect(patternError('(?=NAME)', 'regex')).toMatch('Invalid regex');
		expect(() =>
			saveRule([], { keyword: '[', match: 'regex', categoryId: CATEGORY_IDS.Business })
		).toThrow('Invalid regex');
		expect(() =>
			validateWorkspace({
				...emptyWorkspace(),
				rules: [{ keyword: '[', match: 'regex', categoryId: CATEGORY_IDS.Business }]
			})
		).toThrow('invalid matching pattern');
	});
	it('handles a backtracking-prone pattern without blocking on long input', () => {
		expect(regexMatches('(a+)+$', 'a'.repeat(10000) + '!')).toBe(false);
	});
});
