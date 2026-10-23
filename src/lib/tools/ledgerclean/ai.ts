import { CATEGORY_PRESETS } from './categories';
import * as v from 'valibot';
import {
	UNCATEGORIZED_ID,
	categoryList,
	categoryPath,
	categoryGroup,
	type BudgetCategory,
	type CategoryDictionary
} from './category-model';
import { budgetFlow } from './activity';
import { merchantGroups, groupMerchantTransactions } from './merchants';
import {
	matchingRule,
	ruleKey,
	applyRules,
	transactionOverride,
	normalizeDescription,
	type Rule,
	type Transaction
} from './processing';
import type { ClassificationConfidence } from './confidence';
import { classifyHierarchy } from './hierarchical-classification';
export type TagProposal = {
	transactionId: string;
	categoryId: string;
	confidence?: ClassificationConfidence;
	reviewed?: boolean;
	manual?: boolean;
	selected?: boolean;
	reconsidered?: boolean;
	replacesRule?: Rule;
}[];
import type { ClassificationInput } from './local-ai-contract';
export type CategoryClassifier = ((
	input: ClassificationInput,
	signal: AbortSignal
) => Promise<unknown>) & { rootOnly?: boolean };
export const AI_BATCH_SIZE = 16;
export const AI_GUIDANCE_LIMIT = 500;
const tagsSchema = v.strictObject({
	assignments: v.array(
		v.strictObject({ t: v.pipe(v.number(), v.integer()), c: v.pipe(v.number(), v.integer()) })
	)
});
const categoryPurposes: Record<string, string> = Object.fromEntries(
	Object.values(CATEGORY_PRESETS).map((category) => [category.id, category.description])
);
const categoryExamples: Record<string, string> = Object.fromEntries(
	Object.values(CATEGORY_PRESETS).map((category) => [category.id, category.example])
);
/** Evidence is mapped to this branch's choices; subtags do not expand the root choice set. */
function examplesFor(
	rows: readonly Transaction[],
	categories: CategoryDictionary,
	approved: readonly Transaction[],
	choices: BudgetCategory[],
	parentId: string | null
) {
	const ids = new Set(rows.map((row) => row.id));
	const choiceIds = new Set(choices.map((choice) => choice.id));
	const output: { d: string; c: string }[] = [];
	for (const item of approved.filter(
		(item) => !ids.has(item.id) && item.categorySource !== 'automatic'
	)) {
		const id = categoryGroup(categories, item.categoryId, parentId);
		if (!id || !choiceIds.has(id)) continue;
		output.push({ d: item.description.slice(0, 200), c: categoryPath(categories, id) });
		if (output.length >= 8) break;
	}
	for (const category of categoryList(categories)) {
		const id = categoryGroup(categories, category.id, parentId);
		if (id && choiceIds.has(id) && categoryExamples[category.id])
			output.push({ d: categoryExamples[category.id], c: categoryPath(categories, id) });
	}
	return output.slice(0, 48);
}
/** Financial treatment stays outside expense classification, even on explicit reconsideration. */
export function canSuggestCategory(row: Transaction, categories: CategoryDictionary) {
	return !['income', 'transfer', 'excluded'].includes(budgetFlow(row, categories));
}
/** Default runs only fill gaps; explicit selection can request reconsideration separately. */
export function needsAiRule(
	row: Transaction,
	rules: readonly Rule[],
	categories: CategoryDictionary
) {
	const existing = matchingRule(row.description, rules, categories, row.id, row);
	return (
		transactionOverride(row)?.source !== 'manual' &&
		canSuggestCategory(row, categories) &&
		(!existing || existing.categoryId === UNCATEGORIZED_ID)
	);
}
function ruleContext(
	rows: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary,
	choices: BudgetCategory[],
	parentId: string | null
) {
	const terms = new Set(
		rows.flatMap((row) =>
			normalizeDescription(`${row.description} ${row.sourceCategory || ''}`).split(' ')
		)
	);
	return rules
		.filter(
			(rule) =>
				categories[rule.categoryId]?.kind === 'expense' &&
				choices.some((choice) => choice.id === categoryGroup(categories, rule.categoryId, parentId))
		)
		.map((rule) => ({
			rule,
			score: normalizeDescription(rule.keyword)
				.split(' ')
				.filter((term) => terms.has(term)).length
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, 256)
		.map(({ rule }) => ({
			keyword: rule.keyword,
			...(rule.accountType ? { accountType: rule.accountType } : {}),
			...(rule.direction ? { direction: rule.direction } : {}),
			category: categoryPath(categories, categoryGroup(categories, rule.categoryId, parentId)!),
			match: rule.match ?? 'contains',
			field: rule.field ?? 'description'
		}));
}
export function parseTagMappings(
	value: unknown,
	transactions: readonly Transaction[],
	categoryIds: readonly string[]
): TagProposal {
	const parsed = v.safeParse(tagsSchema, value);
	if (!parsed.success) throw new Error('The model returned invalid transaction mappings.');
	const seen = new Set<number>();
	const proposal = parsed.output.assignments.map(({ t, c }) => {
		if (!transactions[t] || !categoryIds[c] || seen.has(t))
			throw new Error('The model returned an unknown or duplicate transaction/category reference.');
		seen.add(t);
		return { transactionId: transactions[t].id, categoryId: categoryIds[c] };
	});
	if (seen.size !== transactions.length)
		throw new Error('The model omitted some transactions. No changes were applied.');
	return proposal;
}
export function applyTagProposal(
	transactions: readonly Transaction[],
	proposal: TagProposal,
	categories: CategoryDictionary,
	options: { overwriteManual?: boolean } = {}
): Transaction[] {
	const mappings = new Map(proposal.map((row) => [row.transactionId, row.categoryId]));
	if (
		mappings.size !== proposal.length ||
		proposal.some(
			(row) =>
				!categories[row.categoryId] ||
				!transactions.some((transaction) => transaction.id === row.transactionId)
		)
	)
		throw new Error('This proposal contains missing or duplicate references.');
	return transactions.map((transaction) =>
		(options.overwriteManual || transaction.categorySource !== 'manual') &&
		mappings.has(transaction.id)
			? {
					...transaction,
					categoryId: mappings.get(transaction.id)!,
					categorySource: 'ai',
					categoryOverride: { categoryId: mappings.get(transaction.id)!, source: 'ai' }
				}
			: transaction
	);
}

// Explicit row review can replace manual assignments, but never edits made since the request.
export function applyReviewedTagProposal(
	transactions: readonly Transaction[],
	proposal: TagProposal,
	categories: CategoryDictionary,
	requested: readonly Transaction[]
): Transaction[] {
	const current = new Map(transactions.map((row) => [row.id, row]));
	const expected = new Map(requested.map((row) => [row.id, row]));
	if (
		proposal.length !== requested.length ||
		proposal.some((row) => !expected.has(row.transactionId))
	)
		throw new Error('This proposal does not match the selected transactions.');
	if (
		requested.some((row) => {
			const now = current.get(row.id);
			return !now || JSON.stringify(row) !== JSON.stringify(now);
		})
	)
		throw new Error(
			'These transactions changed during review. Discard the proposal and try again.'
		);
	return applyTagProposal(transactions, proposal, categories, { overwriteManual: true });
}

/** Classify repeated descriptions once, preserving differing bank/account/category context. */
export async function categorizeWithAi(
	classify: CategoryClassifier,
	transactions: readonly Transaction[],
	categories: CategoryDictionary,
	signal: AbortSignal,
	onProgress: (done: number, total: number) => void = () => {},
	guidance = '',
	approved: readonly Transaction[] = [],
	rules: readonly Rule[] = [],
	options: { reconsider?: boolean } = {}
): Promise<TagProposal> {
	if (guidance.length > AI_GUIDANCE_LIMIT)
		throw new Error(`Keep guidance under ${AI_GUIDANCE_LIMIT} characters.`);
	signal.throwIfAborted();
	const groups = new Map<string, Transaction[]>();
	const merchants = merchantGroups([...approved, ...transactions]);
	const customGroups = new Map<string, { key: string; description: string }>();
	for (const group of groupMerchantTransactions(
		transactions,
		[...approved, ...transactions],
		rules,
		categories
	)) {
		if (!rules.some((rule) => ruleKey(rule) === group.id)) continue;
		for (const row of group.transactions)
			customGroups.set(row.id, {
				key: group.id,
				description:
					group.rule.match === 'regex' ? group.transactions[0].description : group.rule.keyword
			});
	}
	const requestedIds = new Set(transactions.map((row) => row.id));
	const examples = approved.filter((row) => !requestedIds.has(row.id));
	const reconsideredRules = new Set(
		options.reconsider
			? transactions.flatMap((row) => {
					const rule = matchingRule(row.description, rules, categories, row.id, row);
					return rule ? [ruleKey(rule)] : [];
				})
			: []
	);
	// A rule being reconsidered cannot serve as evidence for its own category.
	const contextRules = rules.filter((rule) => !reconsideredRules.has(ruleKey(rule)));
	const preserved: TagProposal = [];
	for (const row of transactions) {
		if (
			!(options.reconsider
				? canSuggestCategory(row, categories)
				: needsAiRule(row, rules, categories))
		) {
			const projected = applyRules([row], rules, categories)[0];
			preserved.push({
				transactionId: row.id,
				categoryId: projected.categoryId
			});
			continue;
		}

		const key =
			customGroups.get(row.id)?.key ??
			JSON.stringify([
				merchants.get(row.id) ?? normalizeDescription(row.description),
				row.sourceCategory || '',
				row.accountType || '',
				row.activityType || '',
				row.activitySubType || '',
				Math.sign(row.amountCents)
			]);
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	const entries = [...groups.values()];
	const result: TagProposal = [...preserved];
	for (let start = 0; start < entries.length; start += AI_BATCH_SIZE) {
		signal.throwIfAborted();
		const batchGroups = entries.slice(start, start + AI_BATCH_SIZE);
		const batch = batchGroups.map((group) => group[0]);
		const assignments = await classifyHierarchy(
			classify,
			batch,
			categories,
			signal,
			(branchRows, choices, parentId) => ({
				fallback: categoryPath(categories, parentId ?? UNCATEGORIZED_ID),
				rules: ruleContext(branchRows, contextRules, categories, choices, parentId),
				...(guidance.trim() ? { guidance: guidance.trim() } : {}),
				examples: examplesFor(branchRows, categories, examples, choices, parentId),
				categories: choices.map((category) => ({
					id: category.id,
					name: categoryPath(categories, category.id),
					purpose: categoryPurposes[category.id] || categoryPath(categories, category.id)
				})),
				transactions: branchRows.map((row, t) => ({
					t,
					d: customGroups.get(row.id)?.description ?? merchants.get(row.id) ?? row.description,
					...(row.sourceCategory ? { bankCategory: row.sourceCategory } : {}),
					...(row.accountType ? { accountType: row.accountType } : {}),
					...(row.activityType ? { activityType: row.activityType } : {}),
					direction: row.amountCents < 0 ? 'out' : 'in',
					...(!options.reconsider && row.categoryId !== UNCATEGORIZED_ID
						? { currentCategory: categoryPath(categories, row.categoryId) }
						: {})
				}))
			})
		);
		for (const [index, group] of batchGroups.entries()) {
			const assignment = assignments.get(batch[index].id)!;
			for (const row of group) {
				const existing = matchingRule(row.description, rules, categories, row.id, row);
				result.push({
					transactionId: row.id,
					...assignment,
					...(options.reconsider
						? {
								reconsidered: true,
								...(existing ? { replacesRule: structuredClone(existing) } : {})
							}
						: {})
				});
			}
		}
		onProgress(result.length, transactions.length);
	}
	onProgress(result.length, transactions.length);
	const mappings = new Map(result.map((item) => [item.transactionId, item]));
	return transactions.map((row) => mappings.get(row.id)!);
}
