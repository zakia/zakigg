import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SvelteURLSearchParams } from 'svelte/reactivity';

export function useUrlParams(defaults: Record<string, string | undefined> = {}) {
	const params = new SvelteURLSearchParams(page.url?.searchParams);

	// Set defaults for any params that aren't in the URL
	for (const [key, value] of Object.entries(defaults)) {
		if (!params.has(key) && value !== undefined) {
			params.set(key, value);
		}
	}

	$effect(() => {
		goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
	});

	return params;
}

