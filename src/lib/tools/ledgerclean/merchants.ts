import {
	matchingRule,
	normalizeDescription,
	ruleKey,
	type Rule,
	type Transaction
} from './processing';
import { DEFAULT_CATEGORIES, type CategoryDictionary } from './category-model';

/** Only a varying reference after a stable leading phrase is evidence of a merchant group. */
function merchantCandidate(description: string) {
	const text = normalizeDescription(description);
	const marked = text.match(/^(.+?)[/*#]\s*([A-Z0-9-]+)/);
	const numbered = text.match(/^(.+?)\s+(\d{3,}|(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,})(?=\s|$)/);
	const match = marked ?? numbered;
	if (!match) return null;
	const [, prefix, reference] = match;
	if (!/^\d{3,}$/.test(reference) && !(/\d/.test(reference) && reference.length >= 6)) return null;
	const keyword = prefix.trim();
	const words = keyword.match(/[A-Z]+/g) ?? [];
	const generic = new Set([
		'SQ',
		'TST',
		'POS',
		'CARD',
		'DEBIT',
		'CREDIT',
		'PAYMENT',
		'PURCHASE',
		'ORDER',
		'INVOICE',
		'TRANSACTION',
		'FARE',
		'CA',
		'CANADA',
		'ONLINE',
		'BILL',
		'PREAUTHORIZED',
		'EFT'
	]);
	if (keyword.length < 4 || !words.some((word) => word.length >= 4 && !generic.has(word)))
		return null;
	return { keyword, reference };
}

/** Contexts with differing bank labels, account types or bank directions remain separate. */
export function merchantGroups(transactions: readonly Transaction[]): Map<string, string> {
	const groups = new Map<
		string,
		{ keyword: string; references: Set<string>; labels: Set<string>; ids: Set<string> }
	>();
	for (const row of transactions) {
		const candidate = merchantCandidate(row.description);
		if (!candidate) continue;
		const key = JSON.stringify([
			candidate.keyword,
			row.accountType || 'unknown',
			row.accountType === 'credit' ? '' : Math.sign(row.amountCents)
		]);
		if (!groups.has(key))
			groups.set(key, {
				keyword: candidate.keyword,
				references: new Set(),
				labels: new Set(),
				ids: new Set()
			});
		const group = groups.get(key)!;
		group.references.add(candidate.reference);
		if (row.sourceCategory?.trim()) group.labels.add(normalizeDescription(row.sourceCategory));
		group.ids.add(row.id);
	}
	const result = new Map<string, string>();
	for (const group of groups.values()) {
		if (group.references.size < 2 || group.labels.size > 1) continue;
		for (const id of group.ids) result.set(id, group.keyword);
	}
	return result;
}

/** One reusable predicate per merchant, independent of current row categories. */
export function groupMerchantTransactions(
	rows: readonly Transaction[],
	evidence: readonly Transaction[] = rows,
	rules: readonly Rule[] = [],
	categories: CategoryDictionary = DEFAULT_CATEGORIES
) {
	const names = merchantGroups(evidence);
	const groups = new Map<string, { id: string; rule: Rule; transactions: Transaction[] }>();
	for (const row of rows) {
		const existing = matchingRule(row.description, rules, categories, row.id, row);
		const rule: Rule = existing ?? {
			keyword: names.get(row.id) ?? normalizeDescription(row.description),
			match: names.has(row.id) ? 'merchant' : 'exact',
			field: 'description',
			categoryId: row.categoryId,
			...(row.accountType && row.accountType !== 'unknown' ? { accountType: row.accountType } : {}),
			...(row.accountType !== 'credit'
				? { direction: row.amountCents < 0 ? ('out' as const) : ('in' as const) }
				: {})
		};
		const id = ruleKey(rule);
		if (!groups.has(id)) groups.set(id, { id, rule, transactions: [] });
		groups.get(id)!.transactions.push(row);
	}
	return [...groups.values()];
}
