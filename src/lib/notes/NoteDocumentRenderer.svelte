<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { JSONContent } from '@tiptap/core';
	import CodeBlock from '$lib/editor/code-block/CodeBlock.svelte';
	import ComponentEmbedRenderer from '$lib/crafts/ComponentEmbedRenderer.svelte';
	import { renderNode } from '$lib/crafts/document-renderer';
	import { loadNoteAsset } from './storage';

	let { content }: { content: JSONContent } = $props();
	let resolvedContent = $state<JSONContent>({ type: 'doc' });
	let objectUrls: string[] = [];

	const nodes = $derived(
		resolvedContent.type === 'doc' ? (resolvedContent.content ?? []) : [resolvedContent]
	);

	$effect(() => {
		let cancelled = false;
		let nextObjectUrls: string[] = [];

		void resolveContentMedia(content).then(({ content: nextContent, urls }) => {
			if (cancelled) {
				revokeObjectUrls(urls);
				return;
			}

			nextObjectUrls = urls;
			revokeObjectUrls(objectUrls);
			objectUrls = urls;
			resolvedContent = nextContent;
		});

		return () => {
			cancelled = true;
			revokeObjectUrls(nextObjectUrls);
		};
	});

	onDestroy(() => {
		revokeObjectUrls(objectUrls);
		objectUrls = [];
	});

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

	async function resolveContentMedia(node: JSONContent) {
		const urls: string[] = [];
		const resolved = await resolveNode(node, urls);

		return { content: resolved, urls };
	}

	async function resolveNode(node: JSONContent, urls: string[]): Promise<JSONContent> {
		const content = node.content
			? await Promise.all(node.content.map((child) => resolveNode(child, urls)))
			: undefined;

		if (node.type !== 'mediaBlock') {
			return {
				...node,
				...(content ? { content } : {})
			};
		}

		const assetId = typeof node.attrs?.assetId === 'string' ? node.attrs.assetId.trim() : '';
		if (!assetId) {
			return {
				...node,
				...(content ? { content } : {})
			};
		}

		const asset = await loadNoteAsset(assetId);
		if (!asset) {
			return {
				...node,
				...(content ? { content } : {})
			};
		}

		const src = URL.createObjectURL(asset.blob);
		urls.push(src);

		return {
			...node,
			attrs: {
				...node.attrs,
				src
			},
			...(content ? { content } : {})
		};
	}

	function revokeObjectUrls(urls: string[]) {
		for (const url of urls) {
			URL.revokeObjectURL(url);
		}
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
