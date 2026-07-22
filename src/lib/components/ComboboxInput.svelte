<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	type ComboboxOption = {
		id: string;
		label: string;
		icon?: string;
	};

	type Props = {
		options: ComboboxOption[];
		value: string;
		open: boolean;
		highlightedIndex: number;
		listboxId: string;
		label: string;
		inputEl?: HTMLInputElement;
		onInput: (value: string) => void;
		onFocus?: () => void;
		onBlur?: () => void;
		onKeydown?: (event: KeyboardEvent) => void;
		onSelect: (id: string) => void;
		onHighlight: (index: number) => void;
		[attribute: string]: unknown;
	};

	let {
		options,
		value,
		open,
		highlightedIndex,
		listboxId,
		label,
		inputEl = $bindable(),
		onInput,
		onFocus,
		onBlur,
		onKeydown,
		onSelect,
		onHighlight,
		...inputAttributes
	}: Props = $props();

	const highlighted = $derived(options[highlightedIndex]);
</script>

<div class="combobox">
	<input
		bind:this={inputEl}
		aria-activedescendant={open && highlighted ? `${listboxId}-${highlighted.id}` : undefined}
		aria-controls={listboxId}
		aria-expanded={open}
		aria-label={label}
		role="combobox"
		autocomplete="off"
		spellcheck="false"
		{value}
		onblur={onBlur}
		onfocus={onFocus}
		oninput={(event) => onInput(event.currentTarget.value)}
		onkeydown={onKeydown}
		{...inputAttributes}
	/>

	{#if open && options.length}
		<div class="combobox-menu" id={listboxId} role="listbox">
			{#each options as option, index (option.id)}
				<button
					type="button"
					id={`${listboxId}-${option.id}`}
					class:highlighted={index === highlightedIndex}
					role="option"
					tabindex={-1}
					aria-selected={index === highlightedIndex}
					onmousedown={(event) => event.preventDefault()}
					onmouseenter={() => onHighlight(index)}
					onclick={() => onSelect(option.id)}
				>
					{#if option.icon}
						<Icon icon={option.icon} />
					{/if}
					<span>{option.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.combobox {
		min-width: 0;
		position: relative;
	}

	input {
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--s-5);
		color: var(--content);
		font: inherit;
		font-weight: 720;
		min-height: 2rem;
		min-width: 0;
		padding: 0 var(--s-3);
		width: 100%;
	}

	input::placeholder {
		color: color-mix(in oklch, var(--content-1) 62%, transparent);
	}

	input:hover,
	input:focus {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border-color: color-mix(in oklch, var(--edge) 76%, transparent);
	}

	input:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.combobox-menu {
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 1rem 2rem color-mix(in oklch, black 16%, transparent);
		display: grid;
		gap: var(--s-5);
		left: 0;
		max-height: min(22rem, 52vh);
		min-width: min(16rem, 86vw);
		overflow: auto;
		padding: var(--s-4);
		position: absolute;
		top: calc(100% + var(--s-4));
		z-index: 5;
	}

	.combobox-menu button {
		align-items: center;
		appearance: none;
		background: transparent;
		border: 0;
		border-radius: var(--s-5);
		color: inherit;
		cursor: pointer;
		display: flex;
		font: inherit;
		gap: var(--s-3);
		min-height: 2rem;
		padding: 0 var(--s-3);
		text-align: start;
	}

	.combobox-menu button:hover,
	.combobox-menu button.highlighted {
		background: color-mix(in oklch, var(--base) 80%, var(--brand) 8%);
		color: var(--content);
	}

	.combobox-menu :global(svg) {
		flex: 0 0 auto;
		height: 1.05rem;
		width: 1.05rem;
	}
</style>
