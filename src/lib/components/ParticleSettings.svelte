<script lang="ts">
	import DraggableValue from './DraggableValue.svelte';
	import type { ClickMode } from '$lib/home/pointer-interaction';

	type Props = {
		count: number;
		defaultCount: number;
		restitution: number;
		clickMode: ClickMode;
		onCountChange: (count: number) => void;
		onRestitutionChange: (restitution: number) => void;
		onClickModeChange: (mode: ClickMode) => void;
	};

	let {
		count,
		defaultCount,
		restitution,
		clickMode,
		onCountChange,
		onRestitutionChange,
		onClickModeChange
	}: Props = $props();

	const tools: ReadonlyArray<{
		mode: Exclude<ClickMode, 'off'>;
		label: string;
		hint: string;
	}> = [
		{ mode: 'pull', label: 'Pull', hint: 'Click & hold to pull particles in' },
		{ mode: 'push', label: 'Push', hint: 'Click & hold to push particles away' },
		{ mode: 'draw', label: 'Draw', hint: 'Drag to draw collision walls' },
		{
			mode: 'erase',
			label: 'Erase',
			hint: 'Drag to spot-erase walls · Hold Shift to delete full stroke'
		}
	];

	function selectTool(mode: Exclude<ClickMode, 'off'>) {
		onClickModeChange(clickMode === mode ? 'off' : mode);
	}
</script>

<section class="particle-settings" aria-label="Particle settings">
	<DraggableValue
		label="Dots"
		value={count}
		defaultValue={defaultCount}
		min={0}
		step={1}
		pixelsPerStep={6}
		onChange={onCountChange}
	/>
	<DraggableValue
		label="Bounce"
		value={restitution}
		defaultValue={0.3}
		min={0}
		max={1}
		step={0.05}
		pixelsPerStep={10}
		format={(value) => value.toFixed(2)}
		onChange={onRestitutionChange}
	/>

	<span class="separator" aria-hidden="true"></span>

	<div class="click-tools" role="group" aria-label="Click behavior">
		{#each tools as tool (tool.mode)}
			{@const active = clickMode === tool.mode}
			<button
				type="button"
				class="tool-button"
				class:active
				aria-label={tool.label}
				aria-pressed={active}
				title={tool.hint}
				onclick={() => selectTool(tool.mode)}
			>
				{#if tool.mode === 'pull'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
						<path d="M4 4l4.5 4.5M8.5 5v3.5H5" />
						<path d="M20 4l-4.5 4.5M15.5 5v3.5H19" />
						<path d="M4 20l4.5-4.5M8.5 19v-3.5H5" />
						<path d="M20 20l-4.5-4.5M15.5 19v-3.5H19" />
					</svg>
				{:else if tool.mode === 'push'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
						<path d="M9 9L4 4M4 7.5V4h3.5" />
						<path d="M15 9l5-5M20 7.5V4h-3.5" />
						<path d="M9 15l-5 5M4 16.5V20h3.5" />
						<path d="M15 15l5 5M20 16.5V20h-3.5" />
					</svg>
				{:else if tool.mode === 'draw'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M4 20l3.8-1L18.4 8.4a2 2 0 0 0 0-2.8l-.8-.8a2 2 0 0 0-2.8 0L4.2 15.4 4 20z" />
						<path d="M13.5 6.5l4 4" />
					</svg>
				{:else if tool.mode === 'erase'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M19 20H8.5l-4.2-4.2a2 2 0 0 1 0-2.8l9.2-9.2a2 2 0 0 1 2.8 0l4.4 4.4a2 2 0 0 1 0 2.8L12 19.7" />
						<path d="M9.5 8.5l6 6" />
					</svg>
				{/if}
			</button>
		{/each}
	</div>
</section>

<style>
	.particle-settings {
		align-items: center;
		display: flex;
		gap: var(--s-1);
		justify-content: center;
	}

	.separator {
		background: var(--edge);
		height: 1rem;
		width: 1px;
	}

	.click-tools {
		align-items: center;
		background: color-mix(in oklch, var(--base-1) 80%, transparent);
		border: 1px solid var(--edge);
		border-radius: 999px;
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.15rem;
	}

	.tool-button {
		align-items: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 50%;
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		height: 1.55rem;
		justify-content: center;
		padding: 0;
		transition:
			color 140ms ease,
			background-color 140ms ease,
			border-color 140ms ease;
		width: 1.55rem;
	}

	.tool-button:hover {
		color: var(--content);
	}

	.tool-button.active {
		background: color-mix(in oklch, var(--brand) 16%, var(--base-1));
		border-color: color-mix(in oklch, var(--brand) 42%, var(--edge));
		color: var(--brand);
	}

	.tool-button:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.tool-button svg {
		height: 0.95rem;
		width: 0.95rem;
	}
</style>
