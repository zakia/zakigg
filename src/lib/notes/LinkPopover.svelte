<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '@iconify/svelte';
	import type { LinkPopoverState } from './link-popover';

	type LinkPopoverPatch = Partial<Pick<LinkPopoverState, 'href' | 'label' | 'error'>>;
	type Props = {
		popover: LinkPopoverState;
		onUpdate: (patch: LinkPopoverPatch) => void;
		onSubmit: (event: SubmitEvent) => void;
		onEdit: () => void;
		onRemove: () => void;
		onOpen: () => void;
		onCancelClose: () => void;
		onScheduleClose: () => void;
		onKeydown: (event: KeyboardEvent) => void;
	};

	let {
		popover,
		onUpdate,
		onSubmit,
		onEdit,
		onRemove,
		onOpen,
		onCancelClose,
		onScheduleClose,
		onKeydown
	}: Props = $props();
	let labelInput = $state<HTMLInputElement>();
	let hrefInput = $state<HTMLInputElement>();
	let focusedEditingPopover = $state(false);

	$effect(() => {
		if (!popover.visible || !popover.editing) {
			focusedEditingPopover = false;
			return;
		}

		if (focusedEditingPopover) return;

		focusedEditingPopover = true;
		void tick().then(() => {
			if (!popover.visible || !popover.editing || !focusedEditingPopover) return;

			const input = labelInput ?? hrefInput;

			input?.focus();
			input?.select();
		});
	});
</script>

<div
	class={`link-popover placement-${popover.placement}${popover.editing ? ' editing' : ''}`}
	style:left={`${popover.left}px`}
	style:top={`${popover.top}px`}
	role="dialog"
	aria-label="Link editor"
	tabindex="-1"
	onkeydown={onKeydown}
	onpointerenter={() => onCancelClose()}
	onpointerleave={() => onScheduleClose()}
>
	<form class:link-edit-form={popover.editing} class="link-popover-form" onsubmit={onSubmit}>
		{#if popover.editing}
			<div class="link-edit-fields">
				<label class="link-field">
					<span class="link-field-label">Text</span>
					<input
						bind:this={labelInput}
						class="link-input"
						type="text"
						aria-label="Link text"
						placeholder="Text"
						value={popover.label}
						oninput={(event) => onUpdate({ label: event.currentTarget.value })}
					/>
				</label>
				<label class="link-field">
					<span class="link-field-label">Link</span>
					<input
						bind:this={hrefInput}
						class="link-input"
						type="text"
						inputmode="url"
						aria-label="Link URL"
						placeholder="https://example.com"
						value={popover.href}
						oninput={(event) => onUpdate({ href: event.currentTarget.value })}
					/>
				</label>
			</div>
			<button type="submit" class="link-confirm" title="Confirm Link" aria-label="Confirm Link">
				Confirm
			</button>
		{:else}
			<span class="link-preview">{popover.href}</span>
			<button
				type="button"
				class="link-button"
				title="Edit Link"
				aria-label="Edit Link"
				onclick={onEdit}
			>
				<Icon icon="mdi:pencil-outline" />
			</button>
			<button
				type="button"
				class="link-button"
				title="Remove Link"
				aria-label="Remove Link"
				onclick={onRemove}
			>
				<Icon icon="mdi:link-variant-off" />
			</button>
			<button
				type="button"
				class="link-button"
				title="Open Link"
				aria-label="Open Link"
				onclick={onOpen}
			>
				<Icon icon="mdi:open-in-new" />
			</button>
		{/if}

		{#if popover.error}
			<span class="link-error">{popover.error}</span>
		{/if}
	</form>
</div>

<style>
	.link-popover,
	.link-popover-form,
	.link-button,
	.link-confirm {
		align-items: center;
		display: flex;
	}

	.link-popover {
		--link-popover-brand: oklch(65% 0.2 var(--hue, 330));
		--link-popover-brand-content: oklch(100% 0 0);
		--link-popover-content: oklch(36% 0.03 var(--hue, 330));
		--link-popover-edge: oklch(90% 0.012 var(--hue, 330));
		--link-popover-muted: oklch(54% 0.035 var(--hue, 330));
		--link-popover-surface: oklch(100% 0 var(--hue, 330));
		backdrop-filter: blur(16px);
		background: color-mix(in oklch, var(--link-popover-surface) 90%, transparent);
		border: 1px solid color-mix(in oklch, var(--link-popover-edge) 84%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
		color: var(--link-popover-content);
		font-size: var(--s-1);
		gap: var(--s-4);
		max-width: min(22rem, calc(100vw - var(--s1)));
		padding: var(--s-4);
		position: fixed;
		z-index: 5;
	}

	.link-popover.placement-above {
		transform: translate(-50%, calc(-100% - var(--s-3)));
	}

	.link-popover.placement-below {
		transform: translate(-50%, var(--s-4));
	}

	.link-popover.editing {
		background: color-mix(in oklch, var(--link-popover-surface) 96%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 14px 34px rgb(0 0 0 / 0.14);
		max-width: min(30rem, calc(100vw - var(--s0)));
		padding: var(--s-2);
		width: min(30rem, calc(100vw - var(--s0)));
	}

	.link-popover-form {
		gap: var(--s-4);
		min-width: 0;
		width: 100%;
	}

	.link-edit-form {
		align-items: center;
		display: grid;
		gap: var(--s-2);
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.link-preview {
		color: var(--link-popover-content);
		font-size: var(--s-1);
		line-height: 1.2;
		max-width: min(12rem, 42vw);
		overflow: hidden;
		padding: 0 var(--s-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.link-input {
		background: var(--link-popover-surface);
		border: 1px solid var(--link-popover-edge);
		border-radius: var(--s-4);
		color: var(--link-popover-content);
		font: inherit;
		font-size: var(--s-1);
		min-height: 2rem;
		outline: none;
		padding: 0 var(--s-3);
		width: 100%;
	}

	.link-input:focus {
		background: var(--link-popover-surface);
		border-color: var(--link-popover-brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--link-popover-brand) 18%, transparent);
	}

	.link-edit-fields {
		display: grid;
		gap: var(--s-4);
		min-width: 0;
	}

	.link-field {
		align-items: center;
		display: grid;
		gap: var(--s-3);
		grid-template-columns: 2.6rem minmax(0, 1fr);
		min-width: 0;
	}

	.link-field-label {
		color: var(--link-popover-muted);
		font-size: var(--s-1);
		line-height: 1;
		text-align: right;
	}

	.link-button {
		background: transparent;
		border-radius: var(--s-4);
		color: var(--link-popover-muted);
		height: 1.75rem;
		justify-content: center;
		min-width: 1.75rem;
		padding: 0 var(--s-4);
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.link-button:hover,
	.link-button:focus-visible {
		background: color-mix(in oklch, var(--link-popover-brand) 16%, transparent);
		color: var(--link-popover-content);
	}

	.link-button :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.link-confirm {
		background: var(--link-popover-brand);
		border-radius: var(--s-4);
		color: var(--link-popover-brand-content);
		font-size: var(--s-1);
		font-weight: 500;
		height: 2rem;
		justify-content: center;
		padding: 0 var(--s-1);
		transition:
			background-color 0.2s,
			transform 0.2s;
	}

	.link-confirm:hover,
	.link-confirm:focus-visible {
		background: color-mix(in oklch, var(--link-popover-brand) 88%, var(--link-popover-content));
		transform: translateY(-1px);
	}

	.link-error {
		color: var(--error);
		font-size: var(--s-1);
		grid-column: 1 / -1;
		padding-inline: var(--s-2);
	}

	@media (max-width: 42rem) {
		.link-popover.editing {
			padding: var(--s-2);
			width: min(30rem, calc(100vw - var(--s0)));
		}

		.link-edit-form {
			gap: var(--s-1);
			grid-template-columns: 1fr;
		}

		.link-field {
			grid-template-columns: 2.6rem minmax(0, 1fr);
		}

		.link-confirm {
			justify-self: end;
		}
	}
</style>
