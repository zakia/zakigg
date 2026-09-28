<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth';
	import Collection from '$lib/crafts/Collection.svelte';

	let { data } = $props();
	onMount(() => {
		void auth.refresh();
	});
</script>

<svelte:head>
	<title>Crafts – zaki.gg</title>
	<meta name="description" content="A collection of essays, experiments, and interactive crafts." />
</svelte:head>

<Collection initialCrafts={data.crafts} editable={Boolean(auth.user)} />
