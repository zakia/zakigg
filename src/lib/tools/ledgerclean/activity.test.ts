import { describe, expect, it } from 'vitest';
import { BUDGET_LABELS, budgetFlow, detectedAccountType, setBudgetOverrides } from './activity';
import { CATEGORY_IDS, DEFAULT_CATEGORIES } from './category-model';
import { identifyTransactions, planImport } from './identity';
import { emptyWorkspace, loadWorkspace, persistWorkspace } from './workspace-storage';
import {
	applyRules,
	defaultImportOptions,
	exportTransactions,
	filterTransactions,
	mergeCategoryMappings,
	normalizeTransactions,
	proposedCategoryMappings,
	readCsv,
	saveRule,
	setCategory,
	summarizeMonths,
	summarizeYearSpending,
	restoreDefaultCategories,
	type ImportOptions,
	type Rule
} from './processing';
const card = `transaction_date,transaction_type,status,merchant,amount,currency,notes,category
2026-10-01,Purchase,Completed,Corner Store,-100,CAD,,Groceries
2026-10-02,Refund,Completed,Corner Store,20,CAD,,Groceries
2026-10-03,Payment,Completed,,100,CAD,,Uncategorized
2026-10-04,Purchase,Pending,Clinic,-30,CAD,,Medical`;
const cash = `effective_date,effective_time,settlement_date,account_id,account_type,activity_type,activity_sub_type,description,direction,symbol,name,currency,quantity,unit_price,commission,net_cash_amount
2026-10-01,12:00,2026-10-02,bank-a,Chequing,MoneyMovement,AFT_IN,Deposit,IN,,,CAD,0,0,0,1000
2026-10-02,12:00,2026-10-02,bank-a,Chequing,MoneyMovement,OBP_OUT,Online bill payment,OUT,,,CAD,0,0,0,-100
2026-10-03,12:00,2026-10-03,bank-a,Chequing,MoneyMovement,AFT_OUT,Pre-authorized Debit,OUT,,,CAD,0,0,0,-50
2026-10-04,12:00,2026-10-04,bank-a,Chequing,MoneyMovement,TRANSFER,Transfer,OUT,,,CAD,0,0,0,-200
2026-10-05,12:00,2026-10-05,bank-a,Chequing,MoneyMovement,E_TRFOUT,Payment to person,OUT,,,CAD,0,0,0,-10`;
function parse(text: string, patch: Partial<ImportOptions> = {}, rules: Rule[] = []) {
	const data = readCsv(text);
	const options = { ...defaultImportOptions(data.headers, 'synthetic.csv', 'synthetic'), ...patch };
	return { data, options, ...normalizeTransactions(data, options, rules) };
}
function flows(rows: ReturnType<typeof parse>['transactions']) {
	return rows.map((row) => budgetFlow(row, DEFAULT_CATEGORIES));
}
describe('account activity and budget treatment', () => {
	it('detects generic card and chequing columns and keeps payments with blank merchants', () => {
		const credit = parse(card),
			bank = parse(cash);
		expect(credit.issues).toEqual([]);
		expect(bank.issues).toEqual([]);
		expect(credit.transactions).toHaveLength(4);
		expect(credit.transactions[2].description).toBe('Payment');
		expect(detectedAccountType(credit.data, credit.options)).toBe('credit');
		expect(bank.options.columns.amount).toBe('net_cash_amount');
		expect(bank.transactions[0]).toMatchObject({
			amountCents: 100000,
			accountType: 'cash',
			account: 'bank-a',
			categoryId: CATEGORY_IDS.Income
		});
		expect(flows(credit.transactions)).toEqual(['expense', 'expense', 'transfer', 'expense']);
	});
	it('counts every CSV row regardless of status, nets refunds, and excludes repayments', () => {
		const tx = parse(card).transactions;
		expect(summarizeMonths(tx, 'CAD')[0]).toMatchObject({
			incomeCents: 0,
			spendingCents: 11000,
			netCents: -11000,
			count: 4
		});
		const month = summarizeYearSpending(tx, '2026', 'CAD')[9];
		expect(month.spendingCents).toBe(11000);
		expect(month.categories).toEqual(
			expect.arrayContaining([
				{ categoryId: CATEGORY_IDS.Household, amountCents: 8000 },
				{ categoryId: CATEGORY_IDS.Health, amountCents: 3000 }
			])
		);
	});
	it('keeps issuer repayments out of spending after rules and assignments are reset', () => {
		const statement =
			'Date,Description,Amount\n2026-01-01,Shop,100\n2026-01-02,PAYMENT RECEIVED - THANK YOU,-100\n2026-02-01,Shop,20\n2026-02-02,PAYMENT RECEIVED - THANK YOU,-200\n2026-02-03,Shop,-5';
		const tx = parse(statement, { expenses: 'positive' }).transactions;
		const reset = restoreDefaultCategories(tx, DEFAULT_CATEGORIES, [], true);
		expect(reset.rules).toEqual([]);
		expect(
			reset.transactions
				.filter((row) => row.description.includes('THANK YOU'))
				.every((row) => row.categoryId === CATEGORY_IDS.Savings)
		).toBe(true);
		expect(
			summarizeYearSpending(reset.transactions, '2026', 'CAD')
				.slice(0, 2)
				.map((month) => month.spendingCents)
		).toEqual([10000, 1500]);
		expect(summarizeMonths(reset.transactions, 'CAD').map((month) => month.spendingCents)).toEqual([
			1500, 10000
		]);
	});
	it('does not mistake chequing customer receipts or generic bill payments for card repayments', () => {
		const tx = parse(
			'Date,Description,Amount,Account Type\n2026-01-01,PAYMENT RECEIVED - THANK YOU,200,Chequing\n2026-01-02,Online bill payment,-100,Chequing\n2026-01-03,CREDIT CARD PAYMENT,-50,Chequing'
		).transactions;
		expect(flows(tx)).toEqual(['income', 'expense', 'transfer']);
	});
	it('recomputes stored repayment rows without rewriting signs or transaction identities', () => {
		const tx = parse(
			'Date,Description,Amount\n2026-01-01,Shop,100\n2026-01-02,PAYMENT RECEIVED - THANK YOU,-100',
			{ expenses: 'positive' }
		).transactions;
		const payment = { ...tx[1], categoryId: CATEGORY_IDS.Uncategorized };
		let raw = '';
		persistWorkspace(
			{ setItem: (_key, value) => (raw = value) },
			{
				...emptyWorkspace(),
				rules: [],
				transactions: [tx[0], payment],
				imports: [
					{
						id: 'synthetic',
						name: 'synthetic.csv',
						count: 2,
						amountMode: 'signed',
						expenses: 'positive'
					}
				]
			}
		);
		const loaded = loadWorkspace({ getItem: () => raw });
		expect(loaded.transactions[1]).toMatchObject({
			id: payment.id,
			amountCents: payment.amountCents,
			categoryId: CATEGORY_IDS.Savings
		});
		expect(summarizeYearSpending(loaded.transactions, '2026', 'CAD')[0].spendingCents).toBe(10000);
	});
	it('defaults unclassified money in to income and money out to review after reset and reload', () => {
		const tx = parse(
			'Date,Description,Amount\n2026-01-01,Unknown purchase,-100\n2026-01-02,Unknown deposit,200',
			{},
			[]
		).transactions;
		const reset = restoreDefaultCategories(tx, DEFAULT_CATEGORIES, [], true);
		expect(reset.transactions.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Income
		]);
		expect(flows(reset.transactions)).toEqual(['expense', 'income']);
		expect(summarizeMonths(reset.transactions, 'CAD')[0]).toMatchObject({
			spendingCents: 10000,
			incomeCents: 20000
		});
	});
	it('keeps repayment treatment independent of spending categories and rules', () => {
		const tx = parse(
			'Date,Description,Amount\n2026-01-01,Shop,100\n2026-01-02,PAYMENT RECEIVED,-200',
			{ expenses: 'positive' },
			[]
		).transactions;
		const categories = {
			...DEFAULT_CATEGORIES,
			[CATEGORY_IDS.Savings]: {
				...DEFAULT_CATEGORIES[CATEGORY_IDS.Savings],
				kind: 'expense' as const
			}
		};
		expect(budgetFlow(tx[1], categories)).toBe('transfer');
		expect(summarizeMonths(tx, 'CAD', categories)[0]).toMatchObject({
			spendingCents: 10000,
			incomeCents: 0
		});
	});
	it('keeps ambiguous bills and debits as spending; explicit transfers stay out of income and spending', () => {
		const tx = parse(cash).transactions;
		expect(flows(tx)).toEqual(['income', 'expense', 'expense', 'transfer', 'expense']);
		expect(summarizeMonths(tx, 'CAD')[0]).toMatchObject({
			incomeCents: 100000,
			spendingCents: 16000
		});
		const flagged = applyRules(setBudgetOverrides(tx, [tx[1].id], 'transfer'), []);
		expect(summarizeMonths(flagged, 'CAD')[0].spendingCents).toBe(6000);
		expect(filterTransactions(flagged, { type: 'transfers' })).toHaveLength(2);
		expect(applyRules(setBudgetOverrides(flagged, [tx[1].id], null), [])[1].categoryId).toBe(
			CATEGORY_IDS.Uncategorized
		);
	});
	it('excludes individual or selected rows without removing their categories, and restores them', () => {
		let tx = parse(card).transactions;
		tx = setCategory(tx, tx[0].id, CATEGORY_IDS.Business);
		const flagged = applyRules(setBudgetOverrides(tx, [tx[0].id, tx[1].id], 'exclude'), []);
		expect(flagged[0].categoryId).toBe(CATEGORY_IDS.Business);
		expect(filterTransactions(flagged, { type: 'excluded' })).toHaveLength(2);
		expect(summarizeMonths(flagged, 'CAD')[0].spendingCents).toBe(3000);
		expect(filterTransactions(flagged, { type: 'out' })).toHaveLength(1);
		expect(
			summarizeMonths(
				applyRules(setBudgetOverrides(flagged, [tx[0].id, tx[1].id], null), []),
				'CAD'
			)[0].spendingCents
		).toBe(11000);
	});
	it('lets cash refunds offset an expense category, while ordinary deposits are income', () => {
		const tx = parse(cash).transactions;
		expect(budgetFlow(tx[0], DEFAULT_CATEGORIES)).toBe('income');
		const refund = setCategory(tx, tx[0].id, CATEGORY_IDS.Health)[0];
		expect(budgetFlow(refund, DEFAULT_CATEGORIES)).toBe('expense');
		expect(summarizeMonths([refund], 'CAD')[0]).toMatchObject({
			spendingCents: -100000,
			incomeCents: 0
		});
	});
	it('allows overriding inferred account type and handles mixed explicit account types per row', () => {
		expect(
			parse(card, { accountType: 'cash' }).transactions.every((row) => row.accountType === 'cash')
		).toBe(true);
		const tx = parse(
			'Date,Description,Amount,Account Type\n2026-10-01,Refund,10,Credit card\n2026-10-01,Deposit,20,Chequing'
		).transactions;
		expect(flows(tx)).toEqual(['expense', 'income']);
		expect(parse(card, { accountType: 'unknown' }).transactions[0].accountType).toBeUndefined();
	});
	it('preserves bank labels and maps exact names into reusable rules without inventing category roots', () => {
		const parsed = parse(card);
		expect(parsed.transactions[0].sourceCategory).toBe('Groceries');
		expect(parsed.transactions[0].categoryOverride).toBeNull();
		expect(parsed.transactions[3].categoryId).toBe(CATEGORY_IDS.Medical);
		const mappings = {
			...proposedCategoryMappings(parsed.data, parsed.options.columns, [], DEFAULT_CATEGORIES),
			Medical: CATEGORY_IDS.Health
		};
		const rules = mergeCategoryMappings([], mappings, DEFAULT_CATEGORIES);
		const renamed = {
			...DEFAULT_CATEGORIES,
			[CATEGORY_IDS.Health]: { ...DEFAULT_CATEGORIES[CATEGORY_IDS.Health], name: 'Wellbeing' }
		};
		const tx = normalizeTransactions(
			parsed.data,
			{ ...parsed.options, categoryMappings: mappings },
			rules,
			renamed
		).transactions;
		expect(tx[3].categoryId).toBe(CATEGORY_IDS.Health);
		expect(rules.find((rule) => rule.keyword === 'MEDICAL')).toMatchObject({
			field: 'sourceCategory',
			match: 'exact',
			source: 'import'
		});
		expect(applyRules(tx, rules, renamed)[3].categoryId).toBe(CATEGORY_IDS.Health);
	});
	it('lets description rules refine imported hints and distinguishes same-valued rules on different fields', () => {
		const parsed = parse(card);
		let rules = mergeCategoryMappings(
			[],
			{ Medical: CATEGORY_IDS.Health, Groceries: CATEGORY_IDS.Dining },
			DEFAULT_CATEGORIES
		);
		rules = saveRule(rules, {
			keyword: 'Corner Store',
			categoryId: CATEGORY_IDS.Business,
			match: 'exact',
			source: 'ai'
		});
		expect(applyRules(parsed.transactions, rules)[0].categoryId).toBe(CATEGORY_IDS.Business);
		rules = saveRule(rules, {
			keyword: 'Medical',
			categoryId: CATEGORY_IDS.Shopping,
			match: 'exact',
			source: 'manual'
		});
		expect(rules.filter((rule) => rule.keyword === 'MEDICAL')).toHaveLength(2);
		expect(applyRules(parsed.transactions, rules)[3].categoryId).toBe(CATEGORY_IDS.Health);
		expect(
			mergeCategoryMappings(
				rules,
				{ Medical: CATEGORY_IDS.Uncategorized },
				DEFAULT_CATEGORIES
			).filter((rule) => rule.keyword === 'MEDICAL')
		).toHaveLength(1);
	});
	it('ignores changing CSV status during dedupe and preserves IDs, flags, and edits', async () => {
		const original = { ...parse(card).transactions[3], budgetOverride: 'exclude' as const };
		const identified = await identifyTransactions([], [original]);
		const existing = setCategory(identified, identified[0].id, CATEGORY_IDS.Business);
		const incoming = parse(card.replace(',Pending,', ',Completed,')).transactions[3];
		expect(original).not.toHaveProperty('status');
		expect(incoming).not.toHaveProperty('status');
		const plan = planImport(existing, [{ transactions: [incoming] }])[0];
		expect(plan.added).toHaveLength(0);
		expect(plan.duplicates).toHaveLength(1);
		expect(existing[0]).toMatchObject({
			id: identified[0].id,
			budgetOverride: 'exclude',
			categoryOverride: { categoryId: CATEGORY_IDS.Business, source: 'manual' }
		});
		const staged = planImport(
			[],
			[{ transactions: [original, original] }, { transactions: [incoming] }]
		);
		expect(staged.map((batch) => batch.added.length)).toEqual([2, 0]);
	});
	it('roundtrips raw bank metadata and budget flags through storage and CSV export', () => {
		const parsed = parse(card);
		const workspace = emptyWorkspace();
		workspace.rules = mergeCategoryMappings(
			[],
			{ Groceries: CATEGORY_IDS.Dining, Medical: CATEGORY_IDS.Health },
			workspace.categories
		);
		workspace.transactions = applyRules(
			setBudgetOverrides(parsed.transactions, [parsed.transactions[0].id], 'exclude'),
			workspace.rules
		);
		workspace.imports = [
			{
				id: 'synthetic',
				name: 'synthetic.csv',
				count: 4,
				amountMode: 'signed',
				expenses: 'negative'
			}
		];
		let json = '';
		persistWorkspace({ setItem: (_key, value) => (json = value) }, workspace);
		const legacy = JSON.parse(json);
		legacy.transactions[3].status = 'Pending';
		const loaded = loadWorkspace({ getItem: () => JSON.stringify(legacy) });
		expect(loaded.transactions[3]).not.toHaveProperty('status');
		expect(budgetFlow(loaded.transactions[3], DEFAULT_CATEGORIES)).toBe('expense');
		expect(loaded.transactions).toEqual(workspace.transactions);
		const exportCsv = exportTransactions(loaded.transactions);
		expect(readCsv(exportCsv).headers).not.toContain('Status');
		const exported = parse(exportCsv).transactions;
		expect(flows(exported)).toEqual(flows(loaded.transactions));
		expect(exported.map((row) => row.sourceCategory)).toEqual(
			loaded.transactions.map((row) => row.sourceCategory)
		);
		expect(JSON.parse(json).transactions[0]).not.toHaveProperty('categoryId');
	});
	it('loads schema version 2 without changing historical facts or category overrides', () => {
		const workspace = emptyWorkspace();
		const parsed = parse('Date,Description,Amount\n2026-10-01,Old merchant,-20');
		workspace.transactions = parsed.transactions;
		workspace.imports = [
			{
				id: 'synthetic',
				name: 'synthetic.csv',
				count: 1,
				amountMode: 'signed',
				expenses: 'negative'
			}
		];
		let json = '';
		persistWorkspace({ setItem: (_key, value) => (json = value) }, workspace);
		const old = JSON.parse(json);
		old.version = 2;
		delete old.starterVersion;
		const loaded = loadWorkspace({ getItem: () => JSON.stringify(old) });
		expect(loaded.version).toBe(5);
		expect(loaded.transactions).toEqual(workspace.transactions);
		expect(BUDGET_LABELS[budgetFlow(loaded.transactions[0], DEFAULT_CATEGORIES)]).toBe(
			'Spending / refund'
		);
	});
});
