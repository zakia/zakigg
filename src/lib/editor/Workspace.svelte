<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import type { EditorView } from '@codemirror/view';
	import Editor from '#lib/editor/Editor.svelte';
	import type { Page } from './Page';
	import { updateFrontmatterValue, type FrontmatterValue } from './features/frontmatter/source';
	import { Session } from './Session.svelte';
	import Actions from './Actions.svelte';
	import Layout from './document/Layout.svelte';

	let {
		page,
		publicHref,
		navigation,
		save,
		saved = false
	}: {
		page: Page;
		publicHref?: string;
		navigation?: Snippet;
		save?: (page: Page) => Promise<unknown>;
		saved?: boolean;
	} = $props();

	let editorMode = $state<'live' | 'source'>('live');
	let editorView: EditorView | undefined;
	const session = new Session({
		page: untrack(() => page),
		saved: untrack(() => saved),
		backup: async (nextPage) => nextPage,
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
			if (!save || !session.dirty) return;
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

<Layout {navigation} editing>
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
	<Editor
		initialMarkdown={session.markdown}
		mode={editorMode}
		ariaLabel={`${page.title} editor`}
		autofocus
		onMarkdownChange={(markdown) => session.update(markdown)}
		onReady={(view) => (editorView = view)}
	/>
</Layout>
