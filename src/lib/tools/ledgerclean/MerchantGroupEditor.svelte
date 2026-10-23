<script lang="ts">
	import {
		combinedMerchantRule,
		previewMerchantRule,
		type MerchantGroup
	} from './merchant-workspace';
	import type { CategoryDictionary } from './category-model';
	import type { Rule, Transaction } from './processing';
	import { patternError } from './rule-pattern';
	import CategoryPicker from './CategoryPicker.svelte';
	import TagPicker from './TagPicker.svelte';
	import type { TagDictionary } from './tags';
	import RuleTransactions from './RuleTransactions.svelte';
	let {
		groups,
		tags,
		transactions,
		rules,
		categories,
		onSave,
		onCancel,
		onDelete
	}: {
		groups: MerchantGroup[];
		tags: TagDictionary;
		transactions: Transaction[];
		rules: Rule[];
		categories: CategoryDictionary;
		onSave: (rule: Rule, groups: MerchantGroup[]) => void;
		onCancel: () => void;
		onDelete: (rule: Rule) => void;
	} = $props();
	// Each editor is keyed by its selection, so the draft starts once and remains user-owned.
	// svelte-ignore state_referenced_locally
	let draft = $state<Rule>(combinedMerchantRule(groups));
	let error = $state('');
	const invalidPattern = $derived(patternError(draft.keyword, draft.match));
	const preview = $derived.by(() => {
		try {
			return { ...previewMerchantRule(transactions, rules, categories, groups, draft), error: '' };
		} catch (cause) {
			return {
				matches: [],
				error: cause instanceof Error ? cause.message : 'Could not preview this group.'
			};
		}
	});
</script>

<section class="editor" aria-label="Edit merchant group">
	<div class="heading">
		<strong
			>{groups.length > 1 ? `Combine ${groups.length} merchants` : 'Edit merchant group'}</strong
		><button type="button" onclick={onCancel}>Cancel</button>
	</div>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			try {
				onSave(draft, groups);
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'Could not save group.';
			}
		}}
	>
		<div class="fields">
			<label
				>Match<select bind:value={draft.match}
					><option value="contains">Substring</option><option value="regex">Regex</option><option
						value="merchant">Merchant prefix</option
					><option value="exact">Exact description</option></select
				></label
			>
			<label class="pattern"
				>Pattern<input
					aria-label="Merchant pattern"
					bind:value={draft.keyword}
					placeholder={draft.match === 'regex' ? 'NAME-?CHEAP' : 'NAME-CHEAP.COM'}
					spellcheck="false"
				/></label
			>
			<div class="category">
				<span>Category</span><CategoryPicker
					{categories}
					value={draft.categoryId}
					label="Combined merchant category"
					onChange={(categoryId) => (draft.categoryId = categoryId)}
				/>
			</div>
		</div>
		<TagPicker
			{tags}
			ids={draft.tagIds ?? []}
			label="combined merchant"
			onChange={(ids) => (draft.tagIds = ids)}
		/>
		{#if invalidPattern}<p role="alert" class="error">{invalidPattern}</p>{:else}
			<RuleTransactions rule={draft} {transactions} {categories} expanded />
		{/if}
		{#if (preview.error && !invalidPattern) || error}<p class="error" role="alert">
				{error || preview.error}
			</p>{/if}
		<div class="actions">
			{#if groups.length === 1 && groups[0].saved}<button
					type="button"
					onclick={() => onDelete(groups[0].rule)}>Remove grouping rule</button
				>{/if}
			<button type="submit" class="primary" disabled={!!preview.error}>Save merchant group</button>
		</div>
	</form>
</section>

<style>
	.editor {
		margin: 1rem 0;
		padding: 1rem;
		background: var(--base-2);
		border: 1px solid var(--edge-1);
		border-radius: 8px;
		font-size: 0.8rem;
	}
	.heading,
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.fields {
		display: flex;
		gap: 0.75rem;
		align-items: end;
		margin: 1rem 0;
		flex-wrap: wrap;
	}
	label,
	.category {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.pattern {
		flex: 1;
		min-width: 200px;
	}
	.category {
		min-width: 220px;
		flex: 1;
	}
	button,
	select,
	input {
		font: inherit;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		background: var(--base-1);
		color: var(--content);
	}
	button {
		cursor: pointer;
	}
	.primary {
		background: var(--content);
		color: var(--base-1);
		margin-left: auto;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.actions {
		margin-top: 1rem;
	}
	.error {
		color: var(--error);
	}
	button:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
</style>
