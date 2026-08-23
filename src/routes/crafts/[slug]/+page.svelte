<script lang="ts">
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth';
	import {
		DocumentHeader,
		DocumentLayout,
		DocumentPage,
		titleFromSlug
	} from '$lib/editor/document';
	import CraftBackLink from '$lib/crafts/CraftBackLink.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';
	import CraftEditorPage from '$lib/crafts/CraftEditorPage.svelte';

	let { data } = $props();
</script>

{#snippet content()}
	{#if data.mode === 'public'}
		{#if data.craft.kind === 'document'}
			<CraftDocumentRenderer
				document={data.craft.document}
				pageTitle={data.meta.title}
				pageDescription={data.meta.description}
			/>
		{:else if data.craft.kind === 'published'}
			{#await data.craft.document}
				<div class="document-skeleton" aria-label="Loading craft">
					<span></span><span></span><span></span><span></span>
				</div>
			{:then document}
				<CraftDocumentRenderer
					{document}
					pageTitle={data.meta.title}
					pageDescription={data.meta.description}
				/>
			{:catch}
				<p class="document-error" role="alert">This craft could not be loaded.</p>
			{/await}
		{:else}
			<data.craft.Component />
		{/if}
	{/if}
{/snippet}

{#snippet navigation()}
	<CraftBackLink href={resolve('/crafts')} />
{/snippet}

{#snippet article()}
	{#if data.mode === 'public'}
		<article>
			<DocumentHeader
				title={data.meta.title}
				date={data.meta.date}
				wordCount={data.meta.wordCount}
			/>

			{@render content()}
		</article>
	{/if}
{/snippet}

{#snippet actions()}
	{#if data.mode === 'public' && auth.user}
		<a class="edit-craft" href={resolve(`/crafts/${data.meta.slug}?edit`)}>
			<Icon icon="mdi:pencil-outline" /> Edit
		</a>
	{/if}
{/snippet}

<svelte:head>
	{#if data.mode === 'edit'}
		<title>{titleFromSlug(data.slug)} – Edit – zaki.gg</title>
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		<title>{data.meta.title} – zaki.gg</title>
		<meta name="description" content={data.meta.description} />
		<meta property="og:title" content={data.meta.title} />
		<meta property="og:description" content={data.meta.description} />
	{/if}
</svelte:head>

{#if data.mode === 'edit'}
	<CraftEditGate>
		<CraftEditorPage slug={data.slug} />
	</CraftEditGate>
{:else if data.meta.fullBleed && data.craft.kind === 'component'}
	{@render content()}
{:else}
	<DocumentPage>
		<DocumentLayout {navigation} main={article} {actions} />
	</DocumentPage>
{/if}

<style>
	.edit-craft {
		align-items: center;
		color: var(--brand);
		display: inline-flex;
		font-size: var(--s-1);
		gap: var(--s-4);
		grid-area: edit;
		justify-self: end;
	}

	.edit-craft :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.document-skeleton {
		display: grid;
		gap: var(--s-1);
		padding-block: var(--s1);
	}

	.document-skeleton span {
		animation: pulse 1.4s ease-in-out infinite alternate;
		background: color-mix(in oklch, var(--content) 10%, transparent);
		border-radius: var(--s-3);
		height: 0.8rem;
	}

	.document-skeleton span:nth-child(2) {
		width: 92%;
	}

	.document-skeleton span:nth-child(3) {
		width: 78%;
	}

	.document-skeleton span:nth-child(4) {
		width: 86%;
	}

	.document-error {
		color: var(--error);
		padding-block: var(--s1);
	}

	@keyframes pulse {
		to {
			opacity: 0.4;
		}
	}
</style>
