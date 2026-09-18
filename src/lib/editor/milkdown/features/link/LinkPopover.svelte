<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { PopoverAttachment } from '$lib/editor/surface/popover-attachment.svelte';
	import type { LinkPopoverState } from './link-popover-state.svelte';

	let {
		viewState,
		surface,
		onOpen,
		onCopy,
		onEdit,
		onCommit,
		onCancel,
		onRemove,
		onPointerEnter,
		onPointerLeave
	}: {
		viewState: LinkPopoverState;
		surface: PopoverAttachment;
		onOpen: () => void;
		onCopy: () => void;
		onEdit: () => void;
		onCommit: () => void;
		onCancel: () => void;
		onRemove: () => void;
		onPointerEnter: () => void;
		onPointerLeave: () => void;
	} = $props();

	let destinationInput = $state<HTMLInputElement>();

	$effect(() => {
		if (!surface.visible || viewState.mode !== 'edit') return;
		void tick().then(() => destinationInput?.focus());
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			onCommit();
		}
	}
</script>

<div
	class="link-popover"
	class:visible={surface.visible}
	class:editing={viewState.mode === 'edit'}
	role={viewState.mode === 'edit' ? 'dialog' : 'toolbar'}
	aria-label={viewState.mode === 'edit' ? 'Edit link' : 'Link actions'}
	aria-hidden={!surface.visible}
	contenteditable="false"
	onpointerenter={onPointerEnter}
	onpointerleave={onPointerLeave}
	{@attach surface.attachment}
>
	{#if viewState.mode === 'preview'}
		<div class="preview-row">
			<button class="destination" type="button" title="Open link" onclick={onOpen}>
				<Icon icon={viewState.target?.kind === 'wiki' ? 'mdi:file-document-outline' : 'mdi:web'} />
				<span>{viewState.destination}</span>
			</button>
			<button
				class="icon-button"
				type="button"
				aria-label="Copy link"
				title={viewState.copied ? 'Copied' : 'Copy link'}
				onclick={onCopy}
			>
				<Icon icon={viewState.copied ? 'mdi:check' : 'mdi:content-copy'} />
			</button>
			<button class="edit-button" type="button" onclick={onEdit}>Edit</button>
		</div>
	{:else}
		<form
			class="edit-form"
			onsubmit={(event) => {
				event.preventDefault();
				onCommit();
			}}
		>
			<label>
				<span>Page or URL</span>
				<input
					bind:this={destinationInput}
					bind:value={viewState.destination}
					autocomplete="off"
					spellcheck="false"
					onkeydown={handleKeydown}
				/>
			</label>
			<label>
				<span>Link title</span>
				<input
					bind:value={viewState.label}
					autocomplete="off"
					spellcheck="true"
					onkeydown={handleKeydown}
				/>
			</label>
			{#if viewState.error}<p class="error" role="alert">{viewState.error}</p>{/if}
			<div class="form-actions">
				{#if viewState.target?.destination}
					<button class="remove-button" type="button" onclick={onRemove}>
						<Icon icon="mdi:trash-can-outline" />
						Remove link
					</button>
				{/if}
				<span class="keyboard-hint">Enter to apply · Esc to cancel</span>
			</div>
		</form>
	{/if}
</div>

<style>
	.link-popover {
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 95%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge-1) 88%, transparent);
		border-radius: calc(var(--radius) * 0.8);
		box-shadow:
			0 0.75rem 2rem rgb(0 0 0 / 0.14),
			0 2px 6px rgb(0 0 0 / 0.06);
		box-sizing: border-box;
		left: -10000px;
		opacity: 0;
		padding: 4px;
		pointer-events: none;
		position: fixed;
		top: -10000px;
		transform: translateY(5px) scale(0.985);
		transform-origin: top left;
		transition:
			opacity 0.14s ease,
			transform 0.14s ease,
			visibility 0s linear 0.14s;
		visibility: hidden;
		z-index: 80;
	}

	.link-popover.visible {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0) scale(1);
		transition-delay: 0s;
		visibility: visible;
	}

	.link-popover.editing {
		padding: var(--s-1);
		width: min(22rem, calc(100vw - 1.25rem));
	}

	.preview-row {
		align-items: center;
		display: flex;
		gap: 2px;
	}

	button {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.5);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font: inherit;
		font-size: var(--s-1);
		min-height: 2rem;
	}

	button:hover,
	button:focus-visible {
		background: var(--base-2);
		color: var(--content);
		outline: none;
	}

	button:focus-visible,
	input:focus-visible {
		box-shadow: var(--focus-ring);
	}

	.destination {
		gap: var(--s-3);
		max-width: min(23rem, 58vw);
		padding-inline: 0.55rem;
	}

	.destination span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.icon-button {
		justify-content: center;
		width: 2rem;
	}

	.edit-button {
		color: var(--content);
		font-weight: 620;
		padding-inline: 0.6rem;
	}

	button :global(svg) {
		flex: 0 0 auto;
		height: 0.95rem;
		width: 0.95rem;
	}

	.edit-form,
	label {
		display: grid;
	}

	.edit-form {
		gap: var(--s-1);
	}

	label {
		gap: var(--s-4);
	}

	label > span {
		color: var(--content-1);
		font-size: var(--s-1);
		font-weight: 620;
	}

	input {
		background: var(--base-2);
		border: 1px solid var(--edge-1);
		border-radius: calc(var(--radius) * 0.55);
		box-sizing: border-box;
		color: var(--content);
		font: 0.86rem/1.25 var(--font-body);
		min-width: 0;
		outline: none;
		padding: 0.55rem 0.65rem;
		width: 100%;
	}

	input:focus {
		border-color: var(--brand);
	}

	.error {
		color: var(--error);
		font-size: var(--s-1);
		margin: 0;
	}

	.form-actions {
		align-items: center;
		border-top: 1px solid var(--edge-1);
		display: flex;
		gap: var(--s-2);
		justify-content: space-between;
		padding-top: var(--s-2);
	}

	.remove-button {
		gap: var(--s-3);
		padding-inline: 0.45rem;
	}

	.keyboard-hint {
		color: var(--content-2);
		font-size: var(--s-2);
	}

	@media (max-width: 30rem) {
		.keyboard-hint {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.link-popover {
			transition: none;
		}
	}
</style>
