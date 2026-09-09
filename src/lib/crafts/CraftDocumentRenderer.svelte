<script lang="ts">
	import CodeBlockRenderer from '$lib/editor/presentation/code-block/CodeBlockRenderer.svelte';
	import type { CraftDocument } from './types';
	import ComponentEmbedRenderer from './ComponentEmbedRenderer.svelte';
	import { renderCraftMarkdown } from './markdown-renderer';

	let { document }: { document: CraftDocument } = $props();
	const blocks = $derived(renderCraftMarkdown(document.markdown));
</script>

{#each blocks as block, index (`${block.kind}-${index}`)}
	{#if block.kind === 'component'}
		<ComponentEmbedRenderer attrs={block.attrs} />
	{:else if block.kind === 'code'}
		<CodeBlockRenderer title={block.title} language={block.language} code={block.code} />
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html block.html}
	{/if}
{/each}
