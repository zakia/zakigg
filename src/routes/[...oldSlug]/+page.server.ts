import { error, redirect } from '@sveltejs/kit';
import { craftSlugs } from '$lib/crafts/registry';
import type { PageServerLoad } from './$types';

const aliases: Record<string, string> = {
	'🐑🍞': 'sheep-bread'
};

export const load: PageServerLoad = ({ params }) => {
	const first = params.oldSlug.split('/')[0];
	const decoded = (() => {
		try {
			return decodeURIComponent(first);
		} catch {
			return first;
		}
	})();
	const target = aliases[decoded] ?? aliases[first] ?? decoded;
	if (craftSlugs.has(target)) {
		redirect(301, `/crafts/${target}`);
	}
	error(404);
};
