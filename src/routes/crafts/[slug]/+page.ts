import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, params }) => {
	if (data.edit) return { mode: 'edit' as const, slug: params.slug };

	if (!data.published || !data.document) throw new Error('Published craft not found');

	return {
		mode: 'public' as const,
		meta: data.published,
		document: data.document
	};
};
