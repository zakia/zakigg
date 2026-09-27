<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		navigation,
		main,
		actions,
		editor = false
	}: {
		navigation?: Snippet;
		main: Snippet;
		actions?: Snippet;
		editor?: boolean;
	} = $props();
</script>

<div class="document-layout" class:editor>
	{#if navigation}
		<nav class="navigation" aria-label="Document navigation">{@render navigation()}</nav>
	{/if}
	<div class="main">{@render main()}</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.document-layout {
		--vertical-spacing: var(--s3);
		display: grid;
		grid-template-areas: 'back article actions';
		grid-template-columns: 100px minmax(0, 680px) 100px;
		margin-inline: auto;
		max-width: calc(880px + var(--s0) * 2);
		padding-inline: var(--s0);
		padding-top: var(--vertical-spacing);
		width: 100%;
	}

	.document-layout.editor {
		--vertical-spacing: var(--s0);
		column-gap: var(--s0);
		grid-template-columns: minmax(0, 1fr) minmax(0, 680px) minmax(0, 1fr);
		max-width: none;
	}

	.navigation {
		align-self: start;
		grid-area: back;
		position: sticky;
		top: var(--vertical-spacing);
		width: fit-content;
	}

	.main {
		grid-area: article;
		margin-inline: auto;
		max-width: 680px;
		min-width: 0;
		width: 100%;
	}

	.actions {
		align-self: start;
		grid-area: actions;
		justify-self: end;
		position: sticky;
		top: var(--vertical-spacing);
	}

	@media (max-width: 768px) {
		.document-layout {
			grid-template-areas:
				'back actions'
				'article article';
			grid-template-columns: minmax(0, 1fr) auto;
			padding-top: calc(var(--vertical-spacing) / 2);
		}

		.document-layout.editor {
			grid-template-columns: minmax(0, 1fr) auto;
			row-gap: var(--s1);
		}

		.navigation,
		.actions {
			position: static;
		}
	}
</style>
