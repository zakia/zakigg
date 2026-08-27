<script lang="ts">
	import type { SelectionToolbarState } from './selection-toolbar-state.svelte';

	let {
		viewState,
		onToggle,
		onSetLink,
		onRemoveLink
	}: {
		viewState: SelectionToolbarState;
		onToggle: (mark: 'bold' | 'italic' | 'strike' | 'code') => void;
		onSetLink: (href: string) => void;
		onRemoveLink: () => void;
	} = $props();

	let editingLink = $state(false);
	let href = $state('');
	let linkInput = $state<HTMLInputElement>();

	$effect(() => {
		if (!viewState.visible) editingLink = false;
	});

	async function openLinkEditor() {
		href = viewState.linkHref;
		editingLink = true;
		await Promise.resolve();
		linkInput?.focus();
		linkInput?.select();
	}

	function submitLink() {
		const value = href.trim();
		if (value) onSetLink(value);
		else if (viewState.link) onRemoveLink();
		editingLink = false;
	}

	function handleLinkKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			submitLink();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			editingLink = false;
		}
	}
</script>

<div class="toolbar-surface" aria-label="Text formatting">
	{#if editingLink}
		<div class="link-editor">
			<input
				bind:this={linkInput}
				bind:value={href}
				type="url"
				aria-label="Link URL"
				placeholder="https://example.com"
				onkeydown={handleLinkKeydown}
			/>
			<button type="button" aria-label="Apply link" title="Apply link" onclick={submitLink}
				>↵</button
			>
			{#if viewState.link}
				<button
					type="button"
					aria-label="Remove link"
					title="Remove link"
					onclick={() => {
						onRemoveLink();
						editingLink = false;
					}}>×</button
				>
			{/if}
		</div>
	{:else}
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
			aria-label={viewState.link ? 'Edit link' : 'Add link'}
			aria-pressed={viewState.link}
			title={viewState.link ? 'Edit link' : 'Add link'}
			onpointerdown={(event) => event.preventDefault()}
			onclick={openLinkEditor}>↗</button
		>
	{/if}
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

	.link-editor {
		align-items: center;
		display: flex;
		gap: 3px;
	}

	.link-editor input {
		background: var(--base-2);
		border: 1px solid transparent;
		border-radius: calc(var(--radius) * 0.55);
		color: var(--content);
		font: 0.82rem/1.2 var(--font-body);
		min-width: min(17rem, 55vw);
		outline: none;
		padding: 0.48rem 0.6rem;
	}

	.link-editor input:focus {
		border-color: var(--brand);
	}
</style>
