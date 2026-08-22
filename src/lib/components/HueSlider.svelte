<script lang="ts">
	let {
		value,
		onValueChange
	}: {
		value: number;
		onValueChange: (value: number) => void;
	} = $props();

	const position = $derived(`${(value / 360) * 100}%`);
</script>

<label class="hue-control" style={`--hue-position: ${position}`}>
	<input
		class="hue-input"
		type="range"
		min="0"
		max="360"
		step="1"
		{value}
		oninput={(event) => onValueChange(Number(event.currentTarget.value))}
		aria-label={`Hue: ${value} degrees`}
	/>

	<span class="hue-output-track" aria-hidden="true">
		<span class="hue-output-position">
			<output>{value}°</output>
		</span>
	</span>
</label>

<style>
	.hue-control {
		--track-size: 1.5rem;
		--thumb-size: calc(var(--track-size) * 1.5);
		--output-gap: var(--s-4);
		display: block;
		padding-block: 0.5rem;
		position: relative;
	}

	.hue-input {
		appearance: none;
		background: linear-gradient(
			to right,
			oklch(70% 0.2 0),
			oklch(70% 0.2 60),
			oklch(70% 0.2 120),
			oklch(70% 0.2 180),
			oklch(70% 0.2 240),
			oklch(70% 0.2 300),
			oklch(70% 0.2 360)
		);
		border-radius: 999px;
		cursor: ew-resize;
		display: block;
		height: var(--track-size);
		margin: 0;
		width: 100%;
	}

	.hue-input:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}

	.hue-output-track {
		inset: 0 calc(var(--thumb-size) / 2);
		pointer-events: none;
		position: absolute;
	}

	.hue-output-position {
		bottom: calc(50% + var(--thumb-size) / 2 + var(--output-gap));
		display: flex;
		justify-content: center;
		left: var(--hue-position);
		position: absolute;
		width: 0;
	}

	.hue-output-position output {
		border-radius: 0.35rem;
		color: var(--content);
		flex: none;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		opacity: 0;
		padding: 0.25rem 0.4rem;
		transition: opacity 120ms ease;
	}

	.hue-control:hover .hue-output-position output,
	.hue-control:focus-within .hue-output-position output {
		opacity: 1;
	}

	/* Keep these separate: an unknown vendor pseudo-element can invalidate a
	   combined selector in the other engine. */
	.hue-input::-webkit-slider-thumb {
		appearance: none;
		background: var(--brand);
		border: 2px solid var(--base);
		border-radius: 999px;
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--content) 25%, transparent);
		height: var(--thumb-size);
		width: var(--thumb-size);
	}

	.hue-input::-moz-range-thumb {
		background: var(--brand);
		border: 2px solid var(--base);
		border-radius: 999px;
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--content) 25%, transparent);
		height: var(--thumb-size);
		width: var(--thumb-size);
	}
</style>
