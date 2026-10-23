import { nanoid } from 'nanoid';
import { CATEGORY_PRESETS } from './categories';

export type CategoryKind = 'expense' | 'income' | 'transfer' | 'uncategorized';
export type BudgetCategory = {
	id: string;
	name: string;
	parentId: string | null;
	color: string;
	kind: CategoryKind;
	origin: 'default' | 'user' | 'ai';
};
export type CategoryDictionary = Record<string, BudgetCategory>;

export const CATEGORY_IDS = {
	...(Object.fromEntries(
		Object.entries(CATEGORY_PRESETS).map(([key, category]) => [key, category.id])
	) as {
		[K in keyof typeof CATEGORY_PRESETS]: (typeof CATEGORY_PRESETS)[K]['id'];
	}),
	Income: 'VG6_jTLnz41PAe9YU50xy',
	Uncategorized: 'm7wjhd2Zas6_v8kp4Q0tB'
} as const;
export const UNCATEGORIZED_ID = CATEGORY_IDS.Uncategorized;
export const DEFAULT_CATEGORIES: CategoryDictionary = {
	[UNCATEGORIZED_ID]: {
		id: UNCATEGORIZED_ID,
		name: 'Uncategorized',
		color: '#94a3b8',
		kind: 'uncategorized',
		parentId: null,
		origin: 'default'
	},
	[CATEGORY_IDS.Income]: {
		id: CATEGORY_IDS.Income,
		name: 'Income',
		color: '#63a98c',
		kind: 'income',
		parentId: null,
		origin: 'default'
	},
	...Object.fromEntries(
		Object.values(CATEGORY_PRESETS).map(({ id, name, color, kind, parentId }) => [
			id,
			{ id, name, color, kind, parentId, origin: 'default' }
		])
	)
};

export function categoryPath(categories: CategoryDictionary, id: string): string {
	const parts: string[] = [];
	const seen = new Set<string>();
	let category: BudgetCategory | undefined = categories[id];
	while (category && !seen.has(category.id)) {
		seen.add(category.id);
		parts.unshift(category.name);
		category = category.parentId ? categories[category.parentId] : undefined;
	}
	return parts.join(' / ') || 'Uncategorized';
}
export function categoryList(categories: CategoryDictionary): BudgetCategory[] {
	return Object.values(categories).sort((a, b) =>
		categoryPath(categories, a.id).localeCompare(categoryPath(categories, b.id))
	);
}
export function isWithinCategory(
	categories: CategoryDictionary,
	id: string,
	parentId: string
): boolean {
	const seen = new Set<string>();
	while (categories[id] && !seen.has(id)) {
		if (id === parentId) return true;
		seen.add(id);
		id = categories[id].parentId ?? '';
	}
	return false;
}

/** The root, or immediate child of a scoped parent, that owns this category's spending. */
export function categoryGroup(
	categories: CategoryDictionary,
	id: string,
	parentId: string | null = null
): string | null {
	const seen = new Set<string>();
	while (categories[id] && !seen.has(id)) {
		seen.add(id);
		if (id === parentId || categories[id].parentId === parentId) return id;
		id = categories[id].parentId ?? '';
	}
	return null;
}
export function validateCategories(categories: CategoryDictionary): void {
	if (
		!categories[UNCATEGORIZED_ID] ||
		categories[UNCATEGORIZED_ID].kind !== 'uncategorized' ||
		categories[UNCATEGORIZED_ID].parentId
	)
		throw new Error('The review category must remain available.');
	const names = new Set<string>();
	for (const [id, category] of Object.entries(categories)) {
		if (
			id !== category.id ||
			!/^[A-Za-z0-9_-]{21}$/.test(id) ||
			!category.name.trim() ||
			category.name.length > 80 ||
			!/^#[a-f0-9]{6}$/i.test(category.color) ||
			!['expense', 'income', 'transfer', 'uncategorized'].includes(category.kind) ||
			!['default', 'user', 'ai'].includes(category.origin)
		)
			throw new Error('Invalid category. Use a name and a six-digit color.');
		if (category.kind === 'uncategorized' && id !== UNCATEGORIZED_ID)
			throw new Error('Only one review category is allowed.');
		const key = `${category.parentId ?? ''}:${category.name.trim().toLowerCase()}`;
		if (names.has(key)) throw new Error('Category names must be unique within the same parent.');
		names.add(key);
		if (
			category.parentId &&
			(!categories[category.parentId] ||
				categories[category.parentId].kind !== category.kind ||
				category.kind === 'uncategorized')
		)
			throw new Error('Subcategories must share their parent’s type.');
		const seen = new Set([id]);
		let parent = category.parentId;
		while (parent) {
			if (seen.has(parent)) throw new Error('A category cannot be its own ancestor.');
			seen.add(parent);
			parent = categories[parent]?.parentId ?? null;
		}
	}
}
export function addCategory(
	categories: CategoryDictionary,
	input: Omit<BudgetCategory, 'id'>,
	makeId: () => string = nanoid
): CategoryDictionary {
	const id = makeId();
	if (categories[id]) throw new Error('Category identifier already exists.');
	const next = { ...categories, [id]: { ...input, name: input.name.trim(), id } };
	validateCategories(next);
	return next;
}
export function updateCategory(
	categories: CategoryDictionary,
	id: string,
	patch: Partial<Pick<BudgetCategory, 'name' | 'color' | 'parentId' | 'kind'>>
): CategoryDictionary {
	if (!categories[id]) throw new Error('Category no longer exists.');
	const next = {
		...categories,
		[id]: { ...categories[id], ...patch, name: (patch.name ?? categories[id].name).trim() }
	};
	if (next[id].parentId) next[id].kind = next[next[id].parentId]?.kind ?? next[id].kind;
	for (const category of Object.values(next)) {
		if (category.id !== id && isWithinCategory(categories, category.id, id))
			next[category.id] = { ...category, kind: next[id].kind };
	}
	validateCategories(next);
	return next;
}

/** Adopt the new default tree once when opening a workspace created with flat presets. */
export function adoptDefaultHierarchy(categories: CategoryDictionary): CategoryDictionary {
	const next = structuredClone(categories);
	const renamed: Record<string, string> = {
		[CATEGORY_IDS.Dining]: 'Dining and Coffee',
		[CATEGORY_IDS.Health]: 'Medical',
		[CATEGORY_IDS.Shopping]: 'Personal'
	};
	for (const [id, category] of Object.entries(next)) {
		const preset = DEFAULT_CATEGORIES[id];
		if (!preset || category.origin !== 'default') continue;
		if (renamed[id] === category.name) category.name = preset.name;
		if (preset.parentId && !category.parentId && next[preset.parentId]) {
			category.parentId = preset.parentId;
			category.kind = next[preset.parentId].kind;
		}
	}
	for (const preset of Object.values(DEFAULT_CATEGORIES)) {
		if (!preset.parentId || next[preset.id] || !next[preset.parentId]) continue;
		if (
			Object.values(next).some(
				(category) =>
					category.parentId === preset.parentId &&
					category.name.toLowerCase() === preset.name.toLowerCase()
			)
		)
			continue;
		next[preset.id] = { ...preset, kind: next[preset.parentId].kind };
	}
	validateCategories(next);
	return next;
}
