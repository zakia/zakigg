<script lang="ts">
	import { auth } from '$lib/auth';
	import Icon from '$lib/components/Icon.svelte';
	import { renderAuthProviderButton } from './provider-buttons';

	let buttonContainer = $state<HTMLElement>();
	let message = $state('');

	$effect(() => {
		if (!buttonContainer || !auth.ready || auth.user) return;
		void renderSignInButton();
	});

	async function renderSignInButton() {
		if (!buttonContainer) return;
		buttonContainer.replaceChildren();
		try {
			await renderAuthProviderButton(
				'google',
				buttonContainer,
				(credentials) => void completeSignIn(credentials)
			);
		} catch {
			message = 'Google sign-in is unavailable right now.';
		}
	}

	async function completeSignIn(credentials: { credential: string }) {
		try {
			await auth.signIn('google', credentials);
			message = '';
		} catch {
			message = 'This account is not allowed.';
		}
	}

	async function signOut() {
		await auth.signOut();
	}
</script>

<section class="setting-card" aria-labelledby="account-heading">
	<div class="setting-heading">
		<Icon icon="mdi:account-circle-outline" />
		<div>
			<h2 id="account-heading">Account</h2>
			<p>Your private crafts and publishing controls.</p>
		</div>
	</div>

	{#if !auth.ready}
		<p class="muted">Checking your session…</p>
	{:else if auth.user}
		<div class="account-row">
			<div>
				<span class="eyebrow">Signed in as</span>
				<strong>{auth.user.email}</strong>
			</div>
			<button type="button" onclick={() => void signOut()}>
				<Icon icon="mdi:logout" /> Sign out
			</button>
		</div>
	{:else}
		<p class="muted">Sign in to edit, sync, and publish crafts.</p>
		<div class="provider-button" bind:this={buttonContainer}></div>
	{/if}

	{#if message}<p class="error" role="alert">{message}</p>{/if}
</section>

<style>
	.setting-card {
		background: color-mix(in oklch, var(--base-1) 82%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--s-1);
		display: grid;
		gap: var(--s0);
		padding: var(--s1);
	}

	.setting-heading,
	.account-row,
	button {
		align-items: center;
		display: flex;
	}

	.setting-heading {
		gap: var(--s-1);
	}

	.setting-heading :global(svg) {
		color: var(--brand);
		height: 1.5rem;
		width: 1.5rem;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1rem;
	}

	.setting-heading p,
	.muted,
	.eyebrow {
		color: var(--content-1);
		font-size: 0.8rem;
	}

	.account-row {
		justify-content: space-between;
	}

	.account-row > div {
		display: grid;
		gap: 0.2rem;
	}

	button {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 999px;
		color: var(--content);
		gap: var(--s-3);
		padding: var(--s-2) var(--s0);
	}

	button :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.provider-button {
		display: flex;
		min-height: 2.5rem;
	}

	.error {
		color: var(--error);
		font-size: 0.8rem;
	}
</style>
