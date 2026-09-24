<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth';

	let password = $state('');
	let busy = $state(false);
	let message = $state('');

	onMount(() => {
		void auth.refresh();
	});

	async function submit() {
		busy = true;
		message = '';
		try {
			await auth.signIn(password);
			password = '';
		} catch {
			message = 'Incorrect password.';
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		await auth.signOut();
	}
</script>

<section class="settings-section" aria-labelledby="account-heading">
	<div class="section-heading">
		<h2 id="account-heading">Account</h2>
		<p>Private craft editor.</p>
	</div>

	{#if !auth.ready}
		<p class="muted">Checking your session…</p>
	{:else if auth.user}
		<div class="account-row">
			<div>
				<span class="eyebrow">Signed in as</span>
				<strong>Admin</strong>
			</div>
			<button type="button" onclick={() => void signOut()}> Sign out </button>
		</div>
	{:else}
		<form
			class="login-form"
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<label class="field">
				<span>Password</span>
				<input type="password" bind:value={password} autocomplete="current-password" required />
			</label>
			<button type="submit" class="submit" disabled={busy || !password}> Sign in </button>
		</form>
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

	button:hover:not(:disabled) {
		color: var(--brand);
	}

	.login-form {
		display: grid;
		gap: var(--s-2);
	}

	.field {
		display: grid;
		gap: var(--s-3);
	}

	.field span {
		color: var(--content-1);
		font-size: 0.8rem;
	}

	.field input {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 0.375rem;
		color: var(--content);
		font-size: 0.9rem;
		padding: 0.5rem 0.625rem;
		width: 100%;
	}

	.submit {
		justify-content: center;
		background: var(--brand);
		border-radius: 0.375rem;
		color: var(--base-1);
		font-weight: 600;
		padding: 0.5rem;
	}

	.submit:disabled {
		opacity: 0.5;
	}

	.error {
		color: var(--error);
		font-size: 0.8rem;
	}
</style>
