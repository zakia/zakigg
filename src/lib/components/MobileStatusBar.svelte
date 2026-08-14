<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	type BatteryManager = EventTarget & {
		charging: boolean;
		level: number;
	};

	let time = $state('');
	let dateTime = $state('');
	let batteryLevel = $state<number | null>(null);
	let charging = $state(false);

	onMount(() => {
		let battery: BatteryManager | undefined;
		let active = true;

		const updateTime = () => {
			const now = new Date();
			time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
			dateTime = now.toISOString();
		};
		const updateBattery = () => {
			if (!battery) return;
			batteryLevel = Math.round(battery.level * 100);
			charging = battery.charging;
		};

		updateTime();
		const timer = window.setInterval(updateTime, 30_000);
		const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> })
			.getBattery;

		void getBattery?.call(navigator).then((manager) => {
			if (!active) return;
			battery = manager;
			updateBattery();
			battery.addEventListener('levelchange', updateBattery);
			battery.addEventListener('chargingchange', updateBattery);
		});

		return () => {
			active = false;
			window.clearInterval(timer);
			battery?.removeEventListener('levelchange', updateBattery);
			battery?.removeEventListener('chargingchange', updateBattery);
		};
	});
</script>

<div class="mobile-status-bar">
	<time datetime={dateTime}>{time}</time>
	<div
		class="battery"
		aria-label={batteryLevel === null
			? 'Battery status unavailable'
			: `Battery ${batteryLevel}%${charging ? ', charging' : ''}`}
	>
		{#if charging}<Icon icon="mdi:lightning-bolt" />{/if}
		{#if batteryLevel !== null}<span>{batteryLevel}</span>{/if}
		<span class="battery-shell" aria-hidden="true">
			<span class="battery-level" style:width={`${batteryLevel ?? 100}%`}></span>
		</span>
	</div>
</div>

<style>
	.mobile-status-bar {
		align-items: center;
		color: var(--content);
		display: none;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		font-weight: 650;
		height: var(--mobile-status-height);
		justify-content: space-between;
		left: 0;
		padding: env(safe-area-inset-top, 0px) max(var(--s0), env(safe-area-inset-right, 0px)) 0
			max(var(--s0), env(safe-area-inset-left, 0px));
		pointer-events: none;
		position: fixed;
		right: 0;
		top: 0;
		z-index: 999;
	}

	.battery {
		align-items: center;
		display: flex;
		gap: var(--s-4);
	}

	.battery :global(svg) {
		height: 0.85rem;
		width: 0.85rem;
	}

	.battery-shell {
		border: 1.5px solid currentColor;
		border-radius: 0.2rem;
		display: block;
		height: 0.65rem;
		padding: 1.5px;
		position: relative;
		width: 1.2rem;
	}

	.battery-shell::after {
		background: currentColor;
		border-radius: 0 0.1rem 0.1rem 0;
		content: '';
		height: 0.3rem;
		left: calc(100% + 2px);
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		width: 2px;
	}

	.battery-level {
		background: currentColor;
		border-radius: 0.08rem;
		display: block;
		height: 100%;
	}

	@media (max-width: 48rem) and (display-mode: fullscreen) {
		.mobile-status-bar {
			display: flex;
		}
	}
</style>
