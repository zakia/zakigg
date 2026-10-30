<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { clickOutside } from '#lib/attachments/click-outside.js';
	import { springLinear } from '#lib/utils/spring.js';
	import { theme, themeHues } from '#lib/theme.svelte.js';

	let expanded = $state(false);
	let displayedColors = $state(themeHues.filter((c) => c.value !== Number(theme.hue)));

	// Exact Motion.dev harmonic oscillator parameters
	// mass: inertia, stiffness: spring tension, damping: braking resistance
	const mass = 1;
	const stiffness = 240;
	const damping = 20;

	const spring = springLinear({
		mass,
		stiffness,
		damping,
		velocity: 0
	});

	let closeTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => () => clearTimeout(closeTimeout));

	function openPalette() {
		clearTimeout(closeTimeout);
		displayedColors = themeHues.filter((c) => c.value !== Number(theme.hue));
		expanded = true;
	}

	function closePalette() {
		expanded = false;
		clearTimeout(closeTimeout);
		closeTimeout = setTimeout(() => {
			displayedColors = themeHues.filter((c) => c.value !== Number(theme.hue));
		}, spring.duration);
	}
</script>

<div
	class="compact-theme-controls"
	class:is-expanded={expanded}
	style={`--spring-duration: ${spring.duration}ms; --spring-ease: ${spring.css};`}
	{@attach clickOutside(closePalette, { enabled: () => expanded })}
	role="group"
	aria-label="Theme and color controls"
>
	<div class="swatch-cluster">
		<div class="popout-swatches" role="group" aria-label="Theme color options">
			{#each displayedColors as color, i (i)}
				{@const slotOffset = displayedColors.length - i}
				<div
					class="swatch-slot"
					style={`--slot-offset: ${slotOffset};`}
				>
					<button
						type="button"
						class="swatch-button"
						style={`--preset-hue: ${color.value};`}
						onclick={() => {
							theme.setHue(String(color.value));
							closePalette();
						}}
						aria-label={`${color.label} theme`}
						title={color.label}
						tabindex={expanded ? 0 : -1}
					></button>
				</div>
			{/each}
		</div>

		<button
			type="button"
			class="color-trigger"
			class:is-active={expanded}
			onclick={() => (expanded ? closePalette() : openPalette())}
			aria-label={expanded ? 'Close color options' : 'Change theme color'}
			aria-expanded={expanded}
			title={expanded ? 'Close color options' : 'Change theme color'}
		></button>
	</div>

	<button
		type="button"
		class="mode-toggle"
		onclick={theme.toggle}
		aria-label={theme.mode === 'light' ? 'Use dark mode' : 'Use light mode'}
		title={theme.mode === 'light' ? 'Dark mode' : 'Light mode'}
	>
		<Icon icon={theme.mode === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
	</button>
</div>

<style>
	.compact-theme-controls {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		position: relative;
		width: fit-content;
	}

	.swatch-cluster {
		align-items: center;
		display: inline-flex;
		position: relative;
	}

	.popout-swatches {
		align-items: center;
		bottom: 0;
		display: flex;
		gap: var(--s-2);
		pointer-events: none;
		position: absolute;
		right: calc(100% + var(--s-2));
		top: 0;
		z-index: 1;
	}

	.swatch-slot {
		align-items: center;
		display: flex;
		height: 1.95rem;
		justify-content: center;
		opacity: 0;
		pointer-events: none;
		transform: translateX(calc(var(--slot-offset) * (1.95rem + var(--s-2))));
		transition:
			transform var(--spring-duration) var(--spring-ease),
			opacity var(--spring-duration) var(--spring-ease);
		width: 1.95rem;
		will-change: transform, opacity;
	}

	.compact-theme-controls.is-expanded .swatch-slot {
		opacity: 1;
		pointer-events: auto;
		transform: translateX(0);
	}

	.swatch-button {
		background: oklch(77% 0.14 var(--preset-hue));
		border: 0;
		border-radius: 50%;
		box-shadow: 0 2px 9px oklch(70% 0.16 var(--preset-hue) / 0.24);
		box-sizing: border-box;
		cursor: pointer;
		height: 1.95rem;
		padding: 0;
		transform: scale(1);
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease;
		width: 1.95rem;
	}

	.swatch-button:hover {
		box-shadow: 0 4px 14px oklch(70% 0.22 var(--preset-hue) / 0.42);
		transform: scale(1.14);
	}

	.swatch-button:active {
		transform: scale(0.95);
	}

	.color-trigger {
		background: oklch(77% 0.14 var(--hue));
		border: 0;
		border-radius: 50%;
		box-shadow: 0 2px 9px color-mix(in oklch, var(--brand) 28%, transparent);
		box-sizing: border-box;
		cursor: pointer;
		flex: none;
		height: 1.95rem;
		padding: 0;
		position: relative;
		transform: scale(1);
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease;
		width: 1.95rem;
		z-index: 2;
	}

	.color-trigger:hover {
		box-shadow: 0 4px 14px color-mix(in oklch, var(--brand) 38%, transparent);
		transform: scale(1.1);
	}

	.color-trigger.is-active {
		outline: 2px solid var(--brand);
		outline-offset: 3px;
		transform: scale(1);
	}

	.mode-toggle {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: 50%;
		box-sizing: border-box;
		color: var(--content);
		cursor: pointer;
		display: flex;
		flex: none;
		height: 2.15rem;
		justify-content: center;
		padding: 0;
		width: 2.15rem;
	}

	.mode-toggle :global(svg) {
		height: 1.8rem;
		width: 1.8rem;
	}

	.color-trigger:focus-visible,
	.mode-toggle:focus-visible,
	.swatch-button:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 3px;
	}
</style>
