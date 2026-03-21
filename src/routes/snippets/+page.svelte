<script lang="ts">
	import type { SnippetMeta } from '$lib/snippets';

	const modules = import.meta.glob<{ default: unknown; meta?: SnippetMeta }>(
		'$lib/snippets/*.svelte',
		{ eager: true }
	);

	const snippets = Object.entries(modules)
		.map(([path, mod]) => {
			const slug = path.split('/').pop()!.replace('.svelte', '');
			return {
				slug,
				meta: mod.meta ?? {
					title: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
					description: '',
					published: '',
					tags: []
				}
			};
		})
		.sort((a, b) => b.meta.published.localeCompare(a.meta.published));
</script>

<section class="layout gap-s1">
	<h1>Snippets</h1>
	<div class="gap-s-1 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
		{#each snippets as { slug, meta }}
			<a
				href="/snippets/{slug}"
				class="flex flex-col gap-s-3 rounded-md border border-edge bg-base-1 p-s0 transition-all hover:-translate-y-0.5 hover:border-brand"
			>
				<span class="font-medium">{meta.title}</span>
				{#if meta.description}
					<span class="text-s-2 text-content-1">{meta.description}</span>
				{/if}
				{#if meta.published || meta.tags.length}
					<div class="mt-auto flex flex-wrap items-center gap-s-2 text-s-2 text-content-1">
						{#if meta.published}
							<time datetime={meta.published}>
								{new Date(meta.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
							</time>
						{/if}
						{#each meta.tags as tag}
							<span class="rounded-sm bg-base-2 px-s-3 py-s-5">{tag}</span>
						{/each}
					</div>
				{/if}
			</a>
		{/each}
	</div>
</section>
