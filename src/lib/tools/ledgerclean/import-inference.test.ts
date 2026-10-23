import { describe, it, expect } from 'vitest';
import { inferImport, rememberImportProfile, importProfileKey } from './import-inference';
import { readCsv, normalizeTransactions, exportTransactions } from './processing';
function infer(text: string) {
	const data = readCsv(text);
	return { data, ...inferImport(data, 'bank.csv', 'import') };
}
describe('automatic import inference', () => {
	it('imports named dates and explicit debit/credit columns without configuration', () => {
		const result = infer(
			'Date,Description,Debit,Credit\n02 Oct 2026,Store,12,\n01 Oct 2026,Deposit,,100'
		);
		expect(result.questions).toEqual([]);
		expect(
			normalizeTransactions(result.data, result.options).transactions.map((row) => row.amountCents)
		).toEqual([-1200, 10000]);
	});
	it('infers card expense signs from explicit purchases and keeps repayments distinct', () => {
		const result = infer(
			'transaction_date,transaction_type,merchant,amount\n2026-10-01,Purchase,Shop,12\n2026-10-02,Payment,,-100'
		);
		expect(result.questions).toEqual([]);
		expect(result.options.expenses).toBe('positive');
		expect(
			normalizeTransactions(result.data, result.options).transactions.map((row) => row.amountCents)
		).toEqual([-1200, 10000]);
	});
	it('keeps net cash amounts and chequing income in the bank-defined direction', () => {
		const result = infer(
			'effective_date,account_type,description,net_cash_amount\n2026-10-01,Chequing,Deposit,100'
		);
		expect(result.questions).toEqual([]);
		expect(result.options.expenses).toBe('negative');
	});
	it('imports positive-only spending by default and remembers the chosen direction', () => {
		const result = infer('Date,Description,Amount\n02 Oct 2026,Corner Shop,12');
		expect(result.questions).toEqual([]);
		expect(result.options.expenses).toBe('positive');
		result.options.expenses = 'positive';
		const profile = rememberImportProfile(result.options);
		const next = inferImport(result.data, 'renamed.csv', 'other', profile);
		expect(next.questions).toEqual([]);
		expect(next.options.expenses).toBe('positive');
	});
	it('recognizes opposite-sign card repayment conventions and ordinary positive payroll', () => {
		const result = infer(
			'Date,Description,Amount\n2026-10-01,OPENAI,20\n2026-10-01,Shop,10\n2026-10-02,PAYMENT RECEIVED,-100'
		);
		expect(result.questions).toEqual([]);
		expect(result.options.expenses).toBe('positive');
		const salary = infer('Date,Description,Amount\n2026-10-01,Shop,-20\n2026-10-02,PAYROLL,100');
		expect(salary.questions).toEqual([]);
		expect(salary.options.expenses).toBe('negative');
	});
	it('infers issuer payment signs even without a transaction-type column or spending rule', () => {
		const result = infer(
			'Date,Description,Amount\n2026-01-01,Shop,100\n2026-01-01,Other shop,10\n2026-01-02,PAYMENT - THANK YOU,-150'
		);
		expect(result.options.expenses).toBe('positive');
		expect(result.questions).toEqual([]);
		expect(
			normalizeTransactions(result.data, result.options, []).transactions[2].categoryId
		).not.toBe(normalizeTransactions(result.data, result.options, []).transactions[0].categoryId);
	});
	it('uses the most frequent sign regardless of categories, descriptions, or amount size', () => {
		for (const [amounts, expected] of [
			[[5, 10, -10000, 0], 'positive'],
			[[-5, -10, 10000, 0], 'negative'],
			[[10, -10, 0], 'negative'],
			[[0], 'negative']
		] as const) {
			const result = infer(
				'Date,Description,Amount\n' +
					amounts.map((amount) => `2026-10-01,Unknown,${amount}`).join('\n')
			);
			expect(result.questions).toEqual([]);
			expect(result.options.expenses).toBe(expected);
		}
	});
	it('preserves bank-defined signs even when deposits outnumber withdrawals', () => {
		for (const column of ['Amount', 'net_cash_amount']) {
			const result = infer(
				`Date,Description,Account Type,${column}\n2026-10-01,Deposit,Chequing,10\n2026-10-02,Deposit,Chequing,20\n2026-10-03,Shop,Chequing,-5`
			);
			expect(result.options.expenses).toBe('negative');
			expect(result.questions).toEqual([]);
		}
	});
	it('preserves explicit purchase semantics even when payments outnumber purchases', () => {
		const result = infer(
			'Date,Description,transaction_type,Amount\n2026-10-01,Shop,Purchase,10\n2026-10-02,Payment,Payment,-20\n2026-10-03,Payment,Payment,-30'
		);
		expect(result.options.expenses).toBe('positive');
		expect(result.questions).toEqual([]);
	});
	it('asks about ambiguous numeric dates and detects unambiguous numeric order', () => {
		expect(infer('Date,Description,Amount\n02/03/2026,Shop,-12').questions).toEqual(['dateOrder']);
		const result = infer('Date,Description,Amount\n22/03/2026,Shop,-12');
		expect(result.questions).toEqual([]);
		expect(result.options.dateOrder).toBe('DMY');
	});
	it('asks only for missing columns and accounts that cannot be identified', () => {
		expect(infer('When,What,Value\n2026-10-01,Shop,-12').questions).toEqual([
			'date',
			'description',
			'amount'
		]);
		const data = readCsv('Date,Description,Amount\n2026-10-01,Shop,-12');
		expect(
			inferImport(data, 'new.csv', 'import', undefined, [{ name: 'Main', type: 'cash' }]).questions
		).toEqual(['account']);
	});
	it('asks which account a new card format belongs to instead of silently merging another card', () => {
		const data = readCsv(
			'transaction_date,transaction_type,merchant,amount\n2026-10-01,Purchase,Shop,-12\n2026-10-02,Payment,,-100'
		);
		expect(
			inferImport(data, 'another-card.csv', 'new', undefined, [
				{ name: 'First card', type: 'credit' }
			]).questions
		).toEqual(['account']);
	});
	it('recognizes signed LedgerClean exports without asking about positive refunds', () => {
		const first = infer('Date,Description,Amount\n2026-10-01,Shop,-12');
		const tx = normalizeTransactions(first.data, first.options).transactions;
		const exported = readCsv(
			exportTransactions([
				...tx,
				{ ...tx[0], id: 'refund', amountCents: 1200, accountType: 'credit' }
			])
		);
		expect(inferImport(exported, 'cleaned.csv', 'export').questions).toEqual([]);
	});
	it('keys remembered formats independently of row ordering and filename', () => {
		expect(importProfileKey(['Date', 'Description', 'Amount'])).toBe(
			importProfileKey(['Amount', 'Date', 'Description'])
		);
		expect(importProfileKey(['Date', 'Description', 'Amount'])).not.toBe(
			importProfileKey(['date', 'description', 'amount'])
		);
	});
});
