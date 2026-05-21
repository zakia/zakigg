import type { Component } from 'svelte';
import type { CraftMeta } from './types';

const metaModules = import.meta.glob<{ meta: CraftMeta }>('./*/meta.ts', { eager: true });
const componentModules = import.meta.glob('./*/index.{svelte,svx}');

export type CraftSummary = CraftMeta & { slug: string };

export const crafts: CraftSummary[] = Object.entries(metaModules)
	.map(([path, mod]) => {
		const slug = path.split('/')[1];
		return { ...mod.meta, slug };
	})
	.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const craftSlugs = new Set(crafts.map((c) => c.slug));

export async function loadCraft(slug: string): Promise<Component> {
	const keySvelte = `./${slug}/index.svelte`;
	const keySvx = `./${slug}/index.svx`;
	const loader = componentModules[keySvelte] ?? componentModules[keySvx];
	if (!loader) throw new Error(`Unknown craft: ${slug}`);
	const mod = (await loader()) as { default: Component };
	return mod.default;
}
