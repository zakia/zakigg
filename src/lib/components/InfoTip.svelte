<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import Icon from '$lib/components/Icon.svelte';
	import { tooltip } from '$lib/attachments/tooltip';

	let { label, text, href }: { label: string; text: string; href?: Pathname } = $props();
	// resolve's tuple overload cannot accept the generated union of valid pathnames directly.
	const resolveHref = (path: Pathname) => resolve(path as '/');
</script>

{#if href}
	<a class="info-tip" href={resolveHref(href)} aria-label={label} {@attach tooltip(text)}>
		<Icon icon="mdi:information-outline" />
	</a>
{:else}
	<button type="button" class="info-tip" aria-label={label} {@attach tooltip(text)}>
		<Icon icon="mdi:information-outline" />
	</button>
{/if}

<style>
	.info-tip {
		align-items: center;
		background: none;
		border: 0;
		border-radius: 50%;
		color: var(--content-1);
		cursor: help;
		display: inline-flex;
		flex: none;
		height: 1.5rem;
		justify-content: center;
		padding: 0;
		text-decoration: none;
		width: 1.5rem;
	}

	.info-tip:hover,
	.info-tip:focus-visible {
		color: var(--content);
	}

	.info-tip[href] {
		cursor: pointer;
	}

	.info-tip:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.info-tip :global(svg) {
		height: 0.9rem;
		width: 0.9rem;
	}
</style>
