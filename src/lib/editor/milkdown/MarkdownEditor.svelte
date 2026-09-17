<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { Editor } from '@milkdown/kit/core';
	import type { ComponentEmbedRegistry } from '../components/registry';
	import { createMarkdownEditor } from './create-editor';

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

	function updateSource(event: Event) {
		sourceMarkdown = (event.currentTarget as HTMLTextAreaElement).value;
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
	<div class="editor-mode-switch" role="group" aria-label="Editor mode">
		<button
			type="button"
			class:active={mode === 'visual'}
			aria-pressed={mode === 'visual'}
			onclick={() => void showVisual()}>Visual</button
		>
		<button
			type="button"
			class:active={mode === 'source'}
			aria-pressed={mode === 'source'}
			onclick={() => void showSource()}>Source</button
		>
	</div>

	{#if mode === 'source'}
		{#if visualError}
			<div class="source-recovery" role="alert">
				<strong>The visual editor could not parse this Markdown.</strong>
				<span>{visualError}</span>
			</div>
		{/if}
		<textarea
			class="markdown-source-editor"
			value={sourceMarkdown}
			aria-label={`${ariaLabel} source`}
			spellcheck="false"
			oninput={updateSource}
		></textarea>
	{:else}
		<div class="milkdown-editor" bind:this={editorHost}></div>
	{/if}
</section>

<style>
	.markdown-editor-surface {
		min-height: 100%;
		position: relative;
		width: 100%;
	}

	.editor-mode-switch {
		align-items: center;
		background: color-mix(in oklch, var(--base-1) 88%, transparent);
		border: 1px solid var(--edge-1);
		border-radius: 999px;
		display: flex;
		gap: 0.15rem;
		margin-left: auto;
		padding: 0.2rem;
		position: relative;
		width: max-content;
		z-index: 2;
	}

	.editor-mode-switch button {
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--content-1);
		font: inherit;
		font-size: var(--s-1);
		padding: var(--s-4) var(--s-2);
	}

	.editor-mode-switch button.active {
		background: var(--base-2);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
		color: var(--content);
	}

	.source-recovery {
		background: color-mix(in oklch, var(--error) 8%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--error) 34%, var(--edge));
		border-radius: var(--s-3);
		display: grid;
		gap: var(--s-4);
		margin-top: var(--s0);
		padding: var(--s-1) var(--s0);
	}

	.source-recovery span {
		color: var(--content-1);
		font-size: var(--s-1);
	}

	.markdown-source-editor {
		background: transparent;
		border: 0;
		box-sizing: border-box;
		color: var(--content);
		font-family: var(--font-mono);
		font-size: 0.92rem;
		line-height: 1.65;
		margin-top: var(--s0);
		min-height: max(32rem, 70vh);
		outline: none;
		padding: 0;
		resize: vertical;
		width: 100%;
	}

	.markdown-source-editor:focus-visible {
		box-shadow: inset 3px 0 0 color-mix(in oklch, var(--brand) 65%, transparent);
		padding-left: var(--s-1);
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

	.milkdown-editor :global(.milkdown-link-preview),
	.milkdown-editor :global(.milkdown-link-edit) {
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		border-radius: calc(var(--radius) * 0.8);
		box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 0.14);
		box-sizing: border-box;
		padding: 4px;
		position: absolute;
		z-index: 50;
	}

	.milkdown-editor :global(.milkdown-link-preview[data-show='false']),
	.milkdown-editor :global(.milkdown-link-edit[data-show='false']) {
		display: none;
	}

	.milkdown-editor :global(.milkdown-link-preview .link-preview),
	.milkdown-editor :global(.milkdown-link-edit .link-edit) {
		align-items: center;
		display: flex;
		gap: 3px;
	}

	.milkdown-editor :global(.milkdown-link-preview .link-display) {
		background: transparent;
		border-radius: calc(var(--radius) * 0.5);
		color: var(--content);
		font-size: var(--s-1);
		max-width: min(24rem, 55vw);
		overflow: hidden;
		padding: 0.42rem 0.55rem;
		text-decoration-color: var(--brand);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.milkdown-editor :global(.milkdown-link-preview .link-display:hover),
	.milkdown-editor :global(.milkdown-link-preview .link-display:focus-visible) {
		background: var(--base-2);
		color: var(--brand);
		outline: none;
	}

	.milkdown-editor :global(.milkdown-link-preview .milkdown-icon.button),
	.milkdown-editor :global(.milkdown-link-edit .milkdown-icon.button) {
		align-items: center;
		border-radius: calc(var(--radius) * 0.5);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font-size: var(--s-2);
		min-height: 2rem;
		padding-inline: 0.55rem;
		user-select: none;
	}

	.milkdown-editor :global(.milkdown-link-preview .milkdown-icon.button:hover),
	.milkdown-editor :global(.milkdown-link-edit .milkdown-icon.button:hover) {
		background: var(--base-2);
		color: var(--content);
	}

	.milkdown-editor :global(.milkdown-link-edit .input-area) {
		background: var(--base-2);
		border: 1px solid transparent;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content);
		font: 0.82rem/1.2 var(--font-body);
		min-width: min(18rem, 62vw);
		outline: none;
		padding: 0.52rem 0.65rem;
	}

	.milkdown-editor :global(.milkdown-link-edit .input-area:focus) {
		border-color: var(--brand);
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
</style>
