<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { UNCATEGORIZED_ID, categoryPath, type CategoryDictionary } from './category-model';
	import { categorizeWithAi, type TagProposal, needsAiRule, canSuggestCategory } from './ai';
	import { localAi } from './local-ai.svelte';
	import { confidenceLevel, weakestConfidence } from './confidence';
	import {
		workspaceMerchantGroups,
		merchantSpending,
		merchantAiTargets,
		combinedMerchantRule,
		type MerchantGroup
	} from './merchant-workspace';
	import LocalAiButton from './LocalAiButton.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import TagPicker from './TagPicker.svelte';
	import type { TagDictionary } from './tags';
	import type { RecurringSeries } from './recurring';
	import RuleTransactions from './RuleTransactions.svelte';
	import MerchantGroupEditor from './MerchantGroupEditor.svelte';
	import { matchingRule, type Rule, type Transaction } from './processing';
	import type { AiSettings } from './workspace-storage';
	let {
		categories,
		transactions,
		rules,
		blocked = false,
		settings,
		onEnabled,
		onReviewChange,
		onTagsApply,
		onGroupSave,
		onGroupDelete,
		tags,
		rowTags,
		recurring,
		onGroupTagsChange
	}: {
		categories: CategoryDictionary;
		transactions: Transaction[];
		rules: Rule[];
		blocked?: boolean;
		settings: AiSettings;
		onEnabled: () => void;
		onReviewChange: (active: boolean) => void;
		onTagsApply: (proposal: TagProposal, requested: Transaction[]) => void;
		onGroupSave: (rule: Rule, groups: MerchantGroup[]) => void;
		onGroupDelete: (rule: Rule) => void;
		tags: TagDictionary;
		rowTags: Map<string, string[]>;
		recurring: RecurringSeries[];
		onGroupTagsChange: (rule: Rule, ids: string[]) => void;
	} = $props();
	let busy = $state(false),
		preparing = $state(false),
		error = $state(''),
		progress = $state('');
	let search = $state(''),
		filter = $state<'all' | 'review' | 'unused'>('all');
	let selected = $state<string[]>([]),
		editing = $state<MerchantGroup[] | null>(null);
	let proposal = $state<TagProposal | null>(null),
		requested = $state<Transaction[]>([]);
	let lastAutoKey = $state('');
	let controller: AbortController | null = null;
	const groups = $derived(workspaceMerchantGroups(transactions, rules, categories));
	const mappings = $derived(new Map(proposal?.map((item) => [item.transactionId, item])));
	const reviewed = $derived(
		groups.map((group) => {
			const items = group.transactions.map((row) => mappings.get(row.id)).filter((item) => !!item);
			const ids = new Set(items.map((item) => item.categoryId));
			return {
				...group,
				items,
				previousRule: items.find((item) => item.replacesRule)?.replacesRule,
				categoryId: items.length
					? ids.size === 1
						? items[0].categoryId
						: UNCATEGORIZED_ID
					: group.saved
						? group.rule.categoryId
						: UNCATEGORIZED_ID,
				confidence: items.length
					? weakestConfidence(items.map((item) => item.confidence))
					: group.rule.confidence,
				manual: items.length
					? items.every((item) => item.manual)
					: group.saved && group.rule.source === 'manual',
				conflict: ids.size > 1
			};
		})
	);
	const activeGroupCount = $derived(reviewed.filter((g) => g.transactions.length > 0).length);
	const uncategorizedCount = $derived(
		reviewed.filter((g) => g.transactions.length > 0 && g.categoryId === UNCATEGORIZED_ID).length
	);
	const unusedCount = $derived(groups.filter((group) => !group.transactions.length).length);

	const visible = $derived(
		reviewed.filter(
			(group) =>
				(group.rule.keyword.toLowerCase().includes(search.toLowerCase()) ||
					group.transactions.some((row) =>
						row.description.toLowerCase().includes(search.toLowerCase())
					)) &&
				(filter === 'unused' ? !group.transactions.length : !!group.transactions.length) &&
				(filter === 'all' ||
					filter === 'unused' ||
					(filter === 'review' && group.categoryId === UNCATEGORIZED_ID))
		)
	);
	const picked = $derived(groups.filter((group) => selected.includes(group.id)));
	const targets = $derived(merchantAiTargets(visible, rules, categories, selected));
	const aiRows = $derived(targets.rows);
	const aiCount = $derived(targets.groupCount);

	const readyGroups = $derived(
		reviewed.filter(
			(group) =>
				group.items.length > 0 &&
				!group.conflict &&
				group.categoryId !== UNCATEGORIZED_ID &&
				(group.manual || (!!group.confidence && confidenceLevel(group.confidence) !== 'low'))
		)
	);
	const chosen = $derived(
		(selected.length
			? reviewed.filter(
					(group) =>
						selected.includes(group.id) &&
						group.items.length > 0 &&
						!group.conflict &&
						group.categoryId !== UNCATEGORIZED_ID
				)
			: readyGroups
		).flatMap((group) => group.items)
	);
	const active = $derived(busy || preparing || !!proposal || !!editing);
	$effect(() => onReviewChange(active));

	// Automatically pre-fill AI suggestions when the local model is already loaded in memory
	$effect(() => {
		if (
			settings.enabled &&
			localAi.status === 'ready' &&
			!busy &&
			!preparing &&
			!proposal &&
			!editing &&
			!blocked &&
			selected.length === 0 &&
			aiRows.length > 0
		) {
			const key = aiRows.map((row) => row.id).join(',');
			if (key && key !== lastAutoKey) {
				lastAutoKey = key;
				void run();
			}
		}
	});

	onDestroy(() => {
		controller?.abort();
		onReviewChange(false);
	});
	function toggle(ids: string[], checked: boolean) {
		selected = checked
			? [...new Set([...selected, ...ids])]
			: selected.filter((id) => !ids.includes(id));
		const rows = new Set(
			groups
				.filter((group) => ids.includes(group.id))
				.flatMap((group) => group.transactions.map((row) => row.id))
		);
		if (proposal)
			proposal = proposal.map((item) =>
				rows.has(item.transactionId) ? { ...item, reviewed: checked, selected: checked } : item
			);
	}
	function edit(groups: MerchantGroup[]) {
		try {
			combinedMerchantRule(groups);
			editing = $state.snapshot(
				groups.map((group) => {
					const current = reviewed.find((item) => item.id === group.id);
					return {
						...group,
						rule: { ...group.rule, categoryId: current?.categoryId ?? group.rule.categoryId }
					};
				})
			);
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not combine groups.';
		}
	}
	async function afterSave(appliedIds: string[] = []) {
		editing = null;
		selected = [];
		error = '';
		await tick();
		if (proposal) {
			const applied = new Set(appliedIds);
			proposal = proposal.filter((item) => {
				if (applied.has(item.transactionId)) return false;
				const row = transactions.find((row) => row.id === item.transactionId);
				if (!row) return false;
				if (!item.reconsidered) return needsAiRule(row, rules, categories);
				const rule = matchingRule(row.description, rules, categories, row.id, row);
				return (
					canSuggestCategory(row, categories) &&
					JSON.stringify(rule) === JSON.stringify(item.replacesRule)
				);
			});
			if (!proposal.length) proposal = null;
		}
	}

	function acceptItems(items: TagProposal) {
		if (!items.length) return;
		try {
			const ids = new Set(items.map((item) => item.transactionId));
			const ready = items.map((item) => ({ ...item, selected: true, reviewed: true }));
			onTagsApply(
				ready,
				requested.filter((row) => ids.has(row.id))
			);
			void afterSave(items.map((item) => item.transactionId));
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save categories.';
		}
	}

	function setCategory(group: (typeof reviewed)[number], categoryId: string) {
		if (group.items.length && proposal) {
			const ids = new Set(group.transactions.map((row) => row.id));
			proposal = proposal.map((item) =>
				ids.has(item.transactionId)
					? {
							...item,
							categoryId,
							manual: true,
							reviewed: true,
							selected: categoryId !== UNCATEGORIZED_ID
						}
					: item
			);
			return;
		}
		if (categoryId === UNCATEGORIZED_ID && !group.saved) return;
		try {
			onGroupSave({ ...group.rule, categoryId, source: 'manual', confidence: undefined }, [group]);
			void afterSave();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save category.';
		}
	}
	async function run() {
		if (busy || proposal || blocked || !aiRows.length) return;
		error = '';
		busy = true;
		const reconsider = selected.length > 0;
		requested = $state.snapshot(aiRows);
		const abort = new AbortController();
		controller = abort;
		try {
			proposal = await categorizeWithAi(
				localAi.classify,
				requested,
				$state.snapshot(categories),
				abort.signal,
				(done, total) => (progress = `${done} of ${total} scored`),
				'',
				$state.snapshot(transactions),
				$state.snapshot(rules),
				{ reconsider }
			);
			selected = [];
		} catch (cause) {
			if (!abort.signal.aborted)
				error = cause instanceof Error ? cause.message : 'Could not categorize.';
		} finally {
			busy = false;
			controller = null;
		}
	}
</script>

<section class="workspace" aria-label="Merchant groups">
	<div class="toolbar">
		<div class="filter-pills" role="group" aria-label="Filter merchants">
			<button
				type="button"
				class="pill-tab"
				class:active={filter === 'all'}
				aria-pressed={filter === 'all'}
				onclick={() => (filter = 'all')}
			>
				All merchants <span class="count">{activeGroupCount}</span>
			</button>
			<button
				type="button"
				class="pill-tab"
				class:active={filter === 'review'}
				aria-pressed={filter === 'review'}
				onclick={() => (filter = 'review')}
			>
				Uncategorized <span class="count">{uncategorizedCount}</span>
			</button>
			{#if unusedCount}
				<button
					type="button"
					class="pill-tab"
					class:active={filter === 'unused'}
					aria-pressed={filter === 'unused'}
					onclick={() => (filter = 'unused')}
				>
					Unused rules <span class="count">{unusedCount}</span>
				</button>
			{/if}
		</div>

		<input
			type="search"
			class="search-input"
			aria-label="Search merchants"
			placeholder="Search merchants…"
			bind:value={search}
		/>

		<div class="ai-actions">
			{#if busy}
				<span class="status-text" role="status">{progress || 'Categorizing…'}</span>
				<button type="button" onclick={() => controller?.abort()}>Cancel</button>
			{:else if proposal}
				{#if chosen.length}
					<button type="button" class="primary" onclick={() => acceptItems(chosen)}>
						{selected.length
							? `Accept selected (${selected.length})`
							: `Accept all suggestions (${readyGroups.length})`}
					</button>
				{/if}
				<button
					type="button"
					class="quiet"
					onclick={() => {
						proposal = null;
						selected = [];
					}}>Dismiss</button
				>
			{:else}
				<LocalAiButton
					enabled={settings.enabled}
					disabled={blocked || !!editing || !aiRows.length}
					label={`${selected.length ? 'Reconsider selected' : 'Suggest categories'} (${aiCount})`}
					{onEnabled}
					onRun={run}
					onActiveChange={(value) => (preparing = value)}
				/>
			{/if}
		</div>
	</div>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<fieldset disabled={blocked || busy || preparing}>
		{#if selected.length > 0}
			<div class="selection-bar">
				<span><strong>{selected.length}</strong> merchant{selected.length === 1 ? '' : 's'} selected</span>
				<div class="selection-actions">
					<button type="button" disabled={picked.length < 2} onclick={() => edit(picked)}>
						Combine into 1 rule
					</button>
					<button type="button" class="quiet" onclick={() => (selected = [])}>
						Clear selection
					</button>
				</div>
			</div>
		{/if}

		{#if editing}{#key editing.map((group) => group.id).join('|')}<MerchantGroupEditor
					groups={editing}
					{tags}
					{transactions}
					{rules}
					{categories}
					onCancel={() => (editing = null)}
					onSave={(rule, groups) => {
						onGroupSave(rule, groups);
						void afterSave();
					}}
					onDelete={(rule) => {
						onGroupDelete(rule);
						void afterSave();
					}}
				/>{/key}{/if}

		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table needs keyboard access.) -->
		<div class="scroll" tabindex="0" role="region" aria-label="Merchant categorization rules">
			<table aria-label="Merchant categorization rules">
				<thead>
					<tr>
						<th scope="col" class="check-col">
							<input
								type="checkbox"
								aria-label="Select visible merchants"
								checked={!!visible.length && visible.every((group) => selected.includes(group.id))}
								indeterminate={visible.some((group) => selected.includes(group.id)) &&
									!visible.every((group) => selected.includes(group.id))}
								onchange={(event) =>
									toggle(
										visible.map((group) => group.id),
										event.currentTarget.checked
									)}
							/>
						</th>
						<th scope="col">Merchant</th>
						<th scope="col">Category & tags</th>
						<th scope="col" class="action-col"><span class="sr-only">Rule actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each visible as group (group.id)}
						{@const hasSuggestion =
							group.items.length > 0 && !group.conflict && group.categoryId !== UNCATEGORIZED_ID}
						<tr
							class:selected={selected.includes(group.id)}
							class:is-suggested={hasSuggestion}
						>
							<td class="check-col" data-label="Select">
								<input
									type="checkbox"
									aria-label={`Select merchant ${group.rule.keyword}`}
									checked={selected.includes(group.id)}
									onchange={(event) => toggle([group.id], event.currentTarget.checked)}
								/>
							</td>
							<td class="merchant" data-label="Merchant">
								<div class="merchant-line">
									<strong>{group.rule.keyword}</strong>
									{#each merchantSpending(group.transactions, categories) as total (total.currency)}
										<span
											class="merchant-total"
											title="Net spending after refunds"
											aria-label={`Net spending for ${group.rule.keyword} in ${total.currency}`}
										>
											{new Intl.NumberFormat('en-CA', {
												style: 'currency',
												currency: total.currency,
												currencyDisplay: 'code'
											}).format(total.amountCents / 100)}
										</span>
									{/each}
								</div>
								<div class="merchant-meta">
									<RuleTransactions
										rule={group.rule}
										matchedRows={group.transactions}
										{transactions}
										{categories}
										{tags}
										{rowTags}
									/>
									{#if recurring.some((series) => group.transactions.some((row) => series.transactionIds.includes(row.id)))}
										<span class="pattern-badge">
											↻ {group.transactions.filter((row) =>
												recurring.some((series) => series.transactionIds.includes(row.id))
											).length} recurring
										</span>
									{/if}
								</div>
							</td>
							<td class="category-td" data-label="Category & tags">
								<div class="category-tags">
									<CategoryPicker
										{categories}
										value={group.categoryId}
										label={`Category for merchant ${group.rule.keyword}`}
										onChange={(categoryId) => setCategory(group, categoryId)}
									/>
									<TagPicker
										{tags}
										ids={group.rule.tagIds ?? []}
										label={`merchant ${group.rule.keyword}`}
										disabled={blocked || busy || preparing || !!group.items.length}
										onChange={(ids) => onGroupTagsChange(group.rule, ids)}
									/>
									{#if group.conflict}
										<span class="status-pill conflict">Conflicting suggestions</span>
									{:else if hasSuggestion}
										<span class="status-pill suggested">
											{group.manual ? 'Edited' : 'AI suggestion'}
										</span>
										<button
											type="button"
											class="accept-btn"
											aria-label={`Accept category for ${group.rule.keyword}`}
											onclick={() => acceptItems(group.items)}
										>
											Accept
										</button>
									{/if}
								</div>
								{#if group.previousRule}
									<small class="previous">
										Previously saved: {categoryPath(categories, group.previousRule.categoryId)}
									</small>
								{/if}
							</td>
							<td class="action-col" data-label="Rule">
								<button
									type="button"
									class="quiet edit-rule-btn"
									aria-label={`Edit matching pattern for ${group.rule.keyword}`}
									onclick={() => edit([group])}
								>
									Edit rule
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if !visible.length}
				<p class="empty">
					{transactions.length
						? 'No merchants match this filter.'
						: 'Import transactions to start organizing merchants.'}
				</p>
			{/if}
		</div>
	</fieldset>
</section>

<style>
	.workspace {
		font-size: 0.8125rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.filter-pills {
		display: inline-flex;
		align-items: center;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 8px;
		padding: 0.2rem;
		gap: 0.15rem;
	}
	.pill-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 0;
		background: transparent;
		color: var(--content-1);
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 500;
	}
	.pill-tab:hover {
		color: var(--content);
	}
	.pill-tab.active {
		background: var(--base-1);
		color: var(--content);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
	}
	.count {
		font-size: 0.7rem;
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
	}
	.search-input {
		flex: 1;
		min-width: 190px;
	}
	.ai-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.status-text {
		color: var(--content-1);
		font-size: 0.78rem;
	}
	.selection-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.9rem;
		margin-bottom: 0.75rem;
		background: var(--base-2);
		border: 1px solid var(--edge-1);
		border-radius: 8px;
	}
	.selection-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.scroll {
		overflow: auto;
		container-type: inline-size;
		border: 1px solid var(--edge);
		border-radius: 10px;
		background: var(--base-1);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	thead {
		position: sticky;
		inset-block-start: 0;
		z-index: 1;
	}
	th,
	td {
		padding: 0.75rem 0.9rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: top;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	tbody tr:hover {
		background: color-mix(in oklch, var(--base-2) 45%, var(--base-1));
	}
	th {
		background: var(--base-2);
		color: var(--content-1);
		font-size: 0.74rem;
		font-weight: 500;
	}
	.check-col {
		width: 2.25rem;
		padding-right: 0;
	}
	.action-col {
		width: 1%;
		white-space: nowrap;
		text-align: right;
	}
	.merchant {
		min-width: 260px;
		width: 38%;
	}
	.merchant-line {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.merchant-line strong {
		flex: 1;
	}
	.merchant-total {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--content-1);
		font-size: 0.75rem;
	}
	.merchant-meta {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.pattern-badge {
		color: var(--content-1);
		font-size: 0.7rem;
		white-space: nowrap;
	}
	.category-td {
		min-width: 240px;
	}
	.category-tags {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.category-tags > :global(.combobox) {
		flex: 1 0 12.5rem;
		max-width: 19rem;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.5rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 500;
		white-space: nowrap;
	}
	.status-pill.suggested {
		background: color-mix(in oklch, var(--info) 18%, var(--base-2));
		border: 1px solid color-mix(in oklch, var(--info) 45%, var(--edge));
		color: var(--content);
	}
	.status-pill.conflict {
		background: color-mix(in oklch, var(--error) 14%, var(--base-2));
		color: var(--error);
	}
	.accept-btn {
		padding: 0.25rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 500;
		border-radius: 6px;
		border: 1px solid var(--content);
		background: var(--content);
		color: var(--base-1);
	}
	.edit-rule-btn {
		font-size: 0.74rem;
		padding: 0.3rem 0.5rem;
		opacity: 0.75;
	}
	tr:hover .edit-rule-btn,
	.edit-rule-btn:focus-visible {
		opacity: 1;
	}
	.previous {
		display: block;
		margin-top: 0.3rem;
		color: var(--content-1);
		font-size: 0.7rem;
	}
	strong {
		font-weight: 550;
	}
	input[type='checkbox'] {
		margin-top: 0.4rem;
		width: 15px;
		height: 15px;
		accent-color: var(--content);
		cursor: pointer;
	}
	input,
	button {
		font: inherit;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		background: var(--base-1);
		color: var(--content);
	}
	button {
		cursor: pointer;
		white-space: nowrap;
	}
	.primary {
		background: var(--content);
		border-color: var(--content);
		color: var(--base-1);
	}
	.quiet {
		background: transparent;
		border-color: transparent;
		color: var(--content-1);
	}
	.quiet:hover:not(:disabled) {
		background: var(--base-2);
		color: var(--content);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.selected {
		background: var(--base-2);
	}
	.is-suggested {
		background: color-mix(in oklch, var(--info) 5%, var(--base-1));
	}
	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--content-1);
	}
	.error {
		color: var(--error);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
	input:focus-visible,
	button:focus-visible,
	.scroll:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 2px;
	}
	@container (width < 600px) {
		thead {
			display: none;
		}
		tbody tr {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr) auto;
			gap: 0.4rem 0.6rem;
			padding: 0.75rem;
			border-bottom: 1px solid var(--edge);
			align-items: start;
		}
		tbody tr:last-child {
			border-bottom: 0;
		}
		td {
			padding: 0;
			border-bottom: 0;
			min-width: 0;
		}
		.check-col {
			grid-column: 1;
			grid-row: 1;
			width: auto;
		}
		.merchant {
			grid-column: 2;
			grid-row: 1;
			width: auto;
			min-width: 0;
		}
		.action-col {
			grid-column: 3;
			grid-row: 1;
			width: auto;
		}
		.category-td {
			grid-column: 1 / -1;
			grid-row: 2;
			min-width: 0;
			padding-top: 0.25rem;
		}
		.category-tags > :global(.combobox) {
			max-width: none;
		}
		.edit-rule-btn {
			opacity: 1;
		}
	}
</style>
