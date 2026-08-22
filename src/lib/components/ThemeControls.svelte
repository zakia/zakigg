<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import HueSlider from '$lib/components/HueSlider.svelte';
	import { theme, themeHues } from '$lib/theme.svelte';
</script>

<section class="theme-controls" aria-label="Appearance playground">
	<HueSlider value={Number(theme.hue)} onValueChange={(value) => theme.setHue(String(value))} />

	<div class="theme-options">
		<button
			type="button"
			class="theme-mode-toggle"
			onclick={theme.toggle}
			aria-label={theme.mode === 'light' ? 'Use dark mode' : 'Use light mode'}
			title={theme.mode === 'light' ? 'Dark mode' : 'Light mode'}
		>
			<Icon icon={theme.mode === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
		</button>

		<div class="theme-presets" role="group" aria-label="Color presets">
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
		</div>
	</div>
</section>

<style>
	.theme-controls {
		display: grid;
		gap: var(--s0);
		width: min(28rem, calc(100vw - 2rem));
	}

	.theme-options,
	.theme-presets {
		align-items: center;
		display: flex;
	}

	.theme-options {
		gap: var(--s0);
		justify-content: center;
	}

	.theme-presets {
		gap: var(--s-1);
	}

	.theme-mode-toggle,
	.theme-preset {
		border: 0;
		border-radius: 999px;
		cursor: pointer;
		flex: none;
		padding: 0;
	}

	.theme-mode-toggle {
		align-items: center;
		background: color-mix(in oklch, var(--base-2) 88%, transparent);
		border: 1px solid var(--edge);
		color: var(--content);
		display: flex;
		height: 3rem;
		justify-content: center;
		width: 3rem;
	}

	.theme-mode-toggle :global(svg) {
		height: 1.5rem;
		width: 1.5rem;
	}

	.theme-preset {
		background: oklch(65% 0.2 var(--preset-hue));
		border: 3px solid transparent;
		height: 2rem;
		outline: 1px solid color-mix(in oklch, var(--content) 18%, transparent);
		outline-offset: -1px;
		width: 2rem;
	}

	.theme-preset.is-active {
		border-color: var(--base);
		outline: 2px solid var(--content);
	}

	.theme-mode-toggle:focus-visible,
	.theme-preset:focus-visible {
		outline: 2px solid var(--content);
		outline-offset: 2px;
	}
</style>
