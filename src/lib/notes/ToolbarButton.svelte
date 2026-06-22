<script lang="ts">
	import Icon from '@iconify/svelte';

	type Props = {
		title: string;
		icon: string;
		active?: boolean;
		disabled?: boolean;
		pressed?: boolean;
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
		text,
		variant = '',
		onClick
	}: Props = $props();
</script>

<button
	type="button"
	class={`toolbar-button ${variant}`.trim()}
	class:active
	{title}
	aria-label={title}
	aria-pressed={pressed}
	onclick={() => void onClick()}
	{disabled}
>
	<Icon {icon} />
	{#if text}
		<span>{text}</span>
	{/if}
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
