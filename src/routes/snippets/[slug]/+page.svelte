<script lang="ts">
	import { page } from '$app/state';
	import { Temporal } from 'temporal-polyfill';
	import Icon from '@iconify/svelte';
	import type { SnippetMeta } from '$lib/snippets';

	const slug = $derived(page.params.slug ?? '');

	let Component = $state<ConstructorOfATypedSvelteComponent | null>(null);
	let meta = $state<SnippetMeta | undefined>(undefined);
	let notFound = $state(false);

	$effect(() => {
		Component = null;
		meta = undefined;
		notFound = false;

		import(`$lib/snippets/${slug}.svelte`)
			.then((mod) => {
				Component = mod.default;
				meta = mod.meta;
			})
			.catch(() => {
				notFound = true;
			});
	});

	function formatDate(iso?: string) {
		if (!iso) return '';
		return Temporal.PlainDate.from(iso).toLocaleString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{meta?.title ?? slug}</title>
	{#if meta?.description}
		<meta name="description" content={meta.description} />
	{/if}
</svelte:head>

{#if notFound}
	<section class="layout gap-s0">
		<h1>Not found</h1>
		<p>No snippet called "{slug}".</p>
		<a href="/snippets" class="text-brand">Back to snippets</a>
	</section>
{:else}
	<section class="snippet-page">
		<a href="/snippets" class="btn text-brand top-(--vertical-spacing) w-fit p-0 md:sticky">
			<Icon icon="ep:top-left" />Back
		</a>

		<article>
			<hgroup>
				<h1 class="text-s1">{meta?.title ?? slug}</h1>
				{#if meta?.published}
					<time class="text-content-1" datetime={meta.published}>
						{formatDate(meta.published)}
					</time>
				{/if}
				{#if meta?.tags?.length}
					<div class="mt-s-3 gap-s-3 flex flex-wrap">
						{#each meta.tags as tag}
							<span class="variant-primary text-s-2 rounded-full p-1 py-0">{tag}</span>
						{/each}
					</div>
				{/if}
			</hgroup>

			{#if Component}
				<Component />
			{/if}
		</article>
	</section>
{/if}

<style>
	.snippet-page {
		--vertical-spacing: var(--s3);
		max-width: 880px;
		margin-inline: auto;
		width: 100%;
		display: grid;
		align-items: start;
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
</style>
