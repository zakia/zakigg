<script lang="ts">
	import { onDestroy } from 'svelte';
	import { budgetFlow } from './activity';
	import { UNCATEGORIZED_ID, categoryPath, type CategoryDictionary } from './category-model';
	import { groupMerchantTransactions } from './merchants';
	import { combinedMerchantRule, merchantSpending } from './merchant-workspace';
	import {
		matchingRule,
		clearCategoryOverride,
		normalizeDescription,
		ruleKey,
		type Rule,
		type Transaction
	} from './processing';
	import {
		assignmentReason,
		isMerchantRule,
		moveRule,
		orderedRules,
		previewRuleChange,
		ruleDescription,
		searchableRule,
		type RulePreview as Preview
	} from './rules';
	import type { TagDictionary } from './tags';
	import CategoryPicker from './CategoryPicker.svelte';
	import RuleTransactions from './RuleTransactions.svelte';
	import RuleEditor from './RuleEditor.svelte';
	import RulePreview from './RulePreview.svelte';
	let {
		transactions,
		rules,
		categories,
		tags,
		rowTags,
		blocked = false,
		initialRule,
		releaseExceptionId,
		onChange,
		onEditingChange
	}: {
		transactions: Transaction[];
		rules: Rule[];
		categories: CategoryDictionary;
		tags: TagDictionary;
		rowTags: ReadonlyMap<string, string[]>;
		blocked?: boolean;
		initialRule?: Rule;
		releaseExceptionId?: string;
		onChange: (rules: Rule[], releaseExceptionId?: string) => void | Promise<void>;
		onEditingChange: (active: boolean) => void;
	} = $props();
	type Editing = { rule: Rule; originalKey?: string; key: number; releaseExceptionId?: string };
	// The parent keys this workspace when opening a merchant rule from the ledger.
	// svelte-ignore state_referenced_locally
	let editing = $state<Editing | null>(
		initialRule
			? {
					rule: { ...rules.find((rule) => ruleKey(rule) === ruleKey(initialRule)), ...initialRule },
					releaseExceptionId,
					key: 0,
					originalKey: rules.find((rule) => ruleKey(rule) === ruleKey(initialRule))
						? ruleKey(initialRule)
						: undefined
				}
			: null
	);
	let pending = $state<{ title: string; preview: Preview } | null>(null);
	let pendingElement = $state<HTMLElement>();
	$effect(() => {
		if (pending && pendingElement)
			pendingElement.scrollIntoView({ block: 'start', behavior: 'instant' });
	});
	let section = $state<'merchants' | 'rules'>('merchants');
	let filter = $state<'all' | 'uncategorized'>('all');
	let search = $state('');
	let selected = $state<string[]>([]);
	let limit = $state(50);
	let applying = $state(false);
	let error = $state('');
	let notice = $state('');
	let editId = 0;
	const sorted = $derived(orderedRules(rules));
	const merchantGroups = $derived(
		groupMerchantTransactions(
			transactions.filter((row) => budgetFlow(row, categories) === 'expense'),
			transactions
		).map((group) => ({
			...group,
			categoryId: group.transactions.every(
				(row) => row.categoryId === group.transactions[0].categoryId
			)
				? group.transactions[0].categoryId
				: UNCATEGORIZED_ID,
			mixed: new Set(group.transactions.map((row) => row.categoryId)).size > 1
		}))
	);
	const unmatched = $derived(
		merchantGroups.filter((group) =>
			group.transactions.some((row) => row.categoryId === UNCATEGORIZED_ID)
		).length
	);
	const query = $derived(normalizeDescription(search));
	const filteredMerchants = $derived(
		merchantGroups
			.filter(
				(group) =>
					(filter === 'all' ||
						group.transactions.some((row) => row.categoryId === UNCATEGORIZED_ID)) &&
					normalizeDescription(group.rule.keyword).includes(query)
			)
			.sort((a, b) => a.rule.keyword.localeCompare(b.rule.keyword))
	);
	const filteredRules = $derived(
		sorted.filter((rule) => searchableRule(rule, categories).includes(query))
	);
	const visibleMerchants = $derived(filteredMerchants.slice(0, limit));
	const visibleRules = $derived(filteredRules.slice(0, limit));
	$effect(() => onEditingChange(!!editing || !!pending || applying));
	let filterKey = '';
	$effect(() => {
		const next = JSON.stringify([search, section, filter]);
		if (next !== filterKey) {
			filterKey = next;
			limit = 50;
		}
	});
	onDestroy(() => onEditingChange(false));
	function edit(rule: Rule, existing = false) {
		error = '';
		notice = '';
		pending = null;
		const saved = existing ? rules.find((item) => ruleKey(item) === ruleKey(rule)) : undefined;
		editing = {
			rule: saved ? { ...saved, ...rule } : rule,
			originalKey: saved ? ruleKey(saved) : undefined,
			key: ++editId
		};
	}
	function editMerchant(group: (typeof merchantGroups)[number], categoryId = group.categoryId) {
		const existing = rules.find((rule) => ruleKey(rule) === ruleKey(group.rule));
		edit({ ...group.rule, ...existing, categoryId, source: 'manual' }, !!existing);
	}
	function combine() {
		try {
			const groups = merchantGroups
				.filter((group) => selected.includes(group.id))
				.map((group) => ({ ...group, saved: false }));
			edit(combinedMerchantRule(groups));
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not combine merchants.';
		}
	}
	function toggle(id: string, checked: boolean) {
		selected = checked ? [...selected, id] : selected.filter((value) => value !== id);
	}
	function change(title: string, next: Rule[], focus?: Rule) {
		editing = null;
		notice = '';
		pending = {
			title,
			preview: previewRuleChange(transactions, rules, next, categories, focus, tags)
		};
	}
	async function apply(next: Rule[]) {
		if (applying) return;
		applying = true;
		try {
			const basis = editing?.releaseExceptionId
				? clearCategoryOverride(transactions, editing.releaseExceptionId)
				: transactions;
			const count = previewRuleChange(basis, rules, next, categories, undefined, tags).changed
				.length;
			await onChange(next, editing?.releaseExceptionId);
			editing = null;
			pending = null;
			selected = [];
			error = '';
			notice = `Rules updated. ${count} transaction${count === 1 ? '' : 's'} updated.`;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not save rules.';
		} finally {
			applying = false;
		}
	}
</script>

<section class="workspace" aria-label="Merchant rules workspace">
	<div class="intro">
		<div>
			<h2>Merchants & rules</h2>
			<p>
				Transaction exceptions first, then merchant rules, then patterns. Rules apply to future
				imports too.
			</p>
		</div>
		<button
			type="button"
			class="primary"
			disabled={blocked || applying}
			onclick={() =>
				edit({
					keyword: '',
					match: 'words',
					field: 'description',
					categoryId: UNCATEGORIZED_ID,
					spendingOnly: true,
					enabled: true,
					source: 'manual'
				})}>+ New rule</button
		>
	</div>
	<div class="toolbar">
		<div class="tabs" role="group" aria-label="Merchant workspace section">
			<button
				type="button"
				class:active={section === 'merchants'}
				aria-pressed={section === 'merchants'}
				onclick={() => {
					section = 'merchants';
					search = '';
				}}>Merchants <span>{merchantGroups.length}</span></button
			><button
				type="button"
				class:active={section === 'rules'}
				aria-pressed={section === 'rules'}
				onclick={() => {
					section = 'rules';
					search = '';
				}}>Rules <span>{rules.length}</span></button
			>
		</div>
		{#if section === 'merchants'}<select aria-label="Filter merchants" bind:value={filter}
				><option value="all">All merchants ({merchantGroups.length})</option><option
					value="uncategorized">Uncategorized ({unmatched})</option
				></select
			>{/if}
		<input
			type="search"
			aria-label={section === 'merchants' ? 'Search merchants' : 'Search rules'}
			placeholder={section === 'merchants' ? 'Search merchants…' : 'Search patterns or categories…'}
			bind:value={search}
		/>
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}{#if notice}<p
			class="notice"
			role="status"
		>
			{notice}
		</p>{/if}
	<fieldset disabled={blocked || applying}>
		{#if editing}{#key editing.key}<RuleEditor
					initial={editing.rule}
					originalKey={editing.originalKey}
					{rules}
					transactions={editing.releaseExceptionId
						? clearCategoryOverride(transactions, editing.releaseExceptionId)
						: transactions}
					{categories}
					{tags}
					onSave={apply}
					onCancel={() => (editing = null)}
				/>{/key}{/if}
		{#if pending}<section
				class="pending"
				aria-label="Confirm rule change"
				bind:this={pendingElement}
			>
				<div class="intro">
					<h3>{pending.title}</h3>
					<button type="button" onclick={() => (pending = null)}>Cancel</button>
				</div>
				<RulePreview preview={pending.preview} {categories} />
				<div class="confirm-actions">
					<button
						type="button"
						class="primary"
						onclick={() => pending && apply(pending.preview.rules)}>Apply change</button
					>
				</div>
			</section>{/if}
		{#if section === 'merchants'}
			{#if selected.length}<div class="selection">
					<strong>{selected.length} merchants selected</strong><button
						type="button"
						onclick={combine}>Create shared rule</button
					><button type="button" class="quiet" onclick={() => (selected = [])}
						>Clear selection</button
					>
				</div>{/if}
			<div class="scroll">
				<table aria-label="Merchants">
					<thead
						><tr
							><th class="check"
								><input
									type="checkbox"
									aria-label="Select visible merchants"
									checked={!!visibleMerchants.length &&
										visibleMerchants.every((group) => selected.includes(group.id))}
									indeterminate={visibleMerchants.some((group) => selected.includes(group.id)) &&
										!visibleMerchants.every((group) => selected.includes(group.id))}
									onchange={(event) => {
										const ids = visibleMerchants.map((group) => group.id);
										selected = event.currentTarget.checked
											? [...new Set([...selected, ...ids])]
											: selected.filter((id) => !ids.includes(id));
									}}
								/></th
							><th>Merchant</th><th>Category & tags</th><th><span class="sr-only">Actions</span></th
							></tr
						></thead
					><tbody>
						{#each visibleMerchants as group (group.id)}<tr
								><td class="check"
									><input
										type="checkbox"
										aria-label={`Select merchant ${group.rule.keyword}`}
										checked={selected.includes(group.id)}
										onchange={(event) => toggle(group.id, event.currentTarget.checked)}
									/></td
								><td class="merchant"
									><div class="merchant-title">
										<strong>{group.rule.keyword}</strong><span class="money"
											>{merchantSpending(group.transactions, categories)
												.map((total) =>
													new Intl.NumberFormat('en-CA', {
														style: 'currency',
														currency: total.currency,
														currencyDisplay: 'code'
													}).format(total.amountCents / 100)
												)
												.join(' · ')}</span
										>
									</div>
									<RuleTransactions
										rule={group.rule}
										matchedRows={group.transactions}
										{transactions}
										{categories}
										{tags}
										{rowTags}
									/><small
										>{group.mixed
											? 'Mixed categories / transaction exceptions'
											: assignmentReason(group.transactions[0], rules, categories)}</small
									></td
								><td class="category"
									><CategoryPicker
										{categories}
										value={group.categoryId}
										label={`Category for merchant ${group.rule.keyword}`}
										onChange={(categoryId) => editMerchant(group, categoryId)}
									/><small
										>{[...new Set(group.transactions.flatMap((row) => rowTags.get(row.id) ?? []))]
											.map((id) => tags[id]?.name)
											.filter(Boolean)
											.join(' · ')}</small
									></td
								><td class="actions"
									><button type="button" onclick={() => editMerchant(group)}>Edit rule</button></td
								></tr
							>{/each}
					</tbody>
				</table>
				{#if !visibleMerchants.length}<p class="empty">
						{transactions.length
							? 'No merchants match this filter.'
							: 'Import transactions to organize merchants. Starter rules are ready in the Rules tab.'}
					</p>{/if}
			</div>
			{#if filteredMerchants.length > limit}<button
					class="more"
					type="button"
					onclick={() => (limit += 50)}
					>Show more merchants ({filteredMerchants.length - limit} remaining)</button
				>{/if}
		{:else}
			<p class="order-note">
				Merchant rules run first. Within each group, the first matching enabled rule wins. Use ↑ and
				↓ to change priority.
			</p>
			<div class="scroll">
				<table aria-label="Categorization rules">
					<thead
						><tr><th>Enabled</th><th>Priority / match</th><th>Category</th><th>Actions</th></tr
						></thead
					><tbody>
						{#each visibleRules as rule (ruleKey(rule))}{@const index =
								sorted.indexOf(rule)}{@const matchCount = transactions.filter((row) =>
								matchingRule(row.description, [{ ...rule, enabled: true }], categories, row.id, row)
							).length}<tr class:disabled-rule={rule.enabled === false}
								><td
									><input
										type="checkbox"
										aria-label={`Enable rule ${rule.keyword}`}
										checked={rule.enabled !== false}
										onchange={(event) =>
											change(
												`${event.currentTarget.checked ? 'Enable' : 'Disable'} ${rule.keyword}`,
												rules.map((item) =>
													item === rule ? { ...item, enabled: event.currentTarget.checked } : item
												),
												rule
											)}
									/></td
								><td class="pattern"
									><div>
										<span class="priority">{index + 1}</span><strong>{rule.keyword}</strong>
									</div>
									<small
										>{ruleDescription(rule).split(':')[0]} · {rule.starterId
											? 'Starter rule'
											: 'Personal rule'} · {matchCount} matching transaction{matchCount === 1
											? ''
											: 's'}{rule.spendingOnly ? ' · spending only' : ''}</small
									></td
								><td
									>{categoryPath(categories, rule.categoryId)}{#if rule.tagIds?.length}<small
											>{rule.tagIds
												.map((id) => tags[id]?.name)
												.filter(Boolean)
												.join(' · ')}</small
										>{/if}</td
								><td class="actions"
									><div>
										<button
											type="button"
											aria-label={`Move rule ${rule.keyword} earlier`}
											disabled={index === 0 ||
												isMerchantRule(sorted[index - 1]) !== isMerchantRule(rule)}
											onclick={() =>
												change(
													`Move ${rule.keyword} earlier`,
													moveRule(rules, ruleKey(rule), -1),
													rule
												)}>↑</button
										><button
											type="button"
											aria-label={`Move rule ${rule.keyword} later`}
											disabled={index === sorted.length - 1 ||
												isMerchantRule(sorted[index + 1]) !== isMerchantRule(rule)}
											onclick={() =>
												change(
													`Move ${rule.keyword} later`,
													moveRule(rules, ruleKey(rule), 1),
													rule
												)}>↓</button
										><button
											type="button"
											onclick={() => edit(rule, true)}
											aria-label={`Edit rule ${rule.keyword}`}>Edit</button
										><button
											type="button"
											class="quiet"
											onclick={() =>
												change(
													`Delete ${rule.keyword}`,
													rules.filter((item) => item !== rule),
													rule
												)}
											aria-label={`Delete rule ${rule.keyword}`}>Delete</button
										>
									</div></td
								></tr
							>{/each}
					</tbody>
				</table>
				{#if !visibleRules.length}<p class="empty">
						No rules match. Create a rule or restore the starter set in Settings.
					</p>{/if}
			</div>
			{#if filteredRules.length > limit}<button
					class="more"
					type="button"
					onclick={() => (limit += 50)}
					>Show more rules ({filteredRules.length - limit} remaining)</button
				>{/if}
		{/if}
	</fieldset>
</section>

<style>
	.workspace {
		font-size: 0.8125rem;
	}
	.intro {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	h3 {
		font-size: 0.9rem;
		margin: 0;
	}
	.intro p,
	.order-note {
		font-size: 0.77rem;
		color: var(--content-1);
		margin: 0.4rem 0 0;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.toolbar > input {
		flex: 1;
		min-width: 180px;
	}
	.tabs {
		display: inline-flex;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 8px;
		padding: 0.2rem;
		gap: 0.2rem;
	}
	.tabs button {
		border: 0;
		background: transparent;
		color: var(--content-1);
	}
	.tabs button.active {
		background: var(--base-1);
		color: var(--content);
		box-shadow: 0 1px 2px rgb(0 0 0/0.06);
	}
	.tabs span {
		font-size: 0.72rem;
		color: var(--content-1);
		margin-left: 0.3rem;
	}
	input,
	select,
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
		color: var(--base-1);
		border-color: var(--content);
	}
	.quiet {
		background: transparent;
		color: var(--content-1);
		border-color: transparent;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	fieldset {
		padding: 0;
		margin: 0;
		border: 0;
		min-width: 0;
	}
	.scroll {
		overflow: auto;
		border: 1px solid var(--edge);
		border-radius: 10px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	th,
	td {
		padding: 0.8rem 0.9rem;
		border-bottom: 1px solid var(--edge);
		vertical-align: top;
	}
	th {
		background: var(--base-2);
		color: var(--content-1);
		font-size: 0.74rem;
		font-weight: 500;
	}
	tbody tr:last-child td {
		border: 0;
	}
	tbody tr:hover {
		background: var(--base-2);
	}
	.merchant {
		min-width: 260px;
		width: 45%;
	}
	.merchant-title {
		display: flex;
		gap: 0.8rem;
		align-items: baseline;
		justify-content: space-between;
	}
	.money {
		font-size: 0.75rem;
		white-space: nowrap;
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
	}
	.category {
		min-width: 240px;
	}
	.check {
		width: 2rem;
		padding-right: 0;
	}
	input[type='checkbox'] {
		width: 15px;
		height: 15px;
		accent-color: var(--content);
		cursor: pointer;
	}
	.actions {
		width: 1%;
		white-space: nowrap;
	}
	.actions > div {
		display: flex;
		gap: 0.25rem;
	}
	.actions button {
		font-size: 0.74rem;
		padding: 0.3rem 0.45rem;
	}
	small {
		display: block;
		font-size: 0.7rem;
		color: var(--content-1);
		margin-top: 0.3rem;
		max-width: 30rem;
		overflow-wrap: anywhere;
	}
	.pattern {
		min-width: 250px;
	}
	.pattern strong {
		overflow-wrap: anywhere;
	}
	.priority {
		display: inline-block;
		min-width: 1.7rem;
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
	}
	.disabled-rule {
		opacity: 0.6;
	}
	.selection,
	.pending {
		border: 1px solid var(--edge-1);
		border-radius: 8px;
		background: var(--base-2);
		padding: 0.8rem 1rem;
		margin: 1rem 0;
	}
	.selection {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.pending .intro {
		margin: 0;
	}
	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
	}
	.order-note {
		margin-bottom: 0.8rem;
	}
	.more {
		margin-top: 0.8rem;
	}
	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--content-1);
	}
	.notice {
		color: var(--content-1);
		font-size: 0.78rem;
	}
	.error {
		color: var(--error);
	}
	input:focus-visible,
	select:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
	@media (max-width: 650px) {
		thead {
			display: none;
		}
		tbody tr {
			display: grid;
			grid-template-columns: 1.25rem minmax(0, 1fr);
			gap: 0.55rem 0.7rem;
			padding: 0.85rem;
			border-bottom: 1px solid var(--edge);
		}
		td {
			padding: 0;
			border: 0;
			min-width: 0;
		}
		td:first-child {
			grid-column: 1;
			grid-row: 1 / 4;
		}
		td:nth-child(2),
		td:nth-child(3),
		td.actions {
			grid-column: 2;
		}
		td.merchant,
		td.pattern,
		td.category {
			min-width: 0;
			width: auto;
		}
		td.actions {
			width: auto;
		}
		.actions > div {
			flex-wrap: wrap;
		}
		.merchant small,
		.pattern small {
			max-width: none;
		}

		.intro {
			align-items: start;
		}
		.intro p {
			max-width: 28rem;
		}
		.merchant-title {
			flex-direction: column;
			gap: 0.3rem;
		}
		.toolbar .tabs {
			width: 100%;
		}
		.toolbar .tabs button {
			flex: 1;
		}
		.merchant {
			min-width: 220px;
		}
		.category {
			min-width: 200px;
		}
	}
</style>
