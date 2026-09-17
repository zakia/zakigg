<script lang="ts">
	import CraftCollection from '$lib/crafts/CraftCollection.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';
</script>

<svelte:head>
	<title>Manage Crafts – zaki.gg</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<CraftEditGate>
	<CraftCollection editable />
</CraftEditGate>
