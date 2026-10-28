import {
	DEFAULT_TAGS,
	validateTags,
	validateTagIds,
	resolveTagIds,
	editTransactionTags,
	type TagDictionary
} from './tags';
import { patternError } from './rule-pattern';
import { starterRules, STARTER_RULE_VERSION } from './starter-rules';
import { consolidateMerchantRules } from './merchant-rules';
import { confidenceSchema } from './confidence';
import { isDeclaredTransfer } from './activity';
import type { ImportProfile } from './import-inference';
import * as v from 'valibot';
import {
	DEFAULT_CATEGORIES,
	UNCATEGORIZED_ID,
	validateCategories,
	adoptDefaultHierarchy,
	type CategoryDictionary
} from './category-model';
import {
	defaultImportOptions,
	applyRules,
	matchingRule,
	normalizeDate,
	transactionOverride,
	type ImportOptions,
	ruleKey,
	type Rule,
	type Transaction
} from './processing';

export type ImportInfo = {
	id: string;
	name: string;
	count: number;
	amountMode: ImportOptions['amountMode'];
	expenses: ImportOptions['expenses'];
	account?: string;
	duplicates?: number;
	profileKey?: string;
};
export type Workspace = {
	version: 5;
	starterVersion: number;
	tags: TagDictionary;
	profiles: Record<string, ImportProfile>;
	categories: CategoryDictionary;
	transactions: Transaction[];
	rules: Rule[];
	imports: ImportInfo[];
};
// Keep the existing storage location so upgrading cannot leave an abandoned second workspace.
export const WORKSPACE_KEY = 'ledgerclean:workspace:v1';
const tagSchema = v.strictObject({
	id: v.string(),
	name: v.string(),
	color: v.string(),
	dimension: v.picklist(['purpose', 'context', 'pattern'])
});
const tagOverrideSchema = v.strictObject({ add: v.array(v.string()), remove: v.array(v.string()) });
const categorySchema = v.strictObject({
	id: v.string(),
	name: v.string(),
	color: v.string(),
	parentId: v.nullable(v.string()),
	kind: v.picklist(['expense', 'income', 'transfer', 'uncategorized']),
	origin: v.picklist(['default', 'user', 'ai'])
});
const facts = {
	id: v.string(),
	date: v.string(),
	merchant: v.string(),
	description: v.string(),
	amountCents: v.pipe(v.number(), v.safeInteger()),
	currency: v.picklist(['CAD', 'USD', 'EUR', 'GBP']),
	source: v.string(),
	importId: v.string()
};
const overrideSchema = v.nullable(
	v.strictObject({ categoryId: v.string(), source: v.picklist(['manual', 'ai']) })
);
const previousTransactionSchema = v.strictObject({
	...facts,
	account: v.string(),
	categoryOverride: overrideSchema
});
const activityFacts = {
	accountType: v.optional(v.picklist(['unknown', 'cash', 'credit'])),
	activityType: v.optional(v.string()),
	activitySubType: v.optional(v.string()),
	// Accept the old field on load only; CSV status no longer belongs to the budget model.
	status: v.optional(v.string()),
	sourceCategory: v.optional(v.string()),
	budgetOverride: v.optional(v.nullable(v.picklist(['transfer', 'exclude'])))
};
const transactionSchema = v.strictObject({
	...previousTransactionSchema.entries,
	...activityFacts,
	tagOverride: v.optional(tagOverrideSchema)
});
const legacyTransactionSchema = v.strictObject({
	...facts,
	categoryId: v.string(),
	categorySource: v.picklist(['automatic', 'ai', 'manual'])
});
export const ruleSchema = v.strictObject({
	enabled: v.optional(v.boolean()),
	starterId: v.optional(v.string()),
	spendingOnly: v.optional(v.boolean()),
	tagIds: v.optional(v.array(v.string())),
	confidence: v.optional(confidenceSchema),
	direction: v.optional(v.picklist(['out', 'in'])),
	accountType: v.optional(v.picklist(['unknown', 'cash', 'credit'])),
	keyword: v.string(),
	categoryId: v.string(),
	match: v.optional(v.picklist(['exact', 'contains', 'merchant', 'regex', 'words'])),
	source: v.optional(v.picklist(['manual', 'ai', 'starter', 'import'])),
	field: v.optional(v.picklist(['description', 'sourceCategory'])),
	excludedTransactionIds: v.optional(v.array(v.string()))
});
const profileSchema = v.strictObject({
	columns: v.strictObject(
		Object.fromEntries(
			Object.keys(defaultImportOptions([], '').columns).map((key) => [key, v.string()])
		)
	),
	account: v.string(),
	accountType: v.optional(v.picklist(['auto', 'unknown', 'cash', 'credit'])),
	expenses: v.picklist(['negative', 'positive']),
	dateOrder: v.picklist(['MDY', 'DMY']),
	currency: v.picklist(['CAD', 'USD', 'EUR', 'GBP'])
});
const shared = {
	tags: v.optional(v.record(v.string(), tagSchema), () => structuredClone(DEFAULT_TAGS)),
	profiles: v.optional(v.record(v.string(), profileSchema), {}),
	categories: v.record(v.string(), categorySchema),
	imports: v.array(
		v.strictObject({
			id: v.string(),
			name: v.string(),
			count: v.pipe(v.number(), v.integer(), v.minValue(0)),
			amountMode: v.picklist(['signed', 'split']),
			expenses: v.picklist(['negative', 'positive']),
			account: v.optional(v.string()),
			profileKey: v.optional(v.string()),
			duplicates: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
		})
	)
};
const oldShared = {
	...shared,
	ai: v.optional(
		v.union([
			v.strictObject({ enabled: v.boolean() }),
			v.strictObject({
				baseUrl: v.string(),
				model: v.string(),
				format: v.picklist(['schema', 'json'])
			})
		])
	)
};
const workspaceSchema = v.strictObject({
	...shared,
	version: v.literal(5),
	starterVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), STARTER_RULE_VERSION),
	transactions: v.array(transactionSchema),
	rules: v.array(ruleSchema)
});
const priorSchema = v.strictObject({
	...oldShared,
	version: v.literal(4),
	transactions: v.array(transactionSchema),
	rules: v.array(ruleSchema)
});
const flatSchema = v.strictObject({ ...priorSchema.entries, version: v.literal(3) });
const previousSchema = v.strictObject({
	...priorSchema.entries,
	version: v.literal(2),
	transactions: v.array(previousTransactionSchema)
});
const legacySchema = v.strictObject({
	...oldShared,
	version: v.literal(1),
	transactions: v.array(legacyTransactionSchema),
	rules: v.array(v.strictObject({ keyword: v.string(), categoryId: v.string() }))
});
export function emptyWorkspace(): Workspace {
	return {
		version: 5,
		starterVersion: STARTER_RULE_VERSION,
		tags: structuredClone(DEFAULT_TAGS),
		profiles: {},
		categories: structuredClone(DEFAULT_CATEGORIES),
		transactions: [],
		rules: starterRules(),
		imports: []
	};
}
export function validateWorkspace(value: unknown): Workspace {
	const legacy = (value as { version?: unknown })?.version === 1;
	const parsed = legacy
		? v.safeParse(legacySchema, value)
		: (value as { version?: unknown })?.version === 2
			? v.safeParse(previousSchema, value)
			: (value as { version?: unknown })?.version === 3
				? v.safeParse(flatSchema, value)
				: (value as { version?: unknown })?.version === 4
					? v.safeParse(priorSchema, value)
					: v.safeParse(workspaceSchema, value);
	if (!parsed.success) throw new Error('Saved workspace has an unsupported or invalid format.');
	const saved = parsed.output;
	if (saved.version < 4) saved.categories = adoptDefaultHierarchy(saved.categories);
	validateTags(saved.tags);
	validateCategories(saved.categories);
	const savedRules: Rule[] = saved.rules;
	if (savedRules.some((rule) => !!patternError(rule.keyword, rule.match)))
		throw new Error('Saved rules contain an invalid matching pattern.');
	// Older presets had no stable identity. Upgrade once; never resurrect edited/disabled/deleted v5 defaults.
	const rules: Rule[] =
		saved.version < 5 ? savedRules.filter((rule) => rule.source !== 'starter') : savedRules;
	for (const rule of rules) validateTagIds(rule.tagIds ?? [], saved.tags);
	const transactions: Transaction[] = saved.transactions.map((row) => {
		if ('categoryId' in row)
			return { ...row, account: 'Main account', categoryOverride: transactionOverride(row) };
		const facts = { ...row };
		if ('status' in facts) delete facts.status;
		return { ...facts, categoryId: UNCATEGORIZED_ID, categorySource: 'automatic' };
	});
	const ids = new Set<string>();
	const imports = new Set(saved.imports.map((file) => file.id));
	if (imports.size !== saved.imports.length)
		throw new Error('Saved imports have duplicate identifiers.');
	for (const row of transactions) {
		if (
			ids.has(row.id) ||
			!imports.has(row.importId) ||
			normalizeDate(row.date, 'MDY') !== row.date ||
			(row.categoryOverride && !saved.categories[row.categoryOverride.categoryId]) ||
			(legacy && !saved.categories[row.categoryId])
		)
			throw new Error('Saved transactions have invalid relationships or dates.');
		validateTagIds(row.tagOverride?.add ?? [], saved.tags);
		if (row.tagOverride?.remove.some((id) => !saved.tags[id]))
			throw new Error('Saved tag overrides have invalid relationships.');
		ids.add(row.id);
	}
	if (
		rules.some(
			(rule) =>
				!saved.categories[rule.categoryId] ||
				!rule.keyword.trim() ||
				rule.excludedTransactionIds?.some((id) => !ids.has(id))
		)
	)
		throw new Error('Saved rules have invalid category relationships.');
	const legacyRank = (rule: Rule) => (rule.source === 'import' ? 1 : rule.source === 'ai' ? 2 : 3);
	const orderedLegacy = [...rules].sort(
		(a, b) =>
			legacyRank(b) - legacyRank(a) ||
			Number(b.match === 'exact') - Number(a.match === 'exact') ||
			Number(b.match === 'merchant') - Number(a.match === 'merchant') ||
			Number(!!b.accountType) - Number(!!a.accountType) ||
			Number(!!b.direction) - Number(!!a.direction) ||
			b.keyword.length - a.keyword.length
	);
	const historical =
		saved.version < 5
			? transactions.map((row) => {
					const winner = orderedLegacy.find((rule) =>
						matchingRule(row.description, [rule], saved.categories, row.id, row)
					);
					return { winner, row: applyRules([row], winner ? [winner] : [], saved.categories)[0] };
				})
			: [];
	const consolidatedRules =
		saved.version < 5
			? consolidateMerchantRules(transactions, orderedLegacy, saved.categories)
			: rules;
	if (saved.version < 5) {
		const keys = new Set(consolidatedRules.map(ruleKey));
		const additions = starterRules(saved.categories)
			.filter((rule) => !keys.has(ruleKey(rule)))
			.map((rule) => ({
				...rule,
				// Upgrading must not silently replace an existing categorized merchant with a shipped default.
				enabled: !transactions.some((row) => {
					const existing = matchingRule(
						row.description,
						consolidatedRules,
						saved.categories,
						row.id,
						row
					);
					return (
						existing &&
						existing.categoryId !== rule.categoryId &&
						matchingRule(
							row.description,
							[...consolidatedRules, rule],
							saved.categories,
							row.id,
							row
						) === rule
					);
				})
			}));
		consolidatedRules.push(...additions);
	}
	if (new Set(consolidatedRules.map(ruleKey)).size !== consolidatedRules.length)
		throw new Error('Saved rules contain duplicate matching patterns.');
	const projected = applyRules(transactions, consolidatedRules, saved.categories).map(
		(row, index) => {
			const old = historical[index];
			if (!old?.winner) return row;
			let preserved = row;
			// Preserve historical intent where the new specificity policy differs from the retired source ranking.
			if (
				old.row.categoryId !== row.categoryId &&
				!transactionOverride(row) &&
				!isDeclaredTransfer(row)
			) {
				const source = old.winner.source === 'ai' ? ('ai' as const) : ('manual' as const);
				preserved = {
					...row,
					categoryId: old.row.categoryId,
					categorySource: source,
					categoryOverride: { categoryId: old.row.categoryId, source }
				};
			}
			const winner = matchingRule(
				row.description,
				consolidatedRules,
				saved.categories,
				row.id,
				row
			);
			const before = resolveTagIds(old.winner.tagIds ?? [], row.tagOverride, saved.tags);
			const after = resolveTagIds(winner?.tagIds ?? [], row.tagOverride, saved.tags);
			return JSON.stringify([...before].sort()) === JSON.stringify([...after].sort())
				? preserved
				: editTransactionTags([preserved], row.id, after, before, saved.tags)[0];
		}
	);
	return {
		version: 5,
		starterVersion: 'starterVersion' in saved ? saved.starterVersion : STARTER_RULE_VERSION,
		tags: saved.tags,
		imports: saved.imports,
		categories: saved.categories,
		profiles: saved.profiles as Record<string, ImportProfile>,
		rules: consolidatedRules,
		transactions: projected
	};
}
export function loadWorkspace(storage: Pick<Storage, 'getItem'>): Workspace {
	const value = storage.getItem(WORKSPACE_KEY);
	if (value !== null) return validateWorkspace(JSON.parse(value));
	return emptyWorkspace();
}
export function persistWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
	// Raw facts and one-off overrides only: automatic categories are derived from the saved rules.
	storage.setItem(WORKSPACE_KEY, JSON.stringify(serializeWorkspace(workspace)));
}

export function serializeWorkspace(workspace: Workspace) {
	return {
		version: 5,
		starterVersion: workspace.starterVersion,
		tags: workspace.tags,
		profiles: workspace.profiles,
		categories: workspace.categories,
		transactions: workspace.transactions.map((row) => ({
			id: row.id,
			date: row.date,
			merchant: row.merchant,
			description: row.description,
			amountCents: row.amountCents,
			currency: row.currency,
			source: row.source,
			importId: row.importId,
			account: row.account || 'Main account',
			categoryOverride: transactionOverride(row),
			accountType: row.accountType,
			activityType: row.activityType,
			activitySubType: row.activitySubType,
			sourceCategory: row.sourceCategory,
			budgetOverride: row.budgetOverride,
			tagOverride: row.tagOverride
		})),
		rules: workspace.rules,
		imports: workspace.imports
	};
}
