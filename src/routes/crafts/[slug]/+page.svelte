<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { Temporal } from 'temporal-polyfill';
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';

	let { data } = $props();

	const craft = $derived(data.craft);

	const printDate = (iso: string) => {
		return Temporal.PlainDate.from(iso.split('T')[0]).toLocaleString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};
</script>

<svelte:head>
	<title>{data.meta.title}</title>
	<meta name="description" content={data.meta.description} />
	<meta property="og:title" content={data.meta.title} />
	<meta property="og:description" content={data.meta.description} />
</svelte:head>

{#snippet content()}
	{#if craft.kind === 'document'}
		<CraftDocumentRenderer document={craft.document} />
	{:else if craft.kind === 'published'}
		{#await craft.document}
			<div class="document-skeleton" aria-label="Loading craft">
				<span></span><span></span><span></span><span></span>
			</div>
		{:then document}
			<CraftDocumentRenderer {document} />
		{:catch}
			<p class="document-error" role="alert">This craft could not be loaded.</p>
		{/await}
	{:else}
		<craft.Component />
	{/if}
{/snippet}

{#if data.meta.fullBleed && craft.kind === 'component'}
	{@render content()}
{:else}
	<section class="gap-s0 mx-auto grid w-full items-start">
		<a
			href={resolve('/crafts')}
			class="btn text-brand top-(--vertical-spacing) w-fit p-0 md:sticky"
		>
			<Icon icon="ep:top-left" />Back
		</a>

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
		max-width: 880px;
		display: grid;
		padding-top: var(--vertical-spacing);
		padding-bottom: calc(var(--vertical-spacing) * 3);
		padding-inline: var(--s0);
		grid-template-columns: 100px 1fr 100px;

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			padding-top: calc(var(--vertical-spacing) / 2);
			padding-bottom: calc(var(--vertical-spacing) * 2);
		}
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
