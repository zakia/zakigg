import type { Component } from 'svelte';
import type { CraftDocument, CraftMeta } from './types';

const metaModules = import.meta.glob<{ meta: CraftMeta }>('./*/meta.ts', { eager: true });
const documentModules = import.meta.glob<{ default: CraftDocument }>('./*/content.json');
const componentModules = import.meta.glob('./*/index.{svelte,svx}');

export type CraftSummary = CraftMeta & { slug: string };
export type LoadedCraft =
	| { kind: 'document'; document: CraftDocument }
	| { kind: 'component'; Component: Component };

export const crafts: CraftSummary[] = Object.entries(metaModules)
	.map(([path, mod]) => {
		const slug = path.split('/')[1];
		return { ...mod.meta, slug };
	})
	.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const craftSlugs = new Set(crafts.map((c) => c.slug));

export async function loadCraft(slug: string): Promise<LoadedCraft> {
	const keyDocument = `./${slug}/content.json`;
	const keySvelte = `./${slug}/index.svelte`;
	const keySvx = `./${slug}/index.svx`;
	const documentLoader = documentModules[keyDocument];
	const loader = componentModules[keySvelte] ?? componentModules[keySvx];

	if (documentLoader) {
		const mod = await documentLoader();
		return { kind: 'document', document: mod.default };
	}

	if (!loader) throw new Error(`Unknown craft: ${slug}`);
	const mod = (await loader()) as { default: Component };
	return { kind: 'component', Component: mod.default };
}
