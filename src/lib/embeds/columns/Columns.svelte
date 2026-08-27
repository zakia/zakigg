<script lang="ts">
	import CraftDocumentRenderer from '$lib/crafts/CraftDocumentRenderer.svelte';
	import type { ColumnsProps } from './embed';

	let {
		columns,
		gap = 'medium',
		editing = false,
		updateProps
	}: ColumnsProps & {
		editing?: boolean;
		updateProps?: (props: Record<string, unknown>) => void;
	} = $props();

	function updateColumn(index: number, markdown: string) {
		updateProps?.({
			gap,
			columns: columns.map((column, columnIndex) =>
				columnIndex === index ? { ...column, markdown } : column
			)
		});
	}

	function addColumn() {
		if (columns.length >= 4) return;
		updateProps?.({ gap, columns: [...columns, { markdown: 'New column' }] });
	}

	function removeColumn(index: number) {
		if (columns.length <= 2) return;
		updateProps?.({ gap, columns: columns.filter((_, columnIndex) => columnIndex !== index) });
	}

	function columnWidth(value: string | number | undefined) {
		if (typeof value === 'number') return `${value}fr`;
		if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return `${value}fr`;
		return value || '1fr';
	}
</script>

<div
	class="columns-layout"
	class:gap-small={gap === 'small'}
	class:gap-large={gap === 'large'}
	style={`--column-count: ${columns.length}; --column-widths: ${columns.map((column) => columnWidth(column.width)).join(' ')};`}
>
	{#each columns as column, index (index)}
		<section class="column" aria-label={`Column ${index + 1}`}>
			<CraftDocumentRenderer
				document={{ version: 2, format: 'markdown', markdown: column.markdown }}
			/>
			{#if editing && updateProps}
				<label class="column-source">
					<span>Column {index + 1} Markdown</span>
					<textarea
						value={column.markdown}
						oninput={(event) => updateColumn(index, event.currentTarget.value)}
					></textarea>
				</label>
				{#if columns.length > 2}
					<button type="button" class="remove-column" onclick={() => removeColumn(index)}>
						Remove column
					</button>
				{/if}
			{/if}
		</section>
	{/each}
</div>

{#if editing && updateProps && columns.length < 4}
	<button type="button" class="add-column" onclick={addColumn}>Add column</button>
{/if}

<style>
	.columns-layout {
		display: grid;
		gap: var(--s1);
		grid-template-columns: var(--column-widths, repeat(var(--column-count), minmax(0, 1fr)));
		margin: var(--s1) 0;
		min-width: 0;
		width: 100%;
	}

	.columns-layout.gap-small {
		gap: var(--s-1);
	}

	.columns-layout.gap-large {
		gap: var(--s2);
	}

	.column {
		min-width: 0;
	}

	.column :global(.content > :first-child) {
		margin-top: 0;
	}

	.column-source {
		border-top: 1px solid var(--edge);
		display: grid;
		gap: var(--s-4);
		margin-top: var(--s-1);
		padding-top: var(--s-1);
	}

	.column-source span {
		color: var(--content-1);
		font-size: var(--s-2);
		font-weight: 700;
	}

	.column-source textarea {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		font: 0.82rem/1.5 var(--font-mono, monospace);
		min-height: 7rem;
		padding: var(--s-2);
		resize: vertical;
		width: 100%;
	}

	.add-column,
	.remove-column {
		background: transparent;
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content-1);
		font: inherit;
		font-size: var(--s-2);
		padding: var(--s-4) var(--s-2);
	}

	.remove-column {
		margin-top: var(--s-2);
	}

	@media (max-width: 44rem) {
		.columns-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
