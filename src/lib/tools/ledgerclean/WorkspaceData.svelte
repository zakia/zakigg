<script lang="ts">
	import type { Workspace } from './workspace-storage';
	import {
		importRuleBundle,
		restoreWorkspaceBackup,
		rulesBackup,
		workspaceBackup
	} from './workspace-files';
	import { starterRules } from './starter-rules';
	import { previewRuleChange, type RulePreview as Preview } from './rules';
	import { ruleKey } from './processing';
	import RulePreview from './RulePreview.svelte';
	let {
		workspace,
		onRestore,
		disabled = false
	}: {
		workspace: Workspace;
		onRestore: (workspace: Workspace) => void | Promise<void>;
		disabled?: boolean;
	} = $props();
	let backupInput: HTMLInputElement;
	let rulesInput: HTMLInputElement;
	let pending = $state<{
		kind: 'workspace' | 'rules' | 'starters';
		workspace: Workspace;
		preview: Preview;
		before: string;
	} | null>(null);
	let error = $state('');
	let reading = $state(false);
	let applying = $state(false);
	function download(kind: 'workspace' | 'rules') {
		const text =
			kind === 'workspace'
				? workspaceBackup($state.snapshot(workspace))
				: rulesBackup($state.snapshot(workspace));
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `ledgerclean-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	async function read(file: File | undefined, kind: 'workspace' | 'rules') {
		if (!file) return;
		error = '';
		reading = true;
		pending = null;
		try {
			if (file.size > 50 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 50 MB.');
			const text = await file.text();
			const next =
				kind === 'workspace'
					? restoreWorkspaceBackup(text)
					: importRuleBundle(text, $state.snapshot(workspace));
			pending = {
				kind,
				workspace: next,
				before: workspaceBackup($state.snapshot(workspace)),
				preview: previewRuleChange(
					workspace.transactions,
					workspace.rules,
					next.rules,
					next.categories,
					undefined,
					next.tags
				)
			};
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not read this file.';
		} finally {
			reading = false;
		}
	}
	function restoreStarters() {
		const personal = workspace.rules.filter((rule) => !rule.starterId);
		const keys = new Set(personal.map(ruleKey));
		const next = {
			...$state.snapshot(workspace),
			rules: [
				...$state.snapshot(personal),
				...starterRules(workspace.categories).filter((rule) => !keys.has(ruleKey(rule)))
			]
		};
		const preview = previewRuleChange(
			workspace.transactions,
			workspace.rules,
			next.rules,
			workspace.categories,
			undefined,
			workspace.tags
		);
		pending = {
			kind: 'starters',
			workspace: { ...next, transactions: preview.transactions },
			preview,
			before: workspaceBackup($state.snapshot(workspace))
		};
		error = '';
	}
</script>

<section aria-labelledby="workspace-data-title">
	<h2 id="workspace-data-title">Local data & backups</h2>
	<p>
		Transactions, rules, and exceptions stay in this browser. Export a backup to keep a copy or move
		to another device.
	</p>
	<fieldset disabled={disabled || reading || applying}>
		<div class="buttons">
			<button type="button" onclick={() => download('workspace')}>Back up workspace</button><button
				type="button"
				onclick={() => backupInput.click()}>Restore workspace…</button
			>
		</div>
		<input
			class="file-input"
			bind:this={backupInput}
			type="file"
			accept=".json,application/json"
			aria-label="Restore workspace file"
			onchange={(event) => {
				void read(event.currentTarget.files?.[0], 'workspace');
				event.currentTarget.value = '';
			}}
		/>
		<h3>Reusable rules</h3>
		<p>
			Rule exports include categories and tags, without transactions or their exceptions. Importing
			merges rules; matching patterns are replaced after preview.
		</p>
		<div class="buttons">
			<button type="button" onclick={() => download('rules')}>Export rules</button><button
				type="button"
				onclick={() => rulesInput.click()}>Import rules…</button
			><button type="button" onclick={restoreStarters}>Restore starter rules…</button>
		</div>
		<input
			class="file-input"
			bind:this={rulesInput}
			type="file"
			accept=".json,application/json"
			aria-label="Import rules file"
			onchange={(event) => {
				void read(event.currentTarget.files?.[0], 'rules');
				event.currentTarget.value = '';
			}}
		/>
		{#if pending}
			<section class="restore" aria-label="Import preview">
				<h3>
					{pending.kind === 'workspace'
						? 'Replace this workspace?'
						: pending.kind === 'starters'
							? 'Restore the starter rules?'
							: 'Import these rules?'}
				</h3>
				{#if pending.kind === 'workspace'}<p>
						This replaces {workspace.transactions.length} current transactions and {workspace.rules
							.length} rules with {pending.workspace.transactions.length} transactions and {pending
							.workspace.rules.length} rules from the backup. Its categories, tags, and transaction exceptions
						are restored too.
					</p>
					<button type="button" onclick={() => download('workspace')}
						>Back up current workspace first</button
					>
				{:else}<p>
						{pending.kind === 'starters'
							? 'Starter customizations are reset. Personal rules and transaction exceptions stay intact.'
							: `${pending.workspace.rules.length} rules after merging. Your transactions and their exceptions stay intact.`}
					</p>
					<RulePreview preview={pending.preview} categories={pending.workspace.categories} />{/if}
				<div class="buttons">
					<button
						type="button"
						class="primary"
						onclick={async () => {
							if (!pending || applying) return;
							if (workspaceBackup($state.snapshot(workspace)) !== pending.before) {
								error =
									'The workspace changed while this preview was open. Open the import or reset preview again.';
								pending = null;
								return;
							}
							applying = true;
							try {
								await onRestore($state.snapshot(pending.workspace));
								pending = null;
							} catch (cause) {
								error = cause instanceof Error ? cause.message : 'Could not save workspace.';
							} finally {
								applying = false;
							}
						}}
						>{pending.kind === 'workspace'
							? 'Replace workspace'
							: pending.kind === 'starters'
								? 'Restore starter rules'
								: 'Import rules'}</button
					><button type="button" onclick={() => (pending = null)}>Cancel</button>
				</div>
			</section>
		{/if}
	</fieldset>
	{#if reading}<p role="status">Reading file…</p>{/if}{#if error}<p class="error" role="alert">
			{error}
		</p>{/if}
</section>

<style>
	h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	h3 {
		font-size: 0.85rem;
		margin: 1.2rem 0 0.4rem;
	}
	p {
		color: var(--content-1);
		font-size: 0.78rem;
		line-height: 1.55;
		margin: 0.5rem 0 0.8rem;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
	button {
		font: inherit;
		font-size: 0.78rem;
		border: 1px solid var(--edge-1);
		border-radius: 6px;
		background: var(--base-1);
		color: var(--content);
		padding: 0.5rem 0.65rem;
		cursor: pointer;
	}
	.primary {
		background: var(--content);
		color: var(--base-1);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--content-1);
		outline-offset: 3px;
	}
	fieldset {
		margin: 0;
		border: 0;
		padding: 0;
		min-width: 0;
	}
	.file-input {
		display: none;
	}
	.restore {
		border: 1px solid var(--edge-1);
		padding: 0.8rem;
		border-radius: 8px;
		margin-top: 1rem;
	}
	.restore h3 {
		margin-top: 0;
	}
	.error {
		color: var(--error);
	}
</style>
