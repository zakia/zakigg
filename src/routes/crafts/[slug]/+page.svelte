<script lang="ts">
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth';
	import Icon from '$lib/components/Icon.svelte';
	import { Temporal } from 'temporal-polyfill';
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import CraftEditGate from '$lib/crafts/CraftEditGate.svelte';
	import CraftEditorPage from '$lib/crafts/CraftEditorPage.svelte';
	import { titleFromSlug } from '$lib/notes/types';

	let { data } = $props();

	const printDate = (iso: string) => {
		return Temporal.PlainDate.from(iso.split('T')[0]).toLocaleString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};
</script>

{#snippet content()}
	{#if data.mode === 'public'}
		{#if data.craft.kind === 'document'}
			<CraftDocumentRenderer document={data.craft.document} />
		{:else if data.craft.kind === 'published'}
			{#await data.craft.document}
				<div class="document-skeleton" aria-label="Loading craft">
					<span></span><span></span><span></span><span></span>
				</div>
			{:then document}
				<CraftDocumentRenderer {document} />
			{:catch}
				<p class="document-error" role="alert">This craft could not be loaded.</p>
			{/await}
		{:else}
			<data.craft.Component />
		{/if}
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
	<section class="gap-s0 mx-auto grid w-full items-start">
		<a
			href={resolve('/crafts')}
			class="btn text-brand top-(--vertical-spacing) w-fit p-0 md:sticky"
		>
			<Icon icon="ep:top-left" />Back
		</a>
		{#if auth.user}
			<a class="edit-craft" href={`${resolve('/crafts/[slug]', { slug: data.meta.slug })}?edit`}>
				<Icon icon="mdi:pencil-outline" /> Edit
			</a>
		{/if}

		<article>
			<hgroup>
				<h1 class="text-s1">{data.meta.title}</h1>
				<p class="text-content-1">{data.meta.description}</p>
				<time class="text-content-1">{printDate(data.meta.date)}</time>
			</hgroup>

			{@render content()}
		</article>
	</section>
{/if}

<style>
	section {
		--vertical-spacing: var(--s3);
		display: grid;
		grid-template-areas: 'back article edit';
		grid-template-columns: 100px minmax(0, 680px) 100px;
		max-width: 880px;
		padding-bottom: calc(var(--vertical-spacing) * 3);
		padding-inline: var(--s0);
		padding-top: var(--vertical-spacing);

		> :global(.btn) {
			grid-area: back;
		}

		> article {
			grid-area: article;
		}

		@media (max-width: 768px) {
			grid-template-areas:
				'back edit'
				'article article';
			grid-template-columns: minmax(0, 1fr) auto;
			padding-top: calc(var(--vertical-spacing) / 2);
			padding-bottom: calc(var(--vertical-spacing) * 2);
		}
	}

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
