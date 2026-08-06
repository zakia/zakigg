<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { handleSignedIn, startSyncEngine, syncNow, syncState } from './engine.svelte';
	import { renderGoogleSignInButton } from './google-signin';
	import {
		refreshSyncSession,
		signInWithCredential,
		signOutSyncSession,
		syncSession
	} from './session.svelte';

	let { onToast }: { onToast?: (message: string) => void } = $props();

	let buttonContainer = $state<HTMLElement>();
	let signInFailed = $state(false);

	onMount(() => {
		startSyncEngine();
		void refreshSyncSession();
	});

	// Render the official Google button whenever the signed-out container is in
	// the DOM. Failing to load GIS (offline, unconfigured client id) hides the
	// control instead of breaking the page.
	$effect(() => {
		const container = buttonContainer;
		if (!container || syncSession.status !== 'signed-out') return;

		renderGoogleSignInButton(container, (credential) => void completeSignIn(credential)).catch(
			() => {
				signInFailed = true;
			}
		);
	});

	async function completeSignIn(credential: string) {
		try {
			const email = await signInWithCredential(credential);
			onToast?.(`Sync enabled for ${email}`);
			await handleSignedIn();
		} catch {
			onToast?.('This account is not allowed to sync');
		}
	}

	async function handleSignOut() {
		await signOutSyncSession();
		onToast?.('Sync disabled on this device');
	}
</script>

{#if syncSession.status === 'signed-in'}
	<div class="sync-pill" data-status={syncState.status} title={syncSession.email}>
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
		<button
			type="button"
			class="sync-action"
			title="Sign out of sync"
			aria-label="Sign out of sync"
			onclick={() => void handleSignOut()}
		>
			<Icon icon="mdi:logout" />
		</button>
	</div>
{:else if syncSession.status === 'signed-out' && !signInFailed}
	<div class="google-button" bind:this={buttonContainer}></div>
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

	.google-button {
		display: flex;
		flex-shrink: 0;
	}
</style>
