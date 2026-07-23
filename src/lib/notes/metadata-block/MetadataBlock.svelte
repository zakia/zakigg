<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { dragHandleZone, type DndEvent } from 'svelte-dnd-action';
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import ComboboxInput from '$lib/components/ComboboxInput.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import MetadataPropertyRow from './MetadataPropertyRow.svelte';
	import { focusMetadataField, getMetadataFieldElements } from './focus';
	import {
		METADATA_PROPERTY_DEFINITIONS,
		getMetadataPropertyDefinition,
		normalizeMetadataBlockAttrs,
		normalizeMetadataEntries,
		normalizeMetadataList,
		type MetadataEntry,
		type MetadataPropertyDefinition,
		type MetadataPropertyValue
	} from './config';

	type Props = {
		node: Readable<ProseMirrorNode>;
		updateProperties: (properties: MetadataEntry[]) => void;
		setAdding: (adding: boolean) => void;
		exitBlock: (side: 'before' | 'after') => void;
	};

	type PropertyRow = {
		id: string;
		definition: MetadataPropertyDefinition;
		value: MetadataPropertyValue;
	};

	type ValueFieldOptions = {
		key: string;
		arrows?: boolean;
		enter?: boolean;
	};

	const ROW_FLIP_DURATION = 150;

	let { node, updateProperties, setAdding, exitBlock }: Props = $props();
	let shell = $state<HTMLElement>();
	// Session-only view state: properties always start closed, and toggling
	// must not dirty the document (a persisted attr would bump updatedAt).
	let collapsed = $state(true);
	let addPropertyActive = $state(false);
	let propertyKeyDraft = $state('');
	let propertyComboboxOpen = $state(false);
	let highlightedPropertyIndex = $state(0);
	let propertyKeyInput = $state<HTMLInputElement>();
	let listDrafts = $state<Record<string, string>>({});
	let textDrafts = $state<Record<string, string>>({});
	let newPropertyRowWasVisible = false;
	const propertyOptionsId = `metadata-property-options-${Math.random().toString(36).slice(2)}`;

	const attrs = $derived(normalizeMetadataBlockAttrs($node.attrs));
	const entries = $derived(attrs.properties);
	const rows = $derived(
		entries.map(
			(entry): PropertyRow => ({
				id: entry.key,
				definition: getMetadataPropertyDefinition(entry.key),
				value: entry.value
			})
		)
	);
	// Writable derived: dnd consider/finalize events reassign it mid-drag, and
	// it snaps back to the committed entry order whenever the node attrs change.
	let dndRows = $derived(rows.map((row) => ({ ...row })));
	const availableProperties = $derived(
		METADATA_PROPERTY_DEFINITIONS.filter(
			(definition) => !entries.some((entry) => entry.key === definition.key)
		)
	);
	const filteredAvailableProperties = $derived(
		getFilteredAvailableProperties(propertyKeyDraft, availableProperties)
	);
	// Only user intent (adding/addPropertyActive) opens the picker — every
	// document now carries this block, so an empty one must render compact
	// instead of auto-opening and stealing focus on load.
	const showNewPropertyRow = $derived(
		availableProperties.length > 0 && (attrs.adding || addPropertyActive)
	);

	function commitEntries(next: MetadataEntry[]) {
		updateProperties(normalizeMetadataEntries(next));
	}

	function getEntryValue(key: string) {
		return entries.find((entry) => entry.key === key)?.value;
	}

	function updateProperty(key: string, value: MetadataPropertyValue) {
		commitEntries(entries.map((entry) => (entry.key === key ? { key, value } : entry)));
	}

	function removeProperty(key: string) {
		delete listDrafts[key];
		delete textDrafts[key];
		commitEntries(entries.filter((entry) => entry.key !== key));
	}

	function moveProperty(key: string, direction: -1 | 1) {
		const index = entries.findIndex((entry) => entry.key === key);
		const targetIndex = index + direction;

		if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) return;

		const next = [...entries];
		const [entry] = next.splice(index, 1);

		next.splice(targetIndex, 0, entry);
		commitEntries(next);
	}

	function updateTextProperty(key: string, value: string) {
		textDrafts[key] = value;
		updateProperty(key, value);
	}

	function clearTextDraft(key: string) {
		delete textDrafts[key];
	}

	function addProperty(definition: MetadataPropertyDefinition) {
		commitEntries([...entries, { key: definition.key, value: getEmptyPropertyValue(definition) }]);
		addPropertyActive = false;
		propertyComboboxOpen = false;
		propertyKeyDraft = '';
		highlightedPropertyIndex = 0;
		setAdding(false);
		void tick().then(() => focusValueField(definition.key));
	}

	function beginAddProperty() {
		addPropertyActive = true;
		propertyComboboxOpen = true;
		void tick().then(() => propertyKeyInput?.focus());
	}

	function getEmptyPropertyValue(definition: MetadataPropertyDefinition): MetadataPropertyValue {
		if (definition.type === 'list') return [];
		if (definition.type === 'boolean') return false;

		return '';
	}

	function getFilteredAvailableProperties(
		query: string,
		definitions: MetadataPropertyDefinition[]
	) {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) return definitions;

		return definitions.filter(
			(definition) =>
				definition.label.toLowerCase().includes(normalizedQuery) ||
				definition.key.toLowerCase().includes(normalizedQuery)
		);
	}

	// --- Two-level keyboard model (modeled after Obsidian's properties panel).
	// Property level: key cells (and the add-property button) are the selectable
	// units — Tab/arrows move between them, Enter opens the value for editing,
	// Cmd/Ctrl+Backspace removes the selected property.
	// Edit level: Tab returns to property selection (next property), Shift+Tab
	// selects this property's key, Escape steps back up to the key.

	function getKeyElements() {
		return shell ? [...shell.querySelectorAll<HTMLElement>('[data-metadata-key]')] : [];
	}

	function getValueFields() {
		return shell ? getMetadataFieldElements(shell) : [];
	}

	function focusValueField(key: string) {
		const field = shell?.querySelector<HTMLElement>(
			`.metadata-row[data-property-key="${key}"] [data-metadata-field]`
		);

		if (field) focusMetadataField(field);
	}

	function focusRowKey(key: string) {
		shell?.querySelector<HTMLElement>(`[data-metadata-key][data-key="${key}"]`)?.focus();
	}

	function focusKeyByOffset(from: HTMLElement, direction: 1 | -1) {
		const keys = getKeyElements();
		const index = keys.indexOf(from);
		const next = index >= 0 ? keys[index + direction] : undefined;

		if (next) {
			next.focus();
			return;
		}

		exitBlock(direction === 1 ? 'after' : 'before');
	}

	function focusKeyAfterRow(key: string) {
		const keys = getKeyElements();
		const index = keys.findIndex((element) => element.dataset.key === key);
		const next = keys[index + 1];

		if (next) {
			next.focus();
			return;
		}

		exitBlock('after');
	}

	function focusValueByOffset(from: HTMLElement, direction: 1 | -1) {
		const fields = getValueFields();
		const index = fields.indexOf(from);
		const next = index >= 0 ? fields[index + direction] : undefined;

		if (next) {
			focusMetadataField(next);
			return;
		}

		exitBlock(direction === 1 ? 'after' : 'before');
	}

	function removePropertyAndFocusNeighbor(key: string) {
		const keys = getKeyElements();
		const index = keys.findIndex((element) => element.dataset.key === key);

		removeProperty(key);
		void tick().then(() => {
			const nextKeys = getKeyElements();
			const next = nextKeys[Math.min(Math.max(index, 0), nextKeys.length - 1)];

			if (next) {
				next.focus();
				return;
			}

			exitBlock('after');
		});
	}

	function handleKeyCellKeydown(event: KeyboardEvent, key: string) {
		const target = event.currentTarget as HTMLElement;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			focusValueField(key);
			return;
		}

		if (event.key === 'Tab') {
			event.preventDefault();
			focusKeyByOffset(target, event.shiftKey ? -1 : 1);
			return;
		}

		if (event.key === 'Backspace' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			removePropertyAndFocusNeighbor(key);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			exitBlock('after');
			return;
		}

		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

		event.preventDefault();

		const direction = event.key === 'ArrowDown' ? 1 : -1;

		if (event.altKey) {
			moveProperty(key, direction);
			void tick().then(() => focusRowKey(key));
			return;
		}

		focusKeyByOffset(target, direction);
	}

	function handleValueKeydown(event: KeyboardEvent, options: ValueFieldOptions) {
		const { key, arrows = true, enter = true } = options;
		const target = event.currentTarget as HTMLElement;

		if (event.key === 'Tab') {
			event.preventDefault();

			if (event.shiftKey) {
				focusRowKey(key);
				return;
			}

			focusKeyAfterRow(key);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			focusRowKey(key);
			return;
		}

		if (enter && event.key === 'Enter') {
			event.preventDefault();
			focusKeyAfterRow(key);
			return;
		}

		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

		const direction = event.key === 'ArrowDown' ? 1 : -1;

		if (event.altKey) {
			event.preventDefault();
			moveProperty(key, direction);
			void tick().then(() => target.focus());
			return;
		}

		if (!arrows || event.metaKey || event.ctrlKey) return;

		event.preventDefault();
		focusValueByOffset(target, direction);
	}

	function handleListValueKeydown(event: KeyboardEvent, key: string) {
		handleListKeydown(event, key);

		if (event.defaultPrevented) return;

		handleValueKeydown(event, { key });
	}

	function handleAddButtonKeydown(event: KeyboardEvent) {
		const target = event.currentTarget as HTMLElement;

		if (event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();

			const direction = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;

			focusKeyByOffset(target, direction);
			return;
		}

		if (event.key !== 'Escape') return;

		event.preventDefault();
		exitBlock('after');
	}

	function handlePropertyKeyInput(value: string) {
		propertyKeyDraft = value;
		propertyComboboxOpen = true;
		highlightedPropertyIndex = 0;
	}

	function handlePropertyKeyBlur() {
		window.setTimeout(() => {
			propertyComboboxOpen = false;
		}, 80);
	}

	function handlePropertyKeydown(event: KeyboardEvent) {
		if (event.key === 'Tab') {
			event.preventDefault();

			if (event.shiftKey) {
				const keys = getKeyElements();
				const previous = keys[keys.length - 1];

				if (previous) {
					previous.focus();
					return;
				}

				exitBlock('before');
				return;
			}

			exitBlock('after');
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			propertyComboboxOpen = true;
			highlightedPropertyIndex = Math.min(
				highlightedPropertyIndex + 1,
				Math.max(0, filteredAvailableProperties.length - 1)
			);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			propertyComboboxOpen = true;
			highlightedPropertyIndex = Math.max(0, highlightedPropertyIndex - 1);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			commitPropertyKey();
			return;
		}

		if (event.key !== 'Escape') return;

		event.preventDefault();
		propertyKeyDraft = '';
		propertyComboboxOpen = false;
		addPropertyActive = false;
		setAdding(false);
		// The new-property row unmounts under focus; land on the add button.
		void tick().then(() => {
			const keys = getKeyElements();

			keys[keys.length - 1]?.focus();
		});
	}

	function commitPropertyKey() {
		const definition = filteredAvailableProperties[highlightedPropertyIndex];

		if (!definition) return;

		addProperty(definition);
	}

	function selectPropertyKey(key: string) {
		const definition = availableProperties.find((candidate) => candidate.key === key);

		if (definition) addProperty(definition);
	}

	function commitListDraft(key: string) {
		const draft = listDrafts[key] ?? '';
		const nextItems = normalizeMetadataList(draft);

		if (!nextItems.length) return;

		updateProperty(key, [...getListValue(key), ...nextItems]);
		listDrafts[key] = '';
	}

	function removeListItem(key: string, item: string) {
		updateProperty(
			key,
			getListValue(key).filter((current) => current !== item)
		);
	}

	function getListValue(key: string) {
		const value = getEntryValue(key) ?? [];

		return Array.isArray(value) ? value : normalizeMetadataList(value);
	}

	function handleListKeydown(event: KeyboardEvent, key: string) {
		if ((event.key === 'Enter' && listDrafts[key]) || event.key === ',') {
			event.preventDefault();
			commitListDraft(key);
			return;
		}

		if (event.key !== 'Backspace' || listDrafts[key]) return;
		if (event.metaKey || event.ctrlKey) return;

		const values = getListValue(key);
		if (!values.length) return;

		event.preventDefault();
		updateProperty(key, values.slice(0, -1));
	}

	function handleDndConsider(event: CustomEvent<DndEvent<PropertyRow>>) {
		dndRows = event.detail.items;
	}

	function handleDndFinalize(event: CustomEvent<DndEvent<PropertyRow>>) {
		dndRows = event.detail.items;

		const byKey = new Map(entries.map((entry) => [entry.key, entry]));
		const next = event.detail.items
			.map((item) => byKey.get(item.id))
			.filter((entry): entry is MetadataEntry => Boolean(entry));

		commitEntries(next);
	}

	$effect(() => {
		if (highlightedPropertyIndex < filteredAvailableProperties.length) return;

		highlightedPropertyIndex = Math.max(0, filteredAvailableProperties.length - 1);
	});

	$effect(() => {
		if (!showNewPropertyRow) {
			newPropertyRowWasVisible = false;
			return;
		}

		propertyComboboxOpen = true;

		if (newPropertyRowWasVisible) return;

		newPropertyRowWasVisible = true;
		void tick().then(() => {
			if (showNewPropertyRow) propertyKeyInput?.focus();
		});
	});
</script>

<div class="metadata-shell" class:collapsed bind:this={shell}>
	<header class="metadata-header">
		<button
			type="button"
			class="collapse-button"
			data-metadata-collapse
			aria-label={collapsed ? 'Show properties' : 'Hide properties'}
			onclick={() => (collapsed = !collapsed)}
		>
			<Icon icon={collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'} />
		</button>
		<strong>Properties</strong>
	</header>

	{#if !collapsed}
		<div class="metadata-rows">
			<div
				class="metadata-dnd-rows"
				role="list"
				use:dragHandleZone={{
					items: dndRows,
					flipDurationMs: ROW_FLIP_DURATION,
					dropTargetStyle: {},
					zoneTabIndex: -1
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each dndRows as row (row.id)}
					<div
						class="metadata-row"
						data-property-key={row.definition.key}
						role="listitem"
						animate:flip={{ duration: ROW_FLIP_DURATION }}
					>
						<MetadataPropertyRow
							definition={row.definition}
							value={row.value}
							listDraft={listDrafts[row.definition.key] ?? ''}
							textDraft={textDrafts[row.definition.key]}
							onKeyCellKeydown={(event) => handleKeyCellKeydown(event, row.definition.key)}
							onValueKeydown={(event, options) =>
								handleValueKeydown(event, { key: row.definition.key, ...options })}
							onListKeydown={(event) => handleListValueKeydown(event, row.definition.key)}
							onListDraft={(value) => (listDrafts[row.definition.key] = value)}
							onListCommit={() => commitListDraft(row.definition.key)}
							onListRemoveItem={(item) => removeListItem(row.definition.key, item)}
							onToggle={(checked) => updateProperty(row.definition.key, checked)}
							onTextInput={(value) => updateTextProperty(row.definition.key, value)}
							onTextBlur={() => clearTextDraft(row.definition.key)}
							onRemove={() => removePropertyAndFocusNeighbor(row.definition.key)}
						/>
					</div>
				{/each}
			</div>

			{#if availableProperties.length}
				{#if showNewPropertyRow}
					<div class="metadata-row metadata-row-new">
						<button
							type="button"
							class="add-property-plus"
							tabindex={-1}
							aria-label="Add property"
							onclick={beginAddProperty}
						>
							<Icon icon="mdi:plus" />
						</button>

						<div class="property-key-slot">
							<ComboboxInput
								bind:inputEl={propertyKeyInput}
								data-metadata-field
								options={filteredAvailableProperties.map((definition) => ({
									id: definition.key,
									label: definition.label,
									icon: definition.icon
								}))}
								value={propertyKeyDraft}
								open={propertyComboboxOpen}
								highlightedIndex={highlightedPropertyIndex}
								listboxId={propertyOptionsId}
								label="Property key"
								onInput={handlePropertyKeyInput}
								onFocus={() => (propertyComboboxOpen = true)}
								onBlur={handlePropertyKeyBlur}
								onKeydown={handlePropertyKeydown}
								onSelect={selectPropertyKey}
								onHighlight={(index) => (highlightedPropertyIndex = index)}
							/>
						</div>

						<div class="property-value-placeholder">Empty</div>
						<span class="remove-property-spacer" aria-hidden="true"></span>
					</div>
				{:else}
					<div class="add-property">
						<button
							type="button"
							class="add-property-button"
							data-metadata-key
							onclick={beginAddProperty}
							onkeydown={handleAddButtonKeydown}
						>
							<Icon icon="mdi:plus" />
							<span>Add property</span>
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.metadata-shell {
		color: var(--content);
		display: grid;
		gap: var(--s-3);
		margin-block: var(--s-1) var(--s0);
		max-width: 100%;
		width: 100%;
	}

	.metadata-shell.collapsed {
		margin-block-end: var(--s-1);
	}

	.metadata-header {
		align-items: center;
		display: flex;
		gap: var(--s-3);
		min-height: 2rem;
	}

	.metadata-header strong {
		font-size: var(--s0);
		font-weight: 780;
	}

	button {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		padding: 0;
	}

	button:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.collapse-button,
	.add-property-plus {
		border-radius: var(--s-5);
		color: var(--content-1);
		display: grid;
		flex: 0 0 auto;
		height: 1.6rem;
		place-items: center;
		width: 1.6rem;
	}

	.collapse-button:hover,
	.add-property-plus:hover {
		background: color-mix(in oklch, var(--base-1) 82%, var(--content) 8%);
		color: var(--content);
	}

	.metadata-rows,
	.metadata-dnd-rows {
		display: grid;
		gap: var(--s-4);
	}

	.metadata-dnd-rows {
		outline: none;
	}

	.metadata-row {
		background: transparent;
		display: grid;
		gap: var(--s-3);
		grid-template-columns: auto minmax(8rem, 0.32fr) minmax(0, 1fr) auto;
		min-height: 2.1rem;
		position: relative;
	}

	.metadata-row-new {
		align-items: start;
	}

	.add-property-plus {
		margin-inline-start: calc(var(--s-5) * -1);
		margin-top: 0.2rem;
	}

	.property-key-slot {
		min-width: 0;
	}

	.property-value-placeholder {
		align-items: center;
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		display: flex;
		min-height: 2rem;
		min-width: 0;
		padding-inline: var(--s-3);
	}

	.remove-property-spacer {
		display: block;
		height: 1.6rem;
		width: 1.6rem;
	}

	.add-property {
		align-items: start;
		color: var(--content-1);
		display: flex;
		gap: var(--s-3);
		position: relative;
	}

	.add-property-button {
		align-items: center;
		border-radius: var(--s-5);
		display: flex;
		gap: var(--s-3);
		min-height: 2rem;
		padding: 0 var(--s-3);
	}

	.add-property-button:hover {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		color: var(--content);
	}

	.collapse-button :global(svg),
	.add-property-plus :global(svg),
	.add-property-button :global(svg) {
		flex: 0 0 auto;
		height: 1.05rem;
		width: 1.05rem;
	}

	@media (max-width: 42rem) {
		.metadata-row {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.metadata-row-new .property-key-slot,
		.metadata-row-new .property-value-placeholder {
			grid-column: 2 / -1;
		}

		.metadata-row-new .remove-property-spacer {
			display: none;
		}
	}
</style>
