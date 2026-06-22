<script module lang="ts">
	import * as v from 'valibot';
	import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

	export const timerPropsSchema = v.object({
		endIsoTimestamp: v.pipe(
			v.string(),
			v.isoTimestamp('Use an ISO timestamp like 2026-06-21T18:00:00.000Z.')
		)
	});

	export type TimerProps = v.InferOutput<typeof timerPropsSchema>;

	export const timerEmbed = {
		id: 'core.Timer',
		label: 'Timer',
		icon: 'mdi:timer-outline',
		props: timerPropsSchema,
		fields: {
			endIsoTimestamp: {
				label: 'End',
				control: 'datetime-local'
			}
		},
		initialProps: () => ({
			endIsoTimestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString()
		})
	} satisfies ComponentEmbedConfig<typeof timerPropsSchema>;
</script>

<script lang="ts">
	let { endIsoTimestamp }: TimerProps = $props();
	let now = $state(Date.now());

	const targetTime = $derived(Date.parse(endIsoTimestamp));
	const remainingMs = $derived(Math.max(0, targetTime - now));
	const countdown = $derived(formatRemainingTime(remainingMs));

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
</script>

<time class="timer-embed" datetime={endIsoTimestamp} aria-label={`Timer ${countdown}`}>
	{countdown}
</time>

<style>
	.timer-embed {
		color: var(--content);
		font-variant-numeric: tabular-nums;
		font-size: clamp(2.2rem, 7vw, 4rem);
		font-weight: 430;
		letter-spacing: 0;
		line-height: 0.95;
		white-space: nowrap;
	}
</style>
