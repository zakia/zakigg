import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SvelteURLSearchParams } from 'svelte/reactivity';

export function svelteParams(data: Record<string, string>) {
	const state = $state(data);
	// convert state to URL search params
	const urlParams = new SvelteURLSearchParams(page.url?.searchParams);
	for (const [key, value] of Object.entries(state)) {
		if (!urlParams.has(key)) {
			urlParams.set(key, value);
		}
	}
	goto(urlParams.toString());
	return state;
}
