<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '$lib/auth';
	import CraftCollection from '$lib/crafts/CraftCollection.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';
	import { getPublicCrafts } from '$lib/crafts/publication.remote';

	const edit = $derived(page.url.searchParams.has('edit'));

	async function retryPublicCrafts(reset: () => void) {
		try {
			await getPublicCrafts().refresh();
			reset();
		} catch {
			// Keep the boundary's useful retry state visible.
		}
	}
</script>

{#snippet pendingCrafts()}
	<CraftCollection pending />
{/snippet}

{#snippet failedCrafts(_error: unknown, reset: () => void)}
	<CraftCollection loadError onRetry={() => void retryPublicCrafts(reset)} />
{/snippet}

<svelte:head>
	{#if edit}
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

{#if edit}
	<CraftEditGate>
		<CraftCollection editable />
	</CraftEditGate>
{:else}
	<svelte:boundary pending={pendingCrafts} failed={failedCrafts}>
		<CraftCollection initialCrafts={await getPublicCrafts()} showEditLink={Boolean(auth.user)} />
	</svelte:boundary>
{/if}
