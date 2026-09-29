<script lang="ts">
	import DraggableValue from './DraggableValue.svelte';
	import { defaultPointerSettings } from '$lib/home/pointer-interaction';
	import {
		defaultParticleAppearance,
		type ParticleAppearance
	} from '$lib/home/particle-appearance';
	import { DEFAULT_MIN_ACCELERATION } from '$lib/home/physics';

	type PointerSettings = typeof defaultPointerSettings;
	type Props = {
		settings: PointerSettings;
		appearance: ParticleAppearance;
		minAcceleration: number;
		onSettingsChange: (settings: PointerSettings) => void;
		onAppearanceChange: (appearance: ParticleAppearance) => void;
		onMinAccelerationChange: (value: number) => void;
	};

	let {
		settings,
		appearance,
		minAcceleration,
		onSettingsChange,
		onAppearanceChange,
		onMinAccelerationChange
	}: Props = $props();

	function updateAppearance(key: keyof ParticleAppearance, value: number) {
		onAppearanceChange({ ...appearance, [key]: value });
	}

	function updatePress(key: 'growthMuPerSecond' | 'visualGrowthPerSecond', value: number) {
		onSettingsChange({ ...settings, press: { ...settings.press, [key]: value } });
	}
</script>

<button
	type="button"
	class="settings-trigger"
	popovertarget="canvas-settings-popover"
	aria-label="Canvas settings"
	title="Canvas settings"
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
		<path d="M3 6h10m4 0h4M3 12h3m4 0h11M3 18h10m4 0h4" stroke-linecap="round" />
		<circle cx="15" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="15" cy="18" r="2" />
	</svg>
</button>

<div
	id="canvas-settings-popover"
	class="settings-popover"
	popover="auto"
	role="dialog"
	aria-label="Canvas settings"
>
	<div class="setting-list">
		<DraggableValue
			layout="row"
			label="Dots opacity"
			value={appearance.dotOpacity}
			defaultValue={defaultParticleAppearance.dotOpacity}
			min={0}
			max={1}
			step={0.05}
			pixelsPerStep={14}
			format={(value) => `${Math.round(value * 100)}%`}
			onChange={(value) => updateAppearance('dotOpacity', value)}
		/>
		<DraggableValue
			layout="row"
			label="Links opacity"
			value={appearance.linkOpacity}
			defaultValue={defaultParticleAppearance.linkOpacity}
			min={0}
			max={1}
			step={0.05}
			pixelsPerStep={14}
			format={(value) => `${Math.round(value * 100)}%`}
			onChange={(value) => updateAppearance('linkOpacity', value)}
		/>
		<DraggableValue
			layout="row"
			label="Link radius"
			value={appearance.linkRadius}
			defaultValue={defaultParticleAppearance.linkRadius}
			min={0}
			step={10}
			pixelsPerStep={8}
			format={(value) => `${value} px`}
			onChange={(value) => updateAppearance('linkRadius', value)}
		/>
		<div class="divider" aria-hidden="true"></div>
		<DraggableValue
			layout="row"
			label="Hover push"
			value={settings.hover.mu}
			defaultValue={defaultPointerSettings.hover.mu}
			min={0}
			step={5000}
			format={(value) => `${Math.round(value / 1000)}k`}
			onChange={(value) =>
				onSettingsChange({ ...settings, hover: { ...settings.hover, mu: value } })}
		/>
		<DraggableValue
			layout="row"
			label="Pull growth"
			value={settings.press.growthMuPerSecond}
			defaultValue={defaultPointerSettings.press.growthMuPerSecond}
			min={0}
			step={100000}
			format={(value) => `${(value / 1_000_000).toFixed(1)}M/s`}
			onChange={(value) => updatePress('growthMuPerSecond', value)}
		/>
		<DraggableValue
			layout="row"
			label="Core growth"
			value={settings.press.visualGrowthPerSecond}
			defaultValue={defaultPointerSettings.press.visualGrowthPerSecond}
			min={0}
			step={1}
			format={(value) => `${value} px/s`}
			onChange={(value) => updatePress('visualGrowthPerSecond', value)}
		/>
		<DraggableValue
			layout="row"
			label="Min acceleration"
			value={minAcceleration}
			defaultValue={DEFAULT_MIN_ACCELERATION}
			min={0}
			step={0.05}
			pixelsPerStep={16}
			format={(value) => `${value.toFixed(2)} px/s²`}
			onChange={onMinAccelerationChange}
		/>
	</div>
</div>

<style>
	.settings-trigger {
		align-items: center;
		anchor-name: --canvas-settings-trigger;
		background: transparent;
		border: 0;
		border-radius: 50%;
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		flex: none;
		height: 1.7rem;
		justify-content: center;
		padding: 0;
		width: 1.7rem;
	}

	.settings-trigger:hover {
		color: var(--brand);
	}

	.settings-trigger svg {
		height: 1.1rem;
		width: 1.1rem;
	}

	.settings-trigger:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.settings-popover {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: 0 12px 28px rgb(0 0 0 / 0.09);
		color: var(--content);
		inset: auto;
		left: calc(anchor(right) + 0.75rem);
		margin: 0;
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		padding: 0.65rem 0.8rem;
		position: fixed;
		position-anchor: --canvas-settings-trigger;
		top: max(1rem, min(calc(anchor(top) - 4rem), calc(100dvh - 17rem)));
		width: min(16rem, calc(100vw - 2rem));
	}

	.setting-list {
		display: grid;
		gap: 0.3rem;
	}

	.divider {
		border-top: 1px solid var(--edge);
		margin-block: 0.15rem;
	}

	@supports not (top: anchor(top)) {
		.settings-popover {
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
		}
	}

	@media (max-width: 48rem) {
		.settings-popover {
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
		}
	}
</style>
