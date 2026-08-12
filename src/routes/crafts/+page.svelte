<script lang="ts">
	import { auth } from '$lib/auth';
	import CraftCollection from '$lib/crafts/CraftCollection.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';

	let { data } = $props();

	const publicCrafts = $derived(
		data.crafts.map((craft) => ({
			id:
				'pageId' in craft && typeof craft.pageId === 'string'
					? craft.pageId
					: `static:${craft.slug}`,
			slug: craft.slug,
			title: craft.title,
			tags: craft.tags,
			date: craft.date,
			wordCount: craft.wordCount
		}))
	);
</script>

<svelte:head>
	{#if data.edit}
		<title>Manage Crafts – zaki.gg</title>
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		<title>Crafts – zaki.gg</title>
		<meta
			name="description"
			content="A collection of essays, experiments, and interactive crafts."
		/>
	{/if}
</svelte:head>

{#if data.edit}
	<CraftEditGate>
		<CraftCollection editable />
	</CraftEditGate>
{:else}
	<CraftCollection initialCrafts={publicCrafts} showEditLink={Boolean(auth.user)} />
{/if}
