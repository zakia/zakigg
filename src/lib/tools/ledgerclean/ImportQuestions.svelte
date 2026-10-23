<script lang="ts">
	import { detectedAccountType } from './activity';
	import type { CsvData, ImportOptions } from './processing';
	import type { ImportQuestion } from './import-inference';
	let {
		name,
		data,
		options,
		questions,
		accounts,
		onChange
	}: {
		name: string;
		data: CsvData;
		options: ImportOptions;
		questions: ImportQuestion[];
		accounts: string[];
		onChange: (options: ImportOptions) => void;
	} = $props();
	function update(patch: Partial<ImportOptions>) {
		onChange({ ...options, ...patch });
	}
	let signChoice = $state('');
	const detected = $derived(detectedAccountType(data, options));
	const labels: Partial<Record<ImportQuestion, string>> = {
		date: 'Which column is the date?',
		description: 'Which column describes the transaction?',
		amount: 'Which column contains the amount?'
	};
</script>

<section>
	<h3>{name}</h3>
	{#each questions as question (question)}
		{#if question === 'date' || question === 'description' || question === 'amount'}<label
				>{labels[question]}<select
					aria-label={`${question} column for ${name}`}
					value={options.columns[question]}
					onchange={(event) =>
						update({ columns: { ...options.columns, [question]: event.currentTarget.value } })}
					><option value="">Choose a column</option>{#each data.headers as header (header)}<option
							>{header}</option
						>{/each}</select
				></label
			>
		{:else if question === 'sign'}<label
				>What do positive amounts mean?<select
					aria-label={`Positive amounts in ${name}`}
					value={signChoice}
					onchange={(event) => {
						signChoice = event.currentTarget.value;
						update({
							expenses: signChoice === 'negative' ? 'negative' : 'positive',
							accountType:
								signChoice === 'bank-out'
									? 'cash'
									: detected !== 'unknown'
										? detected
										: signChoice === 'negative'
											? 'cash'
											: 'credit'
						});
					}}
					><option value="" disabled>Choose how this file records money</option>
					<option value="negative"
						>{detected === 'credit'
							? 'Credits / refunds'
							: 'Bank deposits / money coming in'}</option
					>
					<option value="positive"
						>{detected === 'cash' ? 'Purchases / money going out' : 'Credit-card purchases'}</option
					>
					{#if detected === 'unknown'}<option value="bank-out"
							>Money going out of a bank account</option
						>{/if}
					></select
				></label
			>
		{:else if question === 'dateOrder'}<label
				>Which date order does this file use?<select
					aria-label={`Date order in ${name}`}
					value={options.dateOrder}
					onchange={(event) =>
						update({ dateOrder: event.currentTarget.value as ImportOptions['dateOrder'] })}
					><option value="MDY">Month / day / year</option><option value="DMY"
						>Day / month / year</option
					></select
				></label
			>
		{:else if question === 'account'}<label
				>Which account is this statement for?<input
					aria-label={`Account for ${name}`}
					value={options.account}
					list={`account-${options.idPrefix}`}
					onchange={(event) =>
						update({ account: event.currentTarget.value.trim() || 'Main account' })}
				/><datalist id={`account-${options.idPrefix}`}
					>{#each accounts as account (account)}<option value={account}></option>{/each}</datalist
				></label
			>{/if}
	{/each}
	<div class="sample">
		<table>
			<thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody
				>{#each data.rows.slice(0, 3) as row, i (i)}<tr
						><td>{row[options.columns.date] || '—'}</td><td
							>{row[options.columns.description] || '—'}</td
						><td
							>{row[options.columns.amount] ||
								row[options.columns.debit] ||
								row[options.columns.credit] ||
								'—'}</td
						></tr
					>{/each}</tbody
			>
		</table>
	</div>
</section>

<style>
	section {
		padding: 1rem 0;
		font-size: 0.85rem;
	}
	h3 {
		font-size: 0.9rem;
		color: var(--content-1);
		font-weight: 500;
		margin: 0 0 1rem;
	}
	label {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	input,
	select {
		font: inherit;
		max-width: 360px;
		padding: 0.65rem;
		border: 1px solid var(--edge-1);
		border-radius: 7px;
		background: var(--base-1);
		color: var(--content);
	}
	.sample {
		overflow: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.8rem;
		text-align: left;
	}
	th {
		color: var(--content-1);
		font-weight: 500;
	}
	th,
	td {
		padding: 0.65rem;
		border-bottom: 1px solid var(--edge);
	}
	td:last-child {
		text-align: right;
	}
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}
</style>
