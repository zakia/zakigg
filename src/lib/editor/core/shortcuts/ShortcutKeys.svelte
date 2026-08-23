<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatShortcut,
		formatShortcutKey,
		isAppleShortcutPlatform,
		type ShortcutKey
	} from './registry';

	let { keys }: { keys: ShortcutKey[] } = $props();
	let useAppleKeys = $state(false);

	const label = $derived(formatShortcut(keys, useAppleKeys));

	onMount(() => {
		useAppleKeys = isAppleShortcutPlatform();
	});
</script>

<span class="shortcut-keys" aria-label={label}>
	{#each keys as key (key)}
		<kbd>{formatShortcutKey(key, useAppleKeys)}</kbd>
	{/each}
</span>

<style>
	.shortcut-keys {
		align-items: center;
		display: inline-flex;
		gap: 0.18rem;
	}

	kbd {
		align-items: center;
		background: color-mix(in oklch, var(--base-1) 82%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: 0.36rem;
		box-shadow: inset 0 -1px 0 color-mix(in oklch, var(--edge) 70%, transparent);
		color: var(--content);
		display: inline-flex;
		font-family: inherit;
		font-size: 0.72rem;
		font-weight: 650;
		height: 1.35rem;
		justify-content: center;
		line-height: 1;
		min-width: 1.35rem;
		padding: 0 0.36rem;
	}
</style>
