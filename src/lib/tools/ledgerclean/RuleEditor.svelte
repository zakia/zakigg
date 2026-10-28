<script lang="ts">
	import { onMount } from 'svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import TagPicker from './TagPicker.svelte';
	import RulePreview from './RulePreview.svelte';
	import type { CategoryDictionary } from './category-model';
	import type { TagDictionary } from './tags';
	import { validateTagIds } from './tags';
	import type { Rule, Transaction } from './processing';
	import { previewRuleChange, saveEditedRule } from './rules';
	let {
		initial,
		originalKey,
		rules,
		transactions,
		categories,
		tags,
		onSave,
		onCancel
	}: {
		initial: Rule;
		originalKey?: string;
		rules: Rule[];
		transactions: Transaction[];
		categories: CategoryDictionary;
		tags: TagDictionary;
		onSave: (rules: Rule[]) => void | Promise<void>;
		onCancel: () => void;
	} = $props();
	// The parent keys the editor by its selection; the draft remains user-owned.
	// svelte-ignore state_referenced_locally
	let draft = $state<Rule>({ ...$state.snapshot(initial), field: initial.field ?? 'description' });
	let error = $state('');
	let root: HTMLElement;
	let patternInput: HTMLInputElement;
	onMount(() => {
		root.scrollIntoView({ block: 'start', behavior: 'instant' });
		patternInput.focus({ preventScroll: true });
	});
	const preview = $derived.by(() => {
		try {
			validateTagIds(draft.tagIds ?? [], tags);
			const next = saveEditedRule(rules, draft, categories, originalKey);
			return {
				value: previewRuleChange(transactions, rules, next, categories, draft, tags),
				error: ''
			};
		} catch (cause) {
			return {
				value: null,
				error: cause instanceof Error ? cause.message : 'Could not preview rule.'
			};
		}
	});
</script>

<section class="editor" aria-label="Rule editor" bind:this={root}>
	<div class="heading">
		<div>
			<h3>{originalKey ? 'Edit rule' : 'New rule'}</h3>
			<p>Preview the result before applying it to current and future transactions.</p>
		</div>
		<button type="button" onclick={onCancel}>Cancel</button>
	</div>
	<form
		onsubmit={async (event) => {
			event.preventDefault();
			if (!preview.value) return;
			try {
				await onSave(preview.value.rules);
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'Could not save rule.';
			}
		}}
	>
		<div class="fields">
			<label
				>When<select bind:value={draft.match}
					><option value="words">Contains any whole word or phrase</option><option value="merchant"
						>Merchant starts with</option
					><option value="exact">Description is exactly</option><option value="contains"
						>Contains text</option
					><option value="regex">Matches regex</option></select
				></label
			>
			<label class="pattern"
				>{draft.match === 'words' ? 'Words or phrases, separated by commas' : 'Pattern'}<input
					bind:this={patternInput}
					aria-label="Rule pattern"
					bind:value={draft.keyword}
					placeholder={draft.match === 'words'
						? 'coffee, cafe, café'
						: draft.match === 'regex'
							? '^(STARBUCKS|TIM HORTONS)'
							: 'STARBUCKS'}
					spellcheck="false"
					maxlength="500"
				/></label
			>
			<div class="category">
				<span>Assign category</span><CategoryPicker
					{categories}
					value={draft.categoryId}
					label="Rule category"
					onChange={(categoryId) => (draft.categoryId = categoryId)}
				/>
			</div>
		</div>
		<p class="hint">
			{draft.match === 'words'
				? 'Case-insensitive whole words: “bar” won’t match “barber”. Spaces inside a phrase stay together.'
				: draft.match === 'merchant'
					? 'Matches the start of the description at a word boundary, including changing branch or reference numbers.'
					: draft.match === 'regex'
						? 'Case-insensitive RE2 regex. Lookaround and backreferences are not supported.'
						: 'Matching is case-insensitive.'}
		</p>
		<TagPicker
			{tags}
			ids={draft.tagIds ?? []}
			label="rule defaults"
			onChange={(ids) => (draft.tagIds = ids)}
		/>
		<details class="scope">
			<summary>Matching scope</summary>
			<div class="fields">
				<label
					>Field<select bind:value={draft.field}
						><option value="description">Description</option><option value="sourceCategory"
							>Bank category</option
						></select
					></label
				>
				<label
					>Account type<select
						value={draft.accountType ?? ''}
						onchange={(event) =>
							(draft.accountType = (event.currentTarget.value || undefined) as Rule['accountType'])}
						><option value="">All account types</option><option value="cash">Bank / cash</option
						><option value="credit">Credit card</option><option value="unknown">Unknown</option
						></select
					></label
				>
				<label
					>Money direction<select
						value={draft.direction ?? ''}
						onchange={(event) =>
							(draft.direction = (event.currentTarget.value || undefined) as Rule['direction'])}
						><option value="">Both directions</option><option value="out">Money out</option><option
							value="in">Money in</option
						></select
					></label
				>
				<label class="check"
					><input type="checkbox" bind:checked={draft.spendingOnly} />Spending and card refunds only</label
				>
			</div>
		</details>
		<label class="check enabled"
			><input
				type="checkbox"
				checked={draft.enabled !== false}
				onchange={(event) => (draft.enabled = event.currentTarget.checked)}
			/>Rule enabled</label
		>
		{#if preview.value}<RulePreview
				preview={preview.value}
				{categories}
			/>{:else if draft.keyword.trim()}<p class="error" role="alert">{preview.error}</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<span class="hint">Transaction exceptions and transfer handling stay protected.</span><button
				class="primary"
				type="submit"
				disabled={!preview.value}>Save rule</button
			>
		</div>
	</form>
</section>

<style>
	.editor {
		border: 1px solid var(--edge-1);
		border-radius: 10px;
		background: var(--base-1);
		padding: 1.1rem;
		margin: 1rem 0;
		font-size: 0.8rem;
	}
	.heading,
	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.heading h3 {
		font-size: 1rem;
		margin: 0;
	}
	.heading p,
	.hint {
		color: var(--content-1);
		font-size: 0.76rem;
	}
	.heading p {
		margin: 0.3rem 0 0;
	}
	.fields {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
		align-items: end;
		margin: 1rem 0 0.5rem;
	}
	label,
	.category {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.pattern {
		flex: 1;
		min-width: 220px;
	}
	.category {
		min-width: 220px;
		flex: 1;
	}
	input,
	select,
	button {
		font: inherit;
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		padding: 0.5rem 0.65rem;
		background: var(--base-1);
		color: var(--content);
	}
	select {
		max-width: 100%;
	}
	button {
		cursor: pointer;
		white-space: nowrap;
	}
	.primary {
		background: var(--content);
		color: var(--base-1);
		margin-left: auto;
	}
	.actions {
		margin-top: 1rem;
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	.check input {
		accent-color: var(--content);
	}
	.enabled {
		margin-top: 1rem;
	}
	.scope {
		margin-top: 1rem;
	}
	.scope summary {
		color: var(--content-1);
		cursor: pointer;
		width: fit-content;
	}
	.error {
		color: var(--error);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	input:focus-visible,
	select:focus-visible,
	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
	@media (max-width: 600px) {
		.heading {
			align-items: start;
		}
		.fields > label,
		.fields > .category {
			width: 100%;
			min-width: 0;
			flex-basis: 100%;
		}
		.actions {
			align-items: start;
			flex-wrap: wrap;
		}
	}
</style>
