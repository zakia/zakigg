<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		scrollable = false,
		class: className,
		...attributes
	}: HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
		scrollable?: boolean;
	} = $props();
</script>

<div
	{...attributes}
	class={['craft-page-shell', className, { 'craft-page-shell--scrollable': scrollable }]}
>
	{@render children()}
</div>

<style>
	.craft-page-shell {
		--craft-page-end-space: calc(var(--s3) * 3);
		--craft-page-end-clearance: var(--craft-page-end-space);
		box-sizing: border-box;
		min-width: 0;
		width: 100%;
	}

	/* A real flex item remains part of an overflowing scroll area. Bottom
	   padding on a column flex scroller can be consumed at the scroll edge. */
	.craft-page-shell::after {
		content: '';
		display: block;
		flex: 0 0 var(--craft-page-end-clearance);
		height: var(--craft-page-end-clearance);
		pointer-events: none;
	}

	.craft-page-shell--scrollable {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
		position: relative;
	}

	@media (max-width: 48rem) {
		.craft-page-shell {
			--craft-page-end-space: calc(var(--s3) * 2);
		}

		/* A contained scroller reaches behind the fixed mobile navigation, unlike
		   a document-scrolling page whose space is already reserved by the app
		   layout. Keep the same article-end space visible above that navigation. */
		.craft-page-shell--scrollable {
			--craft-page-end-clearance: calc(var(--craft-page-end-space) + var(--mobile-nav-height));
		}
	}
</style>
