<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { Editor } from '@milkdown/kit/core';
	import Icon from '$lib/components/Icon.svelte';
	import type { ComponentEmbedRegistry } from '../components/registry';
	import { createMarkdownEditor } from './create-editor';
	import { createLinkAttachment } from './features/link/link-attachment.svelte';
	import MarkdownSourceEditor from './MarkdownSourceEditor.svelte';

	let {
		initialMarkdown,
		embeds,
		ariaLabel = 'Markdown document editor',
		autofocus = false,
		onMarkdownChange,
		onReady,
		onError
	}: {
		initialMarkdown: string;
		embeds: ComponentEmbedRegistry;
		ariaLabel?: string;
		autofocus?: boolean;
		onMarkdownChange?: (markdown: string) => void;
		onReady?: (editor: Editor) => void;
		onError?: (error: unknown) => void;
	} = $props();

	let editorHost = $state<HTMLDivElement>();
	let editor = $state<Editor>();
	let mode = $state<'visual' | 'source'>('visual');
	let sourceMarkdown = $state(untrack(() => initialMarkdown));
	let visualError = $state('');
	let disposed = false;
	let setupRevision = 0;
	const linkAttachment = createLinkAttachment(() => editor);

	async function destroyEditor() {
		const current = editor;
		editor = undefined;
		if (current) await current.destroy();
	}

	async function startVisualEditor() {
		const revision = ++setupRevision;
		await destroyEditor();
		if (disposed || mode !== 'visual' || !editorHost || revision !== setupRevision) return;

		const instance = createMarkdownEditor({
			host: editorHost,
			markdown: sourceMarkdown,
			embeds,
			ariaLabel,
			autofocus,
			onMarkdownChange: (markdown) => {
				sourceMarkdown = markdown;
				visualError = '';
				onMarkdownChange?.(markdown);
			}
		});

		try {
			await instance.create();
			if (disposed || mode !== 'visual' || revision !== setupRevision) {
				await instance.destroy();
				return;
			}
			editor = instance;
			onReady?.(instance);
		} catch (error) {
			if (disposed || revision !== setupRevision) return;
			visualError = error instanceof Error ? error.message : 'The visual editor could not start.';
			mode = 'source';
			onError?.(error);
		}
	}

	async function showSource() {
		if (mode === 'source') return;
		setupRevision += 1;
		mode = 'source';
		await destroyEditor();
	}

	async function showVisual() {
		if (mode === 'visual') return;
		visualError = '';
		mode = 'visual';
		await tick();
		await startVisualEditor();
	}

	function updateSource(markdown: string) {
		sourceMarkdown = markdown;
		visualError = '';
		onMarkdownChange?.(sourceMarkdown);
	}

	onMount(() => {
		void startVisualEditor();
		return () => {
			disposed = true;
			setupRevision += 1;
			void destroyEditor();
		};
	});
</script>

<section class="markdown-editor-surface" class:source-mode={mode === 'source'}>
	<div class="editor-mode-bar">
		<div class="editor-mode-switch" role="group" aria-label="Editor mode">
			<button
				type="button"
				class:active={mode === 'visual'}
				aria-pressed={mode === 'visual'}
				title="Edit visually"
				onclick={() => void showVisual()}
			>
				<Icon icon="mdi:format-paragraph" />
				<span>Visual</span>
			</button>
			<button
				type="button"
				class:active={mode === 'source'}
				aria-pressed={mode === 'source'}
				title="Edit Markdown source"
				onclick={() => void showSource()}
			>
				<Icon icon="mdi:language-markdown-outline" />
				<span>Markdown</span>
			</button>
		</div>
	</div>

	{#if mode === 'source'}
		<div class="source-editor-shell">
			{#if visualError}
				<div class="source-recovery" role="alert">
					<strong>The visual editor could not parse this Markdown.</strong>
					<span>{visualError}</span>
				</div>
			{/if}
			<MarkdownSourceEditor
				value={sourceMarkdown}
				ariaLabel={`${ariaLabel} Markdown source`}
				autofocus
				onChange={updateSource}
			/>
		</div>
	{:else}
		<div class="milkdown-editor" bind:this={editorHost} {@attach linkAttachment}></div>
	{/if}
</section>

<style>
	.markdown-editor-surface {
		min-height: 100%;
		position: relative;
		width: 100%;
	}

	.editor-mode-bar,
	.source-editor-shell {
		box-sizing: border-box;
		margin-inline: auto;
		max-width: calc(680px + var(--editor-inline-padding) + var(--editor-inline-padding));
		padding-inline: var(--editor-inline-padding);
		width: 100%;
	}

	.editor-mode-bar {
		align-items: center;
		display: flex;
		justify-content: flex-end;
		min-height: 2.25rem;
	}

	.editor-mode-switch {
		align-items: center;
		background: color-mix(in oklch, var(--content) 5%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: calc(var(--radius) * 0.8);
		display: flex;
		gap: 2px;
		padding: 3px;
		position: relative;
		width: max-content;
		z-index: 2;
	}

	.editor-mode-switch button {
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		font: inherit;
		font-size: var(--s-1);
		font-weight: 620;
		min-height: 1.8rem;
		padding: 0 var(--s-2);
		transition:
			background-color 0.16s ease,
			box-shadow 0.16s ease,
			color 0.16s ease;
	}

	.editor-mode-switch button:hover,
	.editor-mode-switch button:focus-visible {
		color: var(--content);
		outline: none;
	}

	.editor-mode-switch button:focus-visible {
		box-shadow: var(--focus-ring);
	}

	.editor-mode-switch button :global(svg) {
		height: 0.9rem;
		width: 0.9rem;
	}

	.editor-mode-switch button.active {
		background: var(--base-1);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.08),
			0 0 0 1px color-mix(in oklch, var(--edge) 86%, transparent);
		color: var(--content);
	}

	.source-editor-shell {
		padding-top: var(--s0);
	}

	.source-recovery {
		background: color-mix(in oklch, var(--error) 8%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--error) 34%, var(--edge));
		border-radius: var(--s-3);
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s0);
		padding: var(--s-1) var(--s0);
	}

	.source-recovery span {
		color: var(--content-1);
		font-size: var(--s-1);
	}

	.milkdown-editor {
		margin-inline: auto;
		min-height: 100%;
		width: 100%;
	}

	.milkdown-editor :global(.milkdown) {
		background: transparent;
		min-height: inherit;
		position: relative;
	}

	.milkdown-editor :global(.milkdown .markdown-editor-content) {
		box-sizing: border-box;
		min-height: inherit;
		outline: none;
	}

	.milkdown-editor :global(.milkdown .ProseMirror) {
		color: var(--content);
		font-family: var(--font-body);
		font-size: var(--s0);
		line-height: 1.65;
	}

	.milkdown-editor :global(.milkdown .ProseMirror > *) {
		margin-block: 0;
	}

	.milkdown-editor :global(.milkdown .ProseMirror > * + *) {
		margin-top: var(--s0);
	}

	.milkdown-editor :global(.milkdown .ProseMirror h1),
	.milkdown-editor :global(.milkdown .ProseMirror h2),
	.milkdown-editor :global(.milkdown .ProseMirror h3) {
		color: var(--content);
		font-family: var(--font-body);
		font-weight: 750;
		letter-spacing: -0.04em;
		line-height: 1.08;
	}

	.milkdown-editor :global(.milkdown .ProseMirror h1) {
		font-size: clamp(var(--s3), 7vw, var(--s4));
		margin-bottom: var(--s1);
	}

	.milkdown-editor :global(.milkdown .ProseMirror h2) {
		font-size: var(--s2);
		margin-top: var(--s3);
	}

	.milkdown-editor :global(.milkdown .ProseMirror h3) {
		font-size: var(--s1);
	}

	.milkdown-editor :global(.milkdown .ProseMirror blockquote) {
		border-left: 3px solid var(--brand);
		color: var(--content-1);
		padding-left: var(--s0);
	}

	.milkdown-editor :global(.milkdown .ProseMirror ul),
	.milkdown-editor :global(.milkdown .ProseMirror ol) {
		padding-left: var(--s2);
	}

	.milkdown-editor :global(.milkdown .ProseMirror li::marker) {
		color: var(--brand);
	}

	.milkdown-editor :global(.milkdown .ProseMirror hr) {
		border: 0;
		border-top: 1px solid var(--edge-1);
		margin-block: var(--s2);
	}

	.milkdown-editor :global(.milkdown .ProseMirror a) {
		color: var(--brand);
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
	}

	.milkdown-editor :global(.milkdown .ProseMirror p a:not(:has(code)):hover) {
		color: var(--brand-content);
	}

	.milkdown-editor :global(.milkdown .ProseMirror :not(pre) > code) {
		background: color-mix(in oklch, var(--brand) 9%, var(--base-2));
		border-radius: calc(var(--radius) * 0.45);
		color: var(--brand);
		font-family: var(--font-mono);
		font-size: 0.88em;
		padding: 0.1em 0.3em;
	}

	.milkdown-editor :global(.milkdown .ProseMirror *::selection) {
		background: color-mix(in oklch, var(--brand) 24%, transparent);
	}

	.milkdown-editor :global(.milkdown .ProseMirror-selectednode.milkdown-youtube-node),
	.milkdown-editor :global(.milkdown .milkdown-youtube-node.is-selected),
	.milkdown-editor :global(.milkdown .milkdown-columns-node.is-selected) {
		border-radius: var(--radius);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 28%, transparent);
	}

	@media (max-width: 48rem) {
		.milkdown-editor :global(.milkdown .ProseMirror h1) {
			font-size: var(--s3);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.editor-mode-switch button {
			transition: none;
		}
	}
</style>
