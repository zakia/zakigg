<script lang="ts">
	import DraggableValue from './DraggableValue.svelte';
	import type { ControlSectionSchema } from '#lib/home/particle-appearance.js';

	type Props = {
		sections: readonly ControlSectionSchema[];
	};

	let { sections }: Props = $props();
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
	<div class="section-stack">
		{#each sections as section, index (section.id)}
			{#if index > 0}
				<div class="divider" aria-hidden="true"></div>
			{/if}
			<section class="setting-section" aria-label={section.title}>
				<header class="section-header">
					<span class="section-title">{section.title}</span>
					{#if section.toggle}
						{@const toggle = section.toggle}
						<button
							type="button"
							class="mode-pill"
							class:active={toggle.enabled}
							aria-pressed={toggle.enabled}
							onclick={() => toggle.onChange(!toggle.enabled)}
						>
							{toggle.label}
						</button>
					{/if}
					{#if section.modes}
						{@const modes = section.modes}
						<div class="mode-group" role="group" aria-label={`${section.title} behaviour`}>
							{#each modes.options as option (option.value)}
								<button
									type="button"
									class="mode-pill"
									class:active={modes.value === option.value}
									aria-pressed={modes.value === option.value}
									onclick={() => modes.onChange(option.value)}
								>
									{option.label}
								</button>
							{/each}
						</div>
					{/if}
				</header>

				{#if section.controls.length > 0}
					<div class="setting-list">
						{#each section.controls as control (control.id)}
							<DraggableValue
								layout="row"
								label={control.label}
								value={control.value}
								defaultValue={control.defaultValue}
								min={control.min}
								max={control.max}
								step={control.step}
								pixelsPerStep={control.pixelsPerStep}
								format={control.format}
								onChange={control.onChange}
							/>
						{/each}
					</div>
				{/if}

				{#if section.action}
					{@const action = section.action}
					<button
						type="button"
						class="action-button"
						disabled={action.disabled}
						onclick={action.onClick}
					>
						{action.label}
					</button>
				{/if}
			</section>
		{/each}
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
		box-shadow: 0 12px 28px rgb(0 0 0 / 0.12);
		color: var(--content);
		inset: auto;
		left: calc(anchor(right) + 0.75rem);
		margin: 0;
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		padding: 0.7rem 0.85rem;
		position: fixed;
		position-anchor: --canvas-settings-trigger;
		top: max(1rem, min(calc(anchor(top) - 2rem), calc(100dvh - 26rem)));
		width: min(17.5rem, calc(100vw - 2rem));
	}

	.section-stack {
		display: grid;
		gap: 0.45rem;
	}

	.setting-section {
		display: grid;
		gap: 0.25rem;
	}

	.section-header {
		align-items: center;
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.35rem;
	}

	.section-title {
		color: var(--content-2);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.mode-group {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 0.35rem;
		display: inline-flex;
		gap: 0.1rem;
		padding: 0.1rem;
	}

	.mode-pill {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		color: var(--content-1);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		line-height: 1.2;
		padding: 0.15rem 0.4rem;
	}

	.mode-pill:hover {
		color: var(--content);
	}

	.mode-pill.active {
		background: var(--base-1);
		border-color: var(--edge);
		color: var(--brand);
	}

	.mode-pill:focus-visible,
	.action-button:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.setting-list {
		display: grid;
		gap: 0.22rem;
	}

	.action-button {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 0.35rem;
		color: var(--content);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		margin-top: 0.15rem;
		padding: 0.28rem 0.5rem;
		text-align: center;
	}

	.action-button:hover:not(:disabled) {
		border-color: var(--brand);
		color: var(--brand);
	}

	.action-button:disabled {
		color: var(--content-2);
		cursor: default;
		opacity: 0.55;
	}

	.divider {
		border-top: 1px solid var(--edge);
		margin-block: 0.1rem;
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
