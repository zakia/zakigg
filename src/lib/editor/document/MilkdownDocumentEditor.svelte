<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import type { ComponentEmbedRegistry } from '$lib/editor/components/registry';
	import MilkdownEditor from '$lib/editor/milkdown/MilkdownEditor.svelte';
	import { getContentText, type NotePage } from './model';
	import { markdownBodyToEditorContent } from './markdown-ast';
	import { parseMarkdownFrontmatter } from './markdown';
	import { DocumentSession, type DocumentPublicationAdapter } from './session.svelte';
	import DocumentActions from './DocumentActions.svelte';
	import DocumentCanvas from './DocumentCanvas.svelte';
	import DocumentHeader from './DocumentHeader.svelte';
	import MetadataPanel from './metadata/MetadataPanel.svelte';

	let {
		page,
		embeds,
		onSaved,
		publicHref,
		navigation,
		publication,
		isSyncEnabled
	}: {
		page: NotePage;
		embeds: ComponentEmbedRegistry;
		onSaved?: (page: NotePage) => void;
		publicHref?: string;
		navigation?: Snippet;
		publication?: DocumentPublicationAdapter;
		isSyncEnabled?: () => boolean;
	} = $props();

	// The registry becomes active as generic MDX node views move out of the
	// legacy adapter. Keeping it in this boundary preserves the final editor
	// contract without coupling persistence to component implementations.
	const embedRegistry = untrack(() => embeds);
	void embedRegistry;

	const initialBodyMarkdown = untrack(() => parseMarkdownFrontmatter(page.markdown).markdown);
	let bodyMarkdown = $state(initialBodyMarkdown);
	let content = $state(markdownBodyToEditorContent(initialBodyMarkdown));
	let propertiesOpen = $state(false);
	let editorError = $state('');
	const session = new DocumentSession({
		getPage: () => page,
		getContent: () => $state.snapshot(content),
		onDraftChange: () => undefined,
		onSaved: (nextPage) => onSaved?.(nextPage),
		publication: untrack(() => publication),
		isSyncEnabled: untrack(() => isSyncEnabled)
	});
	const wordCount = $derived.by(() => {
		const text = `${session.title} ${getContentText(content)}`.trim();
		return text ? text.split(/\s+/).length : 0;
	});

	onDestroy(() => session.destroy());

	function updateMarkdown(markdown: string) {
		if (markdown === bodyMarkdown) return;

		try {
			content = markdownBodyToEditorContent(markdown);
			bodyMarkdown = markdown;
			editorError = '';
			session.scheduleSave();
		} catch (error) {
			editorError = error instanceof Error ? error.message : 'The document could not be parsed.';
			session.markError();
		}
	}

	function handleEditorError(error: unknown) {
		editorError = error instanceof Error ? error.message : 'The editor could not be started.';
		session.markError();
	}

	async function downloadMarkdown() {
		const { downloadNotePageExport } = await import('./persistence/export');
		await downloadNotePageExport(session.getDraftPage(content), content);
	}
</script>

<div class="rich-editor milkdown-document-shell">
	<DocumentActions
		saveState={session.saveState}
		saveLabel={session.saveLabel}
		syncStatus={session.syncLabelStatus}
		publicationState={session.publicationState}
		{publicHref}
		historyOpen={false}
		{propertiesOpen}
		onDownloadMarkdown={downloadMarkdown}
		onToggleProperties={() => (propertiesOpen = !propertiesOpen)}
		onTogglePublication={session.canPublish ? () => session.togglePublication() : undefined}
	/>

	{#if propertiesOpen}
		<aside class="properties-popover" aria-label="Page properties">
			<MetadataPanel
				properties={session.properties}
				onChange={(next) => session.updateProperties(next)}
			/>
		</aside>
	{/if}

	<DocumentCanvas onHost={() => undefined} {navigation}>
		{#snippet header()}
			<DocumentHeader
				title={session.title}
				date={session.date}
				{wordCount}
				editable
				onTitleChange={(value) => session.updateTitle(value)}
			/>
		{/snippet}
		{#snippet editor()}
			{#if editorError}
				<section class="editor-error" role="alert">
					<strong>The visual editor could not open this Markdown.</strong>
					<p>{editorError}</p>
				</section>
			{:else}
				<MilkdownEditor
					initialMarkdown={bodyMarkdown}
					ariaLabel={`${page.title} editor`}
					autofocus
					onMarkdownChange={updateMarkdown}
					onError={handleEditorError}
				/>
			{/if}
		{/snippet}
	</DocumentCanvas>
</div>

<style>
	.milkdown-document-shell {
		background: color-mix(in oklch, var(--base) 92%, var(--base-1));
		display: flex;
		flex: 1;
		flex-direction: column;
		height: 100vh;
		min-height: 100vh;
		position: relative;
	}

	.properties-popover {
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 88%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-2);
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.14);
		max-height: min(34rem, calc(100vh - var(--s4)));
		overflow: auto;
		position: absolute;
		right: calc(var(--s0) + env(safe-area-inset-right));
		top: calc(var(--s3) + 2.75rem + env(safe-area-inset-top));
		width: min(24rem, calc(100vw - var(--s1)));
		z-index: 5;
	}

	.editor-error {
		background: color-mix(in oklch, var(--error) 8%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--error) 34%, var(--edge));
		border-radius: var(--s-3);
		display: grid;
		gap: var(--s-3);
		margin: var(--s2) auto;
		max-width: 42rem;
		padding: var(--s0);
		width: calc(100% - var(--s2));
	}

	.editor-error p {
		color: var(--content-1);
		margin: 0;
	}
</style>
