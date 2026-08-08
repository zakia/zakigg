<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { auth } from '$lib/auth';
	import { renderAuthProviderButton } from './provider-buttons';

	let menu = $state<HTMLElement>();
	let buttonContainer = $state<HTMLElement>();
	let open = $state(false);
	let message = $state('');

	onMount(() => {
		const handlePointerDown = (event: PointerEvent) => {
			if (menu && !menu.contains(event.target as Node)) open = false;
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = false;
		};

		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		const container = buttonContainer;
		if (!open || !container || !auth.ready || auth.user) return;

		message = '';
		renderAuthProviderButton(
			'google',
			container,
			(credentials) => void completeSignIn(credentials)
		).catch(() => {
			message = 'Google sign-in is unavailable right now.';
		});
	});

	async function completeSignIn(credentials: { credential: string }) {
		try {
			await auth.signIn('google', credentials);
			message = '';
		} catch {
			message = 'This account is not allowed.';
		}
	}

	async function handleSignOut() {
		await auth.signOut();
		open = false;
	}
</script>

<div class="auth-menu" bind:this={menu}>
	<button
		type="button"
		class="dock-item auth-trigger"
		class:is-signed-in={Boolean(auth.user)}
		aria-label={auth.user ? 'Open account menu' : 'Sign in'}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<div class="tooltip">
			{auth.user?.email ?? 'Sign in'}
		</div>
		<Icon
			icon={auth.user ? 'mdi:account-check-outline' : 'mdi:account-outline'}
			class="h-full w-full"
		/>
		{#if auth.user}
			<span class="status-dot" aria-hidden="true"></span>
		{/if}
	</button>

	{#if open}
		<div class="auth-panel" role="dialog" aria-label="Account">
			{#if !auth.ready}
				<p class="auth-copy">Checking your session…</p>
			{:else if auth.user}
				<div class="account-details">
					<span class="eyebrow">Signed in as</span>
					<strong>{auth.user.email}</strong>
				</div>
				<button type="button" class="sign-out" onclick={() => void handleSignOut()}>
					<Icon icon="mdi:logout" />
					Sign out
				</button>
			{:else}
				<p class="auth-copy">Sign in to use your account across the app.</p>
				<div class="provider-button" bind:this={buttonContainer}></div>
			{/if}

			{#if message}
				<p class="auth-error" role="alert">{message}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.auth-menu {
		position: relative;
	}

	.dock-item {
		align-items: center;
		border-radius: 999px;
		display: flex;
		font-weight: 600;
		height: 2.5rem;
		justify-content: center;
		position: relative;
		width: 3rem;
		will-change: width, height;
	}

	.auth-trigger {
		color: var(--content-1);
	}

	.auth-trigger.is-signed-in {
		color: var(--brand);
	}

	.status-dot {
		background: var(--success);
		border: 2px solid var(--base);
		border-radius: 999px;
		bottom: 0.1rem;
		height: 0.65rem;
		position: absolute;
		right: 0.1rem;
		width: 0.65rem;
	}

	.tooltip {
		background-color: var(--base);
		border-radius: var(--radius);
		bottom: 110%;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
		font-size: var(--s-1);
		opacity: 0;
		padding: var(--s-4) var(--s-2);
		pointer-events: none;
		position: absolute;
		transition: opacity 0.2s;
		white-space: nowrap;
	}

	.dock-item:hover .tooltip {
		opacity: 1;
	}

	.auth-trigger[aria-expanded='true'] .tooltip {
		opacity: 0;
	}

	.auth-panel {
		background: color-mix(in oklch, var(--base) 94%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg, 1rem);
		bottom: calc(100% + 0.75rem);
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.16);
		display: grid;
		gap: 0.75rem;
		left: 50%;
		min-width: 14rem;
		padding: 1rem;
		position: absolute;
		transform: translateX(-50%);
		z-index: 2;
	}

	.auth-copy,
	.auth-error {
		font-size: 0.8rem;
		line-height: 1.4;
		margin: 0;
	}

	.auth-copy {
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
	}

	.auth-error {
		color: var(--error);
	}

	.account-details {
		display: grid;
		gap: 0.2rem;
	}

	.account-details strong {
		font-size: 0.8rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.eyebrow {
		color: color-mix(in oklch, var(--content-1) 60%, transparent);
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.sign-out {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 999px;
		display: flex;
		font-size: 0.8rem;
		gap: 0.4rem;
		justify-content: center;
		padding: 0.45rem 0.75rem;
		width: 100%;
	}

	.sign-out :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.provider-button {
		display: flex;
		justify-content: center;
		min-height: 2rem;
	}
</style>
