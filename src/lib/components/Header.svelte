<script lang="ts">
	import { onMount } from 'svelte';
	import DraggableValue from '#lib/components/DraggableValue.svelte';
	import HueSlider from '#lib/components/HueSlider.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import NavigationLinks from '#lib/components/NavigationLinks.svelte';
	import {
		DEFAULT_GRID_DOT_SIZE,
		DEFAULT_GRID_FIXED,
		DEFAULT_GRID_SPACING,
		useGridSettings
	} from '#lib/grid-settings.svelte.js';
	import { theme, themeHues } from '#lib/theme.svelte.js';
	import { clamp } from '#lib/utils/index.js';

	let desktopDock = $state<HTMLElement>();
	const grid = useGridSettings();
	const gridCustomized = $derived(
		grid.spacing !== DEFAULT_GRID_SPACING ||
			grid.dotSize !== DEFAULT_GRID_DOT_SIZE ||
			grid.fixed !== DEFAULT_GRID_FIXED
	);

	onMount(() => {
		const dock = desktopDock;
		if (!dock) return;

		const handleMouseMove = (event: MouseEvent) => {
			if (window.matchMedia('(pointer: coarse)').matches) return;

			for (const item of dock.querySelectorAll<HTMLElement>('[data-dock-item]')) {
				const { left, width } = item.getBoundingClientRect();
				const distance = Math.abs(left + width / 2 - event.clientX);
				const scale = clamp(2 - distance / 100, 1, 2);
				item.animate(
					{ width: `${scale * 3}rem`, height: `${scale * 2.5}rem` },
					{ duration: 500, fill: 'forwards' }
				);
			}
		};
		const resetItems = () => {
			for (const item of dock.querySelectorAll<HTMLElement>('[data-dock-item]')) {
				item.animate({ width: '3rem', height: '2.5rem' }, { duration: 100, fill: 'forwards' });
			}
		};

		dock.addEventListener('mousemove', handleMouseMove);
		dock.addEventListener('mouseleave', resetItems);

		return () => {
			dock.removeEventListener('mousemove', handleMouseMove);
			dock.removeEventListener('mouseleave', resetItems);
		};
	});
</script>

<header bind:this={desktopDock} class="desktop-dock" aria-label="Desktop navigation">
	<NavigationLinks variant="dock" />
</header>

<nav class="mobile-nav" aria-label="Primary navigation">
	<NavigationLinks variant="mobile" />
</nav>

<div
	id="site-appearance-popover"
	class="appearance-popover"
	popover="auto"
	role="dialog"
	aria-label="Appearance settings"
>
	<div class="section-stack">
		<section class="setting-section" aria-label="Theme">
			<header class="section-header">
				<span class="section-title">Theme</span>
				<button
					type="button"
					class="mode-pill"
					onclick={theme.toggle}
					aria-label={theme.mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
				>
					<Icon icon={theme.mode === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
					<span>{theme.mode === 'light' ? 'Light' : 'Dark'}</span>
				</button>
			</header>
			<div class="swatch-row" role="group" aria-label="Theme presets">
				{#each themeHues as color (color.value)}
					<button
						type="button"
						class="theme-swatch"
						class:is-active={Number(theme.hue) === color.value}
						style={`--preset-hue: ${color.value}`}
						onclick={() => theme.setHue(String(color.value))}
						aria-label={`${color.label} theme`}
						aria-pressed={Number(theme.hue) === color.value}
						title={color.label}
					></button>
				{/each}
			</div>
			<div class="hue-row">
				<HueSlider
					value={Number(theme.hue)}
					onValueChange={(value) => theme.setHue(String(value))}
				/>
				<output class="hue-output">{theme.hue}°</output>
			</div>
		</section>

		<div class="divider" aria-hidden="true"></div>

		<section class="setting-section" aria-label="Background grid">
			<header class="section-header">
				<span class="section-title">Background Grid</span>
				<div class="header-actions">
					{#if gridCustomized}
						<button type="button" class="reset-pill" onclick={grid.reset}>Reset</button>
					{/if}
					<button
						type="button"
						class="mode-pill"
						class:active={grid.fixed}
						aria-pressed={grid.fixed}
						onclick={() => grid.setFixed(!grid.fixed)}
					>
						{grid.fixed ? 'Fixed' : 'Scroll'}
					</button>
				</div>
			</header>
			<div class="setting-list">
				<DraggableValue
					layout="row"
					label="Spacing"
					value={grid.spacing}
					defaultValue={DEFAULT_GRID_SPACING}
					min={24}
					max={112}
					step={4}
					pixelsPerStep={4}
					format={(value) => `${value}px`}
					onChange={grid.setSpacing}
				/>
				<DraggableValue
					layout="row"
					label="Dot size"
					value={grid.dotSize}
					defaultValue={DEFAULT_GRID_DOT_SIZE}
					min={0}
					max={6}
					step={0.5}
					pixelsPerStep={10}
					format={(value) => `${value}px`}
					onChange={grid.setDotSize}
				/>
			</div>
		</section>
	</div>
</div>

<style>
	.desktop-dock {
		align-items: flex-end;
		backdrop-filter: blur(16px);
		background: color-mix(in oklch, var(--base-1) 88%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 70%, transparent);
		border-radius: var(--radius-lg);
		bottom: env(safe-area-inset-bottom, 0px);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
		display: flex;
		height: 3.5rem;
		left: 50%;
		padding: var(--s-2);
		position: fixed;
		transform: translateX(-50%);
		width: fit-content;
		z-index: 999;
	}

	.mobile-nav {
		display: none;
	}

	.appearance-popover {
		--hue-track-size: 1.15rem;
		--hue-thumb-size: 1.55rem;
		--hue-output-gap: -0.125rem;
		backdrop-filter: blur(20px) saturate(1.2);
		background: color-mix(in oklch, var(--base-1) 94%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		bottom: calc(env(safe-area-inset-bottom, 0px) + 4.25rem);
		box-shadow: 0 12px 28px rgb(0 0 0 / 0.14);
		color: var(--content);
		inset: auto;
		left: 50%;
		margin: 0;
		max-height: calc(100dvh - 6rem);
		overflow: auto;
		padding: 0.75rem 0.9rem;
		position: fixed;
		transform: translateX(-50%);
		width: min(19rem, calc(100vw - 1.5rem));
		z-index: 1000;
	}

	.section-stack {
		display: grid;
		gap: 0.55rem;
	}

	.setting-section {
		display: grid;
		gap: 0.4rem;
	}

	.section-header {
		align-items: center;
		display: flex;
		gap: 0.5rem;
		justify-content: space-between;
		min-height: 1.4rem;
	}

	.header-actions {
		align-items: center;
		display: inline-flex;
		gap: 0.35rem;
	}

	.section-title {
		color: var(--content-2);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.mode-pill,
	.reset-pill {
		align-items: center;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 0.3rem;
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		gap: 0.25rem;
		line-height: 1.2;
		padding: 0.18rem 0.45rem;
	}

	.reset-pill {
		background: transparent;
		border-color: transparent;
	}

	.mode-pill:hover,
	.reset-pill:hover {
		color: var(--content);
	}

	.mode-pill.active {
		background: var(--base-1);
		border-color: var(--brand);
		color: var(--brand);
	}

	.mode-pill :global(svg) {
		height: 0.85rem;
		width: 0.85rem;
	}

	.swatch-row {
		align-items: center;
		display: flex;
		gap: 0.45rem;
		justify-content: space-between;
	}

	.theme-swatch {
		background: oklch(77% 0.14 var(--preset-hue));
		border: 0;
		border-radius: 50%;
		box-shadow: 0 2px 7px oklch(70% 0.16 var(--preset-hue) / 0.24);
		cursor: pointer;
		height: 1.45rem;
		padding: 0;
		width: 1.45rem;
	}

	.theme-swatch.is-active {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.hue-row {
		align-items: center;
		display: flex;
		gap: 0.55rem;
	}

	.hue-row :global(.hue-control) {
		flex: 1;
		min-width: 0;
		padding-block: 0;
	}

	.hue-row :global(.hue-output-track) {
		display: none;
	}

	.hue-output {
		color: var(--content);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		width: 4ch;
	}

	.setting-list {
		display: grid;
		gap: 0.25rem;
	}

	.divider {
		border-top: 1px solid var(--edge);
		margin-block: 0.1rem;
	}

	@media (max-width: 48rem) {
		.desktop-dock {
			display: none;
		}

		.appearance-popover {
			bottom: calc(var(--mobile-nav-height) + 0.75rem);
			width: min(21rem, calc(100vw - 1.5rem));
		}

		.mobile-nav {
			-webkit-backdrop-filter: blur(24px) saturate(1.2);
			backdrop-filter: blur(24px) saturate(1.2);
			background: color-mix(in oklch, var(--base-1) 82%, transparent);
			border-top: 1px solid color-mix(in oklch, var(--edge) 68%, transparent);
			box-sizing: border-box;
			box-shadow: 0 -0.5rem 1.5rem rgb(0 0 0 / 0.04);
			bottom: 0;
			display: grid;
			grid-template-columns: repeat(5, 1fr);
			height: var(--mobile-nav-height);
			left: 0;
			padding: 0 max(var(--s-2), env(safe-area-inset-right)) env(safe-area-inset-bottom)
				max(var(--s-2), env(safe-area-inset-left));
			position: fixed;
			right: 0;
			z-index: 999;
		}
	}

	@media print {
		.desktop-dock,
		.mobile-nav {
			display: none;
		}
	}
</style>
