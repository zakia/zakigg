<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { useTheme } from '$lib/theme.svelte';
	import { clamp } from '$lib/utils';

	const theme = useTheme();
	const links = [
		{ label: 'Home', path: '/', icon: 'line-md:home' },
		{ label: 'About', path: '/about', icon: 'line-md:file-document' },
		{ label: 'Crafts', path: '/crafts', icon: 'line-md:pencil' },
		{ label: 'Notes', path: '/notes', icon: 'mdi:notebook-edit-outline' }
	] as const;

	let isHidden = $state(false);

	$effect(() => {
		if (window.matchMedia('(pointer: coarse)').matches) {
			isHidden = true;
		}
	});

	$effect(() => {
		const dock = document.querySelector('.dock') as HTMLElement;
		dock.addEventListener('mousemove', (e) => {
			if ('ontouchstart' in window || navigator.maxTouchPoints) {
				return;
			}
			const dockItems = document.querySelectorAll('.dock-item') as NodeListOf<HTMLElement>;

			dockItems.forEach((item) => {
				const { left, width } = item.getBoundingClientRect();
				const itemCenter = left + width / 2;
				const mouseX = e.clientX;
				const distance = Math.abs(itemCenter - mouseX);
				const scale = clamp(2 - distance / 100, 1, 2); // Adjust scaling effect
				item.animate(
					{ width: `${scale * 3}rem`, height: `${scale * 2.5}rem` },
					{
						duration: 500,
						fill: 'forwards'
					}
				);
			});
		});

		dock.addEventListener('mouseleave', () => {
			const dockItems = document.querySelectorAll('.dock-item') as NodeListOf<HTMLElement>;
			dockItems.forEach((item) => {
				item.animate(
					{ width: `${3}rem`, height: `${2.5}rem` },
					{
						duration: 100,
						fill: 'forwards'
					}
				);
			});
		});
	});

	function isActive(path: string) {
		if (path === '/') return page.url.pathname === '/';

		return page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);
	}
</script>

<header
	class="bg-base-1 dock p-s-2 fixed bottom-0 left-1/2 z-999 flex h-14 w-fit items-end rounded-lg backdrop-blur-lg print:hidden"
	style:translate="-50% {isHidden ? '200%' : '0%'}"
>
	{#each links as link (link.path)}
		<a href={resolve(link.path)} class="dock-item" class:text-brand={isActive(link.path)}>
			<div class="tooltip">
				{link.label}
			</div>
			<Icon icon={link.icon} class="h-full w-full"></Icon>
		</a>
	{/each}
	<div class="bg-edge-1 my-auto h-3/4 w-px"></div>
	<a href="https://github.com/zakia" class="dock-item" target="_blank">
		<div class="tooltip">GitHub</div>
		<Icon icon="line-md:github" class="h-full w-full"></Icon>
	</a>
	<div class="bg-edge-1 my-auto h-3/4 w-px"></div>

	<button class="dock-item" onclick={theme.toggle}>
		{#if theme.theme === 'light'}
			<div class="tooltip">Dark Mode</div>
			<Icon icon="line-md:moon" class="h-full w-full" />
		{:else}
			<div class="tooltip">Light Mode</div>
			<Icon icon="line-md:sunny" class="h-full w-full" />
		{/if}
	</button>

	<button class="dock-item" onclick={theme.toggleHue}>
		<div class="tooltip">Toggle Color</div>
		<Icon icon="line-md:paint-drop-filled" class="text-brand h-full w-full"></Icon>
	</button>

	<button class="dock-item" onclick={() => (isHidden = true)}>
		<div class="tooltip">Close Dock</div>
		<Icon icon="line-md:close-circle" class="h-full w-full"></Icon>
	</button>
</header>
<div
	class="transition-property-[translate] right-s0 bottom-s0 fixed z-999 duration-[0.3s] print:hidden"
	style:translate="0% {isHidden ? '0%' : '200%'}"
>
	<button
		class="btn variant-primary p-s-2 rounded-full shadow-lg"
		onclick={() => (isHidden = false)}
	>
		<Icon icon="pepicons-print:menu" class="h-6 w-6"></Icon>
	</button>
</div>

<style>
	.dock {
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.1);
		transition: translate 0.3s;
		transform-origin: bottom;
	}

	.dock-item {
		position: relative;
		border-radius: 999px;
		width: 3rem;
		height: 2.5rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		will-change: width, height;
	}

	.tooltip {
		opacity: 0;
		pointer-events: none;
		position: absolute;
		bottom: 110%;
		padding: var(--s-4) var(--s-2);
		border-radius: var(--radius);
		font-size: var(--s-1);
		white-space: nowrap;
		background-color: var(--base);
		transition: opacity 0.2s;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
	}

	.dock-item:hover .tooltip {
		opacity: 1;
	}
</style>
