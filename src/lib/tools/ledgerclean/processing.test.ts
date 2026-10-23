import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, DEFAULT_CATEGORIES, UNCATEGORIZED_ID, addCategory } from './category-model';
import {
	applyRules,
	defaultImportOptions,
	exportTransactions,
	filterTransactions,
	mapImportColumn,
	normalizeDate,
	normalizeTransactions,
	parseMoney,
	previousMonth,
	readCsv,
	saveRule,
	setCategory,
	restoreDefaultCategories,
	summarizeMonths,
	summarizeYearSpending
} from './processing';

function importCsv(csv: string, expenses: 'negative' | 'positive' = 'negative') {
	const data = readCsv(csv);
	return normalizeTransactions(data, {
		...defaultImportOptions(data.headers, 'test.csv'),
		expenses
	});
}

describe('CSV import', () => {
	it('moves column assignments and preserves import options without mutating the proposal', () => {
		const initial = defaultImportOptions(['Date', 'Description', 'Amount', 'Posted'], 'bank.csv');
		const changed = mapImportColumn(initial, 'Posted', 'date');
		expect(changed.columns.date).toBe('Posted');
		expect(initial.columns.date).toBe('Date');
		const moved = mapImportColumn(changed, 'Posted', 'description');
		expect(moved.columns.date).toBe('');
		expect(moved.columns.description).toBe('Posted');
		expect(mapImportColumn(moved, 'Posted', '').columns.description).toBe('');
		expect(moved.currency).toBe(initial.currency);
	});
	it('switches between amount and debit/credit mappings without leaving conflicting columns', () => {
		const initial = defaultImportOptions(
			['Date', 'Description', 'Amount', 'Out', 'In'],
			'bank.csv'
		);
		const debit = mapImportColumn(initial, 'Out', 'debit');
		const split = mapImportColumn(debit, 'In', 'credit');
		expect(split.amountMode).toBe('split');
		expect(split.columns).toMatchObject({ amount: '', debit: 'Out', credit: 'In' });
		const signed = mapImportColumn(split, 'Amount', 'amount');
		expect(signed.amountMode).toBe('signed');
		expect(signed.columns).toMatchObject({ amount: 'Amount', debit: '', credit: '' });
	});
	it('handles BOMs, quoted commas, multiline descriptions, escaped quotes and semicolon delimiters', () => {
		const data = readCsv(
			'\uFEFFDate;Description;Amount\r\n2026-01-02;"Market, ""Shop""\nVisit";-12.34'
		);
		expect(data.headers).toEqual(['Date', 'Description', 'Amount']);
		expect(data.rows[0].Description).toBe('Market, "Shop"\nVisit');
		expect(
			normalizeTransactions(data, defaultImportOptions(data.headers, 'test.csv')).transactions[0]
				.amountCents
		).toBe(-1234);
	});
	it('detects columns without choosing balances as amounts', () => {
		const options = defaultImportOptions(
			['Balance', 'Transaction Date', 'Payee', 'Debit', 'Credit'],
			'bank.csv'
		);
		expect(options.amountMode).toBe('split');
		expect(options.columns).toMatchObject({
			date: 'Transaction Date',
			description: 'Payee',
			amount: '',
			debit: 'Debit',
			credit: 'Credit'
		});
	});
	it('normalizes separate debits and credits, including credits without a debit column', () => {
		const result = importCsv(
			'Date,Description,Debit,Credit\n2026-01-02,Store,10.50,\n2026-01-03,PAYROLL,,3000\n2026-01-04,Invalid,10,20\n2026-01-05,Refund,-5,\n2026-01-06,Missing amount,,'
		);
		expect(result.transactions.map((row) => row.amountCents)).toEqual([-1050, 300000, 500]);
		expect(result.issues).toHaveLength(2);
		expect(
			importCsv('Date,Description,Credit\n2026-01-01,PAYROLL,3000').transactions[0].amountCents
		).toBe(300000);
	});
	it('supports positive expense statements and does not fabricate missing dates or zero amounts', () => {
		const result = importCsv(
			'Date,Description,Amount\n2026-02-01,OPENAI,25\n2026-02-02,PAYMENT RECEIVED,-100\n,Missing date,15\n2026-02-03,Bad amount,nope\n2026-02-30,Impossible date,50',
			'positive'
		);
		expect(result.transactions.map((row) => row.amountCents)).toEqual([-2500, 10000]);
		expect(result.transactions[0].categoryId).toBe(CATEGORY_IDS.Uncategorized);
		expect(result.issues.map((issue) => issue.row)).toEqual([4, 5, 6]);
	});
	it('imports written statement dates and groups them into their correct months', () => {
		const result = importCsv(
			'Date,Description,Amount\n02 Oct 2026,Store,-20\n01 Oct 2026,Store,-10\n30 Sep 2026,Store,-15\n29 Sep 2026,Store,-5\n28 Sep 2026,Store,-5'
		);
		expect(result.issues).toEqual([]);
		expect(result.transactions.map((row) => row.date)).toEqual([
			'2026-10-02',
			'2026-10-01',
			'2026-09-30',
			'2026-09-29',
			'2026-09-28'
		]);
		expect(summarizeMonths(result.transactions, 'CAD')).toMatchObject([
			{ month: '2026-10', spendingCents: 3000, count: 2 },
			{ month: '2026-09', spendingCents: 2500, count: 3 }
		]);
	});
	it('rejects malformed fields and missing or duplicate headers', () => {
		expect(() => readCsv('Date,Description,Amount\n2026-01-01,Store,10,extra')).toThrow('fields');
		expect(() => readCsv('Date,Date,Amount\n2026-01-01,Store,10')).toThrow('unique');
		expect(() => readCsv('Date,,Amount\n2026-01-01,Store,10')).toThrow('nonempty');
		expect(() => importCsv('Date,Description,Balance\n2026-01-01,Store,10')).toThrow('Choose');
		expect(() => readCsv('Date,Description,Amount\n2026-01-01,"unclosed,10')).toThrow(
			'CSV could not be read'
		);
	});
	it('validates currency rather than mixing unsupported values into totals', () => {
		const result = importCsv(
			'Date,Description,Amount,Currency\n2026-01-01,Store,-10,USD\n2026-01-01,Store,-10,INVALID'
		);
		expect(result.transactions[0].currency).toBe('USD');
		expect(result.issues).toHaveLength(1);
	});
});

describe('yearly spending chart data', () => {
	const csv =
		'Date,Description,Amount,Currency,Category\n2025-12-31,Old purchase,-999,CAD,Shopping and Personal\n2026-01-01,Salary,3000,CAD,Income\n2026-01-02,Market,-100,CAD,Groceries\n2026-01-03,Refund,20,CAD,Groceries\n2026-01-04,Hosting,-25,CAD,Business\n2026-01-05,Payment,500,CAD,Savings\n2026-01-06,Foreign purchase,-1000,USD,Shopping and Personal\n2026-02-01,Restaurant,-50,CAD,Dining\n2026-02-02,Prior purchase refund,75,CAD,Shopping and Personal\n2026-03-01,Salary,3000,CAD,Income';
	it('returns all twelve months with stable category order and separates years and currencies', () => {
		const rows = importCsv(csv).transactions;
		const months = summarizeYearSpending(rows, '2026', 'CAD');
		expect(months).toHaveLength(12);
		expect(months[0]).toEqual({
			month: '2026-01',
			count: 5,
			spendingCents: 10500,
			categories: [
				{ categoryId: CATEGORY_IDS.Business, amountCents: 2500 },
				{ categoryId: CATEGORY_IDS.Household, amountCents: 8000 }
			]
		});
		expect(months.at(-1)).toEqual({ month: '2026-12', count: 0, spendingCents: 0, categories: [] });
		expect(summarizeYearSpending(rows, '2025', 'CAD')[11].spendingCents).toBe(99900);
		expect(summarizeYearSpending(rows, '2026', 'USD')[0].spendingCents).toBe(100000);
	});
	it('preserves negative category totals and agrees with monthly summaries', () => {
		const rows = importCsv(csv).transactions;
		const months = summarizeYearSpending(rows, '2026', 'CAD');
		expect(months[1]).toEqual({
			month: '2026-02',
			count: 2,
			spendingCents: -2500,
			categories: [
				{ categoryId: CATEGORY_IDS.Dining, amountCents: 5000 },
				{ categoryId: CATEGORY_IDS.Shopping, amountCents: -7500 }
			]
		});
		for (const summary of summarizeMonths(rows, 'CAD').filter((month) =>
			month.month.startsWith('2026')
		)) {
			expect(months.find((month) => month.month === summary.month)?.spendingCents).toBe(
				summary.spendingCents
			);
		}
	});
	it('distinguishes imported months with no spending from missing months', () => {
		const months = summarizeYearSpending(importCsv(csv).transactions, '2026', 'CAD');
		expect(months[2]).toEqual({ month: '2026-03', count: 1, spendingCents: 0, categories: [] });
		expect(months[3]).toEqual({ month: '2026-04', count: 0, spendingCents: 0, categories: [] });
	});
	it('updates category stacks after manual edits and rule propagation', () => {
		const rows = importCsv(
			'Date,Description,Amount\n2026-01-02,Market,-100\n2026-02-02,Market,-75'
		).transactions;
		const manual = setCategory(rows, rows[0].id, CATEGORY_IDS.Business);
		const applied = applyRules(manual, [{ keyword: 'Market', categoryId: CATEGORY_IDS.Dining }]);
		const months = summarizeYearSpending(applied, '2026', 'CAD');
		expect(months[0].categories).toEqual([
			{ categoryId: CATEGORY_IDS.Business, amountCents: 10000 }
		]);
		expect(months[1].categories).toEqual([{ categoryId: CATEGORY_IDS.Dining, amountCents: 7500 }]);
	});
});

describe('date and amount normalization', () => {
	it('validates calendar dates and honors explicit date order without timezone shifts', () => {
		expect(normalizeDate('03/04/2026', 'MDY')).toBe('2026-03-04');
		expect(normalizeDate('03/04/2026', 'DMY')).toBe('2026-04-03');
		expect(normalizeDate('2024-02-29', 'MDY')).toBe('2024-02-29');
		expect(normalizeDate('2026-02-29', 'MDY')).toBeNull();
		expect(normalizeDate('', 'MDY')).toBeNull();
	});
	it.each([
		['$1,234.56', 123456],
		['CAD -10.05', -1005],
		['($25.00)', -2500],
		['0.01', 1],
		['0.10', 10],
		['0', 0],
		['1,2.00', null],
		['NaN', null],
		['123abc', null],
		['', null],
		['1.999', null],
		['(-5)', null],
		['9007199254740991', null]
	])('parses %s as %s integer cents', (input, expected) => {
		expect(parseMoney(input as string)).toBe(expected);
	});
});

describe('categorization, monthly trends, and exports', () => {
	const csv =
		'Date,Description,Amount,Currency\n2025-12-31,PAYROLL,1000,CAD\n2025-12-31,Store,-100,CAD\n2026-01-01,PAYROLL,1000,CAD\n2026-01-02,OPENAI,-25,CAD\n2026-01-03,Store,-200,CAD\n2026-01-04,STARBUCKS refund,10,CAD\n2026-01-05,PAYMENT RECEIVED,500,CAD\n2026-01-06,Foreign Store,-999,USD';
	it('includes Business in spending, offsets refunds, separates income and transfers, and keeps years/currencies separate', () => {
		const rows = applyRules(importCsv(csv).transactions, [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'STARBUCKS', categoryId: CATEGORY_IDS.Dining, source: 'manual' }
		]);
		expect(summarizeMonths(rows, 'CAD')).toMatchObject([
			{ month: '2026-01', spendingCents: 21500, incomeCents: 100000, netCents: 78500, count: 5 },
			{ month: '2025-12', spendingCents: 10000, incomeCents: 100000, netCents: 90000, count: 2 }
		]);
		expect(summarizeMonths(rows, 'USD')[0].spendingCents).toBe(99900);
		expect(previousMonth('2026-01')).toBe('2025-12');
	});
	it('propagates new rules to inferred rows and future imports without overwriting manual edits', () => {
		const rows = applyRules(importCsv(csv).transactions, [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'STARBUCKS', categoryId: CATEGORY_IDS.Dining, source: 'manual' }
		]);
		const manual = setCategory(rows, rows[1].id, CATEGORY_IDS.Shopping);
		const rules = saveRule([], { keyword: 'store', categoryId: CATEGORY_IDS.Dining });
		const applied = applyRules(manual, rules);
		expect(applied[1].categoryId).toBe(CATEGORY_IDS.Shopping);
		expect(applied[4].categoryId).toBe(CATEGORY_IDS.Dining);
		expect(rows[1].categoryId).toBe(CATEGORY_IDS.Uncategorized);
		const data = readCsv('Date,Description,Amount\n2026-02-01,STORE,-20');
		expect(
			normalizeTransactions(data, defaultImportOptions(data.headers, 'new.csv'), rules)
				.transactions[0].categoryId
		).toBe(CATEGORY_IDS.Dining);
		expect(saveRule(rules, { keyword: 'STORE', categoryId: CATEGORY_IDS.Business })).toEqual([
			{ keyword: 'STORE', categoryId: CATEGORY_IDS.Business }
		]);
	});
	it('combines month, currency, category, direction, and text filters', () => {
		const rows = applyRules(importCsv(csv).transactions, [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'STARBUCKS', categoryId: CATEGORY_IDS.Dining, source: 'manual' }
		]);
		expect(
			filterTransactions(rows, {
				month: '2026-01',
				currency: 'CAD',
				type: 'out',
				search: 'openai',
				categoryId: CATEGORY_IDS.Business
			})
		).toHaveLength(1);
		expect(filterTransactions(rows, { month: '2026-01', type: 'transfers' })[0].categoryId).toBe(
			CATEGORY_IDS.Savings
		);
	});
	it('exports signed numeric amounts, preserves categories on reimport, and neutralizes formula descriptions', () => {
		const rows = applyRules(importCsv(csv).transactions, [
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'manual' },
			{ keyword: 'STARBUCKS', categoryId: CATEGORY_IDS.Dining, source: 'manual' }
		]);
		const exported = exportTransactions(rows);
		const data = readCsv(exported);
		expect(data.rows[3].Amount).toBe('-25');
		const roundtrip = normalizeTransactions(data, defaultImportOptions(data.headers, 'clean.csv'));
		expect(roundtrip.issues).toEqual([]);
		expect(
			roundtrip.transactions.map((row) => [row.date, row.amountCents, row.categoryId, row.currency])
		).toEqual(rows.map((row) => [row.date, row.amountCents, row.categoryId, row.currency]));
		const injected = exportTransactions([{ ...rows[0], description: '=HYPERLINK("example")' }]);
		expect(readCsv(injected).rows[0].Description.startsWith("'=HYPERLINK")).toBe(true);
	});
});

describe('Category reset', () => {
	it('restores defaults, rolls custom descendants into a default ancestor, and clears orphaned references', () => {
		const child = '123456789012345678901';
		const orphan = '123456789012345678902';
		const current = addCategory(
			addCategory(
				DEFAULT_CATEGORIES,
				{
					name: 'Models',
					parentId: CATEGORY_IDS.Business,
					kind: 'expense',
					color: '#abcdef',
					origin: 'ai'
				},
				() => child
			),
			{
				name: 'Custom spending',
				parentId: null,
				kind: 'expense',
				color: '#fedcba',
				origin: 'user'
			},
			() => orphan
		);
		current[CATEGORY_IDS.Business] = {
			...current[CATEGORY_IDS.Business],
			name: 'Renamed business',
			color: '#aaaaaa'
		};
		const imported = importCsv(
			'Date,Description,Amount\n2026-01-01,Known,-10\n2026-01-02,Custom,-20\n2026-01-03,Other,-30'
		).transactions.map((row, i) => ({
			...row,
			categoryId: [CATEGORY_IDS.Business, child, orphan][i],
			categorySource: 'manual' as const
		}));
		const rules = [
			{ keyword: 'CUSTOM', categoryId: child },
			{ keyword: 'OTHER', categoryId: orphan }
		];
		const snapshot = structuredClone({ current, imported, rules });
		const result = restoreDefaultCategories(imported, current, rules);
		expect(result.categories).toEqual(DEFAULT_CATEGORIES);
		expect(result.categories).not.toBe(DEFAULT_CATEGORIES);
		expect(result.transactions.map((row) => [row.categoryId, row.categorySource])).toEqual([
			[CATEGORY_IDS.Business, 'manual'],
			[CATEGORY_IDS.Business, 'manual'],
			[UNCATEGORIZED_ID, 'automatic']
		]);
		expect(
			result.transactions.map((row) => [
				row.id,
				row.date,
				row.amountCents,
				row.source,
				row.importId
			])
		).toEqual(imported.map((row) => [row.id, row.date, row.amountCents, row.source, row.importId]));
		expect(result.rules).toEqual([{ keyword: 'CUSTOM', categoryId: CATEGORY_IDS.Business }]);
		expect({ current, imported, rules }).toEqual(snapshot);
	});
	it('can clear all assignments and rules for a fresh categorization without removing transactions', () => {
		const imported = importCsv(
			'Date,Description,Amount\n2026-01-01,OPENAI,-20\n2026-01-02,PAYROLL,3000'
		).transactions;
		const result = restoreDefaultCategories(
			imported,
			DEFAULT_CATEGORIES,
			[{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business }],
			true
		);
		expect(result.transactions).toHaveLength(2);
		expect(
			result.transactions.every(
				(row) =>
					row.categoryId === (row.amountCents > 0 ? CATEGORY_IDS.Income : UNCATEGORIZED_ID) &&
					row.categorySource === 'automatic'
			)
		).toBe(true);
		expect(result.rules).toEqual([]);
		expect(result.transactions.map((row) => row.amountCents)).toEqual([-2000, 300000]);
	});
});
