<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		navigation,
		children,
		actions,
		editing = false
	}: {
		navigation?: Snippet;
		children: Snippet;
		actions?: Snippet;
		editing?: boolean;
	} = $props();
</script>

<div class="document-layout" class:editing>
	{#if navigation}
		<nav class="navigation" aria-label="Document navigation">{@render navigation()}</nav>
	{/if}
	<div class="main">{@render children()}</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.document-layout {
		--document-end-space: calc(var(--s3) * 3);
		--vertical-spacing: var(--s3);
		box-sizing: border-box;
		display: grid;
		grid-template-areas: 'back article actions';
		grid-template-columns: 100px minmax(0, 680px) 100px;
		margin-inline: auto;
		max-width: calc(880px + var(--s0) * 2);
		min-width: 0;
		padding-bottom: var(--document-end-space);
		padding-inline: var(--s0);
		padding-top: var(--vertical-spacing);
		width: 100%;
	}

	.document-layout.editing {
		--vertical-spacing: var(--s0);
		background: color-mix(in oklch, var(--base) 92%, var(--base-1));
		column-gap: var(--s0);
		flex: 1;
		grid-template-columns: minmax(0, 1fr) minmax(0, 680px) minmax(0, 1fr);
		max-width: none;
		min-height: 100vh;
		position: relative;
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
			--document-end-space: calc(var(--s3) * 2);
			grid-template-areas:
				'back actions'
				'article article';
			grid-template-columns: minmax(0, 1fr) auto;
			padding-top: calc(var(--vertical-spacing) / 2);
		}

		.document-layout.editing {
			--document-end-space: calc(var(--s3) * 2 + var(--mobile-nav-height));
			grid-template-columns: minmax(0, 1fr) auto;
			row-gap: var(--s1);
		}

		.navigation,
		.actions {
			position: static;
		}
	}
</style>
