<script lang="ts">
	import { auth } from '$lib/auth';
	import { theme } from '$lib/theme.svelte';
	import { renderAuthProviderButton } from './provider-buttons';

	let buttonContainer = $state<HTMLElement>();
	let message = $state('');

	$effect(() => {
		if (!buttonContainer || !auth.ready || auth.user) return;
		void renderSignInButton(theme.mode);
	});

	async function renderSignInButton(colorScheme: 'light' | 'dark') {
		if (!buttonContainer) return;
		// The provider SDK owns the contents of this host element.
		// eslint-disable-next-line svelte/no-dom-manipulating
		buttonContainer.replaceChildren();
		try {
			await renderAuthProviderButton(
				'google',
				buttonContainer,
				(credentials) => void completeSignIn(credentials),
				{ colorScheme }
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

<section class="settings-section" aria-labelledby="account-heading">
	<div class="section-heading">
		<h2 id="account-heading">Account</h2>
		<p>Private crafts and publishing.</p>
	</div>

	{#if !auth.ready}
		<p class="muted">Checking your session…</p>
	{:else if auth.user}
		<div class="account-row">
			<div>
				<span class="eyebrow">Signed in as</span>
				<strong>{auth.user.email}</strong>
			</div>
			<button type="button" onclick={() => void signOut()}> Sign out </button>
		</div>
	{:else}
		<p class="muted">Sign in to edit, sync, and publish crafts.</p>
		{#key theme.mode}
			<div class="provider-button" bind:this={buttonContainer}></div>
		{/key}
	{/if}

	{#if message}<p class="error" role="alert">{message}</p>{/if}
</section>

<style>
	.settings-section {
		border-top: 1px solid var(--edge);
		display: grid;
		gap: var(--s1);
		padding-block: var(--s1);
	}

	.section-heading,
	.account-row,
	button {
		align-items: center;
		display: flex;
	}

	.section-heading {
		display: grid;
		gap: var(--s-5);
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1rem;
	}

	.section-heading p,
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
		background: transparent;
		border: 0;
		color: var(--content-1);
		font-size: 0.8rem;
		padding: var(--s-2) 0;
	}

	button:hover {
		color: var(--brand);
	}

	.provider-button {
		align-items: center;
		display: flex;
		min-height: 2.75rem;
	}

	.error {
		color: var(--error);
		font-size: 0.8rem;
	}
</style>
