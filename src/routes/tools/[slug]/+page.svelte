<script lang="ts">
	import { resolve } from '$app/paths';
	import BackLink from '$lib/components/BackLink.svelte';
	import Header from '$lib/editor/document/Header.svelte';
	import Layout from '$lib/editor/document/Layout.svelte';
	import Frame from '$lib/editor/document/Frame.svelte';

	let { data } = $props();
</script>

{#snippet navigation()}
	<BackLink href={resolve('/tools')} label="Tools" />
{/snippet}

{#snippet article()}
	<article>
		<Header title={data.meta.title} date={data.meta.date} />
		<data.Tool />
	</article>
{/snippet}

<svelte:head>
	<title>{data.meta.title} – Tools – zaki.gg</title>
	<meta name="description" content={data.meta.description} />
</svelte:head>

{#if data.meta.fullBleed}
	<data.Tool />
{:else}
	<Frame>
		<Layout {navigation} main={article} />
	</Frame>
{/if}
