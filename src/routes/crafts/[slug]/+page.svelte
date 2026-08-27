<script lang="ts">
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth';
	import DocumentHeader from '$lib/editor/document/DocumentHeader.svelte';
	import DocumentLayout from '$lib/editor/document/DocumentLayout.svelte';
	import DocumentPage from '$lib/editor/document/DocumentPage.svelte';
	import { titleFromSlug } from '$lib/editor/document/slug';
	import CraftBackLink from '$lib/crafts/CraftBackLink.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';

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
				<section class="document-error" role="alert">
					<strong>This craft’s published document is temporarily unavailable.</strong>
					<p>The source document has not been changed. Try loading the published copy again.</p>
					<button type="button" onclick={() => window.location.reload()}>
						<Icon icon="mdi:refresh" /> Retry
					</button>
				</section>
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
		{#await import('$lib/crafts/CraftEditorPage.svelte')}
			<section class="editor-loading" role="status">
				<Icon icon="mdi:loading" class="spin" />
				<p>Loading editor…</p>
			</section>
		{:then { default: CraftEditorPage }}
			<CraftEditorPage slug={data.slug} />
		{:catch}
			<section class="editor-loading" role="alert">
				<Icon icon="mdi:alert-circle-outline" />
				<p>The editor could not be loaded. Refresh to try again.</p>
			</section>
		{/await}
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
		display: grid;
		gap: var(--s-2);
		padding-block: var(--s1);
	}

	.document-error p {
		color: var(--content-1);
		margin: 0;
	}

	.document-error button {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		cursor: pointer;
		display: inline-flex;
		gap: var(--s-3);
		justify-self: start;
		padding: var(--s-3) var(--s-1);
	}

	.document-error button:hover,
	.document-error button:focus-visible {
		border-color: color-mix(in oklch, var(--brand) 45%, var(--edge));
		outline: none;
	}

	.editor-loading {
		align-content: center;
		color: var(--content-1);
		display: grid;
		gap: var(--s-2);
		justify-items: center;
		min-height: 65vh;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		text-align: center;
	}

	.editor-loading p {
		margin: 0;
	}

	.editor-loading :global(svg) {
		color: var(--brand);
		height: 1.5rem;
		width: 1.5rem;
	}

	.editor-loading :global(.spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes pulse {
		to {
			opacity: 0.4;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.editor-loading :global(.spin) {
			animation: none;
		}
	}
</style>
