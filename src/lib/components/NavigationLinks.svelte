<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';

	let { variant }: { variant: 'dock' | 'mobile' } = $props();

	const links = [
		{ label: 'Home', path: '/', icon: 'line-md:home' },
		{ label: 'About', path: '/about', icon: 'line-md:file-document' },
		{ label: 'Crafts', path: '/crafts', icon: 'line-md:pencil' },
		{ label: 'Tools', path: '/tools', icon: 'mdi:tools' }
	] as const;

	function isActive(path: string) {
		if (path === '/') return page.url.pathname === '/';
		return page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);
	}
</script>

<div class="nav-links">
	{#each links as link (link.path)}
		<a
			href={resolve(link.path)}
			class:active={isActive(link.path)}
			aria-label={link.label}
			aria-current={isActive(link.path) ? 'page' : undefined}
			data-dock-item={variant === 'dock' ? '' : undefined}
		>
			{#if variant === 'dock'}<span class="tooltip">{link.label}</span>{/if}
			<Icon icon={link.icon} />
		</a>
	{/each}
	<button
		type="button"
		class="nav-trigger"
		popovertarget="site-appearance-popover"
		aria-label="Appearance settings"
		data-dock-item={variant === 'dock' ? '' : undefined}
	>
		{#if variant === 'dock'}<span class="tooltip">Appearance</span>{/if}
		<Icon icon="mdi:tune-variant" />
	</button>
</div>

<style>
	.nav-links {
		display: contents;
	}

	a,
	.nav-trigger {
		align-items: center;
		background: transparent;
		border: 0;
		color: var(--content-1);
		cursor: pointer;
		display: flex;
		font: inherit;
		justify-content: center;
		padding: 0;
		position: relative;
		text-decoration: none;
	}

	a.active,
	.nav-trigger:hover,
	.nav-trigger:focus-visible {
		color: var(--brand);
	}

	:global(.desktop-dock) a,
	:global(.desktop-dock) .nav-trigger {
		border-radius: 999px;
		height: 2.5rem;
		width: 3rem;
	}

	:global(.desktop-dock) a :global(svg),
	:global(.desktop-dock) .nav-trigger :global(svg) {
		height: 100%;
		width: 100%;
	}

	.tooltip {
		background: var(--base);
		border-radius: var(--radius);
		bottom: 110%;
		box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
		color: var(--content);
		font-size: var(--s-1);
		opacity: 0;
		padding: var(--s-4) var(--s-2);
		pointer-events: none;
		position: absolute;
		transition: opacity 0.2s;
		white-space: nowrap;
	}

	:global(.desktop-dock) a:hover .tooltip,
	:global(.desktop-dock) .nav-trigger:hover .tooltip {
		opacity: 1;
	}

	:global(.mobile-nav) a,
	:global(.mobile-nav) .nav-trigger {
		height: var(--mobile-nav-content-height);
	}

	:global(.mobile-nav) a :global(svg),
	:global(.mobile-nav) .nav-trigger :global(svg) {
		height: 1.5rem;
		width: 1.5rem;
	}
</style>
