<script lang="ts">
	import ToolCollection from '$lib/tools/ToolCollection.svelte';
	import { tools } from '$lib/tools/registry';
</script>

<svelte:head>
	<title>Tools – zaki.gg</title>
	<meta name="description" content="Focused utilities and interactive experiments." />
</svelte:head>

<ToolCollection items={tools} />
