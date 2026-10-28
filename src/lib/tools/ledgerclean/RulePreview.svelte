<script lang="ts">
	import { categoryPath, type CategoryDictionary } from './category-model';
	import { assignmentReason, ruleDescription, type RulePreview } from './rules';
	import type { Transaction } from './processing';
	import { formatDate } from '#lib/utils/date.js';
	let {
		preview,
		categories,
		title = 'Matching transactions'
	}: { preview: RulePreview; categories: CategoryDictionary; title?: string } = $props();
	let limit = $state(20);
	const rows = $derived(preview.matches.length ? preview.matches : preview.changed);
	function next(row: Transaction) {
		return preview.transactions.find((item) => item.id === row.id)!;
	}
</script>

<section class="rule-preview" aria-label="Rule change preview">
	<div class="summary" role="status">
		<strong
			>{preview.matches.length} matching transaction{preview.matches.length === 1
				? ''
				: 's'}</strong
		>
		<span
			>{preview.changed.length} category or tag change{preview.changed.length === 1
				? ''
				: 's'}</span
		>
		{#if preview.exceptions.length}<span
				>{preview.exceptions.length} transaction exception{preview.exceptions.length === 1
					? ''
					: 's'} or transfer{preview.exceptions.length === 1 ? '' : 's'} protected</span
			>{/if}
	</div>
	{#if preview.overlaps.length}
		<details class="overlaps">
			<summary
				>{preview.overlaps.length} overlapping match{preview.overlaps.length === 1 ? '' : 'es'} — see
				which rule wins</summary
			>
			<p>
				Transaction exceptions take precedence. Merchant rules run before patterns; the first
				matching rule in each group wins.
			</p>
			<ul>
				{#each preview.overlaps.slice(0, 20) as overlap (overlap.transaction.id)}<li>
						<strong>{overlap.transaction.description}</strong>: {ruleDescription(overlap.winner)} → {categoryPath(
							categories,
							overlap.winner.categoryId
						)}<small
							>Also matches: {overlap.rules
								.filter((rule) => rule !== overlap.winner)
								.map(ruleDescription)
								.join('; ')}</small
						>
					</li>{/each}
			</ul>
		</details>
	{/if}
	{#if rows.length}
		<div class="scroll">
			<table aria-label={title}>
				<thead
					><tr
						><th>Date / description</th><th>Current category</th><th>After saving</th><th
							class="amount">Amount</th
						></tr
					></thead
				>
				<tbody
					>{#each rows.slice(0, limit) as row (row.id)}{@const after = next(row)}<tr
							><td
								><small
									>{formatDate(row.date, {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}</small
								>{row.description}</td
							><td>{categoryPath(categories, row.categoryId)}</td><td
								>{categoryPath(categories, after.categoryId)}<small
									>{assignmentReason(after, preview.rules, categories)}</small
								></td
							><td class="amount"
								>{new Intl.NumberFormat('en-CA', {
									style: 'currency',
									currency: row.currency
								}).format(row.amountCents / 100)}</td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
		{#if rows.length > limit}<button type="button" onclick={() => (limit += 20)}
				>Show more matches</button
			>{/if}
	{:else}<p class="empty">
			No current transactions match. This rule can still match future imports.
		</p>{/if}
</section>

<style>
	.rule-preview {
		margin-top: 1rem;
		font-size: 0.78rem;
	}
	.summary {
		display: flex;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
		color: var(--content-1);
		margin-bottom: 0.75rem;
	}
	.summary strong {
		color: var(--content);
	}
	.scroll {
		overflow: auto;
		max-height: 320px;
		border: 1px solid var(--edge);
		border-radius: 8px;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		text-align: left;
	}
	th,
	td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: top;
	}
	th {
		background: var(--base-2);
		color: var(--content-1);
		font-weight: 500;
		position: sticky;
		top: 0;
	}
	td:first-child {
		min-width: 200px;
	}
	small {
		display: block;
		color: var(--content-1);
		font-size: 0.7rem;
		max-width: 28rem;
		overflow-wrap: anywhere;
	}
	.amount {
		white-space: nowrap;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.overlaps {
		background: var(--base-2);
		border: 1px solid var(--edge);
		padding: 0.7rem;
		border-radius: 8px;
		margin: 0.75rem 0;
	}
	.overlaps summary {
		cursor: pointer;
	}
	.overlaps p {
		color: var(--content-1);
	}
	ul {
		padding-left: 1.1rem;
		max-height: 200px;
		overflow: auto;
	}
	li + li {
		margin-top: 0.5rem;
	}
	.empty {
		color: var(--content-1);
	}
	button {
		font: inherit;
		background: var(--base-1);
		color: var(--content);
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		padding: 0.45rem 0.65rem;
		margin-top: 0.6rem;
		cursor: pointer;
	}
	button:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
</style>
