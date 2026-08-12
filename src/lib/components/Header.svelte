<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AuthMenu from '$lib/auth/AuthMenu.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { useTheme } from '$lib/theme.svelte';
	import { clamp } from '$lib/utils';

	const theme = useTheme();
	const links = [
		{ label: 'Home', path: '/', icon: 'line-md:home' },
		{ label: 'About', path: '/about', icon: 'line-md:file-document' },
		{ label: 'Crafts', path: '/crafts', icon: 'line-md:pencil' },
		{ label: 'Profile', path: '/profile', icon: 'mdi:account-outline' }
	] as const;

	let isHidden = $state(false);
	let desktopDock = $state<HTMLElement>();

	onMount(() => {
		const dock = desktopDock;
		if (!dock) return;

		const handleMouseMove = (event: MouseEvent) => {
			if (window.matchMedia('(pointer: coarse)').matches) return;

			for (const item of dock.querySelectorAll<HTMLElement>('.dock-item')) {
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
			for (const item of dock.querySelectorAll<HTMLElement>('.dock-item')) {
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

	function isActive(path: string) {
		if (path === '/') return page.url.pathname === '/';
		return page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);
	}
</script>

<header
	bind:this={desktopDock}
	class="desktop-dock"
	class:is-hidden={isHidden}
	aria-label="Desktop navigation"
>
	{#each links.slice(0, 3) as link (link.path)}
		<a
			href={resolve(link.path)}
			class="dock-item"
			class:text-brand={isActive(link.path)}
			aria-label={link.label}
		>
			<span class="tooltip">{link.label}</span>
			<Icon icon={link.icon} />
		</a>
	{/each}
	<div class="divider"></div>
	<AuthMenu />
	<div class="divider"></div>
	<button class="dock-item" onclick={theme.toggle} aria-label="Toggle theme">
		<span class="tooltip">{theme.theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
		<Icon icon={theme.theme === 'light' ? 'line-md:moon' : 'line-md:sunny'} />
	</button>
	<button class="dock-item" onclick={theme.toggleHue} aria-label="Change color">
		<span class="tooltip">Change Color</span>
		<Icon icon="line-md:paint-drop-filled" class="text-brand" />
	</button>
	<button class="dock-item" onclick={() => (isHidden = true)} aria-label="Close dock">
		<span class="tooltip">Close Dock</span>
		<Icon icon="line-md:close-circle" />
	</button>
</header>

<button
	type="button"
	class="dock-toggle"
	class:is-visible={isHidden}
	onclick={() => (isHidden = false)}
	aria-label="Open navigation"
>
	<Icon icon="pepicons-print:menu" />
</button>

<nav class="mobile-nav" aria-label="Primary navigation">
	{#each links as link (link.path)}
		<a href={resolve(link.path)} class:active={isActive(link.path)} aria-label={link.label}>
			<Icon icon={link.icon} />
			<span>{link.label}</span>
		</a>
	{/each}
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
		background: var(--brand);
		border: 0;
		border-radius: 999px;
		bottom: calc(var(--s0) + env(safe-area-inset-bottom, 0px));
		color: var(--brand-content);
		height: 2.75rem;
		opacity: 0;
		pointer-events: none;
		position: fixed;
		right: calc(var(--s0) + env(safe-area-inset-right, 0px));
		transition: opacity 0.2s;
		width: 2.75rem;
		z-index: 999;
	}

	.dock-toggle.is-visible {
		opacity: 1;
		pointer-events: auto;
	}

	.dock-toggle :global(svg) {
		height: 1.5rem;
		width: 1.5rem;
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
			backdrop-filter: blur(18px);
			background: color-mix(in oklch, var(--base-1) 92%, transparent);
			border-top: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
			bottom: 0;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			left: 0;
			padding: var(--s-2) max(var(--s-2), env(safe-area-inset-right))
				calc(var(--s-2) + env(safe-area-inset-bottom)) max(var(--s-2), env(safe-area-inset-left));
			position: fixed;
			right: 0;
			z-index: 999;
		}

		.mobile-nav a {
			align-items: center;
			color: var(--content-1);
			display: flex;
			flex-direction: column;
			font-size: 0.68rem;
			font-weight: 600;
			gap: 0.2rem;
			justify-content: center;
			min-height: 3rem;
			text-decoration: none;
		}

		.mobile-nav a.active {
			color: var(--brand);
		}

		.mobile-nav :global(svg) {
			height: 1.45rem;
			width: 1.45rem;
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
