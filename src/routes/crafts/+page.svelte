<script lang="ts">
	import { applyTagColors } from '#lib/components/tag.js';
	import Collection from '#lib/crafts/Collection.svelte';
	import { listRepositoryCrafts } from '#lib/crafts/repository.remote.js';

	const data = $derived(await listRepositoryCrafts());

	$effect(() => {
		applyTagColors(data.tags);
	});
</script>

<svelte:head>
	<title>Crafts – zaki.gg</title>
	<meta name="description" content="A collection of essays, experiments, and interactive crafts." />
</svelte:head>

<Collection
	initialCrafts={data.crafts}
	initialPages={data.pages}
	editable={data.editable}
/>
