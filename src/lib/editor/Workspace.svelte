<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import type { EditorView } from '@codemirror/view';
	import Editor from '$lib/editor/Editor.svelte';
	import type { Page } from './Page';
	import { updateFrontmatterValue, type FrontmatterValue } from './features/frontmatter/source';
	import { Session } from './Session.svelte';
	import { savePage } from './document/persistence/storage';
	import Actions from './Actions.svelte';
	import Canvas from './document/Canvas.svelte';

	let {
		page,
		onSaved,
		publicHref,
		navigation,
		save,
		saved = false,
		recovery,
		onRestore
	}: {
		page: Page;
		onSaved?: (page: Page) => void;
		publicHref?: string;
		navigation?: Snippet;
		save?: (page: Page) => Promise<unknown>;
		saved?: boolean;
		recovery?: Page | null;
		onRestore?: () => void;
	} = $props();

	let editorMode = $state<'live' | 'source'>('live');
	let editorView: EditorView | undefined;
	const session = new Session({
		page: untrack(() => page),
		saved: untrack(() => saved),
		backup: savePage,
		onSaved: (nextPage) => onSaved?.(nextPage),
		save: untrack(() => save)
	});

	onDestroy(() => session.destroy());
	onMount(() => {
		function handleSaveShortcut(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey)) return;
			event.preventDefault();
			void session.save();
		}
		function beforeUnload(event: BeforeUnloadEvent) {
			if (!session.dirty || (!session.backupPending && !session.backupError)) return;
			event.preventDefault();
			event.returnValue = '';
		}
		window.addEventListener('keydown', handleSaveShortcut);
		window.addEventListener('beforeunload', beforeUnload);
		return () => {
			window.removeEventListener('keydown', handleSaveShortcut);
			window.removeEventListener('beforeunload', beforeUnload);
		};
	});

	function updateSourceProperty(key: string, value: FrontmatterValue) {
		if (!editorView) return;
		const change = updateFrontmatterValue(editorView.state.doc.toString(), key, value);
		if (change) editorView.dispatch({ changes: change, userEvent: 'input' });
	}

	async function downloadMarkdown() {
		const { downloadPageExport } = await import('./document/persistence/export');
		await downloadPageExport(session.page);
	}
</script>

<div class="rich-editor document-shell">
	<Canvas {navigation}>
		{#snippet actions()}
			<Actions
				status={session.status}
				saving={session.saving}
				dirty={session.dirty}
				published={session.page.frontmatter?.published === true}
				{publicHref}
				mode={editorMode}
				onToggleMode={() => (editorMode = editorMode === 'live' ? 'source' : 'live')}
				onDownloadMarkdown={downloadMarkdown}
				onSave={save ? () => void session.save() : undefined}
				onSetPublished={(value) => updateSourceProperty('published', value)}
			/>
		{/snippet}
		{#snippet editor()}
			{#if recovery}
				<div class="recovery" role="status">
					<span>Showing Git’s version. A browser backup is available.</span>
					<button
						type="button"
						onclick={async () => {
							if (!editorView || !recovery) return;
							editorView.dispatch({
								changes: { from: 0, to: editorView.state.doc.length, insert: recovery.markdown },
								userEvent: 'input'
							});
							if (await session.backup()) onRestore?.();
						}}>Restore local changes</button
					>
				</div>
			{/if}
			<Editor
				initialMarkdown={session.markdown}
				mode={editorMode}
				ariaLabel={`${page.title} editor`}
				autofocus
				onMarkdownChange={(markdown) => session.update(markdown)}
				onReady={(view) => (editorView = view)}
			/>
		{/snippet}
	</Canvas>
</div>

<style>
	.recovery {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1);
		padding: var(--s0);
		color: var(--content-1);
	}
	.recovery button {
		font: inherit;
		color: var(--content);
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		padding: var(--s-2);
		cursor: pointer;
	}

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
