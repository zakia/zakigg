<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		getEditorShortcut,
		isAppleShortcutPlatform,
		shortcutTitle,
		type EditorShortcutId
	} from './keyboard-shortcuts';
	import ShortcutKeys from './ShortcutKeys.svelte';

	type Props = {
		title: string;
		icon: string;
		active?: boolean;
		disabled?: boolean;
		pressed?: boolean;
		shortcutId?: EditorShortcutId;
		text?: string;
		variant?: string;
		onClick: () => void | Promise<void>;
	};

	let {
		title,
		icon,
		active = false,
		disabled = false,
		pressed,
		shortcutId,
		text,
		variant = '',
		onClick
	}: Props = $props();

	let useAppleKeys = $state(false);

	const shortcut = $derived(getEditorShortcut(shortcutId));
	const buttonTitle = $derived(shortcutTitle(title, shortcut, useAppleKeys));

	onMount(() => {
		useAppleKeys = isAppleShortcutPlatform();
	});
</script>

<button
	type="button"
	class={`toolbar-button ${variant}`.trim()}
	class:active
	title={buttonTitle}
	aria-label={buttonTitle}
	aria-pressed={pressed}
	onclick={() => void onClick()}
	{disabled}
>
	<Icon {icon} />
	{#if text}
		<span>{text}</span>
	{/if}
	<span class="toolbar-tooltip" role="tooltip">
		<span>{title}</span>
		{#if shortcut}
			<ShortcutKeys keys={shortcut.keys} />
		{/if}
	</span>
</button>

<style>
	.toolbar-button {
		align-items: center;
		background: transparent;
		border-radius: var(--s-4);
		color: var(--content-1);
		display: flex;
		gap: var(--s-3);
		height: var(--toolbar-size);
		justify-content: center;
		min-width: var(--toolbar-size);
		padding: 0 var(--s-3);
		position: relative;
		transition:
			background-color 0.2s,
			color 0.2s,
			opacity 0.2s;
	}

	.toolbar-button :global(svg) {
		height: 1.25rem;
		width: 1.25rem;
	}

	.toolbar-button:hover:not(:disabled),
	.toolbar-button.active {
		background: color-mix(in oklch, var(--brand) 16%, transparent);
		color: var(--content);
	}

	.toolbar-button:disabled {
		cursor: not-allowed;
		opacity: 0.35;
	}

	.text-action {
		border: 1px solid var(--edge);
		font-size: var(--s-1);
		padding-inline: var(--s-2);
	}

	.toolbar-tooltip {
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

	.toolbar-tooltip :global(kbd) {
		background: color-mix(in oklch, var(--base) 92%, transparent);
		border-color: color-mix(in oklch, var(--base-1) 36%, transparent);
		color: var(--content);
	}

	.toolbar-button:hover .toolbar-tooltip,
	.toolbar-button:focus-visible .toolbar-tooltip {
		opacity: 1;
		transform: translate(-50%, 0);
	}
</style>
