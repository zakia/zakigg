import { nanoid } from 'nanoid';
import type { Rule, Transaction } from './processing';
import { matchingRule } from './processing';
import type { CategoryDictionary } from './category-model';

export type TagDimension = 'purpose' | 'context' | 'pattern';
export type BudgetTag = { id: string; name: string; color: string; dimension: TagDimension };
export type TagDictionary = Record<string, BudgetTag>;
export type TagOverride = { add: string[]; remove: string[] };
export const TAG_IDS = {
	Needs: 'ZqCB660dU2tHNv3yqHyBc',
	Wants: 'BOO5nsggdmMn9S3PwPyQg',
	Mixed: 'BaZm2W0Ls1meDim93Hws9',
	Work: 'TY-t-37l_PWWNsC-Mod_3',
	Social: 'hwVtOE4Z-_fc5P2lm96EZ',
	Recurring: 'JwZFI1uDzmsmIo0T_tZak',
	Subscription: 'MJVIp2vKGsu-haw955IVi'
} as const;
export const DEFAULT_TAGS: TagDictionary = Object.fromEntries(
	[
		{ id: TAG_IDS.Needs, name: 'Needs', color: '#629885', dimension: 'purpose' },
		{ id: TAG_IDS.Wants, name: 'Wants', color: '#bb8770', dimension: 'purpose' },
		{ id: TAG_IDS.Mixed, name: 'Mixed', color: '#9c8fba', dimension: 'purpose' },
		{ id: TAG_IDS.Work, name: 'Work', color: '#7289b9', dimension: 'context' },
		{ id: TAG_IDS.Social, name: 'Social', color: '#d38b9a', dimension: 'context' },
		{ id: TAG_IDS.Recurring, name: 'Recurring', color: '#648fa9', dimension: 'pattern' },
		{ id: TAG_IDS.Subscription, name: 'Subscription', color: '#8a80cb', dimension: 'pattern' }
	].map((tag) => [tag.id, tag])
) as TagDictionary;

export function validateTagIds(ids: readonly string[], tags: TagDictionary) {
	if (
		new Set(ids).size !== ids.length ||
		ids.some((id) => !tags[id]) ||
		ids.filter((id) => tags[id]?.dimension === 'purpose').length > 1
	)
		throw new Error('Use existing tags and one Wants/Needs choice.');
}
export function validateTags(tags: TagDictionary) {
	const names = new Set<string>();
	for (const [id, tag] of Object.entries(tags)) {
		const name = tag.name.trim().toLowerCase();
		if (
			tag.id !== id ||
			!/^[A-Za-z0-9_-]{21}$/.test(id) ||
			!name ||
			tag.name.length > 80 ||
			!/^#[a-f0-9]{6}$/i.test(tag.color) ||
			!['purpose', 'context', 'pattern'].includes(tag.dimension) ||
			names.has(name)
		)
			throw new Error('Use unique tag names, stable IDs and six-digit colors.');
		names.add(name);
	}
	for (const [id, tag] of Object.entries(DEFAULT_TAGS))
		if (!tags[id] || tags[id].dimension !== tag.dimension)
			throw new Error('Keep the default tag dimensions available.');
}
export function addTag(tags: TagDictionary, name: string, color = '#7289b9'): TagDictionary {
	const id = nanoid();
	const next = { ...tags, [id]: { id, name: name.trim(), color, dimension: 'context' as const } };
	validateTags(next);
	return next;
}
export function resolveTagIds(
	inherited: readonly string[],
	override: TagOverride | undefined,
	tags: TagDictionary
) {
	const removed = new Set(override?.remove ?? []);
	const added = override?.add ?? [];
	const purpose = added.find((id) => tags[id]?.dimension === 'purpose');
	return [
		...new Set([
			...inherited.filter(
				(id) => !removed.has(id) && (!purpose || tags[id]?.dimension !== 'purpose')
			),
			...added
		])
	].filter((id) => !!tags[id]);
}
/** Categories and purposes are independent. Derived tags never alter import facts or identities. */
export function transactionTagMap(
	rows: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary,
	tags: TagDictionary,
	recurringIds: ReadonlySet<string> = new Set()
) {
	return new Map(
		rows.map((row) => {
			const rule = matchingRule(row.description, rules, categories, row.id, row);
			const inherited = [
				...(rule?.tagIds ?? []),
				...(recurringIds.has(row.id) ? [TAG_IDS.Recurring] : [])
			];
			return [row.id, resolveTagIds(inherited, row.tagOverride, tags)];
		})
	);
}
export function editTransactionTags(
	rows: readonly Transaction[],
	id: string,
	current: readonly string[],
	desired: readonly string[],
	tags: TagDictionary
): Transaction[] {
	validateTagIds(desired, tags);
	return rows.map((row) => {
		if (row.id !== id) return row;
		const add = new Set(row.tagOverride?.add ?? []),
			remove = new Set(row.tagOverride?.remove ?? []);
		for (const old of current)
			if (!desired.includes(old)) {
				add.delete(old);
				remove.add(old);
			}
		for (const wanted of desired)
			if (!current.includes(wanted)) {
				remove.delete(wanted);
				add.add(wanted);
			}
		const purpose = (ids: readonly string[]) => ids.find((id) => tags[id]?.dimension === 'purpose');
		if (purpose(current) !== purpose(desired)) {
			for (const tag of Object.values(tags).filter((tag) => tag.dimension === 'purpose')) {
				add.delete(tag.id);
				remove.add(tag.id);
			}
			const chosen = purpose(desired);
			if (chosen) {
				remove.delete(chosen);
				add.add(chosen);
			}
		}
		return { ...row, tagOverride: { add: [...add], remove: [...remove] } };
	});
}
export function filterByTag(
	rows: readonly Transaction[],
	map: ReadonlyMap<string, string[]>,
	id: string,
	tags: TagDictionary
) {
	if (!id) return [...rows];
	return rows.filter((row) =>
		id === 'unreviewed'
			? !(map.get(row.id) ?? []).some((id) => tags[id]?.dimension === 'purpose')
			: map.get(row.id)?.includes(id)
	);
}
