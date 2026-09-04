<script lang="ts">
	import { resolve } from '$app/paths';
	import BackLink from '$lib/components/BackLink.svelte';
	import DocumentHeader from '$lib/editor/document/DocumentHeader.svelte';
	import DocumentLayout from '$lib/editor/document/DocumentLayout.svelte';
	import DocumentPage from '$lib/editor/document/DocumentPage.svelte';

	let { data } = $props();
</script>

{#snippet navigation()}
	<BackLink href={resolve('/tools')} label="Tools" />
{/snippet}

{#snippet article()}
	<article>
		<DocumentHeader title={data.meta.title} date={data.meta.date} />
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
	<DocumentPage>
		<DocumentLayout {navigation} main={article} />
	</DocumentPage>
{/if}
