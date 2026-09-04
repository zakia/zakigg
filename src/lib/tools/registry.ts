import type { Component } from 'svelte';
import type { ToolMeta, ToolSummary } from './types';

const metaModules = import.meta.glob<{ meta: ToolMeta }>('./*/meta.ts', { eager: true });
const componentModules = import.meta.glob<{ default: Component }>('./*/index.svelte');

export const tools: ToolSummary[] = Object.entries(metaModules)
	.map(([path, module]) => ({ ...module.meta, slug: path.split('/')[1] }))
	.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export const toolSlugs = new Set(tools.map((tool) => tool.slug));

export async function loadTool(slug: string): Promise<Component> {
	const loader = componentModules[`./${slug}/index.svelte`];
	if (!loader) throw new Error(`Unknown tool: ${slug}`);

	return (await loader()).default;
}
