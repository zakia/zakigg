<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { Editor } from '@milkdown/kit/core';
	import Icon from '$lib/components/Icon.svelte';
	import type { ComponentEmbedRegistry } from '../components/registry';
	import { createMarkdownEditor } from './create-editor';
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
		<div class="milkdown-editor" bind:this={editorHost}></div>
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

	.milkdown-editor :global(.milkdown-link-preview),
	.milkdown-editor :global(.milkdown-link-edit) {
		backdrop-filter: blur(18px);
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		border-radius: calc(var(--radius) * 0.8);
		box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 0.14);
		box-sizing: border-box;
		opacity: 0;
		padding: 4px;
		pointer-events: none;
		position: absolute;
		transform: translateY(5px) scale(0.985);
		transform-origin: bottom center;
		transition:
			opacity 0.13s ease,
			transform 0.13s ease,
			visibility 0s linear 0.13s;
		visibility: hidden;
		z-index: 50;
	}

	.milkdown-editor :global(.milkdown-link-preview[data-show='true']),
	.milkdown-editor :global(.milkdown-link-edit[data-show='true']) {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0) scale(1);
		transition-delay: 0s;
		visibility: visible;
	}

	.milkdown-editor :global(.milkdown-link-preview[data-show='true']) {
		transition-delay: 0.16s;
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

	@media (prefers-reduced-motion: reduce) {
		.editor-mode-switch button,
		.milkdown-editor :global(.milkdown-link-preview),
		.milkdown-editor :global(.milkdown-link-edit) {
			transition: none;
		}
	}
</style>
