<script lang="ts">
	import type { Snippet } from 'svelte';
	import { auth } from '$lib/auth';
	import Icon from '$lib/components/Icon.svelte';

	let { children }: { children: Snippet } = $props();
</script>

{#if !auth.ready}
	<section class="edit-gate" aria-live="polite">
		<Icon icon="mdi:loading" class="spin" />
		<p>Checking your account…</p>
	</section>
{:else if !auth.user}
	<section class="edit-gate">
		<Icon icon="mdi:lock-outline" />
		<h1>Sign in to edit</h1>
		<p>Use the account control in the dock to open the private craft editor.</p>
	</section>
{:else}
	{@render children()}
{/if}

<style>
	.edit-gate {
		align-content: center;
		justify-items: center;
		color: var(--content-1);
		display: grid;
		gap: var(--s-2);
		min-height: 65vh;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		text-align: center;
	}

	.edit-gate h1,
	.edit-gate p {
		margin: 0;
	}

	.edit-gate :global(svg) {
		color: var(--brand);
		height: 1.5rem;
		width: 1.5rem;
	}

	.edit-gate :global(.spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
</style>
