<script lang="ts">
	import { onDestroy } from 'svelte';
	import { localAi, MODEL_DOWNLOAD_MB } from './local-ai.svelte';
	let {
		enabled,
		disabled = false,
		label = 'Categorize',
		onEnabled,
		onRun = () => {},
		onActiveChange = () => {}
	}: {
		enabled: boolean;
		disabled?: boolean;
		label?: string;
		onEnabled: () => void;
		onRun?: () => void | Promise<void>;
		onActiveChange?: (active: boolean) => void;
	} = $props();
	let confirm = $state(false),
		preparing = $state(false),
		error = $state('');
	let controller: AbortController | null = null;
	onDestroy(() => {
		controller?.abort();
		onActiveChange(false);
	});
	async function run() {
		if (disabled || preparing) return;
		if (!enabled && localAi.status !== 'ready' && !confirm) {
			confirm = true;
			return;
		}
		confirm = false;
		error = '';
		preparing = true;
		onActiveChange(true);
		const abort = new AbortController();
		controller = abort;
		try {
			await localAi.load(abort.signal);
			onEnabled();
			await onRun();
		} catch (cause) {
			if (!abort.signal.aborted)
				error = cause instanceof Error ? cause.message : 'Could not start local AI.';
		} finally {
			preparing = false;
			controller = null;
			onActiveChange(false);
		}
	}
</script>

{#if preparing && localAi.status === 'loading'}<div class="download" role="status">
		<span>Loading local AI · {Math.round(localAi.progress * 100)}%</span><progress
			max="1"
			value={localAi.progress}
		></progress><button type="button" onclick={() => controller?.abort()}>Cancel</button>
	</div>
{:else if confirm}<div class="confirm">
		<span>One-time download · ~{MODEL_DOWNLOAD_MB} MB. Transactions stay on this device.</span
		><button type="button" {disabled} onclick={run}>Download & {label.toLowerCase()}</button><button
			type="button"
			onclick={() => (confirm = false)}>Cancel</button
		>
	</div>
{:else}<button class="primary" type="button" disabled={disabled || preparing} onclick={run}
		>{label}</button
	>{/if}
{#if error}<p role="alert">{error}</p>{/if}

<style>
	button {
		font: inherit;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--edge-1);
		border-radius: 7px;
		background: var(--base-1);
		color: var(--content);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.primary {
		background: var(--content);
		color: var(--base-1);
		border-color: var(--content);
	}
	.confirm,
	.download {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.8rem;
	}
	span {
		color: var(--content-1);
	}
	progress {
		width: 100px;
		accent-color: var(--content);
	}
	p {
		color: var(--error);
		font-size: 0.8rem;
	}
	button:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}
</style>
