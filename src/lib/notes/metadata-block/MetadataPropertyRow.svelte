<script lang="ts">
	import { dragHandle } from 'svelte-dnd-action';
	import ChipInput from '$lib/components/ChipInput.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		normalizeMetadataList,
		type MetadataPropertyDefinition,
		type MetadataPropertyValue
	} from './config';

	type Props = {
		definition: MetadataPropertyDefinition;
		value: MetadataPropertyValue;
		listDraft: string;
		textDraft?: string;
		onKeyCellKeydown: (event: KeyboardEvent) => void;
		onValueKeydown: (event: KeyboardEvent, options?: { arrows?: boolean }) => void;
		onListKeydown: (event: KeyboardEvent) => void;
		onListDraft: (value: string) => void;
		onListCommit: () => void;
		onListRemoveItem: (item: string) => void;
		onToggle: (checked: boolean) => void;
		onTextInput: (value: string) => void;
		onTextBlur: () => void;
		onRemove: () => void;
	};

	let {
		definition,
		value,
		listDraft,
		textDraft,
		onKeyCellKeydown,
		onValueKeydown,
		onListKeydown,
		onListDraft,
		onListCommit,
		onListRemoveItem,
		onToggle,
		onTextInput,
		onTextBlur,
		onRemove
	}: Props = $props();

	function getTextValue(current: MetadataPropertyValue) {
		return Array.isArray(current)
			? current.join(', ')
			: typeof current === 'boolean'
				? String(current)
				: current;
	}

	function getListValue(current: MetadataPropertyValue) {
		return Array.isArray(current) ? current : normalizeMetadataList(current);
	}

	function getDateValue(current: MetadataPropertyValue) {
		const raw = getTextValue(current);

		return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
	}
</script>

<div
	class="drag-handle"
	use:dragHandle
	aria-label={`Drag ${definition.label}`}
	title={`Drag ${definition.label}`}
>
	<Icon icon="mdi:drag" />
</div>

<button
	type="button"
	class="property-name"
	data-metadata-key
	data-key={definition.key}
	title={`${definition.label} property`}
	onkeydown={onKeyCellKeydown}
>
	<Icon icon={definition.icon} />
	<span>{definition.label}</span>
</button>

<div class="property-control">
	{#if definition.type === 'list'}
		<ChipInput
			data-metadata-field
			items={getListValue(value)}
			draft={listDraft}
			label={definition.label}
			onDraft={onListDraft}
			onCommit={onListCommit}
			onRemoveItem={onListRemoveItem}
			onKeydown={onListKeydown}
		/>
	{:else if definition.type === 'boolean'}
		<label class="boolean-control">
			<input
				type="checkbox"
				data-metadata-field
				checked={value === true}
				onchange={(event) => onToggle(event.currentTarget.checked)}
				onkeydown={(event) => onValueKeydown(event)}
			/>
			<span>{value === true ? 'true' : 'false'}</span>
		</label>
	{:else}
		<input
			aria-label={definition.label}
			data-metadata-field
			type={definition.type === 'date' ? 'date' : 'text'}
			placeholder={definition.type === 'date' ? 'yyyy-mm-dd' : 'Empty'}
			value={textDraft ?? (definition.type === 'date' ? getDateValue(value) : getTextValue(value))}
			oninput={(event) => onTextInput(event.currentTarget.value)}
			onblur={onTextBlur}
			onkeydown={(event) => onValueKeydown(event, { arrows: definition.type !== 'date' })}
		/>
	{/if}
</div>

<button
	type="button"
	class="remove-property"
	tabindex={-1}
	aria-label={`Remove ${definition.label}`}
	onclick={onRemove}
>
	<Icon icon="mdi:close" />
</button>

<style>
	button {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}

	button:focus-visible,
	input:focus-visible,
	.drag-handle:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.drag-handle,
	.remove-property {
		border-radius: var(--s-5);
		color: var(--content-1);
		display: grid;
		flex: 0 0 auto;
		height: 1.6rem;
		place-items: center;
		width: 1.6rem;
	}

	.drag-handle {
		cursor: grab;
		margin-inline-start: calc(var(--s-5) * -1);
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.drag-handle:hover,
	.remove-property:hover {
		background: color-mix(in oklch, var(--base-1) 82%, var(--content) 8%);
		color: var(--content);
	}

	.property-name {
		align-items: center;
		border-radius: var(--s-5);
		color: var(--content-1);
		display: flex;
		font-weight: 700;
		gap: var(--s-3);
		justify-content: flex-start;
		min-width: 0;
		padding-inline: var(--s-4);
		text-align: start;
	}

	.property-name:hover,
	.property-name:focus-visible {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		color: var(--content);
	}

	.property-name :global(svg),
	.drag-handle :global(svg),
	.remove-property :global(svg) {
		flex: 0 0 auto;
		height: 1.05rem;
		width: 1.05rem;
	}

	.property-control {
		min-width: 0;
	}

	input {
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--s-5);
		color: var(--content);
		font: inherit;
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

	.boolean-control {
		align-items: center;
		color: var(--content-1);
		display: flex;
		gap: var(--s-3);
		min-height: 2rem;
		width: fit-content;
	}

	.boolean-control input {
		accent-color: var(--brand);
		height: 1rem;
		padding: 0;
		width: 1rem;
	}

	@media (max-width: 42rem) {
		.property-name {
			grid-column: 2 / -1;
		}

		.property-control {
			grid-column: 2 / -1;
		}
	}
</style>
