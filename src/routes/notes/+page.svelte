<script lang="ts">
	import type { JSONContent } from '@tiptap/core';
	import { createMediaAssetUploadInput } from '$lib/notes/media';
	import RichNoteEditor from '$lib/notes/RichNoteEditor.svelte';
	import { publishCraftDocument, uploadCraftAsset } from './craft-document.remote';

	let { data } = $props();

	const editorTarget = $derived(
		data.editorTarget.kind === 'craft'
			? {
					kind: 'craft' as const,
					slug: data.editorTarget.slug,
					content: data.editorTarget.document.content,
					updatedAt: data.editorTarget.document.updatedAt,
					onPublish: publishCraft,
					onUploadAsset: uploadCraftMedia
				}
			: { kind: 'note' as const }
	);

	async function publishCraft(content: JSONContent) {
		if (data.editorTarget.kind !== 'craft') return;

		await publishCraftDocument({
			slug: data.editorTarget.slug,
			document: {
				version: 1,
				editor: 'tiptap',
				content
			}
		});
	}

	async function uploadCraftMedia(file: File) {
		if (data.editorTarget.kind !== 'craft') return '';

		const result = await uploadCraftAsset({
			slug: data.editorTarget.slug,
			asset: await createMediaAssetUploadInput(file)
		});

		return result.src;
	}
</script>

<svelte:head>
	<title>Editor | Adham Zaki</title>
	<meta name="description" content="A local-first document editor on zaki.gg." />
</svelte:head>

<section class="notes-page">
	<RichNoteEditor target={editorTarget} />
</section>

<style>
	.notes-page {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 100%;
		width: 100%;
	}
</style>
