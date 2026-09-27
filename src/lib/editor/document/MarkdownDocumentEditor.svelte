<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import type { EditorView } from '@codemirror/view';
	import MarkdownEditor from '$lib/editor/codemirror/MarkdownEditor.svelte';
	import type { NotePage } from './model';
	import { updateFrontmatterValue, type FrontmatterValue } from './frontmatter-source';
	import { DocumentSession, type DocumentRepositoryAdapter } from './session.svelte';
	import DocumentActions from './DocumentActions.svelte';
	import DocumentCanvas from './DocumentCanvas.svelte';

	let {
		page,
		onSaved,
		publicHref,
		navigation,
		repository
	}: {
		page: NotePage;
		onSaved?: (page: NotePage) => void;
		publicHref?: string;
		navigation?: Snippet;
		repository?: DocumentRepositoryAdapter;
	} = $props();

	let documentMarkdown = $state(untrack(() => page.markdown));
	let editorMode = $state<'live' | 'source'>('live');
	let editorView: EditorView | undefined;
	const session = new DocumentSession({
		getPage: () => page,
		getMarkdown: () => documentMarkdown,
		updateSourceProperty,
		onSaved: (nextPage) => onSaved?.(nextPage),
		repository: untrack(() => repository)
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
		if (markdown === documentMarkdown) return;

		documentMarkdown = markdown;
		session.scheduleSave();
	}

	function updateSourceProperty(key: string, value: FrontmatterValue) {
		if (!editorView) return;
		const change = updateFrontmatterValue(editorView.state.doc.toString(), key, value);
		if (change) editorView.dispatch({ changes: change, userEvent: 'input' });
	}

	async function downloadMarkdown() {
		const { downloadNotePageExport } = await import('./persistence/export');
		await downloadNotePageExport(session.getDraftPage());
	}
</script>

<div class="rich-editor document-shell">
	<DocumentCanvas {navigation}>
		{#snippet actions()}
			<DocumentActions
				saveState={session.saveState}
				saveLabel={session.saveLabel}
				commitStatus={session.commitStatus}
				publicationState={session.publicationState}
				{publicHref}
				mode={editorMode}
				onToggleMode={() => (editorMode = editorMode === 'live' ? 'source' : 'live')}
				onDownloadMarkdown={downloadMarkdown}
				onCommit={session.canCommit ? async () => void (await session.commitNow()) : undefined}
				onTogglePublication={session.canPublish ? () => session.togglePublication() : undefined}
			/>
		{/snippet}
		{#snippet editor()}
			<MarkdownEditor
				initialMarkdown={documentMarkdown}
				mode={editorMode}
				ariaLabel={`${page.title} editor`}
				autofocus
				onMarkdownChange={updateMarkdown}
				onReady={(view) => (editorView = view)}
			/>
		{/snippet}
	</DocumentCanvas>
</div>

<style>
	.document-shell {
		background: color-mix(in oklch, var(--base) 92%, var(--base-1));
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 100vh;
		position: relative;
	}

	/* Keep the browser page as the scroll surface so the scrollbar stays at the
	   viewport edge. */
	.document-shell :global(.document-page--scrollable) {
		flex: none;
		min-height: 100vh;
		overflow: visible;
	}
</style>
