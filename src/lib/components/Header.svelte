<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavigationLinks from '$lib/components/NavigationLinks.svelte';
	import { clamp } from '$lib/utils';

	let isHidden = $state(false);
	let desktopDock = $state<HTMLElement>();

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

<header
	bind:this={desktopDock}
	class="desktop-dock"
	class:is-hidden={isHidden}
	aria-label="Desktop navigation"
>
	<NavigationLinks variant="dock" />
	<!-- <div class="divider"></div>
	<button
		class="dock-item"
		data-dock-item
		onclick={() => (isHidden = true)}
		aria-label="Close dock"
	>
		<span class="tooltip">Close Dock</span>
		<Icon icon="line-md:close-circle" />
	</button> -->
</header>

<button
	type="button"
	class="dock-toggle btn variant-primary rounded-full shadow-lg"
	class:is-visible={isHidden}
	onclick={() => (isHidden = false)}
	aria-label="Open navigation"
>
	<Icon icon="pepicons-print:menu" class="h-6 w-6" />
</button>

<nav class="mobile-nav" aria-label="Primary navigation">
	<NavigationLinks variant="mobile" />
</nav>

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
		transition: translate 0.3s;
		translate: 0 0;
		width: fit-content;
		z-index: 999;
	}

	.desktop-dock.is-hidden {
		translate: 0 200%;
	}

	.dock-item {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--content-1);
		display: flex;
		height: 2.5rem;
		justify-content: center;
		position: relative;
		width: 3rem;
	}

	.dock-item :global(svg) {
		height: 100%;
		width: 100%;
	}

	.divider {
		background: var(--edge-1);
		height: 75%;
		margin-block: auto;
		width: 1px;
	}

	.tooltip {
		background: var(--base);
		border-radius: var(--radius);
		bottom: 110%;
		box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
		font-size: var(--s-1);
		opacity: 0;
		padding: var(--s-4) var(--s-2);
		pointer-events: none;
		position: absolute;
		white-space: nowrap;
	}

	.dock-item:hover .tooltip {
		opacity: 1;
	}

	.dock-toggle {
		bottom: calc(var(--s0) + env(safe-area-inset-bottom, 0px));
		padding: var(--s-2);
		pointer-events: none;
		position: fixed;
		right: calc(var(--s0) + env(safe-area-inset-right, 0px));
		translate: 0 200%;
		z-index: 999;
	}

	.dock-toggle.is-visible {
		pointer-events: auto;
		translate: 0 0;
	}

	.mobile-nav {
		display: none;
	}

	@media (max-width: 48rem) {
		.desktop-dock,
		.dock-toggle {
			display: none;
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
			grid-template-columns: repeat(4, 1fr);
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
		.dock-toggle,
		.mobile-nav {
			display: none;
		}
	}
</style>
