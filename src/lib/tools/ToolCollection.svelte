<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import type { ToolSummary } from './types';

	let { items }: { items: ToolSummary[] } = $props();
	let query = $state('');

	const visibleTools = $derived.by(() => {
		const text = query.trim().toLowerCase();
		return items.filter(
			(tool) =>
				!tool.draft &&
				(!text ||
					[tool.title, tool.description, tool.slug, ...tool.tags]
						.join(' ')
						.toLowerCase()
						.includes(text))
		);
	});

	function toolHref(slug: string) {
		return resolve('/tools/[slug]', { slug });
	}
</script>

<section class="tool-collection layout">
	<header>
		<div>
			<h1>Tools</h1>
			<p>Focused utilities and interactive experiments.</p>
		</div>
		<label class="search-field">
			<Icon icon="mdi:magnify" />
			<input type="search" bind:value={query} placeholder="Search" aria-label="Search tools" />
		</label>
	</header>

	{#if visibleTools.length}
		<ul class="tool-grid list-reset">
			{#each visibleTools as tool (tool.slug)}
				<li>
					<a href={toolHref(tool.slug)}>
						<div class="tool-heading">
							<h2>{tool.title}</h2>
							<Icon icon="mdi:arrow-top-right" />
						</div>
						<p>{tool.description}</p>
						<div class="tags" aria-label="Tags">
							{#each tool.tags as tag (tag)}<span>{tag}</span>{/each}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty-state">No tools match this search.</p>
	{/if}
</section>

<style>
	.tool-collection {
		gap: var(--s1);
		padding-block: var(--s2) calc(var(--s4) + 5rem);
	}

	header {
		align-items: end;
		display: flex;
		gap: var(--s0);
		justify-content: space-between;
	}

	header h1,
	header p,
	h2,
	.tool-grid p {
		margin: 0;
	}

	header p,
	.tool-grid p,
	.empty-state {
		color: var(--content-1);
	}

	.search-field {
		align-items: center;
		border-bottom: 1px solid var(--edge);
		display: flex;
		gap: var(--s-2);
		min-width: min(18rem, 40vw);
		padding: var(--s-2) 0;
	}

	.search-field:focus-within {
		border-color: var(--brand);
	}

	.search-field :global(svg) {
		color: var(--content-1);
		height: 1.15rem;
		width: 1.15rem;
	}

	.search-field input {
		background: transparent;
		border: 0;
		color: var(--content);
		font: inherit;
		outline: 0;
		width: 100%;
	}

	.tool-grid {
		display: grid;
		gap: var(--s-1);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
	}

	.tool-grid a {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		color: inherit;
		display: grid;
		gap: var(--s-2);
		height: 100%;
		padding: var(--s0);
		text-decoration: none;
		transition:
			border-color 160ms ease,
			transform 160ms ease;
	}

	.tool-grid a:hover,
	.tool-grid a:focus-visible {
		border-color: color-mix(in oklch, var(--brand) 55%, var(--edge));
		outline: 0;
		transform: translateY(-2px);
	}

	.tool-heading {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		justify-content: space-between;
	}

	.tool-heading h2 {
		font-size: var(--s0);
	}

	.tool-heading :global(svg) {
		color: var(--content-1);
		height: 1rem;
		width: 1rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		margin-top: auto;
	}

	.tags span {
		background: color-mix(in oklch, var(--brand) 10%, transparent);
		border-radius: 999px;
		color: var(--content-1);
		font-size: var(--s-2);
		padding: var(--s-4) var(--s-2);
	}

	.empty-state {
		padding-block: var(--s3);
		text-align: center;
	}

	@media (max-width: 40rem) {
		header {
			align-items: stretch;
			flex-direction: column;
		}

		.search-field {
			min-width: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tool-grid a {
			transition: none;
		}
	}
</style>
