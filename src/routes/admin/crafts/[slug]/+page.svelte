<script lang="ts">
	import { page } from '$app/state';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';
	import CraftEditorPage from '$lib/crafts/CraftEditorPage.svelte';
	import { titleFromSlug } from '$lib/editor/document/slug';

	const slug = $derived(page.params.slug ?? '');
</script>

<svelte:head>
	<title>{titleFromSlug(slug)} – Edit – zaki.gg</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<CraftEditGate>
	<CraftEditorPage {slug} />
</CraftEditGate>
