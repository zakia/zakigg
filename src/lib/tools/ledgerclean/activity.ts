import { UNCATEGORIZED_ID, type CategoryDictionary } from './category-model';
import type { CsvData, ImportOptions, Transaction } from './processing';

export type AccountType = 'unknown' | 'cash' | 'credit';
export type BudgetOverride = 'transfer' | 'exclude' | null;
export type BudgetFlow = 'expense' | 'income' | 'transfer' | 'excluded';
const token = (value = '') =>
	value
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[\s_-]+/g, '');
export function parseAccountType(value: string): AccountType {
	const type = token(value);
	if (['credit', 'creditcard', 'card', 'creditaccount'].includes(type)) return 'credit';
	if (
		[
			'chequing',
			'checking',
			'cash',
			'current',
			'currentaccount',
			'savings',
			'saving',
			'debit',
			'debitcard'
		].includes(type)
	)
		return 'cash';
	return 'unknown';
}
export function detectedAccountType(data: CsvData, options: ImportOptions): AccountType {
	const column = options.columns.accountType;
	const explicit = new Set(
		column
			? data.rows.map((row) => parseAccountType(row[column])).filter((type) => type !== 'unknown')
			: []
	);
	if (explicit.size) return explicit.size === 1 ? [...explicit][0] : 'unknown';
	const types = new Set(
		options.columns.activityType
			? data.rows.map((row) => token(row[options.columns.activityType]))
			: []
	);
	// A proposal, editable at import: explicit per-row account types always take precedence.
	return (types.has('purchase') && types.has('payment')) ||
		(options.expenses === 'positive' &&
			data.rows.some((row) => isCardStatementRepayment(row[options.columns.description] || '')))
		? 'credit'
		: 'unknown';
}
export function rowAccountType(
	row: Record<string, string>,
	data: CsvData,
	options: ImportOptions,
	fallback = detectedAccountType(data, options)
): AccountType {
	if (options.accountType && options.accountType !== 'auto') return options.accountType;
	return parseAccountType(row[options.columns.accountType] || '') !== 'unknown'
		? parseAccountType(row[options.columns.accountType])
		: fallback;
}
/** Explicit issuer repayment labels are financial facts, independent of spending rules. */
export function isCardStatementRepayment(description: string): boolean {
	const label = token(description).replace(/[^a-z0-9]/g, '');
	return ['paymentreceived', 'paymentreceivedthankyou', 'paymentthankyou'].includes(label);
}
export function isDeclaredTransfer(transaction: Transaction): boolean {
	const type = token(transaction.activityType);
	const subtype = token(transaction.activitySubType);
	const description = token(transaction.description).replace(/[^a-z0-9]/g, '');
	return (
		transaction.budgetOverride === 'transfer' ||
		['creditcardpayment', 'creditcardrepayment'].includes(description) ||
		(transaction.accountType !== 'cash' && isCardStatementRepayment(transaction.description)) ||
		['transfer', 'internaltransfer', 'accounttransfer'].includes(type) ||
		['transfer', 'internaltransfer', 'accounttransfer'].includes(subtype) ||
		(transaction.accountType === 'credit' &&
			['payment', 'repayment', 'cardpayment', 'creditcardpayment'].includes(type))
	);
}
export function automaticActivityCategory(
	transaction: Transaction,
	categories: CategoryDictionary
): string {
	const kind = isDeclaredTransfer(transaction)
		? 'transfer'
		: transaction.accountType !== 'credit' && transaction.amountCents > 0
			? 'income'
			: 'uncategorized';
	return (
		Object.values(categories).find((category) => category.kind === kind)?.id ?? UNCATEGORIZED_ID
	);
}
export function budgetFlow(transaction: Transaction, categories: CategoryDictionary): BudgetFlow {
	if (transaction.budgetOverride === 'exclude') return 'excluded';
	const kind = categories[transaction.categoryId]?.kind;
	if (isDeclaredTransfer(transaction) || kind === 'transfer') return 'transfer';
	// Card repayments never become income. Other card credits offset their expense category.
	if (transaction.accountType === 'credit') return kind === 'income' ? 'excluded' : 'expense';
	if (kind === 'income' || (transaction.amountCents > 0 && kind !== 'expense')) return 'income';
	return 'expense';
}
export const BUDGET_LABELS: Record<BudgetFlow, string> = {
	expense: 'Spending / refund',
	income: 'Income',
	transfer: 'Transfer',
	excluded: 'Excluded'
};
export function setBudgetOverrides(
	transactions: readonly Transaction[],
	ids: readonly string[],
	value: BudgetOverride
): Transaction[] {
	const selected = new Set(ids);
	return transactions.map((row) =>
		selected.has(row.id) ? { ...row, budgetOverride: value } : row
	);
}
