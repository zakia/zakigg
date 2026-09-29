<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import HueSlider from '$lib/components/HueSlider.svelte';
	import { theme, themeHues } from '$lib/theme.svelte';

	type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

	let customOpen = $state(false);
	let customPicker: HTMLDetailsElement;
	let copyFeedback = $state<{ format: ColorFormat; value: string; success: boolean } | null>(null);
	let copyMessage = $state('');
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
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

	async function copyColor(format: ColorFormat) {
		const value = colorCodes[format];
		try {
			await navigator.clipboard.writeText(value);
			copyFeedback = { format, value, success: true };
			copyMessage = `${format.toUpperCase()} color copied`;
		} catch {
			copyFeedback = { format, value, success: false };
			copyMessage = 'Could not copy color';
		}
		clearTimeout(copyFeedbackTimer);
		copyFeedbackTimer = setTimeout(() => {
			copyFeedback = null;
			copyMessage = '';
		}, 1800);
	}

	onMount(() => {
		function closeOnOutsideClick(event: PointerEvent) {
			if (!customPicker.contains(event.target as Node)) customOpen = false;
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key !== 'Escape' || !customOpen) return;
			event.preventDefault();
			customOpen = false;
			customPicker.querySelector('summary')?.focus();
		}

		document.addEventListener('pointerdown', closeOnOutsideClick);
		document.addEventListener('keydown', closeOnEscape);

		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick);
			document.removeEventListener('keydown', closeOnEscape);
			clearTimeout(copyFeedbackTimer);
		};
	});
</script>

<section class="theme-controls" aria-label="Appearance controls">
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
				onclick={() => {
					theme.setHue(String(color.value));
					customOpen = false;
				}}
				aria-label={`${color.label} theme`}
				aria-pressed={Number(theme.hue) === color.value}
				title={color.label}
			></button>
		{/each}

		<details class="custom-picker" bind:this={customPicker} bind:open={customOpen}>
			<summary class:is-active={isCustomHue} aria-label="Custom color" title="Custom color"
			></summary>
			<div class="slider-card">
				<HueSlider
					value={Number(theme.hue)}
					onValueChange={(value) => theme.setHue(String(value))}
				/>
				<dl class="color-codes" aria-label="Brand color codes">
					<div>
						<dt>HEX</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								onclick={() => copyColor('hex')}
								aria-label={`Copy HEX color ${colorCodes.hex}`}
							>
								<code>{colorCodes.hex}</code><span
									class:visible={copyFeedback?.format === 'hex' &&
										copyFeedback.value === colorCodes.hex}
									aria-hidden="true">{copyFeedback?.success ? 'Copied' : 'Try again'}</span
								>
							</button>
						</dd>
					</div>
					<div>
						<dt>RGB</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								onclick={() => copyColor('rgb')}
								aria-label={`Copy RGB color ${colorCodes.rgb}`}
							>
								<code>{colorCodes.rgb}</code><span
									class:visible={copyFeedback?.format === 'rgb' &&
										copyFeedback.value === colorCodes.rgb}
									aria-hidden="true">{copyFeedback?.success ? 'Copied' : 'Try again'}</span
								>
							</button>
						</dd>
					</div>
					<div>
						<dt>HSL</dt>
						<dd>
							<button
								type="button"
								class="copy-value"
								onclick={() => copyColor('hsl')}
								aria-label={`Copy HSL color ${colorCodes.hsl}`}
							>
								<code>{colorCodes.hsl}</code><span
									class:visible={copyFeedback?.format === 'hsl' &&
										copyFeedback.value === colorCodes.hsl}
									aria-hidden="true">{copyFeedback?.success ? 'Copied' : 'Try again'}</span
								>
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
								onclick={() => copyColor('oklch')}
								aria-label={`Copy OKLCH color ${colorCodes.oklch}`}
							>
								<code>{colorCodes.oklch}</code><span
									class:visible={copyFeedback?.format === 'oklch' &&
										copyFeedback.value === colorCodes.oklch}
									aria-hidden="true">{copyFeedback?.success ? 'Copied' : 'Try again'}</span
								>
							</button>
						</dd>
					</div>
				</dl>
				<p class="sr-only" role="status">{copyMessage}</p>
			</div>
		</details>
	</div>
</section>

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
	summary {
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
	summary.is-active {
		outline: 2px solid var(--brand);
		outline-offset: 3px;
	}

	.custom-picker {
		flex: none;
	}

	summary {
		background: conic-gradient(
			oklch(77% 0.14 25),
			oklch(77% 0.14 85),
			oklch(77% 0.14 145),
			oklch(77% 0.14 240),
			oklch(77% 0.14 290),
			oklch(77% 0.14 25)
		);
		box-shadow: 0 2px 9px color-mix(in oklch, var(--brand) 23%, transparent);
		display: block;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.theme-mode-toggle:focus-visible,
	.theme-preset:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 3px;
	}

	.slider-card {
		--hue-track-size: 1.25rem;
		--hue-thumb-size: 1.8rem;
		--hue-output-gap: -0.125rem;
		background: color-mix(in srgb, var(--base) 92%, transparent);
		border-radius: var(--radius-lg);
		box-sizing: border-box;
		left: calc(100% + 1rem);
		padding: 1.375rem 1rem 0.25rem;
		position: absolute;
		top: 0;
		width: min(19rem, calc(100vw - 2rem));
		z-index: 2;
	}

	@media (max-width: 60rem) {
		.slider-card {
			left: 50%;
			top: calc(100% + 6.5rem);
			transform: translateX(-50%);
		}
	}

	@media (max-width: 60rem) and (max-height: 45rem) {
		.slider-card {
			bottom: calc(var(--mobile-nav-height) + 0.25rem);
			left: 50vw;
			position: fixed;
			top: auto;
		}
	}

	.slider-card :global(.hue-output-position output) {
		opacity: 1;
		padding-block: 0;
	}

	.color-codes {
		display: grid;
		gap: 0.2rem;
		margin: 0.125rem 0 0;
	}

	.color-codes > div {
		align-items: baseline;
		display: grid;
		font-size: 0.68rem;
		grid-template-columns: 4.5rem minmax(0, 1fr);
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
		line-height: 1.2;
		margin: 0;
		min-width: 0;
	}

	.color-codes code {
		color: var(--content);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.copy-value {
		align-items: baseline;
		background: transparent;
		border: 0;
		border-radius: 0.25rem;
		cursor: copy;
		display: flex;
		font-family: var(--font-mono);
		gap: 0.25rem;
		justify-content: space-between;
		padding: 0;
		text-align: left;
		width: 100%;
	}

	.copy-value:hover code {
		color: var(--brand);
	}

	.copy-value:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.copy-value span {
		color: var(--brand);
		font-size: 0.6rem;
		opacity: 0;
		text-align: right;
		transition: opacity 150ms ease;
		width: 3.6rem;
	}

	.copy-value span.visible {
		opacity: 1;
	}
</style>
