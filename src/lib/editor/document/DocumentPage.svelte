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
	class={['document-page', className, { 'document-page--scrollable': scrollable }]}
>
	{@render children()}
</div>

<style>
	.document-page {
		--document-page-end-space: calc(var(--s3) * 3);
		--document-page-end-clearance: var(--document-page-end-space);
		box-sizing: border-box;
		min-width: 0;
		width: 100%;
	}

	/* A real flex item remains part of an overflowing scroll area. Bottom
	   padding on a column flex scroller can be consumed at the scroll edge. */
	.document-page::after {
		content: '';
		display: block;
		flex: 0 0 var(--document-page-end-clearance);
		height: var(--document-page-end-clearance);
		pointer-events: none;
	}

	.document-page--scrollable {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
		position: relative;
	}

	@media (max-width: 48rem) {
		.document-page {
			--document-page-end-space: calc(var(--s3) * 2);
		}

		/* A contained scroller reaches behind the fixed mobile navigation, unlike
		   a document-scrolling page whose space is already reserved by the app
		   layout. Keep the same article-end space visible above that navigation. */
		.document-page--scrollable {
			--document-page-end-clearance: calc(
				var(--document-page-end-space) + var(--mobile-nav-height)
			);
		}
	}
</style>
