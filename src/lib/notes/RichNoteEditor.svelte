<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { Editor } from '@tiptap/core';
	import { Markdown } from '@tiptap/markdown';
	import { Placeholder } from '@tiptap/extension-placeholder';
	import { StarterKit } from '@tiptap/starter-kit';
	import { createNotesDoc, EMPTY_TIPTAP_DOC } from './types';
	import { loadDefaultNote, saveDefaultNote } from './storage';

	type SaveState = 'loading' | 'saving' | 'saved' | 'error';
	type MarkdownEditor = Editor & { getMarkdown: () => string };

	let editorHost = $state<HTMLDivElement>();
	let editor = $state<Editor>();
	let saveState = $state<SaveState>('loading');
	let lastSavedAt = $state<string>();
	let copied = $state(false);
	let editorTick = $state(0);
	let saveTimer: number | undefined;
	let copyTimer: number | undefined;

	const saveLabel = $derived.by(() => {
		if (saveState === 'loading') return 'Loading';
		if (saveState === 'saving') return 'Saving...';
		if (saveState === 'error') return 'Save failed';
		if (!lastSavedAt) return 'Saved locally';

		return `Saved locally ${new Intl.DateTimeFormat(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(lastSavedAt))}`;
	});

	onMount(() => {
		let destroyed = false;

		async function setupEditor() {
			const stored = await loadDefaultNote();
			if (destroyed || !editorHost) return;

			const instance = new Editor({
				element: editorHost,
				extensions: [
					StarterKit.configure({
						heading: {
							levels: [1, 2, 3]
						}
					}),
					Markdown.configure({
						indentation: {
							style: 'space',
							size: 2
						}
					}),
					Placeholder.configure({
						placeholder: 'Start writing...'
					})
				],
				content: stored?.content ?? EMPTY_TIPTAP_DOC,
				autofocus: 'end',
				editorProps: {
					attributes: {
						'aria-label': 'Notes editor',
						class: 'notes-prose'
					}
				},
				onUpdate: () => {
					editorTick += 1;
					scheduleSave();
				},
				onSelectionUpdate: () => {
					editorTick += 1;
				},
				onTransaction: () => {
					editorTick += 1;
				}
			});

			editor = instance;
			lastSavedAt = stored?.updatedAt;
			saveState = 'saved';
			editorTick += 1;
		}

		void setupEditor();

		return () => {
			destroyed = true;
			if (saveTimer) window.clearTimeout(saveTimer);
			if (copyTimer) window.clearTimeout(copyTimer);
			void persistNow();
			editor?.destroy();
		};
	});

	function scheduleSave() {
		if (saveTimer) window.clearTimeout(saveTimer);

		saveState = 'saving';
		saveTimer = window.setTimeout(() => {
			void persistNow();
		}, 350);
	}

	async function persistNow() {
		if (!editor) return;

		try {
			const note = createNotesDoc(editor.getJSON());
			await saveDefaultNote(note);
			lastSavedAt = note.updatedAt;
			saveState = 'saved';
		} catch {
			saveState = 'error';
		}
	}

	function run(command: (activeEditor: Editor) => void) {
		if (!editor) return;
		command(editor);
		editorTick += 1;
	}

	function active(name: string, attrs?: Record<string, unknown>) {
		return editorTick >= 0 && (editor?.isActive(name, attrs) ?? false);
	}

	function canRun(command: (activeEditor: Editor) => boolean) {
		return editorTick >= 0 && editor ? command(editor) : false;
	}

	function getMarkdown() {
		if (!editor) return '';
		return (editor as MarkdownEditor).getMarkdown();
	}

	async function copyMarkdown() {
		const markdown = getMarkdown();
		if (!markdown) return;

		await navigator.clipboard.writeText(markdown);
		copied = true;
		if (copyTimer) window.clearTimeout(copyTimer);
		copyTimer = window.setTimeout(() => {
			copied = false;
		}, 1800);
	}

	function downloadMarkdown() {
		const markdown = getMarkdown();
		const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
		document.body.append(anchor);
		anchor.click();
		window.setTimeout(() => {
			anchor.remove();
			URL.revokeObjectURL(url);
		}, 1000);
	}

	function keepEditorSelection(event: PointerEvent) {
		if ((event.target as HTMLElement).closest('button')) {
			event.preventDefault();
		}
	}
</script>

<div class="notes-editor">
	<header class="notes-topbar">
		<div class="status" data-state={saveState}>
			<span class="status-dot"></span>
			<span>{saveLabel}</span>
		</div>

		<div class="export-actions" aria-label="Markdown export actions">
			<button
				type="button"
				class="toolbar-button text-action"
				title="Copy Markdown"
				aria-label="Copy Markdown"
				onclick={copyMarkdown}
				disabled={!editor}
			>
				<Icon icon={copied ? 'mdi:check' : 'mdi:content-copy'} />
				<span>{copied ? 'Copied' : 'Markdown'}</span>
			</button>
			<button
				type="button"
				class="toolbar-button"
				title="Download Markdown"
				aria-label="Download Markdown"
				onclick={downloadMarkdown}
				disabled={!editor}
			>
				<Icon icon="mdi:download-outline" />
			</button>
		</div>
	</header>

	<div
		class="toolbar"
		role="toolbar"
		tabindex="-1"
		aria-label="Notes formatting toolbar"
		onpointerdown={keepEditorSelection}
	>
		<div class="toolbar-group">
			<button
				type="button"
				class:active={active('heading', { level: 1 })}
				class="toolbar-button"
				title="Heading 1"
				aria-label="Heading 1"
				aria-pressed={active('heading', { level: 1 })}
				onclick={() => run((e) => e.chain().focus().toggleHeading({ level: 1 }).run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-header-1" />
			</button>
			<button
				type="button"
				class:active={active('heading', { level: 2 })}
				class="toolbar-button"
				title="Heading 2"
				aria-label="Heading 2"
				aria-pressed={active('heading', { level: 2 })}
				onclick={() => run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-header-2" />
			</button>
			<button
				type="button"
				class:active={active('paragraph')}
				class="toolbar-button"
				title="Paragraph"
				aria-label="Paragraph"
				aria-pressed={active('paragraph')}
				onclick={() => run((e) => e.chain().focus().setParagraph().run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-paragraph" />
			</button>
		</div>

		<div class="toolbar-group">
			<button
				type="button"
				class:active={active('bold')}
				class="toolbar-button"
				title="Bold"
				aria-label="Bold"
				aria-pressed={active('bold')}
				onclick={() => run((e) => e.chain().focus().toggleBold().run())}
				disabled={!canRun((e) => e.can().chain().focus().toggleBold().run())}
			>
				<Icon icon="mdi:format-bold" />
			</button>
			<button
				type="button"
				class:active={active('italic')}
				class="toolbar-button"
				title="Italic"
				aria-label="Italic"
				aria-pressed={active('italic')}
				onclick={() => run((e) => e.chain().focus().toggleItalic().run())}
				disabled={!canRun((e) => e.can().chain().focus().toggleItalic().run())}
			>
				<Icon icon="mdi:format-italic" />
			</button>
			<button
				type="button"
				class:active={active('strike')}
				class="toolbar-button"
				title="Strike"
				aria-label="Strike"
				aria-pressed={active('strike')}
				onclick={() => run((e) => e.chain().focus().toggleStrike().run())}
				disabled={!canRun((e) => e.can().chain().focus().toggleStrike().run())}
			>
				<Icon icon="mdi:format-strikethrough" />
			</button>
			<button
				type="button"
				class:active={active('code')}
				class="toolbar-button"
				title="Inline Code"
				aria-label="Inline Code"
				aria-pressed={active('code')}
				onclick={() => run((e) => e.chain().focus().toggleCode().run())}
				disabled={!canRun((e) => e.can().chain().focus().toggleCode().run())}
			>
				<Icon icon="mdi:code-tags" />
			</button>
		</div>

		<div class="toolbar-group">
			<button
				type="button"
				class:active={active('bulletList')}
				class="toolbar-button"
				title="Bullet List"
				aria-label="Bullet List"
				aria-pressed={active('bulletList')}
				onclick={() => run((e) => e.chain().focus().toggleBulletList().run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-list-bulleted" />
			</button>
			<button
				type="button"
				class:active={active('orderedList')}
				class="toolbar-button"
				title="Ordered List"
				aria-label="Ordered List"
				aria-pressed={active('orderedList')}
				onclick={() => run((e) => e.chain().focus().toggleOrderedList().run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-list-numbered" />
			</button>
			<button
				type="button"
				class:active={active('blockquote')}
				class="toolbar-button"
				title="Quote"
				aria-label="Quote"
				aria-pressed={active('blockquote')}
				onclick={() => run((e) => e.chain().focus().toggleBlockquote().run())}
				disabled={!editor}
			>
				<Icon icon="mdi:format-quote-close" />
			</button>
			<button
				type="button"
				class:active={active('codeBlock')}
				class="toolbar-button"
				title="Code Block"
				aria-label="Code Block"
				aria-pressed={active('codeBlock')}
				onclick={() => run((e) => e.chain().focus().toggleCodeBlock().run())}
				disabled={!editor}
			>
				<Icon icon="mdi:code-braces" />
			</button>
		</div>

		<div class="toolbar-group">
			<button
				type="button"
				class="toolbar-button"
				title="Undo"
				aria-label="Undo"
				onclick={() => run((e) => e.chain().focus().undo().run())}
				disabled={!canRun((e) => e.can().chain().focus().undo().run())}
			>
				<Icon icon="mdi:undo" />
			</button>
			<button
				type="button"
				class="toolbar-button"
				title="Redo"
				aria-label="Redo"
				onclick={() => run((e) => e.chain().focus().redo().run())}
				disabled={!canRun((e) => e.can().chain().focus().redo().run())}
			>
				<Icon icon="mdi:redo" />
			</button>
		</div>
	</div>

	<div class="editor-surface">
		<div bind:this={editorHost}></div>
	</div>
</div>

<style>
	.notes-editor {
		--toolbar-size: 2.25rem;
		background: color-mix(in oklch, var(--base-1) 96%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		box-shadow: 0 18px 60px rgb(0 0 0 / 0.08);
		display: flex;
		flex-direction: column;
		min-height: min(46rem, calc(100vh - 12rem));
		overflow: hidden;
	}

	.notes-topbar {
		align-items: center;
		border-bottom: 1px solid var(--edge);
		display: flex;
		gap: var(--s-1);
		justify-content: space-between;
		min-height: 3rem;
		padding: var(--s-2) var(--s0);
	}

	.status,
	.export-actions,
	.toolbar,
	.toolbar-group,
	.toolbar-button {
		align-items: center;
		display: flex;
	}

	.status {
		color: var(--content-1);
		font-size: var(--s-1);
		gap: var(--s-3);
		min-width: 0;
	}

	.status-dot {
		background: var(--success);
		border-radius: 999px;
		display: block;
		height: 0.5rem;
		width: 0.5rem;
	}

	.status[data-state='saving'] .status-dot,
	.status[data-state='loading'] .status-dot {
		background: var(--warning);
	}

	.status[data-state='error'] .status-dot {
		background: var(--error);
	}

	.export-actions {
		gap: var(--s-3);
	}

	.toolbar {
		background: var(--base-2);
		border-bottom: 1px solid var(--edge);
		flex-wrap: wrap;
		gap: var(--s-2);
		padding: var(--s-2);
	}

	.toolbar-group {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		gap: var(--s-4);
		padding: var(--s-4);
	}

	.toolbar-button {
		background: transparent;
		border-radius: var(--s-4);
		color: var(--content-1);
		gap: var(--s-3);
		height: var(--toolbar-size);
		justify-content: center;
		min-width: var(--toolbar-size);
		padding: 0 var(--s-3);
		transition:
			background-color 0.2s,
			color 0.2s,
			opacity 0.2s;
	}

	.toolbar-button :global(svg) {
		height: 1.25rem;
		width: 1.25rem;
	}

	.toolbar-button:hover:not(:disabled),
	.toolbar-button.active {
		background: color-mix(in oklch, var(--brand) 16%, transparent);
		color: var(--content);
	}

	.toolbar-button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.text-action {
		border: 1px solid var(--edge);
		font-size: var(--s-1);
		padding-inline: var(--s-2);
	}

	.editor-surface {
		flex: 1;
		min-height: 28rem;
		overflow: auto;
	}

	.editor-surface :global(.ProseMirror) {
		color: var(--content);
		min-height: 28rem;
		outline: none;
		padding: clamp(var(--s0), 5vw, var(--s2));
	}

	.editor-surface :global(.notes-prose) {
		font-size: var(--s0);
	}

	.editor-surface :global(.ProseMirror > * + *) {
		margin-top: 0.85em;
	}

	.editor-surface :global(.ProseMirror h1) {
		font-size: var(--s3);
		font-weight: 780;
		line-height: 1.08;
	}

	.editor-surface :global(.ProseMirror h2) {
		font-size: var(--s2);
		font-weight: 740;
		line-height: 1.15;
	}

	.editor-surface :global(.ProseMirror h3) {
		font-size: var(--s1);
		font-weight: 700;
		line-height: 1.2;
	}

	.editor-surface :global(.ProseMirror ul),
	.editor-surface :global(.ProseMirror ol) {
		padding-left: var(--s1);
	}

	.editor-surface :global(.ProseMirror blockquote) {
		border-left: 3px solid var(--brand);
		color: var(--content-1);
		padding-left: var(--s0);
	}

	.editor-surface :global(.ProseMirror pre) {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		color: var(--content);
		overflow-x: auto;
		padding: var(--s0);
	}

	.editor-surface :global(.ProseMirror code) {
		background: var(--base-2);
		border-radius: var(--s-4);
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 0.08em 0.32em;
	}

	.editor-surface :global(.ProseMirror pre code) {
		background: transparent;
		border-radius: 0;
		padding: 0;
	}

	.editor-surface :global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: var(--content-1);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	@media (max-width: 42rem) {
		.notes-topbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.export-actions,
		.toolbar-group {
			width: 100%;
		}

		.export-actions {
			justify-content: flex-end;
		}

		.toolbar-group {
			flex: 1 1 12rem;
			flex-wrap: wrap;
		}
	}
</style>
