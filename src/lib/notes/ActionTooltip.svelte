<script lang="ts">
	import ShortcutKeys from './ShortcutKeys.svelte';
	import type { EditorShortcut } from './keyboard-shortcuts';

	let { title, shortcut }: { title: string; shortcut?: EditorShortcut } = $props();
</script>

<span class="action-tooltip" role="tooltip">
	<span>{title}</span>
	{#if shortcut}
		<ShortcutKeys keys={shortcut.keys} />
	{/if}
</span>

<style>
	.action-tooltip {
		align-items: center;
		background: color-mix(in oklch, var(--content) 94%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 62%, transparent);
		border-radius: var(--s-4);
		box-shadow: 0 12px 34px rgb(0 0 0 / 0.16);
		color: var(--base);
		display: flex;
		font-size: var(--s-1);
		font-weight: 650;
		gap: var(--s-2);
		left: 50%;
		line-height: 1;
		opacity: 0;
		padding: var(--s-3) var(--s-2);
		pointer-events: none;
		position: absolute;
		top: calc(100% + var(--s-3));
		transform: translate(-50%, -0.18rem);
		transition:
			opacity 0.14s ease,
			transform 0.14s ease;
		white-space: nowrap;
		z-index: 20;
	}

	.action-tooltip :global(kbd) {
		background: color-mix(in oklch, var(--base) 92%, transparent);
		border-color: color-mix(in oklch, var(--base-1) 36%, transparent);
		color: var(--content);
	}

	:global(button:hover) > .action-tooltip,
	:global(button:focus-visible) > .action-tooltip {
		opacity: 1;
		transform: translate(-50%, 0);
	}
</style>
