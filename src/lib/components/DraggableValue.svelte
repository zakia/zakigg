<script lang="ts">
	type Props = {
		label: string;
		value: number;
		defaultValue: number;
		min?: number;
		max?: number;
		step?: number;
		pixelsPerStep?: number;
		format?: (value: number) => string;
		onChange: (value: number) => void;
	};

	let {
		label,
		value,
		defaultValue,
		min = -Infinity,
		max = Infinity,
		step = 1,
		pixelsPerStep = 8,
		format = String,
		onChange
	}: Props = $props();

	let dragging = $state(false);
	let didDrag = false;
	const modified = $derived(Math.abs(value - defaultValue) > step / 1000);

	function constrain(nextValue: number) {
		const stepped = Math.round(nextValue / step) * step;
		const precision = Math.max(0, (String(step).split('.')[1] ?? '').length);
		return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision));
	}

	function startDrag(event: PointerEvent) {
		const control = event.currentTarget as HTMLButtonElement;
		const startX = event.clientX;
		const startValue = value;

		event.preventDefault();
		control.setPointerCapture(event.pointerId);
		dragging = true;
		didDrag = false;

		function update(dragEvent: PointerEvent) {
			dragEvent.preventDefault();
			const distance = dragEvent.clientX - startX;
			if (Math.abs(distance) > 3) didDrag = true;
			onChange(constrain(startValue + Math.round(distance / pixelsPerStep) * step));
		}

		function finish() {
			dragging = false;
			control.removeEventListener('pointermove', update);
			control.removeEventListener('lostpointercapture', finish);
		}

		control.addEventListener('pointermove', update);
		control.addEventListener('lostpointercapture', finish);
	}

	function reset() {
		if (didDrag) {
			didDrag = false;
			return;
		}

		onChange(constrain(defaultValue));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		onChange(constrain(value + (event.key === 'ArrowRight' ? step : -step)));
	}
</script>

<div class="draggable-value">
	<button
		type="button"
		class:dragging
		onclick={reset}
		onkeydown={handleKeydown}
		onpointerdown={startDrag}
		aria-label={`${label}: ${format(value)}. Drag to adjust or click to reset to ${format(defaultValue)}.`}
	>
		<span>{label}:</span>
		<output>{format(value)}</output>
		<span class="modified-dot" class:visible={modified} aria-hidden="true"></span>
	</button>
	<span class="hint" aria-hidden="true">Drag to adjust · Click to reset</span>
</div>

<style>
	.draggable-value {
		align-items: center;
		display: flex;
		font-family: var(--font-mono);
		justify-content: center;
		position: relative;
	}

	button {
		align-items: baseline;
		background: transparent;
		border: 0;
		color: var(--content);
		cursor: ew-resize;
		display: flex;
		font: inherit;
		font-size: 0.78rem;
		gap: 0.35rem;
		padding: 0.2rem 0.4rem;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	button.dragging,
	button:hover output {
		color: var(--brand);
	}

	output {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		transition: color 120ms ease;
	}

	.modified-dot {
		align-self: center;
		background: var(--brand);
		border-radius: 50%;
		height: 0.3rem;
		opacity: 0;
		transition: opacity 120ms ease;
		width: 0.3rem;
	}

	.modified-dot.visible {
		opacity: 1;
	}

	.hint {
		font-size: 0.65rem;
		opacity: 0;
		pointer-events: none;
		position: absolute;
		top: 100%;
		transition: opacity 120ms ease;
		white-space: nowrap;
	}

	.draggable-value:hover .hint,
	.draggable-value:focus-within .hint {
		opacity: 0.45;
	}

	button:focus-visible {
		border-radius: 0.25rem;
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}
</style>
