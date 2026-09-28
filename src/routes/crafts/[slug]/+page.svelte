<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth';
	import BackLink from '$lib/components/BackLink.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Content from '$lib/crafts/Content.svelte';
	import Header from '$lib/editor/document/Header.svelte';
	import Layout from '$lib/editor/document/Layout.svelte';

	let { data } = $props();

	onMount(() => {
		void auth.refresh();
	});
</script>

{#snippet navigation()}
	<BackLink href={resolve('/crafts')} />
{/snippet}

{#snippet actions()}
	{#if auth.user}
		<a class="edit-link" href={resolve('/admin/crafts/[slug]', { slug: data.meta.slug })}>
			<Icon icon="mdi:pencil-outline" />
			Edit
		</a>
	{/if}
{/snippet}

<svelte:head>
	<title>{data.meta.title} – zaki.gg</title>
	<meta name="description" content={data.meta.description} />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description} />
</svelte:head>

<Layout {navigation} {actions}>
	<article>
		<Header
			title={data.meta.title}
			date={data.meta.date}
			wordCount={data.meta.wordCount}
			tags={data.meta.tags}
		/>
		<Content document={data.document} />
	</article>
</Layout>

<style>
	.edit-link {
		align-items: center;
		color: var(--content-1);
		display: inline-flex;
		font-size: var(--s-1);
		gap: var(--s-4);
		text-decoration: none;
	}

	.edit-link:hover,
	.edit-link:focus-visible {
		color: var(--content);
	}

	.edit-link :global(svg) {
		height: 1rem;
		width: 1rem;
	}
</style>
