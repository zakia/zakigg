<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { TimerProps } from './embed';

	type Props = TimerProps & {
		// Provided when rendered inside an editor; enables inline adjustment.
		updateProps?: (props: Record<string, unknown>) => void;
	};

	let { endIsoTimestamp, updateProps }: Props = $props();
	let now = $state(Date.now());
	let adjusting = $state(false);

	const targetTime = $derived(Date.parse(endIsoTimestamp));
	const remainingMs = $derived(Math.max(0, targetTime - now));
	const countdown = $derived(formatRemainingTime(remainingMs));
	const endAsLocalValue = $derived(toDateTimeLocalValue(endIsoTimestamp));

	$effect(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});

	function formatRemainingTime(value: number) {
		const totalSeconds = Math.ceil(value / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) return `${hours}:${padTime(minutes)}:${padTime(seconds)}`;

		return `${minutes}:${padTime(seconds)}`;
	}

	function padTime(value: number) {
		return value.toString().padStart(2, '0');
	}

	function toDateTimeLocalValue(value: string) {
		const date = new Date(value);

		if (!Number.isFinite(date.getTime())) return '';

		const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

		return offsetDate.toISOString().slice(0, 16);
	}

	function commitEndTime(value: string) {
		const date = new Date(value);

		if (!Number.isFinite(date.getTime())) return;

		updateProps?.({ endIsoTimestamp: date.toISOString() });
		adjusting = false;
	}
</script>

<span class="timer-shell">
	<time class="timer-embed" datetime={endIsoTimestamp} aria-label={`Timer ${countdown}`}>
		{countdown}
	</time>

	{#if updateProps}
		{#if adjusting}
			<input
				type="datetime-local"
				aria-label="Timer end"
				value={endAsLocalValue}
				onchange={(event) => commitEndTime(event.currentTarget.value)}
				onkeydown={(event) => {
					if (event.key === 'Escape') adjusting = false;
				}}
			/>
		{:else}
			<button
				type="button"
				class="timer-adjust"
				title="Adjust timer"
				aria-label="Adjust timer"
				onclick={() => (adjusting = true)}
			>
				<Icon icon="mdi:pencil-outline" />
			</button>
		{/if}
	{/if}
</span>

<style>
	.timer-shell {
		align-items: center;
		display: inline-flex;
		gap: var(--s-3);
	}

	.timer-embed {
		color: var(--content);
		font-variant-numeric: tabular-nums;
		font-size: clamp(2.2rem, 7vw, 4rem);
		font-weight: 430;
		letter-spacing: 0;
		line-height: 0.95;
		white-space: nowrap;
	}

	.timer-adjust {
		appearance: none;
		background: transparent;
		border: 0;
		border-radius: var(--s-5);
		color: color-mix(in oklch, var(--content-1) 70%, transparent);
		cursor: pointer;
		display: grid;
		height: 1.7rem;
		opacity: 0;
		padding: 0;
		place-items: center;
		transition:
			color 0.16s ease,
			opacity 0.16s ease;
		width: 1.7rem;
	}

	.timer-shell:hover .timer-adjust,
	.timer-adjust:focus-visible {
		opacity: 1;
	}

	.timer-adjust:hover,
	.timer-adjust:focus-visible {
		color: var(--content);
		outline: none;
	}

	.timer-adjust :global(svg) {
		height: 1.05rem;
		width: 1.05rem;
	}

	input {
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 84%, transparent);
		border-radius: var(--s-5);
		color: var(--content);
		font: inherit;
		font-size: var(--s-2);
		padding: 0.2rem var(--s-3);
	}

	input:focus {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 18%, transparent);
		outline: none;
	}
</style>
