import { isDeclaredTransfer } from './activity';
import { categoryPath, type CategoryDictionary } from './category-model';
import { DEFAULT_TAGS, resolveTagIds, type TagDictionary } from './tags';
import {
	applyRules,
	matchingRule,
	normalizeDescription,
	ruleKey,
	ruleSpecificity,
	saveRule,
	transactionOverride,
	type Rule,
	type Transaction
} from './processing';

export function isMerchantRule(rule: Rule) {
	return ruleSpecificity(rule) === 1;
}

/** Same stable ordering used by the matcher, including disabled rules in their saved position. */
export function orderedRules(rules: readonly Rule[]) {
	return [...rules].sort((a, b) => Number(isMerchantRule(b)) - Number(isMerchantRule(a)));
}

export function ruleDescription(rule: Rule): string {
	const labels = {
		exact: 'Exact description',
		merchant: 'Merchant starts with',
		words: 'Any whole word or phrase',
		contains: 'Contains',
		regex: 'Regex'
	};
	return `${rule.field === 'sourceCategory' ? 'Bank category · ' : ''}${labels[rule.match ?? 'contains']}: ${rule.keyword}`;
}

/** A new rule starts first in its specificity group; editing keeps its explicit position. */
export function saveEditedRule(
	rules: readonly Rule[],
	draft: Rule,
	categories: CategoryDictionary,
	originalKey?: string
): Rule[] {
	const [normalized] = saveRule(
		[],
		{ ...draft, source: draft.starterId ? draft.source : 'manual', confidence: undefined },
		categories
	);
	const key = ruleKey(normalized);
	if (rules.some((rule) => ruleKey(rule) === key && ruleKey(rule) !== originalKey))
		throw new Error('A rule with this pattern and scope already exists. Edit that rule instead.');
	if (!originalKey) return [normalized, ...rules];
	if (!rules.some((rule) => ruleKey(rule) === originalKey))
		throw new Error('This rule changed. Reopen the editor.');
	return rules.map((rule) => (ruleKey(rule) === originalKey ? normalized : rule));
}

export function moveRule(rules: readonly Rule[], key: string, direction: -1 | 1): Rule[] {
	const ordered = orderedRules(rules);
	const index = ordered.findIndex((rule) => ruleKey(rule) === key);
	const other = index + direction;
	if (
		index < 0 ||
		other < 0 ||
		other >= ordered.length ||
		isMerchantRule(ordered[index]) !== isMerchantRule(ordered[other])
	)
		return [...rules];
	[ordered[index], ordered[other]] = [ordered[other], ordered[index]];
	return ordered;
}

export function previewRuleChange(
	transactions: readonly Transaction[],
	rules: readonly Rule[],
	nextRules: readonly Rule[],
	categories: CategoryDictionary,
	focus?: Rule,
	tags: TagDictionary = DEFAULT_TAGS
) {
	const next = applyRules(transactions, nextRules, categories);
	const changed = next.filter((row, index) => {
		if (row.categoryId !== transactions[index].categoryId) return true;
		const before = matchingRule(row.description, rules, categories, row.id, row)?.tagIds ?? [];
		const after = matchingRule(row.description, nextRules, categories, row.id, row)?.tagIds ?? [];
		return (
			JSON.stringify(resolveTagIds(before, row.tagOverride, tags).sort()) !==
			JSON.stringify(resolveTagIds(after, row.tagOverride, tags).sort())
		);
	});
	const matches = focus
		? transactions.filter((row) =>
				matchingRule(row.description, [{ ...focus, enabled: true }], categories, row.id, row)
			)
		: changed.map((row) => transactions.find((before) => before.id === row.id)!);
	const exceptions = matches.filter((row) => !!transactionOverride(row) || isDeclaredTransfer(row));
	const overlaps = matches.flatMap((row) => {
		const candidates = nextRules.filter((rule) =>
			matchingRule(row.description, [rule], categories, row.id, row)
		);
		return candidates.length > 1
			? [
					{
						transaction: row,
						winner: matchingRule(row.description, nextRules, categories, row.id, row)!,
						rules: candidates
					}
				]
			: [];
	});
	return { rules: [...nextRules], transactions: next, matches, changed, exceptions, overlaps };
}
export type RulePreview = ReturnType<typeof previewRuleChange>;

export function assignmentReason(
	row: Transaction,
	rules: readonly Rule[],
	categories: CategoryDictionary
): string {
	if (row.budgetOverride === 'exclude') return 'Excluded from budget';
	if (isDeclaredTransfer(row)) return 'Transfer handling';
	if (transactionOverride(row)) return 'This transaction only';
	const rule = matchingRule(row.description, rules, categories, row.id, row);
	if (rule) return ruleDescription(rule);
	return row.amountCents > 0 && row.accountType !== 'credit' ? 'Money in' : 'No matching rule';
}

/** Portable rules deliberately omit transaction IDs and preserve saved rule order. */
export function portableRules(rules: readonly Rule[]): Rule[] {
	return rules.map((rule) => {
		const copy = { ...rule };
		delete copy.excludedTransactionIds;
		delete copy.confidence;
		return copy;
	});
}

export function searchableRule(rule: Rule, categories: CategoryDictionary) {
	return normalizeDescription(`${rule.keyword} ${categoryPath(categories, rule.categoryId)}`);
}
