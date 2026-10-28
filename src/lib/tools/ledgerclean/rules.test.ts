import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, DEFAULT_CATEGORIES } from './category-model';
import {
	applyRules,
	categorize,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory,
	mergeCategoryMappings,
	ruleKey,
	type Rule
} from './processing';
import { starterRules } from './starter-rules';
import { moveRule, previewRuleChange, saveEditedRule } from './rules';
import { TAG_IDS } from './tags';
import { patternError, wordsMatch } from './rule-pattern';

describe('ordered categorization rules', () => {
	it('matches accepted long word lists after literal escaping and Unicode boundaries are added', () => {
		for (const words of [
			'a'.repeat(480),
			'.'.repeat(300),
			Array.from({ length: 52 }, (_, index) => `cafe.${index}`).join(', ')
		]) {
			expect(patternError(words, 'words')).toBe('');
			expect(wordsMatch(words, words.includes(',') ? 'CAFE.12' : words)).toBe(true);
		}
	});
	it('previews the winning rule and preserves explicit decisions when overlapping patterns are reordered', () => {
		const data = readCsv(
			'Date,Description,Amount\n2026-10-01,COFFEE BAR,-10\n2026-10-02,COFFEE BAR,-20'
		);
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'synthetic.csv')
		).transactions;
		const coffee: Rule = { keyword: 'coffee', match: 'words', categoryId: CATEGORY_IDS.Cafes };
		const bar: Rule = { keyword: 'bar', match: 'words', categoryId: CATEGORY_IDS.Restaurants };
		const current = applyRules(setCategory(rows, rows[0].id, CATEGORY_IDS.Business), [coffee, bar]);
		const next = moveRule([coffee, bar], ruleKey(bar), -1);
		const preview = previewRuleChange(current, [coffee, bar], next, DEFAULT_CATEGORIES, bar);
		expect(preview.changed.map((row) => row.id)).toEqual([rows[1].id]);
		expect(preview.exceptions.map((row) => row.id)).toEqual([rows[0].id]);
		expect(preview.overlaps[1].winner.categoryId).toBe(CATEGORY_IDS.Restaurants);
		expect(preview.transactions.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Business,
			CATEGORY_IDS.Restaurants
		]);
		const edited = saveEditedRule(
			next,
			{ ...bar, keyword: 'bar, pub' },
			DEFAULT_CATEGORIES,
			ruleKey(bar)
		);
		expect(edited[0].keyword).toBe('BAR, PUB');
		expect(() => saveEditedRule(edited, coffee, DEFAULT_CATEGORIES)).toThrow('already exists');
	});
	it('lets word patterns refine bank hints and counts only effective tag changes', () => {
		const data = readCsv('Date,Description,Amount\n2026-10-01,COFFEE BAR,-10');
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'synthetic.csv')
		).transactions.map((row) => ({
			...row,
			sourceCategory: 'Shopping',
			tagOverride: { add: [], remove: [TAG_IDS.Work] }
		}));
		const coffee: Rule = { keyword: 'coffee', match: 'words', categoryId: CATEGORY_IDS.Cafes };
		const bank: Rule = {
			keyword: 'Shopping',
			field: 'sourceCategory',
			match: 'exact',
			categoryId: CATEGORY_IDS.Shopping,
			source: 'import'
		};
		const current = applyRules(rows, [coffee, bank]);
		expect(current[0].categoryId).toBe(CATEGORY_IDS.Cafes);
		expect(
			applyRules(
				rows,
				mergeCategoryMappings([coffee], { Shopping: CATEGORY_IDS.Shopping }, DEFAULT_CATEGORIES)
			)[0].categoryId
		).toBe(CATEGORY_IDS.Cafes);
		const preview = previewRuleChange(
			current,
			[coffee, bank],
			[{ ...coffee, tagIds: [TAG_IDS.Work] }, bank],
			DEFAULT_CATEGORIES,
			coffee
		);
		expect(preview.changed).toHaveLength(0);
	});
	it('matches whole words including accents without matching parts of other words', () => {
		const rules: Rule[] = [
			{ keyword: 'coffee, cafe, café', match: 'words', categoryId: CATEGORY_IDS.Cafes },
			{ keyword: 'restaurant, bar', match: 'words', categoryId: CATEGORY_IDS.Restaurants }
		];
		expect(categorize('LOCAL CAFÉ #12', rules, DEFAULT_CATEGORIES)).toBe(CATEGORY_IDS.Cafes);
		expect(categorize('COFFEE BAR', rules, DEFAULT_CATEGORIES)).toBe(CATEGORY_IDS.Cafes);
		expect(categorize('THE BAR', rules, DEFAULT_CATEGORIES)).toBe(CATEGORY_IDS.Restaurants);
		expect(categorize('BARBER SHOP', rules, DEFAULT_CATEGORIES)).toBe(CATEGORY_IDS.Uncategorized);
		expect(categorize('CAFEINE LABS', rules, DEFAULT_CATEGORIES)).toBe(CATEGORY_IDS.Uncategorized);
	});
	it('applies merchant rules before ordered patterns and preserves transaction exceptions', () => {
		const data = readCsv(
			'Date,Description,Amount\n2026-10-01,COFFEE BAR #123,-10\n2026-10-02,COFFEE BAR #124,-20'
		);
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'synthetic.csv')
		).transactions;
		const patterns: Rule[] = [
			{ keyword: 'bar', match: 'words', categoryId: CATEGORY_IDS.Restaurants },
			{ keyword: 'coffee', match: 'words', categoryId: CATEGORY_IDS.Cafes }
		];
		expect(applyRules(rows, patterns)[0].categoryId).toBe(CATEGORY_IDS.Restaurants);
		expect(applyRules(rows, [...patterns].reverse())[0].categoryId).toBe(CATEGORY_IDS.Cafes);
		const rules: Rule[] = [
			...patterns,
			{ keyword: 'COFFEE BAR', match: 'merchant', categoryId: CATEGORY_IDS.Business }
		];
		const result = applyRules(setCategory(rows, rows[0].id, CATEGORY_IDS.Shopping), rules);
		expect(result.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Shopping,
			CATEGORY_IDS.Business
		]);
		expect(
			applyRules(
				rows,
				rules.map((rule) => ({ ...rule, enabled: false }))
			)[0].categoryId
		).toBe(CATEGORY_IDS.Uncategorized);
	});
	it('ships conservative spending defaults without classifying income, transfers or unknown merchants', () => {
		const data = readCsv(
			'Date,Description,Amount,Account Type\n2026-10-01,LOCAL COFFEE,-10,cash\n2026-10-02,LOCAL BARBER,-20,cash\n2026-10-03,STARBUCKS 123,-5,cash\n2026-10-04,COFFEE PAYROLL,3000,cash\n2026-10-05,PAYMENT RECEIVED - THANK YOU,100,credit\n2026-10-06,LOCAL COFFEE,5,credit\n2026-10-07,UNFAMILIAR MERCHANT,-12,cash'
		);
		const rows = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'synthetic.csv')
		).transactions;
		expect(applyRules(rows, starterRules()).map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Cafes,
			CATEGORY_IDS.Shopping,
			CATEGORY_IDS.Cafes,
			CATEGORY_IDS.Income,
			CATEGORY_IDS.Savings,
			CATEGORY_IDS.Cafes,
			CATEGORY_IDS.Uncategorized
		]);
	});
});
