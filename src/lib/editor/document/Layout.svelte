<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		navigation,
		children,
		actions
	}: {
		navigation?: Snippet;
		children: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="document-layout">
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
		column-gap: var(--s1);
		display: grid;
		flex: 1;
		grid-template-areas: 'back article actions';
		grid-template-columns: minmax(0, 1fr) minmax(0, 680px) minmax(0, 1fr);
		margin-inline: auto;
		max-width: 1400px;
		min-width: 0;
		padding-bottom: var(--document-end-space);
		padding-inline: var(--s0);
		padding-top: var(--vertical-spacing);
		width: 100%;
	}

	.navigation {
		align-items: center;
		align-self: start;
		display: flex;
		grid-area: back;
		justify-self: end;
		min-height: 2.35rem;
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
		justify-self: start;
		position: sticky;
		top: var(--vertical-spacing);
	}

	@media (max-width: 72rem) {
		.document-layout {
			--document-end-space: calc(var(--s3) * 2 + var(--mobile-nav-height, 0px));
			grid-template-areas:
				'back actions'
				'article article';
			grid-template-columns: auto auto;
			justify-content: space-between;
			max-width: calc(680px + var(--s0) * 2);
			padding-top: calc(var(--vertical-spacing) / 2);
			row-gap: var(--s0);
		}

		.navigation,
		.actions {
			position: static;
		}

		.actions {
			justify-self: end;
		}
	}
</style>
