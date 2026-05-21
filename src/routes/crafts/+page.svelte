<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Temporal } from 'temporal-polyfill';

	let { data } = $props();

	let query = $state('');
	let activeTags = $state(new Set<string>());

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.crafts.filter((craft) => {
			if (activeTags.size > 0) {
				const hasAnyTag = craft.tags.some((t) => activeTags.has(t));
				if (!hasAnyTag) return false;
			}
			if (!q) return true;
			const haystack = [craft.title, craft.description, ...craft.tags].join(' ').toLowerCase();
			return haystack.includes(q);
		});
	});

	const grouped = $derived.by(() => {
		const out: { year: number; slug: string; title: string; date: Temporal.PlainDate }[] = [];
		for (const c of filtered) {
			const date = Temporal.PlainDate.from(c.date.split('T')[0]);
			out.push({ year: date.year, slug: c.slug, title: c.title, date });
		}
		return out;
	});

	function toggleTag(tag: string) {
		const next = new Set(activeTags);
		if (next.has(tag)) next.delete(tag);
		else next.add(tag);
		activeTags = next;
	}

	function clearFilters() {
		query = '';
		activeTags = new Set();
	}
</script>

<svelte:head>
	<title>Crafts — Adham Zaki</title>
	<meta name="description" content="A collection of essays, experiments, and interactive crafts." />
</svelte:head>

<div class="layout w-full max-w-2xl">
	<h1 class="text-s1">Crafts</h1>

	<div class="gap-s-2 mt-s0 grid">
		<input
			type="search"
			class="input w-full"
			style="background-color: color-mix(in oklch, var(--brand) 7%, var(--base));"
			placeholder="Search by title, description, or tag..."
			bind:value={query}
		/>

		{#if data.tags.length}
			<div class="gap-s-3 flex flex-wrap">
				{#each data.tags as tag}
					<button
						type="button"
						class="tag basis-20"
						class:active={activeTags.has(tag)}
						onclick={() => toggleTag(tag)}
					>
						{tag}
					</button>
				{/each}
				{#if activeTags.size > 0 || query}
					<button type="button" class="tag clear" onclick={clearFilters}>
						<Icon icon="mdi:close" class="size-4" />
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<div class="mt-s0" data-parent>
		{#each grouped as post, i}
			<div class="bg-content/10 h-[1px] w-full"></div>
			<a
				href={`/crafts/${post.slug}`}
				class="grid grid-cols-[1fr_4fr]"
				data-link
				data-year={post.year}
			>
				<div class="border-content">
					{#if i === 0 || post.year !== grouped[i - 1].year}
						<p class="text-content py-s-1">
							{post.year}
						</p>
					{/if}
				</div>
				<div class="py-s-1 flex justify-between">
					<div>{post.title}</div>
					<p class="text-content">
						{post.date.toLocaleString(undefined, { month: 'short', day: '2-digit' })}
					</p>
				</div>
			</a>
		{:else}
			<p class="text-content py-s0 text-center">No crafts match your filters.</p>
		{/each}
	</div>
</div>

<style scoped>
	[data-link] {
		transition: opacity 0.3s;
	}

	[data-parent]:hover [data-link] {
		opacity: 0.25;

		&:hover {
			opacity: 1;
		}
	}

	.tag {
		border-radius: 9999px;
		font-size: var(--s-1);
		color: var(--content);
		/* background: color-mix(in oklch, var(--brand) 15%, transparent); */
		border: 2px solid color-mix(in oklch, var(--brand) 15%, transparent);
		cursor: pointer;
		transition: all 0.2s;

		&:hover {
			translate: 0 -2px;
		}

		&.active {
			background: var(--brand);
			color: var(--primary-content, white);
			border-color: var(--brand);
		}

		&.clear {
			background: color-mix(in oklch, var(--error) 15%, transparent);
			color: var(--error);
			height: 100%;
			aspect-ratio: 1;
			display: flex;
			justify-content: center;
			align-items: center;
		}
	}
</style>
