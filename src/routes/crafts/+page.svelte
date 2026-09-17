<script lang="ts">
	import CraftCollection from '$lib/crafts/CraftCollection.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Crafts – zaki.gg</title>
	<meta name="description" content="A collection of essays, experiments, and interactive crafts." />
</svelte:head>

<CraftCollection initialCrafts={data.crafts} />
