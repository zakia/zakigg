<script lang="ts">
	import {
		addCategory,
		categoryList,
		categoryPath,
		isWithinCategory,
		updateCategory,
		UNCATEGORIZED_ID,
		type CategoryDictionary
	} from './category-model';
	let {
		categories,
		onChange,
		onDelete,
		editableIds
	}: {
		categories: CategoryDictionary;
		onChange: (categories: CategoryDictionary) => void;
		onDelete?: (id: string) => void;
		editableIds?: string[];
	} = $props();
	let error = $state('');
	let newName = $state('');
	let newColor = $state('#7289b9');
	let newParent = $state('');
	const listed = $derived(categoryList(categories));
	const visible = $derived(
		editableIds ? listed.filter((category) => editableIds.includes(category.id)) : listed
	);
	function change(id: string, patch: Parameters<typeof updateCategory>[2]) {
		try {
			onChange(updateCategory(categories, id, patch));
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not update category.';
		}
	}
	function create() {
		try {
			onChange(
				addCategory(categories, {
					name: newName,
					parentId: newParent || null,
					color: newColor,
					kind: 'expense',
					origin: 'user'
				})
			);
			newName = '';
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not add category.';
		}
	}
	function remove(id: string) {
		try {
			onDelete?.(id);
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not delete category.';
		}
	}
</script>

{#if error}<p class="error" role="alert">{error}</p>{/if}
<div class="category-scroll">
	<table>
		<caption class="sr-only">Edit spending category names, colors and hierarchy.</caption>
		<thead
			><tr
				><th>Category</th><th>Parent</th><th>Budget use</th>{#if onDelete}<th
						><span class="sr-only">Actions</span></th
					>{/if}</tr
			></thead
		>
		<tbody>
			{#each visible as category (category.id)}<tr>
					<td
						><div
							class="category-name"
							style={`padding-left:${(categoryPath(categories, category.id).split(' / ').length - 1) * 14}px`}
						>
							<input
								type="color"
								value={category.color}
								aria-label={`Color for ${category.name}`}
								onchange={(event) => change(category.id, { color: event.currentTarget.value })}
							/><input
								type="text"
								value={category.name}
								maxlength="80"
								aria-label={`Name for ${category.name}`}
								onchange={(event) => change(category.id, { name: event.currentTarget.value })}
							/>
						</div></td
					>
					<td
						>{#if category.kind === 'expense'}<select
								aria-label={`Parent for ${category.name}`}
								value={category.parentId ?? ''}
								onchange={(event) =>
									change(category.id, { parentId: event.currentTarget.value || null })}
								><option value="">Top level</option
								>{#each listed.filter((parent) => parent.kind === 'expense' && !isWithinCategory(categories, parent.id, category.id)) as parent (parent.id)}<option
										value={parent.id}>{categoryPath(categories, parent.id)}</option
									>{/each}</select
							>{:else}—{/if}</td
					>
					<td class="muted"
						>{category.kind === 'expense'
							? 'Spending'
							: category.kind === 'income'
								? 'Income'
								: category.kind === 'transfer'
									? 'Transfer'
									: 'Needs review'}</td
					>
					{#if onDelete}<td
							>{#if category.id !== UNCATEGORIZED_ID}<button
									type="button"
									class="quiet"
									aria-label={`Delete ${category.name}`}
									onclick={() => remove(category.id)}>×</button
								>{/if}</td
						>{/if}
				</tr>{/each}
		</tbody>
	</table>
</div>
{#if !editableIds}<form
		onsubmit={(event) => {
			event.preventDefault();
			create();
		}}
	>
		<input type="color" bind:value={newColor} aria-label="New category color" />
		<input
			type="text"
			bind:value={newName}
			maxlength="80"
			placeholder="New category name"
			aria-label="New category name"
			required
		/>
		<select aria-label="Parent for new category" bind:value={newParent}
			><option value="">Top level</option
			>{#each listed.filter((category) => category.kind === 'expense') as category (category.id)}<option
					value={category.id}>{categoryPath(categories, category.id)}</option
				>{/each}</select
		><button type="submit" disabled={!newName.trim()}>Add category</button>
	</form>{/if}

<style>
	.category-scroll {
		overflow: auto;
		border: 1px solid var(--edge);
		border-radius: 8px;
		max-height: 440px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		text-align: left;
	}
	th,
	td {
		padding: 0.55rem 0.7rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: middle;
	}
	th {
		background: var(--base-2);
		color: var(--content-1);
		font-size: 0.72rem;
		font-weight: 500;
	}
	thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}
	tr:last-child td {
		border-bottom: 0;
	}
	button,
	input,
	select {
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		background: var(--base-1);
		color: var(--content);
		font: inherit;
		min-height: 2rem;
		padding: 0.35rem 0.5rem;
	}
	button:disabled {
		opacity: 0.5;
	}
	input[type='color'] {
		width: 2rem;
		flex: 0 0 2rem;
		padding: 0.2rem;
	}
	input[type='text'] {
		min-width: 140px;
		width: 100%;
	}
	.category-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.quiet {
		border-color: transparent;
		background: transparent;
	}
	.muted {
		color: var(--content-1);
		font-size: 0.7rem;
	}
	form {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.8rem;
		margin-top: 1rem;
	}
	form input[type='text'] {
		width: 190px;
		flex: 1;
	}
	form button {
		white-space: nowrap;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
	.error {
		color: var(--error);
		font-size: 0.8rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
</style>
