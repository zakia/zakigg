import { CATEGORY_PRESETS } from './categories';
import { describe, expect, it } from 'vitest';
import {
	CATEGORY_IDS,
	DEFAULT_CATEGORIES,
	UNCATEGORIZED_ID,
	addCategory,
	categoryPath,
	categoryGroup,
	updateCategory,
	validateCategories
} from './category-model';
import {
	filterTransactions,
	normalizeTransactions,
	readCsv,
	defaultImportOptions,
	summarizeMonths,
	summarizeYearSpending
} from './processing';

describe('relational categories', () => {
	it('defines eight spending roots, focused children, and Savings as transfers', () => {
		validateCategories(DEFAULT_CATEGORIES);
		expect(
			Object.values(CATEGORY_PRESETS)
				.filter((c) => c.kind === 'expense' && !c.parentId)
				.map((c) => c.name)
		).toEqual([
			'Business',
			'Household',
			'Dining',
			'Health',
			'Entertainment',
			'Transport',
			'Travel',
			'Shopping and Personal'
		]);
		expect(DEFAULT_CATEGORIES[CATEGORY_IDS.Savings].kind).toBe('transfer');
		expect(DEFAULT_CATEGORIES[CATEGORY_IDS.Groceries].parentId).toBe(CATEGORY_IDS.Household);
		expect(DEFAULT_CATEGORIES[CATEGORY_IDS.Cafes].parentId).toBe(CATEGORY_IDS.Dining);
		expect(DEFAULT_CATEGORIES[CATEGORY_IDS.Medical].parentId).toBe(CATEGORY_IDS.Health);
	});
	it('keeps tags and summaries stable when a category is renamed or recolored', () => {
		const data = readCsv('Date,Description,Amount\n2026-01-01,OPENAI,-20');
		const rows = normalizeTransactions(data, defaultImportOptions(data.headers, 'bank.csv'), [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business }
		]).transactions;
		const next = updateCategory(DEFAULT_CATEGORIES, CATEGORY_IDS.Business, {
			name: 'Work tools',
			color: '#abcdef'
		});
		expect(rows[0].categoryId).toBe(CATEGORY_IDS.Business);
		expect(categoryPath(next, rows[0].categoryId)).toBe('Work tools');
		expect(summarizeMonths(rows, 'CAD', next)).toEqual(
			summarizeMonths(rows, 'CAD', DEFAULT_CATEGORIES)
		);
		expect(summarizeYearSpending(rows, '2026', 'CAD', next)[0].categories[0].categoryId).toBe(
			CATEGORY_IDS.Business
		);
	});
	it('filters descendants by parent and preserves income semantics after reparenting', () => {
		const next = addCategory(
			DEFAULT_CATEGORIES,
			{
				name: 'AI subscriptions',
				color: '#abcdef',
				parentId: CATEGORY_IDS.Business,
				kind: 'expense',
				origin: 'user'
			},
			() => '123456789012345678901'
		);
		const data = readCsv(
			'Date,Description,Amount,Category\n2026-01-01,Tool,-10,Business / AI subscriptions'
		);
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'bank.csv'),
			[],
			next
		).transactions;
		expect(filterTransactions(rows, { categoryId: CATEGORY_IDS.Business }, next)).toHaveLength(1);
		expect(summarizeMonths(rows, 'CAD', next)[0].spendingCents).toBe(1000);
		const updated = updateCategory(next, CATEGORY_IDS.Business, { kind: 'income' });
		expect(updated['123456789012345678901'].kind).toBe('income');
		expect(summarizeMonths(rows, 'CAD', updated)[0].spendingCents).toBe(0);
	});
	it('rejects cycles, invalid parents, duplicate sibling names and an unusable review category', () => {
		const next = addCategory(
			DEFAULT_CATEGORIES,
			{
				name: 'Child',
				color: '#abcdef',
				parentId: CATEGORY_IDS.Business,
				kind: 'expense',
				origin: 'user'
			},
			() => '123456789012345678901'
		);
		expect(() =>
			updateCategory(next, CATEGORY_IDS.Business, { parentId: '123456789012345678901' })
		).toThrow('ancestor');
		expect(() => updateCategory(next, CATEGORY_IDS.Business, { parentId: 'missing' })).toThrow();
		expect(() => updateCategory(next, CATEGORY_IDS.Business, { name: 'Dining' })).toThrow('unique');
		expect(() => updateCategory(next, UNCATEGORIZED_ID, { kind: 'income' })).toThrow('review');
		expect(() =>
			validateCategories({
				...next,
				[CATEGORY_IDS.Business]: { ...next[CATEGORY_IDS.Business], color: 'url(bad)' }
			})
		).toThrow('Invalid');
	});
	it('rolls up deep descendants and drills one level at a time without losing direct assignments', () => {
		const childId = '123456789012345678901';
		const grandchildId = '123456789012345678902';
		const tree = addCategory(
			addCategory(
				DEFAULT_CATEGORIES,
				{
					name: 'Software',
					parentId: CATEGORY_IDS.Business,
					color: '#abcdef',
					kind: 'expense',
					origin: 'user'
				},
				() => childId
			),
			{
				name: 'Models',
				parentId: childId,
				color: '#fedcba',
				kind: 'expense',
				origin: 'user'
			},
			() => grandchildId
		);
		expect(categoryGroup(tree, grandchildId)).toBe(CATEGORY_IDS.Business);
		expect(categoryGroup(tree, grandchildId, CATEGORY_IDS.Business)).toBe(childId);
		expect(categoryGroup(tree, grandchildId, childId)).toBe(grandchildId);
		expect(categoryGroup(tree, CATEGORY_IDS.Business, CATEGORY_IDS.Business)).toBe(
			CATEGORY_IDS.Business
		);
		expect(categoryGroup(tree, CATEGORY_IDS.Groceries, CATEGORY_IDS.Business)).toBeNull();
		const data = readCsv(
			'Date,Description,Amount\n2026-01-01,Direct,-10\n2026-01-02,Software,-20\n2026-01-03,Model,-30\n2026-01-04,Refund,5\n2026-01-05,Market,-40\n2026-02-01,Salary,3000'
		);
		const ids = [
			CATEGORY_IDS.Business,
			childId,
			grandchildId,
			grandchildId,
			CATEGORY_IDS.Dining,
			CATEGORY_IDS.Income
		];
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'bank.csv'),
			[],
			tree
		).transactions.map((row, i) => ({ ...row, categoryId: ids[i] }));
		const snapshot = structuredClone(rows);
		const roots = summarizeYearSpending(rows, '2026', 'CAD', tree);
		expect(roots[0].categories).toEqual([
			{ categoryId: CATEGORY_IDS.Business, amountCents: 5500 },
			{ categoryId: CATEGORY_IDS.Dining, amountCents: 4000 }
		]);
		expect(roots[0].spendingCents).toBe(9500);
		const business = summarizeYearSpending(rows, '2026', 'CAD', tree, CATEGORY_IDS.Business);
		expect(business[0].categories).toEqual([
			{ categoryId: CATEGORY_IDS.Business, amountCents: 1000 },
			{ categoryId: childId, amountCents: 4500 }
		]);
		expect(business[0].spendingCents).toBe(5500);
		const software = summarizeYearSpending(rows, '2026', 'CAD', tree, childId);
		expect(software[0].categories).toEqual([
			{ categoryId: childId, amountCents: 2000 },
			{ categoryId: grandchildId, amountCents: 2500 }
		]);
		expect(business[1]).toMatchObject({ count: 1, spendingCents: 0, categories: [] });
		expect(business[2]).toMatchObject({ count: 0, spendingCents: 0, categories: [] });
		expect(business).toHaveLength(12);
		expect(rows).toEqual(snapshot);
	});
});
