<script lang="ts">
	import { matchingRule, type Rule, type Transaction } from './processing';
	import { categoryPath, type CategoryDictionary } from './category-model';
	import { DEFAULT_TAGS, type TagDictionary } from './tags';
	import { formatDate } from '$lib/utils/date';
	let {
		rule,
		transactions,
		categories,
		matchedRows,
		tags = DEFAULT_TAGS,
		rowTags = new Map<string, string[]>(),
		expanded = false
	}: {
		expanded?: boolean;
		tags?: TagDictionary;
		rowTags?: ReadonlyMap<string, string[]>;
		rule: Rule;
		transactions: readonly Transaction[];
		categories: CategoryDictionary;
		matchedRows?: readonly Transaction[];
	} = $props();
	let limit = $state(20);
	const matches = $derived(
		matchedRows ??
			transactions.filter((row) => matchingRule(row.description, [rule], categories, row.id, row))
	);
	function money(row: Transaction) {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: row.currency }).format(
			row.amountCents / 100
		);
	}
</script>

<details class="matches" open={expanded}>
	<summary aria-label={`View ${matches.length} transactions matching ${rule.keyword}`}
		>{matches.length} transaction{matches.length === 1 ? '' : 's'}</summary
	>
	<div class="scroll">
		<table aria-label={`Transactions matching ${rule.keyword}`}>
			<thead
				><tr
					><th>Date</th><th>Description</th><th>Current category</th><th>Tags</th><th class="amount"
						>Amount</th
					></tr
				></thead
			>
			<tbody
				>{#each matches.slice(0, limit) as row (row.id)}<tr>
						<td>{formatDate(row.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
						<td>{row.description}</td><td
							>{categoryPath(
								categories,
								row.categoryId
							)}{#if row.categoryOverride?.source === 'manual'}<small>Manual assignment</small
								>{/if}</td
						>
						<td
							>{(rowTags.get(row.id) ?? [])
								.map((id) => tags[id]?.name)
								.filter(Boolean)
								.join(', ') || '—'}</td
						>
						<td class="amount">{money(row)}</td>
					</tr>{/each}</tbody
			>
		</table>
		{#if limit < matches.length}<button type="button" onclick={() => (limit += 20)}
				>Show more transactions</button
			>{/if}
	</div>
</details>

<style>
	.matches {
		margin-top: 0.35rem;
		font-size: 0.75rem;
		color: var(--content-1);
	}
	summary {
		cursor: pointer;
		width: fit-content;
		border-radius: 4px;
	}
	.scroll {
		overflow: auto;
		max-height: 320px;
		margin-top: 0.6rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		color: var(--content);
		font-size: 0.72rem;
	}
	th,
	td {
		padding: 0.5rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: top;
	}
	th {
		color: var(--content-1);
		font-weight: 500;
	}
	td:first-child,
	.amount {
		white-space: nowrap;
	}
	.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	small {
		display: block;
		color: var(--content-1);
	}
	button {
		font: inherit;
		background: var(--base-1);
		color: var(--content);
		border: 1px solid var(--edge-1);
		border-radius: 5px;
		padding: 0.35rem 0.6rem;
		margin: 0.6rem 0;
		cursor: pointer;
	}
	summary:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
</style>
