<script lang="ts">
	import { page } from '$app/state';
	import Access from '$lib/crafts/Access.svelte';
	import Edit from '$lib/crafts/Edit.svelte';
	import { titleFromSlug } from '$lib/editor/document/slug';

	const slug = $derived(page.params.slug ?? '');
</script>

<svelte:head>
	<title>{titleFromSlug(slug)} – Edit – zaki.gg</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Access>
	<Edit {slug} />
</Access>
