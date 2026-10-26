import Papa from 'papaparse';
import { patternError, regexMatches } from './rule-pattern';
import { DEFAULT_TAGS, type TagDictionary, type TagOverride } from './tags';
import type { ClassificationConfidence } from './confidence';
import {
	automaticActivityCategory,
	detectedAccountType,
	budgetFlow,
	isDeclaredTransfer,
	rowAccountType,
	type AccountType,
	type BudgetOverride
} from './activity';
import { parseDate, shiftMonth, type DateOrder } from '#lib/utils/date.js';

// Pure domain functions: no browser APIs, storage, file access, or network calls.
// Amounts use integer minor units. Positive = money in; negative = money out.
import {
	DEFAULT_CATEGORIES,
	UNCATEGORIZED_ID,
	categoryGroup,
	categoryPath,
	isWithinCategory,
	type CategoryDictionary
} from './category-model';
export type Rule = {
	tagIds?: string[];
	confidence?: ClassificationConfidence;
	direction?: 'out' | 'in';
	accountType?: AccountType;
	keyword: string;
	categoryId: string;
	match?: 'exact' | 'contains' | 'merchant' | 'regex';
	source?: 'manual' | 'ai' | 'starter' | 'import';
	field?: 'description' | 'sourceCategory';
	// A reviewed rule can cover the selected rows and future imports only.
	excludedTransactionIds?: string[];
};
export type CategoryOverride = { categoryId: string; source: 'manual' | 'ai' };

export type Transaction = {
	tagOverride?: TagOverride;
	id: string;
	date: string;
	merchant: string;
	description: string;
	amountCents: number;
	currency: string;
	categoryId: string;
	categorySource: 'automatic' | 'ai' | 'manual';
	source: string;
	importId: string;
	account?: string;
	categoryOverride?: CategoryOverride | null;
	accountType?: AccountType;
	activityType?: string;
	activitySubType?: string;
	sourceCategory?: string;
	budgetOverride?: BudgetOverride;
};
export type Columns = {
	date: string;
	description: string;
	amount: string;
	debit: string;
	credit: string;
	currency: string;
	category: string;
	account: string;
	accountType: string;
	activityType: string;
	activitySubType: string;
	sourceCategory: string;
	budgetOverride: string;
};
/** The editable data contract; other detected columns are optional import hints only. */
export const IMPORT_FIELDS = [
	{ value: '', label: 'Skip column' },
	{ value: 'date', label: 'Date' },
	{ value: 'description', label: 'Description' },
	{ value: 'amount', label: 'Amount' },
	{ value: 'debit', label: 'Money out' },
	{ value: 'credit', label: 'Money in' },
	{ value: 'currency', label: 'Currency' },
	{ value: 'account', label: 'Account' },
	{ value: 'sourceCategory', label: 'Bank category' }
] as const satisfies readonly { value: keyof Columns | ''; label: string }[];
export const IMPORT_HINT_LABELS: Partial<Record<keyof Columns, string>> = {
	accountType: 'Account detection',
	activityType: 'Transfer detection',
	activitySubType: 'Transfer detection',
	category: 'Saved category ID',
	budgetOverride: 'Saved budget flag'
};
export type ImportOptions = {
	columns: Columns;
	amountMode: 'signed' | 'split';
	expenses: 'negative' | 'positive';
	dateOrder: DateOrder;
	currency: string;
	source: string;
	idPrefix: string;
	account?: string;
	keepDuplicates?: boolean;
	accountType?: AccountType | 'auto';
	categoryMappings?: Record<string, string>;
};
export type CsvData = { headers: string[]; rows: Record<string, string>[] };
export type ImportIssue = { row: number; message: string };
export type ImportResult = { transactions: Transaction[]; issues: ImportIssue[] };

export function readCsv(text: string): CsvData {
	const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
		skipEmptyLines: 'greedy'
	});
	const fatal = result.errors.find((error) => error.code !== 'UndetectableDelimiter');
	if (fatal) throw new Error(`CSV could not be read: ${fatal.message}`);
	const [headerRow, ...data] = result.data;
	if (!headerRow?.length || !data.length)
		throw new Error('The CSV needs a header and at least one transaction.');
	const headers = headerRow.map((header) => header.trim());
	if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
		throw new Error('Column headers must be unique and nonempty.');
	}
	const rows = data.map((row, index) => {
		if (row.length !== headers.length) {
			throw new Error(
				`Record ${index + 2} has ${row.length} fields; expected ${headers.length}. Check the CSV delimiters and quotes.`
			);
		}
		return Object.fromEntries(headers.map((header, column) => [header, row[column].trim()]));
	});
	return { headers, rows };
}

export function detectColumns(headers: readonly string[]): Columns {
	const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
	const find = (...aliases: string[]) => {
		for (const alias of aliases) {
			const match = headers.find((header) => normalized(header) === alias);
			if (match) return match;
		}
		return '';
	};
	return {
		date: find(
			'date',
			'transactiondate',
			'posteddate',
			'postingdate',
			'transdate',
			'effectivedate',
			'valuedate',
			'bookingdate',
			'settlementdate'
		),
		description: find(
			'description',
			'rawdescription',
			'transactiondescription',
			'merchant',
			'payee',
			'name',
			'memo',
			'details'
		),
		amount: find(
			'amount',
			'transactionamount',
			'amountcad',
			'cad',
			'total',
			'netcashamount',
			'netamount',
			'cashamount'
		),
		debit: find('debit', 'debits', 'debitamount', 'withdrawal', 'withdrawals', 'moneyout'),
		credit: find('credit', 'credits', 'creditamount', 'deposit', 'deposits', 'moneyin'),
		currency: find('currency', 'currencycode'),
		category: find('categoryid'),
		account: find('account', 'accountname', 'accountid'),
		accountType: find('accounttype', 'accountkind'),
		activityType: find('transactiontype', 'activitytype', 'type'),
		activitySubType: find('activitysubtype', 'transactionsubtype', 'subtype'),
		sourceCategory: find('bankcategory', 'sourcecategory', 'originalcategory', 'category'),
		budgetOverride: find('budgetoverride', 'budgetflag')
	};
}

export function defaultImportOptions(
	headers: readonly string[],
	source: string,
	idPrefix = source
): ImportOptions {
	const columns = detectColumns(headers);
	return {
		columns,
		amountMode: !columns.amount && (columns.debit || columns.credit) ? 'split' : 'signed',
		expenses: 'negative',
		dateOrder: 'MDY',
		currency: 'CAD',
		source,
		idPrefix
	};
}

export function normalizeDate(value: string, order: ImportOptions['dateOrder']): string | null {
	return parseDate(value, { order })?.toString() ?? null;
}

export function mapImportColumn(
	options: ImportOptions,
	header: string,
	field: keyof Columns | ''
): ImportOptions {
	const columns = { ...options.columns };
	for (const key of Object.keys(columns) as (keyof Columns)[]) {
		if (columns[key] === header) columns[key] = '';
	}
	let amountMode = options.amountMode;
	if (field) columns[field] = header;
	if (field === 'amount') {
		columns.debit = '';
		columns.credit = '';
		amountMode = 'signed';
	} else if (field === 'debit' || field === 'credit') {
		columns.amount = '';
		amountMode = 'split';
	}
	return { ...options, columns, amountMode };
}

export function parseMoney(value: string): number | null {
	let text = value
		.trim()
		.replace(/^(?:CAD|USD|EUR|GBP)\s*/i, '')
		.replace(/^(?:CA|US)?[$€£]\s*/, '');
	const parentheses = /^\(.*\)$/.test(text);
	if (parentheses)
		text = text
			.slice(1, -1)
			.trim()
			.replace(/^(?:CA|US)?[$€£]\s*/, '');
	// Reject malformed numbers rather than stripping characters or treating them as zero.
	if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
	if (parentheses && /^[+-]/.test(text)) return null;
	const negative = parentheses || text.startsWith('-');
	const [whole, fraction = ''] = text.replace(/^[+-]/, '').replaceAll(',', '').split('.');
	const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
	return Number.isSafeInteger(cents) ? (negative ? -cents : cents) : null;
}

export function cleanMerchant(description: string): string {
	return description
		.replace(/\bAMZN MKTP\b(?:\s+[A-Z]{2})?\*[A-Z0-9]+/gi, 'Amazon')
		.replace(/\s+#\d+\b/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Conservative normalization shared by rules and transaction identity. */
export function normalizeDescription(value: string): string {
	return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function matchingRule(
	description: string,
	rules: readonly Rule[],
	categories: CategoryDictionary,
	transactionId?: string,
	metadata?: Partial<Pick<Transaction, 'sourceCategory' | 'accountType' | 'amountCents'>>
): Rule | undefined {
	const text = normalizeDescription(description);
	const rank = (rule: Rule) => (rule.source === 'import' ? 1 : rule.source === 'ai' ? 2 : 3);
	return rules
		.filter((rule) => {
			const keyword = normalizeDescription(rule.keyword);
			const candidate =
				rule.field === 'sourceCategory'
					? normalizeDescription(metadata?.sourceCategory || '')
					: text;
			return (
				categories[rule.categoryId] &&
				keyword &&
				(!rule.accountType || rule.accountType === metadata?.accountType) &&
				(!rule.direction ||
					(metadata?.amountCents !== undefined &&
						(rule.direction === 'out' ? metadata.amountCents < 0 : metadata.amountCents > 0))) &&
				(!transactionId || !rule.excludedTransactionIds?.includes(transactionId)) &&
				(rule.match === 'regex'
					? regexMatches(rule.keyword, candidate)
					: rule.match === 'exact'
						? candidate === keyword
						: rule.match === 'merchant'
							? candidate.startsWith(keyword) &&
								!/[\p{L}\p{N}]/u.test(candidate.charAt(keyword.length))
							: candidate.includes(keyword))
			);
		})
		.sort(
			(a, b) =>
				rank(b) - rank(a) ||
				Number(b.match === 'exact') - Number(a.match === 'exact') ||
				Number(b.match === 'merchant') - Number(a.match === 'merchant') ||
				Number(!!b.accountType) - Number(!!a.accountType) ||
				Number(!!b.direction) - Number(!!a.direction) ||
				b.keyword.length - a.keyword.length
		)[0];
}

export function categorize(
	description: string,
	rules: readonly Rule[],
	categories: CategoryDictionary
): string {
	return matchingRule(description, rules, categories)?.categoryId ?? UNCATEGORIZED_ID;
}

export function transactionOverride(transaction: Transaction): CategoryOverride | null {
	if (transaction.categoryOverride !== undefined) return transaction.categoryOverride;
	return transaction.categorySource === 'automatic'
		? null
		: {
				categoryId: transaction.categoryId,
				source: transaction.categorySource
			};
}

export function ruleKey(rule: Rule): string {
	return JSON.stringify([
		rule.field ?? 'description',
		rule.match ?? 'contains',
		rule.match === 'regex' ? rule.keyword.trim() : normalizeDescription(rule.keyword),
		rule.accountType ?? '',
		rule.direction ?? ''
	]);
}
export function sourceCategoryLabels(
	data: CsvData,
	columns: Columns,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): string[] {
	return [
		...new Set(
			data.rows
				.map((row) => row[columns.sourceCategory] || row[columns.category] || '')
				.filter((label) => label && !categories[label])
		)
	].sort();
}
export function proposedCategoryMappings(
	data: CsvData,
	columns: Columns,
	rules: readonly Rule[],
	categories: CategoryDictionary
): Record<string, string> {
	return Object.fromEntries(
		sourceCategoryLabels(data, columns, categories).map((label) => {
			const rule = matchingRule(
				'',
				rules.filter((rule) => rule.field === 'sourceCategory'),
				categories,
				undefined,
				{ sourceCategory: label }
			);
			const matches = Object.values(categories).filter(
				(category) =>
					normalizeDescription(category.name) === normalizeDescription(label) ||
					normalizeDescription(categoryPath(categories, category.id)) ===
						normalizeDescription(label)
			);
			return [label, rule?.categoryId ?? (matches.length === 1 ? matches[0].id : UNCATEGORIZED_ID)];
		})
	);
}
/** Approved bank labels use the same rule store as description matches. */
export function mergeCategoryMappings(
	rules: readonly Rule[],
	mappings: Record<string, string>,
	categories: CategoryDictionary
): Rule[] {
	let next = [...rules];
	for (const [keyword, categoryId] of Object.entries(mappings)) {
		const mapping: Rule = {
			keyword,
			categoryId,
			field: 'sourceCategory',
			match: 'exact',
			source: 'import'
		};
		const prior = next.find((rule) => ruleKey(rule) === ruleKey(mapping));
		if (!categories[categoryId]) continue;
		if (categoryId === UNCATEGORIZED_ID) {
			next = next.filter((rule) => ruleKey(rule) !== ruleKey(mapping));
		} else if (prior?.categoryId !== categoryId) {
			next = saveRule(next, { ...mapping, source: prior?.source ?? 'import' }, categories);
		}
	}
	return next;
}

export function normalizeTransactions(
	data: CsvData,
	options: ImportOptions,
	rules: readonly Rule[] = [],
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): ImportResult {
	const { columns } = options;
	const required = [
		columns.date,
		columns.description,
		...(options.amountMode === 'signed' ? [columns.amount] : [columns.debit || columns.credit])
	];
	if (required.some((column) => !column || !data.headers.includes(column))) {
		throw new Error('Choose date, description, and amount columns before importing.');
	}
	for (const column of Object.values(columns).filter(Boolean)) {
		if (!data.headers.includes(column)) throw new Error(`Column "${column}" does not exist.`);
	}
	const transactions: Transaction[] = [];
	const issues: ImportIssue[] = [];
	const fallbackAccountType = detectedAccountType(data, options);
	data.rows.forEach((row, index) => {
		const date = normalizeDate(row[columns.date], options.dateOrder);
		const activityType = row[columns.activityType] || '';
		const activitySubType = row[columns.activitySubType] || '';
		const description =
			row[columns.description] ||
			[activityType, activitySubType === '-' ? '' : activitySubType].filter(Boolean).join(' · ');
		let amount = columns.amount ? parseMoney(row[columns.amount]) : null;
		if (options.amountMode === 'split') {
			const hasAmount = Boolean(
				(columns.debit && row[columns.debit]) || (columns.credit && row[columns.credit])
			);
			const debit = columns.debit && row[columns.debit] ? parseMoney(row[columns.debit]) : 0;
			const credit = columns.credit && row[columns.credit] ? parseMoney(row[columns.credit]) : 0;
			amount =
				!hasAmount || debit === null || credit === null || (debit !== 0 && credit !== 0)
					? null
					: credit - debit;
		} else if (amount !== null && options.expenses === 'positive') {
			amount = -amount;
		}
		const currency = (columns.currency ? row[columns.currency] : options.currency).toUpperCase();
		const errors: string[] = [];
		if (!date)
			errors.push(
				`Invalid date "${row[columns.date]}" (supported: YYYY-MM-DD, 02 Oct 2026, or numeric dates in the selected order)`
			);
		if (!description) errors.push('Missing description');
		if (amount === null)
			errors.push(
				'Invalid amount (use a decimal point and at most two decimal places; split columns must contain either a debit or a credit)'
			);
		if (!['CAD', 'USD', 'EUR', 'GBP'].includes(currency))
			errors.push(`Unsupported currency "${currency}"`);
		if (errors.length) {
			issues.push({ row: index + 2, message: errors.join('; ') });
			return;
		}
		const savedCategory = columns.category ? row[columns.category] : '';
		const savedCategoryId = categories[savedCategory]?.id;
		const manual = !!savedCategoryId;
		const sourceCategory = row[columns.sourceCategory] || (manual ? '' : savedCategory);
		const accountType = rowAccountType(row, data, options, fallbackAccountType);
		const flag = (row[columns.budgetOverride] || '').toLowerCase();
		const budgetOverride = flag === 'transfer' || flag === 'exclude' ? flag : null;

		transactions.push({
			id: `${options.idPrefix}:${index + 2}`,
			date: date!,
			merchant: cleanMerchant(description),
			description,
			amountCents: amount!,
			currency,
			categoryId: savedCategoryId ?? UNCATEGORIZED_ID,
			categorySource: manual ? 'manual' : 'automatic',
			source: options.source,
			account: (columns.account ? row[columns.account] : options.account)?.trim() || 'Main account',
			categoryOverride: manual ? { categoryId: savedCategoryId!, source: 'manual' } : null,
			...(accountType !== 'unknown' ? { accountType } : {}),
			...(activityType ? { activityType } : {}),
			...(activitySubType ? { activitySubType } : {}),
			...(sourceCategory ? { sourceCategory } : {}),
			...(budgetOverride ? { budgetOverride } : {}),
			importId: options.idPrefix
		});
	});
	const mappings =
		options.categoryMappings ?? proposedCategoryMappings(data, columns, rules, categories);
	return {
		transactions: applyRules(
			transactions,
			mergeCategoryMappings(rules, mappings, categories),
			categories
		),
		issues
	};
}

export function parseTransactions(
	text: string,
	options: ImportOptions,
	rules: readonly Rule[] = [],
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): ImportResult {
	return normalizeTransactions(readCsv(text), options, rules, categories);
}

export function setCategory(
	transactions: readonly Transaction[],
	id: string,
	categoryId: string,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): Transaction[] {
	return setCategories(transactions, [id], categoryId, categories);
}

export function setCategories(
	transactions: readonly Transaction[],
	ids: readonly string[],
	categoryId: string,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): Transaction[] {
	if (!categories[categoryId]) throw new Error('Category no longer exists.');
	const selected = new Set(ids);
	return transactions.map((transaction) =>
		selected.has(transaction.id)
			? {
					...transaction,
					categoryId,
					categorySource: categoryId === UNCATEGORIZED_ID ? 'automatic' : 'manual',
					categoryOverride:
						categoryId === UNCATEGORIZED_ID ? null : { categoryId, source: 'manual' }
				}
			: transaction
	);
}

/** Restore the shipped category tree while preserving valid relationships. */
export function restoreDefaultCategories(
	transactions: readonly Transaction[],
	categories: CategoryDictionary,
	rules: readonly Rule[],
	clearAssignments = false
): { categories: CategoryDictionary; transactions: Transaction[]; rules: Rule[] } {
	const defaults = structuredClone(DEFAULT_CATEGORIES);
	function replacement(id: string): string | null {
		const seen = new Set<string>();
		while (id && !seen.has(id)) {
			seen.add(id);
			if (defaults[id]) return id;
			id = categories[id]?.parentId ?? '';
		}
		return null;
	}
	const next: { categories: CategoryDictionary; transactions: Transaction[]; rules: Rule[] } = {
		categories: defaults,
		transactions: transactions.map((transaction) => {
			const categoryId = clearAssignments
				? UNCATEGORIZED_ID
				: (replacement(transaction.categoryId) ?? UNCATEGORIZED_ID);
			return {
				...transaction,
				categoryId,
				categorySource: categoryId === UNCATEGORIZED_ID ? 'automatic' : transaction.categorySource,
				categoryOverride:
					clearAssignments || categoryId === UNCATEGORIZED_ID
						? null
						: transactionOverride(transaction)
							? { ...transactionOverride(transaction)!, categoryId }
							: null
			};
		}),
		rules: clearAssignments
			? []
			: rules.flatMap((rule) => {
					const categoryId = replacement(rule.categoryId);
					return categoryId ? [{ ...rule, categoryId }] : [];
				})
	};
	return {
		...next,
		transactions: next.transactions.map((row) =>
			clearAssignments || isDeclaredTransfer(row) ? applyRules([row], next.rules, defaults)[0] : row
		)
	};
}

export function saveRule(
	rules: readonly Rule[],
	rule: Rule,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): Rule[] {
	const keyword = rule.match === 'regex' ? rule.keyword.trim() : normalizeDescription(rule.keyword);
	const error = patternError(keyword, rule.match);
	if (error) throw new Error(error);
	if (!keyword || !categories[rule.categoryId])
		throw new Error('Choose a description and a valid category.');
	return [
		{ ...rule, keyword },
		...rules.filter((existing) => ruleKey(existing) !== ruleKey({ ...rule, keyword }))
	];
}

/** Clearing the dataset releases historical scopes so reuploads use current rule defaults. */
export function clearRuleScopes(rules: readonly Rule[]): Rule[] {
	return rules.map((rule) => {
		const next = { ...rule };
		delete next.excludedTransactionIds;
		return next;
	});
}

// Categories are a projection of rules plus explicit per-transaction overrides.
export function applyRules(
	transactions: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): Transaction[] {
	return transactions.map((transaction) => {
		const override = transactionOverride(transaction);
		if (isDeclaredTransfer(transaction))
			return {
				...transaction,
				categoryOverride: override,
				categoryId: automaticActivityCategory(transaction, categories),
				categorySource: transaction.budgetOverride === 'transfer' ? 'manual' : 'automatic'
			};
		if (override && categories[override.categoryId])
			return {
				...transaction,
				categoryOverride: override,
				categoryId: override.categoryId,
				categorySource: override.source
			};
		const rule = matchingRule(
			transaction.description,
			rules,
			categories,
			transaction.id,
			transaction
		);
		if (rule)
			return {
				...transaction,
				categoryOverride: override,
				categoryId: rule.categoryId,
				categorySource: 'automatic'
			};
		return {
			...transaction,
			categoryOverride: null,
			categoryId: automaticActivityCategory(transaction, categories),
			categorySource: 'automatic'
		};
	});
}

export type TransactionFilter = {
	month?: string;
	currency?: string;
	search?: string;
	categoryId?: string;
	type?: '' | 'out' | 'in' | 'transfers' | 'excluded';
};
export function filterTransactions(
	transactions: readonly Transaction[],
	filter: TransactionFilter,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): Transaction[] {
	const query = filter.search?.trim().toLowerCase();
	return transactions
		.filter(
			(transaction) =>
				(!filter.month || transaction.date.startsWith(filter.month)) &&
				(!filter.currency || transaction.currency === filter.currency) &&
				(!filter.categoryId ||
					isWithinCategory(categories, transaction.categoryId, filter.categoryId)) &&
				(!query ||
					[
						transaction.merchant,
						transaction.description,
						transaction.source,
						(transaction.amountCents / 100).toFixed(2)
					].some((value) => value.toLowerCase().includes(query))) &&
				(!filter.type ||
					(filter.type === 'transfers'
						? budgetFlow(transaction, categories) === 'transfer'
						: filter.type === 'excluded'
							? budgetFlow(transaction, categories) === 'excluded'
							: !['transfer', 'excluded'].includes(budgetFlow(transaction, categories)) &&
								(filter.type === 'out'
									? transaction.amountCents < 0
									: transaction.amountCents > 0)))
		)
		.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export type MonthSummary = {
	month: string;
	incomeCents: number;
	spendingCents: number;
	netCents: number;
	count: number;
	reviewCount: number;
};
export function summarizeMonths(
	transactions: readonly Transaction[],
	currency: string,
	categories: CategoryDictionary = DEFAULT_CATEGORIES
): MonthSummary[] {
	const groups = new Map<string, MonthSummary>();
	for (const transaction of transactions) {
		if (transaction.currency !== currency) continue;
		const month = transaction.date.slice(0, 7);
		const summary = groups.get(month) ?? {
			month,
			incomeCents: 0,
			spendingCents: 0,
			netCents: 0,
			count: 0,
			reviewCount: 0
		};
		summary.count++;
		if (transaction.categoryId === UNCATEGORIZED_ID) summary.reviewCount++;
		const flow = budgetFlow(transaction, categories);
		if (flow === 'income') summary.incomeCents += transaction.amountCents;
		else if (flow === 'expense') summary.spendingCents -= transaction.amountCents;
		summary.netCents = summary.incomeCents - summary.spendingCents;
		groups.set(month, summary);
	}
	return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export function previousMonth(month: string): string {
	return shiftMonth(month, -1) ?? '';
}

export type MonthSpending = {
	month: string;
	count: number;
	spendingCents: number;
	categories: { categoryId: string; amountCents: number }[];
};

/** Twelve months grouped at the root, or by a parent's immediate children (plus direct tags). */
export function summarizeYearSpending(
	transactions: readonly Transaction[],
	year: string,
	currency: string,
	categoryDictionary: CategoryDictionary = DEFAULT_CATEGORIES,
	parentId: string | null = null
): MonthSpending[] {
	const groups = new Map(
		Object.keys(categoryDictionary).map((id) => [
			id,
			categoryGroup(categoryDictionary, id, parentId)
		])
	);
	const months = Array.from({ length: 12 }, (_, index) => ({
		month: `${year}-${String(index + 1).padStart(2, '0')}`,
		count: 0,
		totals: new Map<string, number>()
	}));
	for (const transaction of transactions) {
		if (transaction.currency !== currency || transaction.date.slice(0, 4) !== year) continue;
		const month = months[Number(transaction.date.slice(5, 7)) - 1];
		month.count++;
		if (budgetFlow(transaction, categoryDictionary) !== 'expense') continue;
		const group = groups.get(transaction.categoryId);
		if (!group) continue;
		month.totals.set(group, (month.totals.get(group) ?? 0) - transaction.amountCents);
	}
	return months.map(({ month, count, totals }) => {
		const categories = Object.keys(categoryDictionary)
			.filter((id) => totals.has(id))
			.map((categoryId) => ({ categoryId, amountCents: totals.get(categoryId)! }));
		return {
			month,
			count,
			spendingCents: categories.reduce((total, entry) => total + entry.amountCents, 0),
			categories
		};
	});
}

export function exportTransactions(
	transactions: readonly Transaction[],
	categories: CategoryDictionary = DEFAULT_CATEGORIES,
	tags: TagDictionary = DEFAULT_TAGS,
	tagMap: ReadonlyMap<string, string[]> = new Map()
): string {
	return Papa.unparse({
		fields: [
			'Date',
			'Merchant',
			'Description',
			'Amount',
			'Currency',
			'Category',
			'Category ID',
			'Source',
			'Account',
			'Account Type',
			'Activity Type',
			'Activity Subtype',
			'Bank Category',
			'Budget Override',
			'Tags',
			'Tag IDs'
		],
		data: transactions.map((transaction) =>
			[
				transaction.date,
				transaction.merchant,
				transaction.description,
				// Keep signed amounts numeric in spreadsheets; sanitize text fields below.
				transaction.amountCents / 100,
				transaction.currency,
				categoryPath(categories, transaction.categoryId),
				transaction.categoryId,
				transaction.source,
				transaction.account || 'Main account',
				transaction.accountType || '',
				transaction.activityType || '',
				transaction.activitySubType || '',
				transaction.sourceCategory || '',
				transaction.budgetOverride || '',
				(tagMap.get(transaction.id) ?? [])
					.map((id) => tags[id]?.name)
					.filter(Boolean)
					.join('; '),
				(tagMap.get(transaction.id) ?? []).join(';')
			].map((value) =>
				typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
			)
		)
	});
}
