<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	type Props = {
		items: string[];
		draft: string;
		label: string;
		placeholder?: string;
		onDraft: (value: string) => void;
		onCommit: () => void;
		onRemoveItem: (item: string) => void;
		onKeydown?: (event: KeyboardEvent) => void;
		[attribute: string]: unknown;
	};

	let {
		items,
		draft,
		label,
		placeholder = 'Empty',
		onDraft,
		onCommit,
		onRemoveItem,
		onKeydown,
		...inputAttributes
	}: Props = $props();
</script>

<div class="chip-input">
	{#each items as item (item)}
		<span class="chip">
			{item}
			<button
				type="button"
				tabindex={-1}
				aria-label={`Remove ${item}`}
				onclick={() => onRemoveItem(item)}
			>
				<Icon icon="mdi:close" />
			</button>
		</span>
	{/each}
	<input
		aria-label={label}
		{placeholder}
		value={draft}
		oninput={(event) => onDraft(event.currentTarget.value)}
		onblur={onCommit}
		onkeydown={onKeydown}
		{...inputAttributes}
	/>
</div>

<style>
	.chip-input {
		align-items: center;
		border: 1px solid transparent;
		border-radius: var(--s-5);
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-4);
		min-height: 2rem;
		padding-inline: var(--s-4);
	}

	.chip-input:focus-within,
	.chip-input:hover {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border-color: color-mix(in oklch, var(--edge) 76%, transparent);
	}

	.chip {
		align-items: center;
		background: color-mix(in oklch, var(--brand) 18%, transparent);
		border-radius: 999px;
		color: color-mix(in oklch, var(--brand) 68%, var(--content));
		display: flex;
		font-weight: 720;
		gap: 0.15rem;
		line-height: 1;
		min-height: 1.55rem;
		padding: 0.1rem 0.1rem 0.1rem var(--s-3);
	}

	.chip button {
		appearance: none;
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--brand);
		cursor: pointer;
		display: grid;
		height: 1.25rem;
		padding: 0;
		place-items: center;
		width: 1.25rem;
	}

	.chip button:hover {
		background: color-mix(in oklch, var(--brand) 24%, transparent);
	}

	.chip button:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.chip button :global(svg) {
		height: 0.85rem;
		width: 0.85rem;
	}

	input {
		background: transparent;
		border: 0;
		color: var(--content);
		flex: 1 1 8rem;
		font: inherit;
		min-height: 1.7rem;
		min-width: 0;
		padding: 0 var(--s-4);
	}

	input::placeholder {
		color: color-mix(in oklch, var(--content-1) 62%, transparent);
	}

	input:focus {
		outline: none;
	}
</style>
