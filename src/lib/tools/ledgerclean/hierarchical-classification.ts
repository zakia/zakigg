import * as v from 'valibot';
import {
	confidenceLevel,
	weakestConfidence,
	confidenceSchema,
	type ClassificationConfidence
} from './confidence';
import {
	categoryList,
	categoryPath,
	UNCATEGORIZED_ID,
	type BudgetCategory,
	type CategoryDictionary
} from './category-model';
import type { Transaction } from './processing';
import type { CategoryClassifier } from './ai';
import type { ClassificationInput } from './local-ai-contract';
const outputSchema = v.strictObject({
	assignments: v.array(
		v.strictObject({
			t: v.pipe(v.number(), v.integer()),
			c: v.string(),
			confidence: v.optional(confidenceSchema)
		})
	)
});
type Assignment = { categoryId: string; confidence?: ClassificationConfidence };

/** Small independent choice sets. Weak child predictions retain their confident parent. */
export async function classifyHierarchy(
	classify: CategoryClassifier,
	rows: readonly Transaction[],
	categories: CategoryDictionary,
	signal: AbortSignal,
	inputFor: (
		rows: readonly Transaction[],
		choices: BudgetCategory[],
		parentId: string | null
	) => ClassificationInput
): Promise<Map<string, Assignment>> {
	const listed = categoryList(categories);
	async function branch(
		batch: readonly Transaction[],
		choices: BudgetCategory[],
		parentId: string | null
	): Promise<Map<string, Assignment>> {
		signal.throwIfAborted();
		const response = await classify(inputFor(batch, choices, parentId), signal);
		signal.throwIfAborted();
		const parsed = v.safeParse(outputSchema, response);
		if (!parsed.success) throw new Error('Local AI returned invalid category mappings.');
		const names = new Map(
			choices.map((choice) => [categoryPath(categories, choice.id), choice.id])
		);
		const selected = new Map<string, Assignment>();
		for (const item of parsed.output.assignments) {
			if (!batch[item.t] || selected.has(batch[item.t].id) || !names.has(item.c))
				throw new Error('Local AI returned an unknown or duplicate category mapping.');
			selected.set(batch[item.t].id, {
				categoryId: names.get(item.c)!,
				...(item.confidence ? { confidence: item.confidence } : {})
			});
		}
		if (selected.size !== batch.length)
			throw new Error('Local AI omitted transactions. No changes were applied.');
		return selected;
	}
	const roots = listed.filter(
		(category) =>
			(category.kind === 'expense' && !category.parentId) || category.id === UNCATEGORIZED_ID
	);
	const result = await branch(rows, roots, null);
	if (classify.rootOnly) return result;
	async function descend(batch: readonly Transaction[], parentId: string) {
		const children = listed.filter(
			(category) => category.parentId === parentId && category.kind === 'expense'
		);
		if (!children.length) return;
		const next = await branch(batch, [categories[parentId], ...children], parentId);
		const descendants = new Map<string, Transaction[]>();
		for (const row of batch) {
			const child = next.get(row.id)!;
			if (
				child.categoryId === parentId ||
				!child.confidence ||
				confidenceLevel(child.confidence) === 'low'
			)
				continue;
			const parent = result.get(row.id)!;
			result.set(row.id, {
				...child,
				confidence: weakestConfidence([parent.confidence, child.confidence])
			});
			descendants.set(child.categoryId, [...(descendants.get(child.categoryId) ?? []), row]);
		}
		for (const [id, batch] of descendants) await descend(batch, id);
	}
	const confident = new Map<string, Transaction[]>();
	for (const row of rows) {
		const assignment = result.get(row.id)!;
		if (
			assignment.categoryId === UNCATEGORIZED_ID ||
			!assignment.confidence ||
			confidenceLevel(assignment.confidence) === 'low'
		)
			continue;
		confident.set(assignment.categoryId, [...(confident.get(assignment.categoryId) ?? []), row]);
	}
	for (const [id, batch] of confident) await descend(batch, id);
	return result;
}
