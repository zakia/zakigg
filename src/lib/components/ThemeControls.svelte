<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import InfoTip from '#lib/components/InfoTip.svelte';
	import HueSlider from '#lib/components/HueSlider.svelte';
	import { copyToClipboard } from '#lib/attachments/copy-to-clipboard.js';
	import CompactThemeControls from '#lib/components/CompactThemeControls.svelte';
	import { theme, themeHues } from '#lib/theme.svelte.js';

	let { variant = 'bar' }: { variant?: 'bar' | 'compact' } = $props();

	const isCustomHue = $derived(!themeHues.some((color) => color.value === Number(theme.hue)));
	const colorCodes = $derived(getColorCodes(Number(theme.hue)));

	function getColorCodes(hue: number) {
		const oklch = `oklch(65% 0.2 ${hue})`;
		if (typeof document === 'undefined') return { hex: '', rgb: '', hsl: '', oklch };

		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d')!;
		context.fillStyle = oklch;
		context.fillRect(0, 0, 1, 1);
		const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
		const hex = `#${[red, green, blue]
			.map((value) => value.toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase()}`;
		const rgb = `rgb(${red}, ${green}, ${blue})`;

		const [r, g, b] = [red, green, blue].map((value) => value / 255);
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const delta = max - min;
		const lightness = (max + min) / 2;
		const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
		let hueDegrees = 0;
		if (delta !== 0) {
			if (max === r) hueDegrees = ((g - b) / delta) % 6;
			else if (max === g) hueDegrees = (b - r) / delta + 2;
			else hueDegrees = (r - g) / delta + 4;
			hueDegrees = (hueDegrees * 60 + 360) % 360;
		}
		const hsl = `hsl(${Math.round(hueDegrees)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`;

		return { hex, rgb, hsl, oklch };
	}
</script>

{#if variant === 'compact'}
	<CompactThemeControls />
{:else}
	<section
		class="theme-controls"
		aria-label="Appearance controls"
	>
		<div class="theme-options" role="group" aria-label="Theme and color">
			<button
				type="button"
				class="theme-mode-toggle"
				onclick={theme.toggle}
				aria-label={theme.mode === 'light' ? 'Use dark mode' : 'Use light mode'}
				title={theme.mode === 'light' ? 'Dark mode' : 'Light mode'}
			>
				<Icon icon={theme.mode === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
			</button>

			{#each themeHues as color (color.value)}
				<button
					type="button"
					class="theme-preset"
					class:is-active={Number(theme.hue) === color.value}
					style={`--preset-hue: ${color.value}`}
					onclick={() => theme.setHue(String(color.value))}
					aria-label={`${color.label} theme`}
					aria-pressed={Number(theme.hue) === color.value}
					title={color.label}
				></button>
			{/each}

			<button
				type="button"
				class="custom-swatch"
				class:is-active={isCustomHue}
				popovertarget="custom-hue-popover"
				aria-label="Custom color"
				title="Custom color"
			></button>

			<div
				id="custom-hue-popover"
				popover="auto"
				class="slider-card"
				role="dialog"
				aria-label="Custom hue settings"
			>
				<div class="hue-row">
					<HueSlider
						value={Number(theme.hue)}
						onValueChange={(value) => theme.setHue(String(value))}
					/>
					<output class="hue-value">{theme.hue}°</output>
				</div>
				<dl class="color-codes" aria-label="Brand color codes">
					<div>
						<dt>HEX</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								{@attach copyToClipboard(() => colorCodes.hex, 'HEX color')}
								aria-label={`Copy HEX color ${colorCodes.hex}`}
							>
								<code>{colorCodes.hex}</code>
							</button>
						</dd>
					</div>
					<div>
						<dt>RGB</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								{@attach copyToClipboard(() => colorCodes.rgb, 'RGB color')}
								aria-label={`Copy RGB color ${colorCodes.rgb}`}
							>
								<code>{colorCodes.rgb}</code>
							</button>
						</dd>
					</div>
					<div>
						<dt>HSL</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								{@attach copyToClipboard(() => colorCodes.hsl, 'HSL color')}
								aria-label={`Copy HSL color ${colorCodes.hsl}`}
							>
								<code>{colorCodes.hsl}</code>
							</button>
						</dd>
					</div>
					<div>
						<dt>
							OKLCH
							<InfoTip
								label="What is OKLCH?"
								text="OKLCH describes color by perceived lightness, chroma, and hue. This palette keeps lightness and chroma fixed as the hue changes."
							/>
						</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								{@attach copyToClipboard(() => colorCodes.oklch, 'OKLCH color')}
								aria-label={`Copy OKLCH color ${colorCodes.oklch}`}
							>
								<code>{colorCodes.oklch}</code>
							</button>
						</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>
{/if}

<style>
	.theme-controls {
		position: relative;
		width: fit-content;
	}

	.theme-options {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		justify-content: center;
	}

	.theme-mode-toggle,
	.theme-preset,
	.custom-swatch {
		border: 0;
		border-radius: 50%;
		box-sizing: border-box;
		cursor: pointer;
		flex: none;
		height: 2.25rem;
		padding: 0;
		width: 2.25rem;
	}

	.theme-mode-toggle {
		align-items: center;
		background: transparent;
		color: var(--content);
		display: flex;
		justify-content: center;
	}

	.theme-mode-toggle :global(svg) {
		height: 1.9rem;
		width: 1.9rem;
	}

	.theme-preset {
		background: oklch(77% 0.14 var(--preset-hue));
		box-shadow: 0 2px 9px oklch(70% 0.16 var(--preset-hue) / 0.24);
	}

	.theme-preset.is-active,
	.custom-swatch.is-active {
		outline: 2px solid var(--brand);
		outline-offset: 3px;
	}

	.custom-swatch {
		anchor-name: --custom-hue-swatch;
		background: conic-gradient(
			oklch(77% 0.14 25),
			oklch(77% 0.14 85),
			oklch(77% 0.14 145),
			oklch(77% 0.14 240),
			oklch(77% 0.14 290),
			oklch(77% 0.14 25)
		);
		box-shadow: 0 2px 9px color-mix(in oklch, var(--brand) 23%, transparent);
	}

	.theme-mode-toggle:focus-visible,
	.theme-preset:focus-visible,
	.custom-swatch:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 3px;
	}

	.slider-card {
		--hue-track-size: 1.25rem;
		--hue-thumb-size: 1.8rem;
		--hue-output-gap: -0.125rem;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: 0 16px 36px rgb(0 0 0 / 0.14);
		box-sizing: border-box;
		color: var(--content);
		inset: auto;
		left: calc(anchor(right) + 0.75rem);
		margin: 0;
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		padding: 0.6rem 0.75rem 0.7rem;
		position: fixed;
		position-anchor: --custom-hue-swatch;
		top: max(1rem, min(calc(anchor(top) - 2rem), calc(100dvh - 22rem)));
		width: min(16.5rem, calc(100vw - 1.5rem));
	}

	@supports not (top: anchor(top)) {
		.slider-card {
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
		}
	}

	@media (max-width: 48rem) {
		.slider-card {
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
		}
	}

	@media (max-width: 25rem) {
		.color-codes > div {
			grid-template-columns: 3.5rem minmax(0, 1fr);
		}
	}

	.hue-row {
		align-items: center;
		display: flex;
		gap: 0.65rem;
	}

	.hue-row :global(.hue-control) {
		flex: 1;
		min-width: 0;
		padding-block: 0;
	}

	.hue-row :global(.hue-output-track) {
		display: none;
	}

	.hue-value {
		color: var(--content);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		width: 4ch;
	}

	.color-codes {
		display: grid;
		gap: 0.2rem;
		margin: 0.8rem 0 0;
	}

	.color-codes > div {
		align-items: baseline;
		display: grid;
		font-size: 0.68rem;
		grid-template-columns: 4rem minmax(0, 1fr);
		line-height: 1.2;
		min-width: 0;
	}

	.color-codes dt {
		align-items: center;
		color: var(--content);
		display: inline-flex;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		gap: 0.1rem;
		letter-spacing: 0.06em;
		line-height: 1.2;
		margin: 0;
	}

	.color-codes dd {
		justify-self: end;
		line-height: 1.2;
		margin: 0;
		min-width: 0;
		text-align: right;
	}

	.color-codes code {
		color: var(--content);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.copy-value {
		background: transparent;
		border: 0;
		border-radius: 0.25rem;
		cursor: copy;
		display: inline-flex;
		font-family: var(--font-mono);
		padding: 0;
		text-align: left;
	}

	.copy-value:hover code {
		color: var(--brand);
	}

	.copy-value:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}
</style>
