<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import CraftArticleLayout from '$lib/crafts/CraftArticleLayout.svelte';
	import CraftPageShell from '$lib/crafts/CraftPageShell.svelte';

	let {
		onHost,
		onDragOver,
		onDrop,
		onScroll,
		navigation,
		header,
		children
	}: {
		onHost: (host?: HTMLDivElement) => void;
		onDragOver?: (event: DragEvent) => void;
		onDrop?: (event: DragEvent) => void;
		onScroll?: (event: Event) => void;
		navigation?: Snippet;
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

<CraftPageShell
	scrollable
	role="presentation"
	ondragover={onDragOver}
	ondrop={onDrop}
	onscroll={onScroll}
>
	{#if header}
		{#snippet editorHeader()}
			<div class="editor-header">{@render header()}</div>
		{/snippet}
		<CraftArticleLayout {navigation} main={editorHeader} />
	{/if}
	<!-- Content-space overlays (the block handle) are absolutely positioned
	     against .editor-body, whose origin is exactly the document's origin.
	     They must NOT be positioned against the page shell: anything rendered
	     above the document (the header) would offset them by its height. -->
	<div class:has-header={Boolean(header)} class="editor-body">
		<div class="editor-host" bind:this={host}></div>
		{@render children?.()}
	</div>
</CraftPageShell>

<style>
	.editor-body {
		--editor-inline-padding: clamp(var(--s0), 5vw, var(--s2));
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		min-height: 0;
		position: relative;
	}

	/* Positioned so it — not the page shell — is the offset parent for
	   content-space overlays, keeping their origin pinned to the document. */
	.editor-host {
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		min-height: 0;
	}

	/* Align the metadata panel with the document's text column, and give it the
	   editor's top padding so it sits where content begins. The document's own
	   top padding is zeroed (below) so the two don't stack. */
	.editor-body.has-header :global(.ProseMirror) {
		padding-top: var(--s0);
	}

	.editor-body :global(.ProseMirror) {
		box-sizing: border-box;
		flex: 1 0 auto;
		margin-inline: auto;
		max-width: calc(680px + var(--editor-inline-padding) + var(--editor-inline-padding));
		min-height: 0;
		outline: none;
		padding: clamp(var(--s1), 6vw, var(--s3)) var(--editor-inline-padding) 0;
		width: 100%;
	}

	.editor-body :global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: var(--content-1);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	.editor-body :global(.ProseMirror [data-component-embed]:not(.component-embed-node)) {
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

	.editor-body :global(.ProseMirror [data-component-embed]:not(.component-embed-node)::before) {
		color: var(--brand);
		content: 'Component';
		font-size: var(--s-2);
		font-weight: 700;
		text-transform: uppercase;
	}

	.editor-body :global(.ProseMirror .ProseMirror-selectednode[data-component-embed]) {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}

	.editor-body :global(.ProseMirror .component-embed-node.ProseMirror-selectednode) {
		border-radius: var(--s-4);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
		width: 100%;
	}

	.editor-body :global(.ProseMirror .media-block-node.ProseMirror-selectednode) {
		border-radius: var(--radius);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}

	.editor-body :global(.ProseMirror .metadata-block-node.ProseMirror-selectednode) {
		border-radius: var(--s-3);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 22%, transparent);
	}
</style>
