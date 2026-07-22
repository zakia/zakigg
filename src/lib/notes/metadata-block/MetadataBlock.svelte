<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { dragHandle, dragHandleZone, type DndEvent } from 'svelte-dnd-action';
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import Icon from '$lib/components/Icon.svelte';
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
		setCollapsed: (collapsed: boolean) => void;
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

	let { node, updateProperties, setCollapsed, setAdding, exitBlock }: Props = $props();
	let shell = $state<HTMLElement>();
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
	const showNewPropertyRow = $derived(
		availableProperties.length > 0 && (attrs.adding || addPropertyActive || rows.length === 0)
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

	function handlePropertyKeyInput(event: Event) {
		propertyKeyDraft = (event.currentTarget as HTMLInputElement).value;
		propertyComboboxOpen = true;
		highlightedPropertyIndex = 0;
	}

	function handlePropertyKeyFocus() {
		propertyComboboxOpen = true;
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

		if (rows.length > 0) {
			addPropertyActive = false;
			setAdding(false);
			// The new-property row unmounts under focus; land on the add button.
			void tick().then(() => {
				const keys = getKeyElements();

				keys[keys.length - 1]?.focus();
			});
		}
	}

	function commitPropertyKey() {
		const definition = filteredAvailableProperties[highlightedPropertyIndex];

		if (!definition) return;

		addProperty(definition);
	}

	function getTextValue(value: MetadataPropertyValue) {
		return Array.isArray(value)
			? value.join(', ')
			: typeof value === 'boolean'
				? String(value)
				: value;
	}

	function getListValue(value: MetadataPropertyValue) {
		return Array.isArray(value) ? value : normalizeMetadataList(value);
	}

	function getDateValue(value: MetadataPropertyValue) {
		const raw = getTextValue(value);

		return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
	}

	function commitListDraft(key: string) {
		const draft = listDrafts[key] ?? '';
		const nextItems = normalizeMetadataList(draft);

		if (!nextItems.length) return;

		updateProperty(key, [...getListValue(getEntryValue(key) ?? []), ...nextItems]);
		listDrafts[key] = '';
	}

	function removeListItem(key: string, item: string) {
		updateProperty(
			key,
			getListValue(getEntryValue(key) ?? []).filter((current) => current !== item)
		);
	}

	function handleListKeydown(event: KeyboardEvent, key: string) {
		if ((event.key === 'Enter' && listDrafts[key]) || event.key === ',') {
			event.preventDefault();
			commitListDraft(key);
			return;
		}

		if (event.key !== 'Backspace' || listDrafts[key]) return;
		if (event.metaKey || event.ctrlKey) return;

		const values = getListValue(getEntryValue(key) ?? []);
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

<div class="metadata-shell" class:collapsed={attrs.collapsed} bind:this={shell}>
	<header class="metadata-header">
		<button
			type="button"
			class="collapse-button"
			data-metadata-collapse
			aria-label={attrs.collapsed ? 'Show properties' : 'Hide properties'}
			onclick={() => setCollapsed(!attrs.collapsed)}
		>
			<Icon icon={attrs.collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'} />
		</button>
		<strong>Properties</strong>
	</header>

	{#if !attrs.collapsed}
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
					{@const definition = row.definition}
					<div
						class="metadata-row"
						data-property-key={definition.key}
						role="listitem"
						animate:flip={{ duration: ROW_FLIP_DURATION }}
					>
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
							onkeydown={(event) => handleKeyCellKeydown(event, definition.key)}
						>
							<Icon icon={definition.icon} />
							<span>{definition.label}</span>
						</button>

						<div class="property-control">
							{#if definition.type === 'list'}
								<div class="chip-input">
									{#each getListValue(row.value) as item (item)}
										<span class="chip">
											{item}
											<button
												type="button"
												tabindex={-1}
												aria-label={`Remove ${item}`}
												onclick={() => removeListItem(definition.key, item)}
											>
												<Icon icon="mdi:close" />
											</button>
										</span>
									{/each}
									<input
										aria-label={definition.label}
										data-metadata-field
										placeholder="Empty"
										value={listDrafts[definition.key] ?? ''}
										oninput={(event) => (listDrafts[definition.key] = event.currentTarget.value)}
										onblur={() => commitListDraft(definition.key)}
										onkeydown={(event) => handleListValueKeydown(event, definition.key)}
									/>
								</div>
							{:else if definition.type === 'boolean'}
								<label class="boolean-control">
									<input
										type="checkbox"
										data-metadata-field
										checked={row.value === true}
										onchange={(event) =>
											updateProperty(definition.key, event.currentTarget.checked)}
										onkeydown={(event) => handleValueKeydown(event, { key: definition.key })}
									/>
									<span>{row.value === true ? 'true' : 'false'}</span>
								</label>
							{:else}
								<input
									aria-label={definition.label}
									data-metadata-field
									type={definition.type === 'date' ? 'date' : 'text'}
									placeholder={definition.type === 'date' ? 'yyyy-mm-dd' : 'Empty'}
									value={textDrafts[definition.key] ??
										(definition.type === 'date'
											? getDateValue(row.value)
											: getTextValue(row.value))}
									oninput={(event) => updateTextProperty(definition.key, event.currentTarget.value)}
									onblur={() => clearTextDraft(definition.key)}
									onkeydown={(event) =>
										handleValueKeydown(event, {
											key: definition.key,
											arrows: definition.type !== 'date'
										})}
								/>
							{/if}
						</div>

						<button
							type="button"
							class="remove-property"
							tabindex={-1}
							aria-label={`Remove ${definition.label}`}
							onclick={() => removePropertyAndFocusNeighbor(definition.key)}
						>
							<Icon icon="mdi:close" />
						</button>
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

						<div class="property-key-combobox">
							<input
								bind:this={propertyKeyInput}
								aria-activedescendant={propertyComboboxOpen &&
								filteredAvailableProperties[highlightedPropertyIndex]
									? `${propertyOptionsId}-${filteredAvailableProperties[highlightedPropertyIndex].key}`
									: undefined}
								aria-controls={propertyOptionsId}
								aria-expanded={propertyComboboxOpen}
								aria-label="Property key"
								data-metadata-field
								role="combobox"
								autocomplete="off"
								spellcheck="false"
								value={propertyKeyDraft}
								onblur={handlePropertyKeyBlur}
								onfocus={handlePropertyKeyFocus}
								oninput={handlePropertyKeyInput}
								onkeydown={handlePropertyKeydown}
							/>

							{#if propertyComboboxOpen && filteredAvailableProperties.length}
								<div class="property-menu" id={propertyOptionsId} role="listbox">
									{#each filteredAvailableProperties as definition, index (definition.key)}
										<button
											type="button"
											id={`${propertyOptionsId}-${definition.key}`}
											class:highlighted={index === highlightedPropertyIndex}
											role="option"
											tabindex={-1}
											aria-selected={index === highlightedPropertyIndex}
											onmousedown={(event) => event.preventDefault()}
											onmouseenter={() => (highlightedPropertyIndex = index)}
											onclick={() => addProperty(definition)}
										>
											<Icon icon={definition.icon} />
											<span>{definition.label}</span>
										</button>
									{/each}
								</div>
							{/if}
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

	.metadata-header,
	.metadata-row,
	.property-name,
	.chip-input,
	.chip,
	.property-value-placeholder,
	.boolean-control,
	.add-property,
	.add-property-button,
	.add-property-plus,
	.property-menu button {
		align-items: center;
		display: flex;
	}

	.metadata-header {
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

	button:disabled {
		cursor: default;
		opacity: 0.45;
	}

	button:focus-visible,
	input:focus-visible,
	.drag-handle:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.collapse-button,
	.drag-handle,
	.add-property-plus,
	.remove-property,
	.chip button {
		border-radius: var(--s-5);
		color: var(--content-1);
		display: grid;
		flex: 0 0 auto;
		height: 1.6rem;
		place-items: center;
		width: 1.6rem;
	}

	.collapse-button:hover,
	.drag-handle:hover,
	.add-property-plus:hover,
	.remove-property:hover,
	.chip button:hover {
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

	.drag-handle {
		cursor: grab;
		margin-inline-start: calc(var(--s-5) * -1);
	}

	.drag-handle:active {
		cursor: grabbing;
	}

	.property-name {
		border-radius: var(--s-5);
		color: var(--content-1);
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
	.add-property-button :global(svg),
	.add-property-plus :global(svg),
	.property-menu :global(svg) {
		flex: 0 0 auto;
		height: 1.05rem;
		width: 1.05rem;
	}

	.property-control {
		min-width: 0;
	}

	.metadata-row-new {
		align-items: start;
	}

	.add-property-plus {
		margin-inline-start: calc(var(--s-5) * -1);
		margin-top: 0.2rem;
	}

	.property-key-combobox {
		min-width: 0;
		position: relative;
	}

	.property-key-combobox input {
		font-weight: 720;
	}

	.property-value-placeholder {
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		min-height: 2rem;
		min-width: 0;
		padding-inline: var(--s-3);
	}

	.remove-property-spacer {
		display: block;
		height: 1.6rem;
		width: 1.6rem;
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

	.chip-input {
		border: 1px solid transparent;
		border-radius: var(--s-5);
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

	.chip-input input {
		border: 0;
		flex: 1 1 8rem;
		min-height: 1.7rem;
		padding-inline: var(--s-4);
		width: auto;
	}

	.chip-input input:hover,
	.chip-input input:focus {
		background: transparent;
		border-color: transparent;
		box-shadow: none;
	}

	.chip {
		background: color-mix(in oklch, var(--brand) 18%, transparent);
		border-radius: 999px;
		color: color-mix(in oklch, var(--brand) 68%, var(--content));
		font-weight: 720;
		gap: 0.15rem;
		line-height: 1;
		min-height: 1.55rem;
		padding: 0.1rem 0.1rem 0.1rem var(--s-3);
	}

	.chip button {
		height: 1.25rem;
		width: 1.25rem;
	}

	.boolean-control {
		color: var(--content-1);
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

	.add-property {
		align-items: start;
		color: var(--content-1);
		gap: var(--s-3);
		position: relative;
	}

	.add-property-button {
		border-radius: var(--s-5);
		gap: var(--s-3);
		min-height: 2rem;
		padding: 0 var(--s-3);
	}

	.add-property-button:hover {
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		color: var(--content);
	}

	.property-menu {
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

	.property-menu button {
		border-radius: var(--s-5);
		gap: var(--s-3);
		min-height: 2rem;
		padding: 0 var(--s-3);
		text-align: start;
	}

	.property-menu button:hover,
	.property-menu button.highlighted {
		background: color-mix(in oklch, var(--base) 80%, var(--brand) 8%);
		color: var(--content);
	}

	@media (max-width: 42rem) {
		.metadata-row {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.property-name {
			grid-column: 2 / -1;
		}

		.property-control {
			grid-column: 2 / -1;
		}

		.metadata-row-new .property-key-combobox,
		.metadata-row-new .property-value-placeholder {
			grid-column: 2 / -1;
		}

		.metadata-row-new .remove-property-spacer {
			display: none;
		}
	}
</style>
