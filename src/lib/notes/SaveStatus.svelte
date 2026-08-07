<script lang="ts">
	import type { SaveState, SyncLabelStatus } from './save-state';

	let {
		state,
		label,
		sync = 'disabled'
	}: { state: SaveState; label: string; sync?: SyncLabelStatus } = $props();
</script>

<div class="save-status" data-state={state} data-sync={sync}>
	<span class="status-dot"></span>
	{#if sync !== 'disabled' && sync !== 'idle'}
		<span class="sync-dot"></span>
	{/if}
	<span>{label}</span>
</div>

<style>
	.save-status {
		align-items: center;
		backdrop-filter: blur(10px);
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 70%, transparent);
		border-radius: 999px;
		color: var(--content-1);
		display: flex;
		font-size: var(--s-1);
		gap: var(--s-3);
		opacity: 0.78;
		padding: var(--s-4) var(--s-2);
		pointer-events: none;
		white-space: nowrap;
	}

	.status-dot {
		background: var(--success);
		border-radius: 999px;
		display: block;
		height: 0.5rem;
		width: 0.5rem;
	}

	.save-status[data-state='saving'] .status-dot,
	.save-status[data-state='loading'] .status-dot {
		background: var(--warning);
	}

	.save-status[data-state='error'] .status-dot {
		background: var(--error);
	}

	.sync-dot {
		background: var(--success);
		border-radius: 999px;
		display: block;
		height: 0.5rem;
		width: 0.5rem;
	}

	.save-status[data-sync='syncing'] .sync-dot,
	.save-status[data-sync='pending'] .sync-dot {
		background: var(--warning);
	}

	.save-status[data-sync='error'] .sync-dot {
		background: var(--error);
	}

	@media (max-width: 32rem) {
		.save-status {
			max-width: 9rem;
		}

		.save-status span:last-child {
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>
