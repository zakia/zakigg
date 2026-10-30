<script lang="ts">
	import { resolveCraftLink } from './links';
	import { componentEmbeds } from '#lib/embeds/index.js';
	import Content from '#lib/editor/features/code/Content.svelte';
	import type { CraftDocument } from './types';
	import Embed from './Embed.svelte';
	import { renderMarkdown } from '#lib/editor/document/markdown-renderer.js';

	let { document }: { document: CraftDocument } = $props();
	const blocks = $derived(
		renderMarkdown(document.markdown, {
			resolveWikiLink: resolveCraftLink,
			embeds: componentEmbeds
		})
	);
</script>

{#each blocks as block, index (`${block.kind}-${index}`)}
	{#if block.kind === 'source'}
		<p role="note">{block.error}</p>
		<pre>{block.markdown}</pre>
	{:else if block.kind === 'component'}
		<Embed attrs={block.attrs} />
	{:else if block.kind === 'code'}
		<Content title={block.title} language={block.language} code={block.code} />
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html block.html}
	{/if}
{/each}
