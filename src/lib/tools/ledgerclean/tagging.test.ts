import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, categoryPath } from './category-model';
import {
	applyRules,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	summarizeYearSpending,
	type Rule
} from './processing';
import {
	DEFAULT_TAGS,
	TAG_IDS,
	editTransactionTags,
	filterByTag,
	transactionTagMap,
	validateTagIds
} from './tags';
import { detectRecurring } from './recurring';
import { emptyWorkspace, loadWorkspace, persistWorkspace } from './workspace-storage';
import { classifyHierarchy } from './hierarchical-classification';
import type { CategoryClassifier } from './ai';
import type { ClassificationInput } from './local-ai-contract';

function transactions(body: string) {
	const csv = readCsv('Date,Description,Amount\n' + body);
	return normalizeTransactions(csv, defaultImportOptions(csv.headers, 'test.csv', 'test-import'))
		.transactions;
}
const categories = DEFAULT_CATEGORIES;
const rule: Rule = {
	keyword: 'MARKET',
	categoryId: CATEGORY_IDS.Groceries,
	tagIds: [TAG_IDS.Needs, TAG_IDS.Work],
	source: 'manual'
};

describe('independent spending and purpose tags', () => {
	it('rolls up once while purpose filters preserve transaction exceptions', () => {
		const rows = applyRules(transactions('2026-01-01,MARKET,-10\n2026-01-02,MARKET,-20'), [rule]);
		const map = transactionTagMap(rows, [rule], categories, DEFAULT_TAGS);
		const updated = editTransactionTags(
			rows,
			rows[0].id,
			map.get(rows[0].id)!,
			[TAG_IDS.Wants, TAG_IDS.Social],
			DEFAULT_TAGS
		);
		const next = transactionTagMap(updated, [rule], categories, DEFAULT_TAGS);
		expect(next.get(rows[0].id)).toEqual(expect.arrayContaining([TAG_IDS.Wants, TAG_IDS.Social]));
		expect(next.get(rows[0].id)).not.toContain(TAG_IDS.Work);
		expect(next.get(rows[0].id)).not.toContain(TAG_IDS.Needs);
		const needs = filterByTag(updated, next, TAG_IDS.Needs, DEFAULT_TAGS);
		expect(summarizeYearSpending(needs, '2026', 'CAD')[0].categories).toEqual([
			{ categoryId: CATEGORY_IDS.Household, amountCents: 2000 }
		]);
		expect(summarizeYearSpending(updated, '2026', 'CAD')[0].spendingCents).toBe(3000);
		const changed = { ...rule, tagIds: [TAG_IDS.Mixed] };
		expect(
			transactionTagMap(updated, [changed], categories, DEFAULT_TAGS).get(rows[0].id)
		).not.toContain(TAG_IDS.Mixed);
		expect(() => validateTagIds([TAG_IDS.Needs, TAG_IDS.Wants], DEFAULT_TAGS)).toThrow();
	});
	it('persists IDs, overrides, and tag names while deriving tags after reload', () => {
		const workspace = emptyWorkspace();
		workspace.rules = [rule];
		workspace.imports = [
			{ id: 'test-import', name: 'test.csv', count: 1, amountMode: 'signed', expenses: 'negative' }
		];
		const rows = applyRules(transactions('2026-01-01,MARKET,-10'), [rule]);
		workspace.transactions = editTransactionTags(
			rows,
			rows[0].id,
			[TAG_IDS.Needs, TAG_IDS.Work],
			[TAG_IDS.Wants],
			DEFAULT_TAGS
		);
		workspace.tags[TAG_IDS.Wants].name = 'Optional';
		let saved = '';
		persistWorkspace({ setItem: (_key, value) => (saved = value) }, workspace);
		const loaded = loadWorkspace({ getItem: () => saved });
		expect(loaded.transactions).toEqual(workspace.transactions);
		expect(loaded.tags[TAG_IDS.Wants].name).toBe('Optional');
		expect(
			transactionTagMap(loaded.transactions, loaded.rules, loaded.categories, loaded.tags).get(
				rows[0].id
			)
		).toEqual([TAG_IDS.Wants]);
		const broken = JSON.parse(saved);
		broken.rules[0].tagIds = ['missing'];
		expect(() => loadWorkspace({ getItem: () => JSON.stringify(broken) })).toThrow();
	});
});

describe('recurring payment series', () => {
	it('detects three calendar payments, including month ends, without tagging a one-off or refund', () => {
		const rows = transactions(
			'2026-01-31,SERVICE,-20\n2026-02-28,SERVICE,-21\n2026-03-31,SERVICE,-20\n2026-02-15,SERVICE,-80\n2026-03-15,SERVICE,20'
		);
		const series = detectRecurring(rows, [], categories);
		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({
			cadence: 'Monthly',
			transactionIds: rows.slice(0, 3).map((row) => row.id)
		});
		const map = transactionTagMap(
			rows,
			[],
			categories,
			DEFAULT_TAGS,
			new Set(series[0].transactionIds)
		);
		expect(map.get(rows[3].id)).toEqual([]);
		const updated = editTransactionTags(rows, rows[0].id, map.get(rows[0].id)!, [], DEFAULT_TAGS);
		expect(
			transactionTagMap(
				updated,
				[],
				categories,
				DEFAULT_TAGS,
				new Set(series[0].transactionIds)
			).get(rows[0].id)
		).toEqual([]);
	});
	it('rejects two observations, daily habits, and series split across accounts or currencies', () => {
		expect(
			detectRecurring(
				transactions('2026-01-01,SERVICE,-20\n2026-02-01,SERVICE,-20'),
				[],
				categories
			)
		).toEqual([]);
		expect(
			detectRecurring(
				transactions('2026-01-01,CAFE,-5\n2026-01-02,CAFE,-5\n2026-01-03,CAFE,-5'),
				[],
				categories
			)
		).toEqual([]);
		const rows = transactions(
			'2026-01-01,SERVICE,-20\n2026-02-01,SERVICE,-20\n2026-03-01,SERVICE,-20'
		);
		expect(
			detectRecurring(
				rows.map((row, i) => ({ ...row, account: i === 2 ? 'Other' : 'Main' })),
				[],
				categories
			)
		).toEqual([]);
		expect(
			detectRecurring(
				rows.map((row, i) => ({ ...row, currency: i === 2 ? 'USD' : 'CAD' })),
				[],
				categories
			)
		).toEqual([]);
	});
});

describe('classification with bounded category choices', () => {
	const rows = transactions('2026-01-01,MARKET,-10');
	const inputFor: Parameters<typeof classifyHierarchy>[4] = (batch, choices, parent) => ({
		rules: [],
		examples: [],
		fallback: categoryPath(categories, parent ?? CATEGORY_IDS.Uncategorized),
		categories: choices.map((choice) => ({
			name: categoryPath(categories, choice.id),
			purpose: choice.name
		})),
		transactions: batch.map((row, t) => ({ t, d: row.description, direction: 'out' }))
	});
	it('offers eight roots then only the chosen branch, combining the weaker score', async () => {
		const inputs: ClassificationInput[] = [];
		const model: CategoryClassifier = async (input) => {
			inputs.push(input);
			return {
				assignments: [
					{
						t: 0,
						c: inputs.length === 1 ? 'Household' : 'Household / Groceries',
						confidence: { score: inputs.length === 1 ? 0.8 : 0.6, margin: 0.2 }
					}
				]
			};
		};
		const result = await classifyHierarchy(
			model,
			rows,
			categories,
			new AbortController().signal,
			inputFor
		);
		expect(inputs[0].categories.filter((c) => c.name !== 'Uncategorized')).toHaveLength(8);
		expect(inputs[0].categories.some((c) => c.name.includes('/'))).toBe(false);
		expect(inputs[1].categories.every((c) => c.name.startsWith('Household'))).toBe(true);
		expect(result.get(rows[0].id)).toEqual({
			categoryId: CATEGORY_IDS.Groceries,
			confidence: { score: 0.6, margin: 0.2 }
		});
	});
	it('retains the root when the child is uncertain and rejects foreign branch mappings', async () => {
		let calls = 0;
		const model: CategoryClassifier = async () => ({
			assignments: [
				{
					t: 0,
					c: ++calls === 1 ? 'Household' : 'Household / Groceries',
					confidence: { score: calls === 1 ? 0.8 : 0.2, margin: 0.1 }
				}
			]
		});
		expect(
			(
				await classifyHierarchy(model, rows, categories, new AbortController().signal, inputFor)
			).get(rows[0].id)?.categoryId
		).toBe(CATEGORY_IDS.Household);
		calls = 0;
		const invalid: CategoryClassifier = async () => ({
			assignments: [
				{ t: 0, c: ++calls === 1 ? 'Household' : 'Dining', confidence: { score: 0.8, margin: 0.2 } }
			]
		});
		await expect(
			classifyHierarchy(invalid, rows, categories, new AbortController().signal, inputFor)
		).rejects.toThrow('unknown');
	});
});
