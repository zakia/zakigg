<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		navigation,
		main,
		actions
	}: {
		navigation?: Snippet;
		main: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="document-layout">
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
		grid-area: actions;
		justify-self: end;
	}

	@media (max-width: 768px) {
		.document-layout {
			grid-template-areas:
				'back actions'
				'article article';
			grid-template-columns: minmax(0, 1fr) auto;
			padding-top: calc(var(--vertical-spacing) / 2);
		}

		.navigation {
			position: static;
		}
	}
</style>
