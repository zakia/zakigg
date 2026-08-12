import { crafts, craftSlugs, loadCraft } from '$lib/crafts/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, params }) => {
	if (data.edit) return { mode: 'edit' as const, slug: params.slug };

	if (data.published && data.document) {
		return {
			mode: 'public' as const,
			meta: data.published,
			craft: { kind: 'published' as const, document: data.document }
		};
	}

	// Unknown slugs are rejected in +page.server.ts. This branch retains the
	// non-serializable Svelte component constructors used by standalone crafts.
	if (!craftSlugs.has(params.slug)) throw new Error('Craft not found');
	const meta = crafts.find((c) => c.slug === params.slug)!;
	const craft = await loadCraft(params.slug);
	return { mode: 'public' as const, meta, craft };
};
