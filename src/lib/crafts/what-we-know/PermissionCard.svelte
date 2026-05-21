<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';

	export type PermissionState =
		| 'unsupported'
		| 'idle'
		| 'requesting'
		| 'granted'
		| 'denied'
		| 'error';

	let {
		icon,
		title,
		description,
		apiSnippet,
		buttonLabel = 'See what this reveals',
		ifDenied,
		state = $bindable('idle'),
		errorMessage = $bindable(''),
		onRequest,
		children
	}: {
		icon: string;
		title: string;
		description: string;
		apiSnippet: string;
		buttonLabel?: string;
		ifDenied: string;
		state?: PermissionState;
		errorMessage?: string;
		onRequest: () => Promise<void>;
		children?: Snippet;
	} = $props();

	async function handleClick() {
		state = 'requesting';
		errorMessage = '';
		try {
			await onRequest();
		} catch (err) {
			state = 'error';
			errorMessage = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<div class="perm">
	<div class="top">
		<div class="icon-wrap">
			<Icon {icon} class="icon" />
		</div>
		<div class="meta">
			<h3>{title}</h3>
			<p>{description}</p>
		</div>
		{#if state === 'granted'}
			<span class="badge granted"><Icon icon="lucide:check" class="badge-ic" /> Granted</span>
		{:else if state === 'denied'}
			<span class="badge denied"><Icon icon="lucide:x" class="badge-ic" /> Denied</span>
		{:else if state === 'error'}
			<span class="badge denied"><Icon icon="lucide:alert-triangle" class="badge-ic" /> Error</span>
		{:else if state === 'unsupported'}
			<span class="badge muted"><Icon icon="lucide:minus" class="badge-ic" /> Unsupported</span>
		{/if}
	</div>

	<details class="api-details">
		<summary>Show the exact JavaScript call</summary>
		<pre><code>{apiSnippet}</code></pre>
	</details>

	{#if state === 'idle'}
		<button class="btn primary" onclick={handleClick}>
			<Icon icon="lucide:play" class="btn-ic" />
			{buttonLabel}
		</button>
	{:else if state === 'requesting'}
		<button class="btn primary" disabled>
			<span class="spinner"></span>
			Waiting for your response…
		</button>
	{:else if state === 'granted'}
		<div class="result">
			{#if children}{@render children()}{/if}
		</div>
	{:else if state === 'denied'}
		<div class="note warn">
			<Icon icon="lucide:shield" class="note-ic" />
			<div>
				<strong>You declined — good instinct.</strong>
				<p>{ifDenied}</p>
			</div>
		</div>
		<button class="btn ghost" onclick={handleClick}>Ask again</button>
	{:else if state === 'error'}
		<div class="note err">
			<Icon icon="lucide:alert-triangle" class="note-ic" />
			<div>
				<strong>Something went wrong.</strong>
				<p class="mono">{errorMessage}</p>
			</div>
		</div>
		<button class="btn ghost" onclick={handleClick}>Try again</button>
	{:else if state === 'unsupported'}
		<div class="note muted">
			<Icon icon="lucide:info" class="note-ic" />
			<span>This API isn't available in your browser — which is itself a signal.</span>
		</div>
	{/if}
</div>

<style>
	.perm {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s1);
		border: 1px solid var(--edge);
		border-radius: var(--s-1);
		background: var(--base-1);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
	}

	.top {
		display: flex;
		align-items: flex-start;
		gap: var(--s-1);
	}

	.icon-wrap {
		display: grid;
		place-items: center;
		padding: var(--s-2);
		border-radius: var(--s-2);
		background: color-mix(in oklch, var(--brand) 12%, transparent);
		flex-shrink: 0;
	}

	.icon-wrap :global(.icon) {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--brand);
	}

	.meta {
		flex: 1;
		min-width: 0;
	}

	.meta h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 var(--s-4);
	}

	.meta p {
		font-size: 0.85rem;
		color: var(--content-1);
		margin: 0;
		line-height: 1.4;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--s-4);
		padding: var(--s-4) var(--s-2);
		border-radius: var(--s-3);
		font-size: 0.7rem;
		font-weight: 500;
		flex-shrink: 0;
	}

	.badge :global(.badge-ic) {
		width: 0.75rem;
		height: 0.75rem;
	}

	.badge.granted {
		background: color-mix(in oklch, lime 25%, transparent);
		color: oklch(45% 0.15 145);
	}

	:global(:root[data-theme='dark']) .badge.granted {
		color: oklch(80% 0.18 145);
	}

	.badge.denied {
		background: color-mix(in oklch, tomato 25%, transparent);
		color: oklch(45% 0.18 25);
	}

	:global(:root[data-theme='dark']) .badge.denied {
		color: oklch(80% 0.18 25);
	}

	.badge.muted {
		background: var(--base-2);
		color: var(--content-1);
	}

	.api-details {
		font-size: 0.72rem;
	}

	.api-details summary {
		cursor: pointer;
		color: var(--content-1);
	}

	.api-details summary:hover {
		color: var(--content);
	}

	.api-details pre {
		margin-top: var(--s-2);
		padding: var(--s-1);
		background: var(--base-2);
		border-radius: var(--s-2);
		overflow-x: auto;
		font-size: 0.7rem;
		line-height: 1.45;
	}

	.api-details code {
		font-family: var(--font-mono);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s0);
		border-radius: var(--s-2);
		font-size: 0.85rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		align-self: flex-start;
		transition: all 0.15s ease;
	}

	.btn :global(.btn-ic) {
		width: 1rem;
		height: 1rem;
	}

	.btn.primary {
		background: var(--brand);
		color: var(--brand-content);
	}

	.btn.primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 2px 6px color-mix(in oklch, var(--brand) 40%, transparent);
	}

	.btn.primary:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.btn.ghost {
		background: transparent;
		color: var(--content-1);
		font-size: 0.75rem;
		padding: var(--s-3) var(--s-2);
	}

	.btn.ghost:hover {
		color: var(--content);
		background: var(--base-2);
	}

	.result {
		padding: var(--s-1);
		background: var(--base-2);
		border-radius: var(--s-2);
		font-size: 0.85rem;
	}

	.note {
		display: flex;
		gap: var(--s-2);
		padding: var(--s-1);
		border-radius: var(--s-2);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.note :global(.note-ic) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.note strong {
		font-weight: 600;
		display: block;
	}

	.note p {
		margin: var(--s-4) 0 0;
		font-size: 0.75rem;
		opacity: 0.85;
	}

	.note.warn {
		background: color-mix(in oklch, orange 18%, transparent);
		color: oklch(40% 0.12 60);
	}

	:global(:root[data-theme='dark']) .note.warn {
		color: oklch(85% 0.14 60);
	}

	.note.err {
		background: color-mix(in oklch, tomato 18%, transparent);
		color: oklch(40% 0.15 25);
	}

	:global(:root[data-theme='dark']) .note.err {
		color: oklch(85% 0.15 25);
	}

	.note.muted {
		background: var(--base-2);
		color: var(--content-1);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
		.btn.primary:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
