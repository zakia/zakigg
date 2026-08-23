<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import CodeBlock from '$lib/editor/core/code-block/CodeBlock.svelte';
	import type { CraftDocument } from './types';
	import ComponentEmbedRenderer from './ComponentEmbedRenderer.svelte';
	import { normalizeCraftDocumentContent } from './document-content';
	import { renderNode } from './document-renderer';
	import { stripLeadingPageHeader } from './publication';

	let {
		document,
		pageTitle = '',
		pageDescription = ''
	}: { document: CraftDocument; pageTitle?: string; pageDescription?: string } = $props();
	const content = $derived(
		normalizeCraftDocumentContent(
			stripLeadingPageHeader(document.content, pageTitle, pageDescription)
		)
	);
	const nodes = $derived(content.type === 'doc' ? (content.content ?? []) : [content]);

	function getTextContent(node: JSONContent): string {
		if (node.text) return node.text;

		return (node.content ?? []).map(getTextContent).join('');
	}

	function getCodeBlockProps(node: JSONContent) {
		return {
			title: typeof node.attrs?.title === 'string' ? node.attrs.title : '',
			language: typeof node.attrs?.language === 'string' ? node.attrs.language : '',
			code: getTextContent(node)
		};
	}
</script>

{#each nodes as node, index (`${node.type ?? 'node'}-${index}`)}
	{#if node.type === 'componentEmbed'}
		<ComponentEmbedRenderer attrs={node.attrs} />
	{:else if node.type === 'codeBlock'}
		{@const codeBlock = getCodeBlockProps(node)}
		<CodeBlock {...codeBlock} />
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderNode(node)}
	{/if}
{/each}
