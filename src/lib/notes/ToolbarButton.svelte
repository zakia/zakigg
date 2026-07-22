<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ActionTooltip from './ActionTooltip.svelte';
	import {
		getEditorShortcut,
		isAppleShortcutPlatform,
		shortcutTitle,
		type EditorShortcutId
	} from './keyboard-shortcuts';

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
	<ActionTooltip {title} {shortcut} />
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
</style>
