<script lang="ts">
	import { onMount } from 'svelte';
	import NavigationLinks from '$lib/components/NavigationLinks.svelte';
	import { clamp } from '$lib/utils';

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

<header bind:this={desktopDock} class="desktop-dock" aria-label="Desktop navigation">
	<NavigationLinks variant="dock" />
</header>

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
		width: fit-content;
		z-index: 999;
	}

	.mobile-nav {
		display: none;
	}

	@media (max-width: 48rem) {
		.desktop-dock {
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
		.mobile-nav {
			display: none;
		}
	}
</style>
