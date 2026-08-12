<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth';
	import Icon from '$lib/components/Icon.svelte';
	import { handleSignedIn, startSyncEngine, syncNow, syncState } from './engine.svelte';

	let initializedFor = $state<string | null>(null);

	onMount(() => {
		startSyncEngine();
	});

	$effect(() => {
		const userId = auth.user?.id ?? null;
		if (!userId) {
			initializedFor = null;
			return;
		}
		if (initializedFor === userId) return;

		initializedFor = userId;
		void handleSignedIn();
	});
</script>

{#if auth.user}
	<div class="sync-pill" data-status={syncState.status} title="Craft sync status">
		<span class="sync-dot"></span>
		<button
			type="button"
			class="sync-action"
			title="Sync now"
			aria-label="Sync now"
			onclick={() => void syncNow()}
		>
			<Icon icon="mdi:cloud-sync-outline" />
		</button>
	</div>
{/if}

<style>
	.sync-pill {
		align-items: center;
		border: 1px solid color-mix(in oklch, var(--edge) 70%, transparent);
		border-radius: 999px;
		display: flex;
		gap: var(--s-4);
		padding: var(--s-4) var(--s-3);
	}

	.sync-dot {
		background: var(--success);
		border-radius: 999px;
		display: block;
		flex-shrink: 0;
		height: 0.5rem;
		width: 0.5rem;
	}

	.sync-pill[data-status='syncing'] .sync-dot,
	.sync-pill[data-status='pending'] .sync-dot {
		background: var(--warning);
	}

	.sync-pill[data-status='error'] .sync-dot {
		background: var(--error);
	}

	.sync-action {
		align-items: center;
		background: none;
		border: none;
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		cursor: pointer;
		display: flex;
		padding: 0;
		transition: color 0.16s ease;
	}

	.sync-action:hover {
		color: var(--content-1);
	}

	.sync-action :global(svg) {
		height: 1rem;
		width: 1rem;
	}
</style>
