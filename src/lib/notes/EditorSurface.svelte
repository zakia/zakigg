<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';

	let {
		onHost,
		onDragOver,
		onDrop,
		header,
		children
	}: {
		onHost: (host?: HTMLDivElement) => void;
		onDragOver?: (event: DragEvent) => void;
		onDrop?: (event: DragEvent) => void;
		// Content that scrolls above the document within the same column
		// (aligned to the text width), e.g. the metadata panel.
		header?: Snippet;
		// Overlays that must live in content coordinate space (they scroll
		// with the document), e.g. the block handle.
		children?: Snippet;
	} = $props();
	let host = $state<HTMLDivElement>();

	$effect(() => {
		onHost(host);
	});

	onDestroy(() => {
		onHost(undefined);
	});
</script>

<div class="editor-surface" role="presentation" ondragover={onDragOver} ondrop={onDrop}>
	{#if header}
		<div class="editor-header">{@render header()}</div>
	{/if}
	<div class="editor-host" bind:this={host}></div>
	{@render children?.()}
</div>

<style>
	.editor-surface {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: auto;
		position: relative;
	}

	.editor-host {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	/* Align the metadata panel with the document's text column, and give it the
	   editor's top padding so it sits where content begins. The document's own
	   top padding is zeroed (below) so the two don't stack. */
	.editor-header {
		box-sizing: border-box;
		flex: 0 0 auto;
		margin-inline: auto;
		max-width: 46rem;
		padding: clamp(var(--s1), 6vw, var(--s3)) clamp(var(--s0), 5vw, var(--s2)) 0;
		width: min(100%, 46rem);
	}

	.editor-surface:has(.editor-header) :global(.ProseMirror) {
		padding-top: var(--s-1);
	}

	.editor-surface :global(.ProseMirror) {
		box-sizing: border-box;
		flex: 1;
		margin-inline: auto;
		max-width: 46rem;
		min-height: 0;
		outline: none;
		padding: clamp(var(--s1), 6vw, var(--s3)) clamp(var(--s0), 5vw, var(--s2))
			calc(var(--s4) + 5rem);
		width: min(100%, 46rem);
	}

	.editor-surface :global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: var(--content-1);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	.editor-surface :global(.ProseMirror [data-component-embed]:not(.component-embed-node)) {
		align-items: center;
		background: color-mix(in oklch, var(--base-1) 82%, var(--brand) 6%);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, var(--brand) 12%);
		border-radius: var(--s-3);
		color: var(--content);
		cursor: default;
		display: flex;
		font-size: var(--s-1);
		font-weight: 650;
		gap: var(--s-3);
		margin-block: var(--s0);
		padding: var(--s-1) var(--s0);
		user-select: none;
	}

	.editor-surface :global(.ProseMirror [data-component-embed]:not(.component-embed-node)::before) {
		color: var(--brand);
		content: 'Component';
		font-size: var(--s-2);
		font-weight: 700;
		text-transform: uppercase;
	}

	.editor-surface :global(.ProseMirror .ProseMirror-selectednode[data-component-embed]) {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}

	.editor-surface :global(.ProseMirror .component-embed-node.ProseMirror-selectednode) {
		border-radius: var(--s-4);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
		width: fit-content;
	}

	.editor-surface :global(.ProseMirror .media-block-node.ProseMirror-selectednode) {
		border-radius: var(--radius);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}

	.editor-surface :global(.ProseMirror .metadata-block-node.ProseMirror-selectednode) {
		border-radius: var(--s-3);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}
</style>
