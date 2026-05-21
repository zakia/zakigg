<script lang="ts">
	import Icon from '@iconify/svelte';

	let {
		icon,
		label,
		value,
		explanation,
		creepy = false,
		delayMs = 0
	}: {
		icon?: string;
		label: string;
		value: string;
		explanation: string;
		creepy?: boolean;
		delayMs?: number;
	} = $props();
</script>

<div class="card-wrap fade-in {creepy ? 'creepy' : ''}" style="animation-delay: {delayMs}ms;">
	<div class="header">
		{#if icon}
			<Icon {icon} class="icon" />
		{/if}
		<span class="label">{label}</span>
		{#if creepy}
			<span class="flag">sensitive</span>
		{/if}
	</div>
	<div class="value">{value}</div>
	<div class="explain">{explanation}</div>
</div>

<style>
	.card-wrap {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s0);
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
		background: var(--base-1);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
	}

	.card-wrap.creepy {
		border-color: color-mix(in oklch, var(--brand) 45%, var(--edge));
		background: color-mix(in oklch, var(--brand) 4%, var(--base-1));
	}

	.header {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--content-1);
	}

	.header :global(.icon) {
		width: 0.9rem;
		height: 0.9rem;
	}

	.label {
		flex: 1;
	}

	.flag {
		margin-left: auto;
		padding: 0 var(--s-4);
		border-radius: var(--s-3);
		font-size: 0.62rem;
		background: color-mix(in oklch, var(--brand) 15%, transparent);
		color: var(--brand);
		letter-spacing: 0.08em;
	}

	.value {
		font-family: var(--font-mono);
		font-size: 0.92rem;
		color: var(--content);
		word-break: break-word;
	}

	.explain {
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--content-1);
	}

	.fade-in {
		opacity: 0;
		transform: translateY(6px);
		animation: fade-in-up 0.35s ease-out forwards;
	}

	@keyframes fade-in-up {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fade-in {
			animation: none;
			opacity: 1;
			transform: none;
		}
	}
</style>
