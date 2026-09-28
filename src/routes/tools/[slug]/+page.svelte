<script lang="ts">
	import { resolve } from '$app/paths';
	import BackLink from '$lib/components/BackLink.svelte';
	import Header from '$lib/editor/document/Header.svelte';
	import Layout from '$lib/editor/document/Layout.svelte';

	let { data } = $props();
</script>

{#snippet navigation()}
	<BackLink href={resolve('/tools')} label="Tools" />
{/snippet}

<svelte:head>
	<title>{data.meta.title} – Tools – zaki.gg</title>
	<meta name="description" content={data.meta.description} />
</svelte:head>

{#if data.meta.fullBleed}
	<data.Tool />
{:else}
	<Layout {navigation}>
		<article>
			<Header title={data.meta.title} date={data.meta.date} />
			<data.Tool />
		</article>
	</Layout>
{/if}
