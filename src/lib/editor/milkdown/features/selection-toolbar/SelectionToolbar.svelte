<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { SelectionToolbarState } from './selection-toolbar-state.svelte';

	let {
		viewState,
		onToggle,
		onToggleLink
	}: {
		viewState: SelectionToolbarState;
		onToggle: (mark: 'bold' | 'italic' | 'strike' | 'code') => void;
		onToggleLink: () => void;
	} = $props();
</script>

<div class:visible={viewState.visible} class="toolbar-surface" aria-label="Text formatting">
	<button
		type="button"
		class:active={viewState.bold}
		aria-label="Bold"
		aria-pressed={viewState.bold}
		title="Bold (⌘B)"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('bold')}><Icon icon="mdi:format-bold" /></button
	>
	<button
		type="button"
		class:active={viewState.italic}
		aria-label="Italic"
		aria-pressed={viewState.italic}
		title="Italic (⌘I)"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('italic')}><Icon icon="mdi:format-italic" /></button
	>
	<button
		type="button"
		class:active={viewState.strike}
		aria-label="Strikethrough"
		aria-pressed={viewState.strike}
		title="Strikethrough"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('strike')}><Icon icon="mdi:format-strikethrough-variant" /></button
	>
	<button
		type="button"
		class:active={viewState.code}
		aria-label="Inline code"
		aria-pressed={viewState.code}
		title="Inline code"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('code')}><Icon icon="mdi:code-tags" /></button
	>
	<span class="divider" aria-hidden="true"></span>
	<button
		type="button"
		class:active={viewState.link}
		aria-label={viewState.link ? 'Remove link' : 'Add link'}
		aria-pressed={viewState.link}
		title={viewState.link ? 'Remove link' : 'Add link'}
		onpointerdown={(event) => event.preventDefault()}
		onclick={onToggleLink}
		><Icon icon={viewState.link ? 'mdi:link-off' : 'mdi:link-variant-plus'} /></button
	>
</div>

<style>
	.toolbar-surface {
		align-items: center;
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 92%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge-1) 84%, transparent);
		border-radius: var(--radius);
		box-shadow:
			0 0.75rem 2rem rgb(0 0 0 / 0.13),
			0 2px 6px rgb(0 0 0 / 0.06);
		display: flex;
		gap: 2px;
		opacity: 0;
		padding: 4px;
		transform: translateY(6px) scale(0.98);
		transform-origin: bottom center;
		transition:
			opacity 0.14s ease,
			transform 0.14s ease,
			visibility 0s linear 0.14s;
		visibility: hidden;
	}

	.toolbar-surface.visible {
		opacity: 1;
		transform: translateY(0) scale(1);
		transition-delay: 0s;
		visibility: visible;
	}

	button {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font-family: var(--font-body);
		height: 2rem;
		justify-content: center;
		min-width: 2rem;
		padding: 0 0.45rem;
	}

	button:hover,
	button:focus-visible {
		background: var(--base-2);
		color: var(--content);
		outline: none;
	}

	button.active {
		background: color-mix(in oklch, var(--brand) 14%, var(--base-1));
		color: var(--brand);
	}

	button :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.divider {
		background: var(--edge-1);
		height: 1.35rem;
		margin-inline: 3px;
		width: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.toolbar-surface {
			transition: none;
		}
	}
</style>
