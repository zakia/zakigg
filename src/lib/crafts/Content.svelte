<script lang="ts">
	import Content from '$lib/editor/features/code/Content.svelte';
	import type { CraftDocument } from './types';
	import Embed from './Embed.svelte';
	import { renderCraftMarkdown } from '$lib/editor/document/markdown-renderer';

	let { document }: { document: CraftDocument } = $props();
	const blocks = $derived(renderCraftMarkdown(document.markdown));
</script>

{#each blocks as block, index (`${block.kind}-${index}`)}
	{#if block.kind === 'component'}
		<Embed attrs={block.attrs} />
	{:else if block.kind === 'code'}
		<Content title={block.title} language={block.language} code={block.code} />
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html block.html}
	{/if}
{/each}
