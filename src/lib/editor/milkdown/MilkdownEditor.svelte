<script lang="ts">
	import { onMount } from 'svelte';
	import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core';
	import { clipboard } from '@milkdown/kit/plugin/clipboard';
	import { history } from '@milkdown/kit/plugin/history';
	import { indent, indentConfig } from '@milkdown/kit/plugin/indent';
	import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
	import { trailing } from '@milkdown/kit/plugin/trailing';
	import { commonmark } from '@milkdown/kit/preset/commonmark';
	import { gfm } from '@milkdown/kit/preset/gfm';
	import { codeBlockFeature } from '../spike/milkdown/code-block';
	import { componentEmbedFeature } from './component-embed';
	import { columnsFeature } from '../spike/milkdown/columns';
	import { paragraphMdxSchema } from '../spike/milkdown/paragraph-mdx';
	import { selectionToolbarFeature } from '../spike/milkdown/selection-toolbar';
	import { configureSlashMenu, zakiSlashMenu } from '../spike/milkdown/slash-menu';
	import { youtubeEmbedFeature } from '../spike/milkdown/youtube-embed';

	let {
		initialMarkdown,
		ariaLabel = 'Markdown document editor',
		autofocus = false,
		onMarkdownChange,
		onReady,
		onError
	}: {
		initialMarkdown: string;
		ariaLabel?: string;
		autofocus?: boolean;
		onMarkdownChange?: (markdown: string) => void;
		onReady?: (editor: Editor) => void;
		onError?: (error: unknown) => void;
	} = $props();

	let editorHost = $state<HTMLDivElement>();

	onMount(() => {
		let disposed = false;
		let editor: Editor | undefined;

		async function setup() {
			if (!editorHost) return;
			const instance = Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, editorHost);
					ctx.set(defaultValueCtx, initialMarkdown);
					ctx.update(indentConfig.key, (value) => ({ ...value, size: 4 }));
					ctx.update(editorViewOptionsCtx, (options) => ({
						...options,
						autofocus,
						attributes: {
							...options.attributes,
							class: 'milkdown-document-editor editor-prose',
							'aria-label': ariaLabel,
							'aria-multiline': 'true'
						}
					}));
				})
				.config(configureSlashMenu)
				.config((ctx) => {
					ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => onMarkdownChange?.(markdown));
				})
				.use(commonmark)
				.use(gfm)
				.use(paragraphMdxSchema)
				.use(listener)
				.use(history)
				.use(indent)
				.use(trailing)
				.use(clipboard)
				.use(zakiSlashMenu)
				.use(selectionToolbarFeature)
				.use(codeBlockFeature)
				.use(componentEmbedFeature)
				.use(youtubeEmbedFeature)
				.use(columnsFeature);

			try {
				await instance.create();
				if (disposed) {
					await instance.destroy();
					return;
				}
				editor = instance;
				onReady?.(instance);
			} catch (error) {
				onError?.(error);
			}
		}

		void setup();
		return () => {
			disposed = true;
			void editor?.destroy();
		};
	});
</script>

<div class="milkdown-editor" bind:this={editorHost}></div>

<style>
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

	.milkdown-editor :global(.milkdown .milkdown-document-editor) {
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
