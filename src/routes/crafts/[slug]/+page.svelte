<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import BackLink from '#lib/components/BackLink.svelte';
	import Content from '#lib/crafts/Content.svelte';
	import Edit from '#lib/crafts/Edit.svelte';
	import { getRepositoryCraft } from '#lib/crafts/repository.remote.js';
	import { parseStoredPage } from '#lib/editor/Page.js';
	import Header from '#lib/editor/document/Header.svelte';
	import Layout from '#lib/editor/document/Layout.svelte';
	import { titleFromSlug } from '#lib/editor/document/slug.js';

	const slug = $derived(page.params.slug ?? '');
	const isEditing = $derived(page.url.searchParams.has('edit'));
	const data = $derived(await getRepositoryCraft(slug));
	const initialPage = $derived(data.page ? parseStoredPage(data.page) : null);
</script>

{#snippet navigation()}
	<BackLink href={resolve('crafts')} />
{/snippet}

<svelte:head>
	<title>{data.meta?.title ?? titleFromSlug(slug)} – zaki.gg</title>
	{#if data.meta}
		<meta name="description" content={data.meta.description} />
		<meta property="og:title" content={data.meta.title} />
		<meta property="og:description" content={data.meta.description} />
	{/if}
	{#if !data.meta?.published}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

{#if data.editable || isEditing}
	<Edit {slug} {initialPage} initialSha={data.sha} editable={data.editable} />
{:else if data.meta && data.document}
	<Layout {navigation}>
		<article class="prose">
			<Header
				title={data.meta.title}
				date={data.meta.date}
				wordCount={data.meta.wordCount}
				tags={data.meta.tags}
			/>
			<Content document={data.document} />
		</article>
	</Layout>
{:else}
	<Layout {navigation}>
		<article class="craft-missing">
			<h1>Craft not found</h1>
			<p>No published craft exists at /crafts/{slug}.</p>
		</article>
	</Layout>
{/if}

<style>
	.craft-missing {
		display: grid;
		gap: var(--s-1);
		padding-block: var(--s2);
	}

	.craft-missing p {
		color: var(--content-1);
		margin: 0;
	}
</style>
