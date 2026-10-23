import { DEFAULT_TAGS, validateTags, validateTagIds, type TagDictionary } from './tags';
import { patternError } from './rule-pattern';
import { consolidateMerchantRules } from './merchant-rules';
import { confidenceSchema } from './confidence';
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
	normalizeDate,
	transactionOverride,
	type ImportOptions,
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
export type AiSettings = { enabled: boolean };
export type Workspace = {
	version: 4;
	tags: TagDictionary;
	profiles: Record<string, ImportProfile>;
	categories: CategoryDictionary;
	transactions: Transaction[];
	rules: Rule[];
	imports: ImportInfo[];
	ai: AiSettings;
};
// Keep the existing storage location so upgrading cannot leave an abandoned second workspace.
export const WORKSPACE_KEY = 'ledgerclean:workspace:v1';
export const DEFAULT_AI: AiSettings = { enabled: false };
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
const ruleSchema = v.strictObject({
	tagIds: v.optional(v.array(v.string())),
	confidence: v.optional(confidenceSchema),
	direction: v.optional(v.picklist(['out', 'in'])),
	accountType: v.optional(v.picklist(['unknown', 'cash', 'credit'])),
	keyword: v.string(),
	categoryId: v.string(),
	match: v.optional(v.picklist(['exact', 'contains', 'merchant', 'regex'])),
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
	),
	ai: v.union([
		v.strictObject({ enabled: v.boolean() }),
		v.strictObject({
			baseUrl: v.string(),
			model: v.string(),
			format: v.picklist(['schema', 'json'])
		})
	])
};
const workspaceSchema = v.strictObject({
	...shared,
	version: v.literal(4),
	transactions: v.array(transactionSchema),
	rules: v.array(ruleSchema)
});
const flatSchema = v.strictObject({ ...workspaceSchema.entries, version: v.literal(3) });
const previousSchema = v.strictObject({
	...workspaceSchema.entries,
	version: v.literal(2),
	transactions: v.array(previousTransactionSchema)
});
const legacySchema = v.strictObject({
	...shared,
	version: v.literal(1),
	transactions: v.array(legacyTransactionSchema),
	rules: v.array(v.strictObject({ keyword: v.string(), categoryId: v.string() }))
});
export function emptyWorkspace(): Workspace {
	return {
		version: 4,
		tags: structuredClone(DEFAULT_TAGS),
		profiles: {},
		categories: structuredClone(DEFAULT_CATEGORIES),
		transactions: [],
		rules: [],
		imports: [],
		ai: { ...DEFAULT_AI }
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
				: v.safeParse(workspaceSchema, value);
	if (!parsed.success) throw new Error('Saved workspace has an unsupported or invalid format.');
	const saved = parsed.output;
	if (saved.version !== 4) saved.categories = adoptDefaultHierarchy(saved.categories);
	validateTags(saved.tags);
	validateCategories(saved.categories);
	const savedRules: Rule[] = saved.rules;
	if (savedRules.some((rule) => !!patternError(rule.keyword, rule.match)))
		throw new Error('Saved rules contain an invalid matching pattern.');
	// Discard shipped presets from existing workspaces; approved/imported rules remain intact.
	const rules: Rule[] = savedRules.filter((rule) => rule.source !== 'starter');
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
	const consolidatedRules = consolidateMerchantRules(transactions, rules, saved.categories);
	return {
		...saved,
		version: 4,
		categories: saved.categories,
		profiles: saved.profiles as Record<string, ImportProfile>,
		ai: { enabled: 'enabled' in saved.ai ? saved.ai.enabled : false },
		rules: consolidatedRules,
		transactions: applyRules(transactions, consolidatedRules, saved.categories)
	};
}
export function loadWorkspace(storage: Pick<Storage, 'getItem'>): Workspace {
	const value = storage.getItem(WORKSPACE_KEY);
	if (value !== null) return validateWorkspace(JSON.parse(value));
	return emptyWorkspace();
}
export function persistWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
	// Raw facts and one-off overrides only: automatic categories are derived from the saved rules.
	storage.setItem(
		WORKSPACE_KEY,
		JSON.stringify({
			version: 4,
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
			imports: workspace.imports,
			ai: { enabled: workspace.ai.enabled }
		})
	);
}
