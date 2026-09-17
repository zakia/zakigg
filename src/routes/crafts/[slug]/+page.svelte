<script lang="ts">
	import { resolve } from '$app/paths';
	import BackLink from '$lib/components/BackLink.svelte';
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import DocumentHeader from '$lib/editor/document/DocumentHeader.svelte';
	import DocumentLayout from '$lib/editor/document/DocumentLayout.svelte';
	import DocumentPage from '$lib/editor/document/DocumentPage.svelte';

	let { data } = $props();
</script>

{#snippet navigation()}
	<BackLink href={resolve('/crafts')} />
{/snippet}

{#snippet article()}
	<article>
		<DocumentHeader title={data.meta.title} date={data.meta.date} wordCount={data.meta.wordCount} />
		<CraftDocumentRenderer document={data.document} />
	</article>
{/snippet}

<svelte:head>
	<title>{data.meta.title} – zaki.gg</title>
	<meta name="description" content={data.meta.description} />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description} />
</svelte:head>

<DocumentPage>
	<DocumentLayout {navigation} main={article} />
</DocumentPage>
