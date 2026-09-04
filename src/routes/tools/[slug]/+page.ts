import { error } from '@sveltejs/kit';
import { loadTool, tools } from '$lib/tools/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const meta = tools.find((tool) => tool.slug === params.slug && !tool.draft);
	if (!meta) error(404, 'Tool not found');

	return { meta, Tool: await loadTool(params.slug) };
};
