import { UNCATEGORIZED_ID, type CategoryDictionary } from './category-model';
import { budgetFlow, isDeclaredTransfer } from './activity';
import { groupMerchantTransactions } from './merchants';
import { patternError } from './rule-pattern';
import {
	applyRules,
	matchingRule,
	normalizeDescription,
	ruleKey,
	saveRule,
	transactionOverride,
	type Rule,
	type Transaction
} from './processing';

export type MerchantGroup = {
	id: string;
	rule: Rule;
	transactions: Transaction[];
	saved: boolean;
};

/** Net budget spending, preserving currencies rather than adding unlike amounts. */
export function merchantSpending(rows: readonly Transaction[], categories: CategoryDictionary) {
	const amounts = new Map<string, number>();
	for (const row of rows) {
		if (budgetFlow(row, categories) !== 'expense') continue;
		amounts.set(row.currency, (amounts.get(row.currency) ?? 0) - row.amountCents);
	}
	return [...amounts]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([currency, amountCents]) => ({ currency, amountCents }));
}

/** Saved predicates define groups; only unmatched merchants need inferred predicates. */
export function workspaceMerchantGroups(
	transactions: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary
): MerchantGroup[] {
	const groups = new Map<string, MerchantGroup>();
	for (const rule of rules) {
		const id = ruleKey(rule);
		groups.set(id, { id, rule, transactions: [], saved: true });
	}
	const unmatched: Transaction[] = [];
	for (const row of transactions) {
		if (isDeclaredTransfer(row)) continue;
		const rule = matchingRule(row.description, rules, categories, row.id, row);
		if (rule) {
			const id = ruleKey(rule);
			if (!groups.has(id)) groups.set(id, { id, rule, transactions: [], saved: true });
			groups.get(id)!.transactions.push(row);
		} else if (row.amountCents < 0 || row.accountType === 'credit') unmatched.push(row);
	}
	for (const group of groupMerchantTransactions(unmatched, transactions))
		groups.set(group.id, {
			...group,
			rule: { ...group.rule, categoryId: UNCATEGORIZED_ID },
			saved: false
		});
	return [...groups.values()];
}

export function combinedMerchantRule(groups: readonly MerchantGroup[]): Rule {
	if (!groups.length) throw new Error('Select at least one merchant.');
	const first = groups[0].rule;
	if (
		groups.some(
			({ rule }) =>
				rule.accountType !== first.accountType ||
				rule.direction !== first.direction ||
				(rule.field ?? 'description') !== (first.field ?? 'description')
		)
	)
		throw new Error(
			'Select merchants with the same account type, money direction and matching field.'
		);
	let prefix = first.keyword;
	for (const group of groups) {
		while (
			prefix &&
			!normalizeDescription(group.rule.keyword).startsWith(normalizeDescription(prefix))
		)
			prefix = prefix.slice(0, -1);
	}
	return {
		...(groups.length === 1 ? first : {}),
		...(groups.some((group) => group.rule.excludedTransactionIds?.length)
			? {
					excludedTransactionIds: [
						...new Set(groups.flatMap((group) => group.rule.excludedTransactionIds ?? []))
					]
				}
			: {}),
		tagIds: (first.tagIds ?? []).filter((id) =>
			groups.every((group) => group.rule.tagIds?.includes(id))
		),
		field: first.field ?? 'description',
		accountType: first.accountType,
		direction: first.direction,
		keyword: groups.length === 1 ? first.keyword : prefix.trim(),
		match: groups.length === 1 ? first.match : 'contains',
		categoryId: groups.every((group) => group.rule.categoryId === first.categoryId)
			? first.categoryId
			: UNCATEGORIZED_ID,
		source: 'manual'
	};
}

/** An explicit user edit can replace selected rules, but never silently replace other groups. */
export function previewMerchantRule(
	transactions: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary,
	selected: readonly MerchantGroup[],
	rule: Rule
) {
	const error = patternError(rule.keyword, rule.match);
	if (error) throw new Error(error);
	if (!categories[rule.categoryId]) throw new Error('Choose a category.');
	if (!selected.length) throw new Error('Select a merchant group.');
	const scope = combinedMerchantRule(selected);
	if (
		rule.accountType !== scope.accountType ||
		rule.direction !== scope.direction ||
		rule.field !== scope.field
	)
		throw new Error('The matching scope changed. Select the merchants again.');
	const matches = transactions.filter(
		(row) => !!matchingRule(row.description, [rule], categories, row.id, row)
	);
	const ids = new Set(matches.map((row) => row.id));
	if (selected.some((group) => group.transactions.some((row) => !ids.has(row.id))))
		throw new Error('The pattern must match every transaction in the selected merchants.');
	const replaced = new Set(selected.filter((group) => group.saved).map((group) => group.id));
	for (const old of rules.filter((old) => replaced.has(ruleKey(old)))) {
		if (
			transactions.some(
				(row) => matchingRule(row.description, [old], categories, row.id, row) && !ids.has(row.id)
			)
		)
			throw new Error(
				'This would leave transactions from a selected rule unmatched. Broaden the pattern.'
			);
	}
	const remaining = rules.filter((old) => !replaced.has(ruleKey(old)));
	if (
		remaining.some((old) => ruleKey(old) === ruleKey(rule)) ||
		matches.some((row) => {
			const old = matchingRule(row.description, remaining, categories, row.id, row);
			return !!old;
		})
	)
		throw new Error(
			'The pattern overlaps another saved merchant. Select that group too or narrow the pattern.'
		);
	const nextRules = saveRule(
		remaining,
		{ ...rule, source: 'manual', confidence: undefined },
		categories
	);
	const resolved = applyRules(
		transactions.map((row) =>
			ids.has(row.id) && transactionOverride(row)?.source === 'ai'
				? { ...row, categoryOverride: null, categorySource: 'automatic' as const }
				: row
		),
		nextRules,
		categories
	);
	return { rules: nextRules, transactions: resolved, matches };
}
