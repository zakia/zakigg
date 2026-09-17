<script lang="ts">
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

<div class="toolbar-surface" aria-label="Text formatting">
	<button
		type="button"
		class:active={viewState.bold}
		aria-label="Bold"
		aria-pressed={viewState.bold}
		title="Bold (⌘B)"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('bold')}><strong>B</strong></button
	>
	<button
		type="button"
		class:active={viewState.italic}
		aria-label="Italic"
		aria-pressed={viewState.italic}
		title="Italic (⌘I)"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('italic')}><em>I</em></button
	>
	<button
		type="button"
		class:active={viewState.strike}
		aria-label="Strikethrough"
		aria-pressed={viewState.strike}
		title="Strikethrough"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('strike')}><s>S</s></button
	>
	<button
		type="button"
		class:active={viewState.code}
		aria-label="Inline code"
		aria-pressed={viewState.code}
		title="Inline code"
		onpointerdown={(event) => event.preventDefault()}
		onclick={() => onToggle('code')}><code>&lt;/&gt;</code></button
	>
	<span class="divider" aria-hidden="true"></span>
	<button
		type="button"
		class:active={viewState.link}
		aria-label={viewState.link ? 'Remove link' : 'Add link'}
		aria-pressed={viewState.link}
		title={viewState.link ? 'Remove link' : 'Add link'}
		onpointerdown={(event) => event.preventDefault()}
		onclick={onToggleLink}>↗</button
	>
</div>

<style>
	.toolbar-surface {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		border-radius: calc(var(--radius) * 0.8);
		box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 0.14);
		display: flex;
		gap: 2px;
		padding: 4px;
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
		font-size: 0.9rem;
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
		background: color-mix(in oklch, var(--brand) 16%, var(--base-1));
		color: var(--brand);
	}

	button code {
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.divider {
		background: var(--edge-1);
		height: 1.35rem;
		margin-inline: 3px;
		width: 1px;
	}
</style>
