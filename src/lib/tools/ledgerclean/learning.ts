import { consolidateMerchantRules } from './merchant-rules';
import { confidenceLevel, weakestConfidence } from './confidence';
import { merchantGroups, groupMerchantTransactions } from './merchants';
import { isDeclaredTransfer } from './activity';
import { applyReviewedTagProposal, canSuggestCategory, type TagProposal } from './ai';
import { UNCATEGORIZED_ID, type CategoryDictionary } from './category-model';
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

/** Review and select whole predicates, so a weak member cannot slip through a strong row. */
export function reviewLearningGroups(
	requested: readonly Transaction[],
	transactions: readonly Transaction[],
	proposal: TagProposal,
	rules: readonly Rule[] = [],
	categories?: CategoryDictionary
) {
	const mappings = new Map(proposal.map((item) => [item.transactionId, item]));
	return groupMerchantTransactions(requested, transactions, rules, categories).map((group) => {
		const items = group.transactions.map((row) => mappings.get(row.id)!).filter(Boolean);
		const categoryIds = new Set(items.map((item) => item.categoryId));
		const categoryId = categoryIds.size === 1 ? items[0].categoryId : UNCATEGORIZED_ID;
		const confidence = weakestConfidence(items.map((item) => item.confidence));
		return {
			...group,
			items,
			previousRule: items.find((item) => item.replacesRule)?.replacesRule,
			categoryId,
			confidence,
			manual: items.every((item) => item.manual),
			conflict: categoryIds.size > 1,
			selected:
				items.length > 0 &&
				items.every(
					(item) =>
						item.selected ??
						(!!item.confidence &&
							!item.reconsidered &&
							confidenceLevel(item.confidence) !== 'low' &&
							item.categoryId !== UNCATEGORIZED_ID)
				),
			rule: { ...group.rule, categoryId }
		};
	});
}
/** Preview a rule change and every affected row before writing the source of truth. */
export function previewLearning(
	transactions: readonly Transaction[],
	proposal: TagProposal,
	rules: readonly Rule[],
	categories: CategoryDictionary
) {
	if (!proposal.length)
		return {
			rules: [] as Rule[],
			conflicts: [] as { keyword: string; reason: string }[],
			affected: [] as Transaction[],
			resolved: [...transactions],
			nextRules: [...rules]
		};
	const rows = new Map(transactions.map((row) => [row.id, row]));
	const groups = new Map<string, { rule: Rule; ids: Set<string>; mappings: TagProposal }>();
	const merchants = merchantGroups(transactions);
	const replacements = new Set<string>();
	for (const mapping of proposal) {
		const row = rows.get(mapping.transactionId);
		if (!row || !categories[mapping.categoryId])
			throw new Error('The proposal references missing transactions or categories.');
		if (
			isDeclaredTransfer(row) ||
			(transactionOverride(row)?.source === 'manual' && !mapping.reconsidered)
		)
			continue;
		if (mapping.reconsidered && !canSuggestCategory(row, categories))
			throw new Error('Only spending can be reconsidered for expense categories.');
		if (mapping.categoryId === UNCATEGORIZED_ID) continue;
		const existing = matchingRule(row.description, rules, categories, row.id, row);
		if (mapping.replacesRule) {
			if (
				!mapping.reconsidered ||
				!existing ||
				JSON.stringify(existing) !== JSON.stringify(mapping.replacesRule)
			)
				throw new Error(
					'The saved rule changed during review. Discard the proposal and try again.'
				);
			replacements.add(ruleKey(existing));
		}
		const draft =
			mapping.replacesRule ?? (existing?.categoryId === UNCATEGORIZED_ID ? existing : undefined);
		const rule: Rule = {
			keyword: merchants.get(row.id) ?? normalizeDescription(row.description),
			categoryId: mapping.categoryId,
			match: merchants.has(row.id) ? 'merchant' : 'exact',
			field: 'description',
			source: mapping.manual ? 'manual' : 'ai',
			...(row.accountType && row.accountType !== 'unknown' ? { accountType: row.accountType } : {}),
			...(row.accountType !== 'credit'
				? { direction: row.amountCents < 0 ? ('out' as const) : ('in' as const) }
				: {}),
			...(draft
				? {
						...draft,
						categoryId: mapping.categoryId,
						source: mapping.manual ? ('manual' as const) : ('ai' as const),
						confidence: undefined
					}
				: {})
		};
		const key = ruleKey(rule);
		if (!groups.has(key)) groups.set(key, { rule, ids: new Set(), mappings: [] });
		groups.get(key)!.ids.add(mapping.categoryId);
		groups.get(key)!.mappings.push(mapping);
	}
	const learned: Rule[] = [];
	const conflicts: { keyword: string; reason: string }[] = [];
	for (const { rule, ids, mappings } of groups.values()) {
		const keyword = rule.keyword;
		if (ids.size !== 1) {
			conflicts.push({
				keyword,
				reason: 'These transactions propose different categories for the same description.'
			});
			continue;
		}
		const categoryId = [...ids][0];
		const matches = transactions.filter(
			(row) =>
				matchingRule(row.description, [rule], categories, row.id, row) && !isDeclaredTransfer(row)
		);
		const existing = matches
			.map((row) => matchingRule(row.description, rules, categories, row.id, row))
			.filter((rule) => !!rule);
		if (
			existing.some(
				(rule) =>
					rule.categoryId !== categoryId &&
					rule.categoryId !== UNCATEGORIZED_ID &&
					!replacements.has(ruleKey(rule))
			)
		) {
			conflicts.push({
				keyword,
				reason: 'An existing rule uses another category. Edit that rule explicitly instead.'
			});
			continue;
		}
		if (
			!replacements.has(ruleKey(rule)) &&
			rule.match !== 'merchant' &&
			matches.every(
				(row) =>
					matchingRule(row.description, rules, categories, row.id, row)?.categoryId === categoryId
			)
		)
			continue;
		if (
			!replacements.has(ruleKey(rule)) &&
			rules.some((item) => ruleKey(item) === ruleKey(rule) && item.categoryId === categoryId)
		)
			continue;
		rule.categoryId = categoryId;
		const old = rules.find((item) => ruleKey(item) === ruleKey(rule));
		if (
			old &&
			old.categoryId !== categoryId &&
			old.categoryId !== UNCATEGORIZED_ID &&
			!replacements.has(ruleKey(old))
		) {
			conflicts.push({
				keyword,
				reason: 'An existing rule uses another category. Edit that rule explicitly instead.'
			});
			continue;
		}
		if (mappings.some((item) => item.manual)) rule.source = 'manual';
		else rule.confidence = weakestConfidence(mappings.map((item) => item.confidence));
		learned.push(rule);
	}
	let nextRules = [...rules];
	for (const rule of learned) nextRules = saveRule(nextRules, rule, categories);
	nextRules = consolidateMerchantRules(transactions, nextRules, categories);
	const resolved = applyRules(
		transactions.map((row) => {
			if (transactionOverride(row)?.source === 'manual') return row;
			const rule = matchingRule(row.description, nextRules, categories, row.id, row);
			return rule && learned.some((item) => ruleKey(item) === ruleKey(rule))
				? { ...row, categoryOverride: null, categorySource: 'automatic' as const }
				: row;
		}),
		nextRules,
		categories
	);
	const affected = resolved.filter(
		(row, index) => row.categoryId !== transactions[index].categoryId
	);
	return { rules: learned, conflicts, affected, resolved, nextRules };
}

/** AI approval only writes validated rules, then runs the same deterministic import matcher. */
export function approveLearning(
	transactions: readonly Transaction[],
	proposal: TagProposal,
	requested: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary
) {
	if (proposal.some((item) => item.reconsidered && !item.reviewed))
		throw new Error('Review reconsidered categories before replacing saved rules.');
	if (
		proposal.some(
			(item) => confidenceLevel(item.confidence) === 'low' && !item.reviewed && !item.manual
		)
	)
		throw new Error('Review low-confidence suggestions before saving them.');
	// This validates completeness/staleness without committing its temporary AI assignments.
	applyReviewedTagProposal(transactions, proposal, categories, requested);
	const preview = previewLearning(transactions, proposal, rules, categories);
	if (preview.conflicts.length)
		throw new Error('Resolve the conflicting rules before saving. No changes were applied.');
	return {
		transactions: preview.resolved,
		rules: preview.nextRules,
		savedCount: preview.rules.length,
		updatedCount: preview.affected.length
	};
}
