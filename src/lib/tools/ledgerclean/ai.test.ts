import { describe, it, expect, vi } from 'vitest';
import {
	categorizeWithAi,
	parseTagMappings,
	applyTagProposal,
	applyReviewedTagProposal,
	AI_BATCH_SIZE,
	AI_GUIDANCE_LIMIT,
	type CategoryClassifier
} from './ai';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, categoryList } from './category-model';
import {
	applyRules,
	readCsv,
	normalizeTransactions,
	defaultImportOptions,
	setCategories,
	type Rule
} from './processing';
const data = readCsv('Date,Description,Amount\n2026-10-01,Unknown,-12\n2026-10-01,PAYROLL,3000');
const rows = normalizeTransactions(
	data,
	defaultImportOptions(data.headers, 'file.csv')
).transactions;
const ids = categoryList(DEFAULT_CATEGORIES).map((category) => category.id);
const business = ids.indexOf(CATEGORY_IDS.Business);
const response = (input: unknown) => ({
	assignments: (input as { transactions: { t: number }[] }).transactions.map(({ t }) => ({
		t,
		c: 'Business'
	}))
});
describe('local AI classification', () => {
	it('requires complete, unique mappings and rejects category creation or extra fields', () => {
		expect(
			parseTagMappings(
				{
					assignments: [
						{ t: 0, c: business },
						{ t: 1, c: business }
					]
				},
				rows,
				ids
			)
		).toHaveLength(2);
		for (const value of [
			{ assignments: [{ t: 0, c: business }] },
			{
				assignments: [
					{ t: 0, c: business },
					{ t: 0, c: business }
				]
			},
			{
				assignments: [
					{ t: 99, c: business },
					{ t: 1, c: business }
				]
			},
			{
				assignments: [
					{ t: 0, c: 999 },
					{ t: 1, c: business }
				]
			},
			{
				assignments: [
					{ t: 0, c: business, name: 'New category' },
					{ t: 1, c: business }
				]
			},
			{ categories: [{ name: 'New category' }] }
		])
			expect(() => parseTagMappings(value, rows, ids)).toThrow();
	});
	it('classifies repeated merchants once and resolves mappings to existing IDs', async () => {
		const repeated = Array.from({ length: 75 }, (_, i) => ({ ...rows[0], id: `row-${i}` }));
		const generate = vi.fn(async (input) => response(input));
		const result = await categorizeWithAi(
			generate,
			repeated,
			DEFAULT_CATEGORIES,
			new AbortController().signal
		);
		expect(generate).toHaveBeenCalledTimes(1);
		const input = generate.mock.calls[0][0] as { transactions: unknown[] };
		expect(input.transactions).toHaveLength(1);
		expect(result).toEqual(
			repeated.map((row) => ({ transactionId: row.id, categoryId: CATEGORY_IDS.Business }))
		);
	});
	it('uses approved examples without using selected rows as their own examples', async () => {
		const selected = {
			...rows[0],
			categorySource: 'manual' as const,
			description: 'Selected merchant',
			categoryId: CATEGORY_IDS.Dining
		};
		const approved = { ...selected, id: 'approved-example', description: 'Reference merchant' };
		const generate = vi.fn(async (input) => response(input));
		await categorizeWithAi(
			generate,
			[selected],
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			() => {},
			'',
			[selected, approved]
		);
		const examples = generate.mock.calls[0][0].examples;
		expect(examples).toContainEqual({ d: 'Reference merchant', c: 'Dining' });
		expect(examples.some((item: { d: string }) => item.d === 'Selected merchant')).toBe(false);
	});
	it('runs saved rules before inference and passes their predicates as model context', async () => {
		const data = readCsv(
			'Date,Description,Amount\n2026-10-01,OPENAI *CHATGPT SUBSCR SAN FRANCISCO,-20\n2026-10-01,DIGITALOCEAN.COM SAINT JOHN,-12\n2026-10-01,DOORDASH*TAKEOUT TORONTO,-22\n2026-10-01,Unfamiliar studio,-10'
		);
		const tx = normalizeTransactions(
			data,
			defaultImportOptions(data.headers, 'test.csv'),
			[]
		).transactions;
		const approvedRules: Rule[] = [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'DIGITALOCEAN', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'DOORDASH', categoryId: CATEGORY_IDS.Dining, source: 'manual' }
		];
		const generate = vi.fn(async (input) => {
			expect(input.transactions).toHaveLength(1);
			expect(input.transactions[0].d).toBe('Unfamiliar studio');
			expect(input.rules).toContainEqual({
				keyword: 'OPENAI',
				category: 'Business',
				match: 'contains',
				field: 'description'
			});
			return response(input);
		});
		const result = await categorizeWithAi(
			generate,
			tx,
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			() => {},
			' ',
			[],
			approvedRules
		);
		expect(result.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Business,
			CATEGORY_IDS.Business,
			CATEGORY_IDS.Dining,
			CATEGORY_IDS.Business
		]);
		expect(generate).toHaveBeenCalledTimes(1);
	});
	it('does not call the model for explicit manual decisions or a fully rule-covered selection', async () => {
		const manual = setCategories(rows, [rows[0].id], CATEGORY_IDS.Dining, DEFAULT_CATEGORIES);
		const generate = vi.fn();
		const result = await categorizeWithAi(
			generate,
			manual,
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			() => {},
			'',
			[],
			[]
		);
		expect(result.map((row) => row.categoryId)).toEqual([CATEGORY_IDS.Dining, CATEGORY_IDS.Income]);
		expect(generate).not.toHaveBeenCalled();
	});
	it('keeps direction and bank hints separate while grouping differing automatic assignments', async () => {
		const distinct = [
			rows[0],
			{ ...rows[0], id: 'refund', amountCents: 1200, accountType: 'credit' as const },
			{ ...rows[0], id: 'bank-hint', sourceCategory: 'Medical' },
			{ ...rows[0], id: 'one-off', categoryId: CATEGORY_IDS.Shopping }
		];
		const generate = vi.fn(async (input) => response(input));
		await categorizeWithAi(generate, distinct, DEFAULT_CATEGORIES, new AbortController().signal);
		expect(generate).toHaveBeenCalledTimes(1);
		expect((generate.mock.calls[0][0] as { transactions: unknown[] }).transactions).toHaveLength(3);
	});
	it('sends compact local context and bounded guidance without account IDs, amounts, dates, or files', async () => {
		const tx = {
			...rows[0],
			account: 'PRIVATE-ACCOUNT',
			source: 'PRIVATE-SOURCE',
			activityType: 'Purchase',
			accountType: 'credit' as const,
			sourceCategory: 'Medical'
		};
		const generate: CategoryClassifier = vi.fn(async (input) => {
			expect(input).toMatchObject({
				guidance: 'Business purchase',
				transactions: [
					{
						t: 0,
						d: 'Unknown',
						direction: 'out',
						bankCategory: 'Medical',
						accountType: 'credit',
						activityType: 'Purchase'
					}
				]
			});
			expect(JSON.stringify(input)).not.toContain('PRIVATE-');
			expect(JSON.stringify(input)).not.toContain(tx.date);
			expect(JSON.stringify(input)).not.toContain('amountCents');
			return response(input);
		});
		await categorizeWithAi(
			generate,
			[tx],
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			() => {},
			' Business purchase '
		);
		await expect(
			categorizeWithAi(
				generate,
				[tx],
				DEFAULT_CATEGORIES,
				new AbortController().signal,
				() => {},
				'x'.repeat(AI_GUIDANCE_LIMIT + 1)
			)
		).rejects.toThrow('guidance');
	});
	it('keeps known income and declared transfers deterministic and never offers income for spending', async () => {
		const transfer = {
			...rows[0],
			id: 'payment',
			activityType: 'Payment',
			accountType: 'credit' as const
		};
		const generate: CategoryClassifier = vi.fn(async (input) => {
			expect(
				(input as { categories: { name: string }[] }).categories.some(
					(category) => category.name === 'Income' || category.name === 'Savings'
				)
			).toBe(false);
			return response(input);
		});
		const result = await categorizeWithAi(
			generate,
			[...rows, transfer],
			DEFAULT_CATEGORIES,
			new AbortController().signal
		);
		expect(result).toEqual([
			{ transactionId: rows[0].id, categoryId: CATEGORY_IDS.Business },
			{ transactionId: rows[1].id, categoryId: CATEGORY_IDS.Income },
			{ transactionId: 'payment', categoryId: CATEGORY_IDS.Savings }
		]);
	});
	it('uses small batches and rejects a later failure without applying partial results', async () => {
		const many = Array.from({ length: AI_BATCH_SIZE + 1 }, (_, i) => ({
			...rows[0],
			id: `row-${i}`,
			description: `Merchant ${i}`
		}));
		const generate = vi.fn(async (input) => response(input));
		const progress = vi.fn();
		expect(
			await categorizeWithAi(
				generate,
				many,
				DEFAULT_CATEGORIES,
				new AbortController().signal,
				progress
			)
		).toHaveLength(many.length);
		expect(generate).toHaveBeenCalledTimes(2);
		expect(progress).toHaveBeenLastCalledWith(many.length, many.length);
		const fail = vi
			.fn()
			.mockImplementationOnce(async (input) => response(input))
			.mockRejectedValueOnce(new Error('GPU lost'));
		await expect(
			categorizeWithAi(fail, many, DEFAULT_CATEGORIES, new AbortController().signal)
		).rejects.toThrow('GPU lost');
		expect(many.every((row) => row.categorySource === 'automatic')).toBe(true);
	});
	it('honors cancellation before and between model calls', async () => {
		const abort = new AbortController();
		abort.abort();
		const generate = vi.fn();
		await expect(
			categorizeWithAi(generate, rows, DEFAULT_CATEGORIES, abort.signal)
		).rejects.toThrow();
		expect(generate).not.toHaveBeenCalled();
		const during = new AbortController();
		const interrupted: CategoryClassifier = async (input) => {
			during.abort();
			return response(input);
		};
		await expect(
			categorizeWithAi(interrupted, rows, DEFAULT_CATEGORIES, during.signal)
		).rejects.toThrow();
	});
});
describe('atomic transaction review', () => {
	it('protects manual assignments during automatic tagging and retains approved overrides through rule changes', () => {
		const manual = setCategories(rows, [rows[0].id], CATEGORY_IDS.Shopping);
		const proposal = rows.map((row) => ({
			transactionId: row.id,
			categoryId: CATEGORY_IDS.Business
		}));
		expect(applyTagProposal(manual, proposal, DEFAULT_CATEGORIES)[0]).toEqual(manual[0]);
		const tagged = applyReviewedTagProposal(manual, proposal, DEFAULT_CATEGORIES, manual);
		expect(tagged[0].categoryOverride).toEqual({ categoryId: CATEGORY_IDS.Business, source: 'ai' });
		expect(
			applyRules(tagged, [{ keyword: 'UNKNOWN', categoryId: CATEGORY_IDS.Dining }])[0].categoryId
		).toBe(CATEGORY_IDS.Business);
	});
	it('rejects changed, deleted, unselected, or duplicated rows before applying anything', () => {
		const proposal = [{ transactionId: rows[0].id, categoryId: CATEGORY_IDS.Business }];
		for (const changed of [
			setCategories(rows, [rows[0].id], CATEGORY_IDS.Shopping),
			rows.slice(1),
			[{ ...rows[0], amountCents: -1 }, rows[1]]
		])
			expect(() =>
				applyReviewedTagProposal(changed, proposal, DEFAULT_CATEGORIES, [rows[0]])
			).toThrow();
		expect(() =>
			applyReviewedTagProposal(rows, [...proposal, ...proposal], DEFAULT_CATEGORIES, [
				rows[0],
				rows[1]
			])
		).toThrow();
		expect(() => applyReviewedTagProposal(rows, proposal, DEFAULT_CATEGORIES, rows)).toThrow();
		expect(() =>
			applyTagProposal(
				rows,
				[{ transactionId: 'missing', categoryId: CATEGORY_IDS.Dining }],
				DEFAULT_CATEGORIES
			)
		).toThrow();
	});
});
