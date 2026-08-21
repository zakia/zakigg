<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { theme, themeHues } from '$lib/theme.svelte';
</script>

<section class="appearance-controls" aria-label="Appearance playground">
	<label class="hue-slider" style={`--hue-position: ${(Number(theme.hue) / 360) * 100}%`}>
		<input
			type="range"
			min="0"
			max="360"
			step="1"
			value={theme.hue}
			oninput={(event) => theme.setHue(event.currentTarget.value)}
			aria-label={`Hue: ${theme.hue} degrees`}
		/>
		<span class="value-track" aria-hidden="true">
			<span class="value-position">
				<output>{theme.hue}°</output>
			</span>
		</span>
	</label>

	<div class="preset-row">
		<button
			type="button"
			class="theme-toggle"
			onclick={theme.toggle}
			aria-label={theme.mode === 'light' ? 'Use dark mode' : 'Use light mode'}
			title={theme.mode === 'light' ? 'Dark mode' : 'Light mode'}
		>
			<Icon icon={theme.mode === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
		</button>

		<div class="presets" role="group" aria-label="Color presets">
			{#each themeHues as color (color.value)}
				<button
					type="button"
					class="swatch"
					class:active={Number(theme.hue) === color.value}
					style={`--swatch-hue: ${color.value}`}
					onclick={() => theme.setHue(String(color.value))}
					aria-label={`${color.label} theme`}
					aria-pressed={Number(theme.hue) === color.value}
					title={color.label}
				></button>
			{/each}
		</div>
	</div>
</section>

<style>
	.appearance-controls {
		display: grid;
		gap: var(--s0);
		width: min(28rem, calc(100vw - 2rem));
	}

	.preset-row {
		align-items: center;
		display: flex;
		gap: var(--s0);
		justify-content: center;
	}

	button {
		border: 0;
		cursor: pointer;
		flex: none;
	}

	.theme-toggle {
		align-items: center;
		background: color-mix(in oklch, var(--base-2) 88%, transparent);
		border: 1px solid var(--edge);
		border-radius: 999px;
		color: var(--content);
		display: flex;
		height: 3rem;
		justify-content: center;
		width: 3rem;
	}

	.theme-toggle :global(svg) {
		height: 1.5rem;
		width: 1.5rem;
	}

	.presets {
		display: flex;
		gap: var(--s-1);
	}

	.swatch {
		background: oklch(65% 0.2 var(--swatch-hue));
		border: 3px solid transparent;
		border-radius: 999px;
		height: 2rem;
		outline: 1px solid color-mix(in oklch, var(--content) 18%, transparent);
		outline-offset: -1px;
		padding: 0;
		width: 2rem;
	}

	.swatch.active {
		border-color: var(--base);
		outline: 2px solid var(--content);
	}

	.hue-slider {
		display: block;
		padding-block: 0.5rem;
		position: relative;
	}

	.value-track {
		inset: 0 0.75rem;
		pointer-events: none;
		position: absolute;
	}

	.value-position {
		bottom: 2rem;
		display: flex;
		justify-content: center;
		left: var(--hue-position);
		position: absolute;
		width: 0;
	}

	.value-position output {
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

	.hue-slider:hover .value-position output,
	.hue-slider:focus-within .value-position output {
		opacity: 1;
	}

	input[type='range'] {
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
		height: 0.75rem;
		margin: 0;
		width: 100%;
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		background: var(--brand);
		border: 2px solid var(--base);
		border-radius: 999px;
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--content) 25%, transparent);
		height: 1.5rem;
		width: 1.5rem;
	}

	input[type='range']::-moz-range-thumb {
		background: var(--brand);
		border: 2px solid var(--base);
		border-radius: 999px;
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--content) 25%, transparent);
		height: 1.25rem;
		width: 1.25rem;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}
</style>
