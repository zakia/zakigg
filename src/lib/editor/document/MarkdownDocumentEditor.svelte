<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import type { ComponentEmbedRegistry } from '$lib/editor/components/registry';
	import MarkdownEditor from '$lib/editor/milkdown/MarkdownEditor.svelte';
	import type { NotePage } from './model';
	import { getMarkdownText } from './markdown-ast';
	import { parseMarkdownFrontmatter } from './markdown';
	import { DocumentSession, type DocumentRepositoryAdapter } from './session.svelte';
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
		repository
	}: {
		page: NotePage;
		embeds: ComponentEmbedRegistry;
		onSaved?: (page: NotePage) => void;
		publicHref?: string;
		navigation?: Snippet;
		repository?: DocumentRepositoryAdapter;
	} = $props();

	const embedRegistry = untrack(() => embeds);

	const initialBodyMarkdown = untrack(() => parseMarkdownFrontmatter(page.markdown).markdown);
	let bodyMarkdown = $state(initialBodyMarkdown);
	let propertiesOpen = $state(false);
	const session = new DocumentSession({
		getPage: () => page,
		getMarkdown: () => bodyMarkdown,
		onDraftChange: () => undefined,
		onSaved: (nextPage) => onSaved?.(nextPage),
		repository: untrack(() => repository)
	});
	const wordCount = $derived.by(() => {
		const text = `${session.title} ${getMarkdownText(bodyMarkdown)}`.trim();
		return text ? text.split(/\s+/).length : 0;
	});

	onDestroy(() => session.destroy());
	onMount(() => {
		function handleSaveShortcut(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey)) return;
			event.preventDefault();
			void session.commitNow();
		}
		window.addEventListener('keydown', handleSaveShortcut);
		return () => window.removeEventListener('keydown', handleSaveShortcut);
	});

	function updateMarkdown(markdown: string) {
		if (markdown === bodyMarkdown) return;

		bodyMarkdown = markdown;
		session.scheduleSave();
	}

	function handleEditorError() {
		session.markError();
	}

	async function downloadMarkdown() {
		const { downloadNotePageExport } = await import('./persistence/export');
		await downloadNotePageExport(session.getDraftPage());
	}
</script>

<div class="rich-editor milkdown-document-shell">
	<DocumentActions
		saveState={session.saveState}
		saveLabel={session.saveLabel}
		commitStatus={session.commitStatus}
		publicationState={session.publicationState}
		{publicHref}
		historyOpen={false}
		{propertiesOpen}
		onDownloadMarkdown={downloadMarkdown}
		onCommit={session.canCommit ? async () => void (await session.commitNow()) : undefined}
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
			<MarkdownEditor
				initialMarkdown={bodyMarkdown}
				embeds={embedRegistry}
				ariaLabel={`${page.title} editor`}
				autofocus
				onMarkdownChange={updateMarkdown}
				onError={handleEditorError}
			/>
		{/snippet}
	</DocumentCanvas>
</div>

<style>
	.milkdown-document-shell {
		background: color-mix(in oklch, var(--base) 92%, var(--base-1));
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 100vh;
		position: relative;
	}

	/* Milkdown uses the browser page as its scroll surface. This keeps the
	   scrollbar at the viewport edge and avoids a second horizontal scroller. */
	.milkdown-document-shell :global(.document-page--scrollable) {
		flex: none;
		min-height: 100vh;
		overflow: visible;
	}

	.milkdown-document-shell :global(.document-actions),
	.properties-popover {
		position: fixed;
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
</style>
