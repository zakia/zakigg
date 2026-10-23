import { weakestConfidence } from './confidence';
import { merchantGroups } from './merchants';
import { isDeclaredTransfer } from './activity';
import {
	matchingRule,
	normalizeDescription,
	ruleKey,
	type Rule,
	type Transaction
} from './processing';
import type { CategoryDictionary } from './category-model';

/** Consolidate only AI exact rules with agreeing categories/scopes and observed varying references. */
export function consolidateMerchantRules(
	transactions: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary
): Rule[] {
	const merchants = merchantGroups(transactions);
	const buckets = new Map<string, { rule: Rule; exact: Rule[] }>();
	for (const rule of rules) {
		if (
			rule.source !== 'ai' ||
			rule.match !== 'exact' ||
			rule.field === 'sourceCategory' ||
			rule.excludedTransactionIds?.length ||
			rule.tagIds?.length ||
			categories[rule.categoryId]?.kind !== 'expense'
		)
			continue;
		const matched = transactions.filter((row) =>
			matchingRule(row.description, [rule], categories, row.id, row)
		);
		const names = new Set(matched.map((row) => merchants.get(row.id)));
		if (!matched.length || names.size !== 1 || names.has(undefined)) continue;
		const broad: Rule = { ...rule, keyword: [...names][0]!, match: 'merchant' };
		const key = ruleKey(broad);
		if (!buckets.has(key)) buckets.set(key, { rule: broad, exact: [] });
		buckets.get(key)!.exact.push(rule);
	}
	let result = [...rules];
	for (const { rule, exact } of buckets.values()) {
		const broad = result.find((item) => ruleKey(item) === ruleKey(rule));
		if (exact.length < 2 && !broad) continue;
		if (
			exact.some((item) => item.categoryId !== rule.categoryId) ||
			(broad && (broad.categoryId !== rule.categoryId || !!broad.tagIds?.length))
		)
			continue;
		const matched = transactions.filter(
			(row) =>
				!isDeclaredTransfer(row) && matchingRule(row.description, [rule], categories, row.id, row)
		);
		if (
			matched.some((row) => {
				const existing = matchingRule(row.description, rules, categories, row.id, row);
				return existing && existing.categoryId !== rule.categoryId;
			})
		)
			continue;
		const obsolete = new Set(exact);
		result = result.filter((item) => !obsolete.has(item));
		if (!broad)
			result.push({
				...rule,
				keyword: normalizeDescription(rule.keyword),
				...(exact.some((item) => item.confidence)
					? { confidence: weakestConfidence(exact.map((item) => item.confidence)) }
					: {})
			});
	}
	return result;
}
