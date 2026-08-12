<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth';
	import { useGridSettings } from '$lib/grid-settings.svelte';
	import '$lib/prism.css';
	import '@fontsource-variable/inter';
	import '@fontsource/fira-mono';
	import type { Snippet } from 'svelte';
	import '../app.css';
	import Header from '../lib/components/Header.svelte';

	let { children }: { children: Snippet } = $props();
	useGridSettings();

	onMount(() => {
		void auth.refresh();
	});

	function titleFromPathname(pathname: string) {
		const segment = decodeURIComponent(pathname).split('/').filter(Boolean).at(-1);
		if (!segment) return 'zaki.gg';

		const routeTitle = segment
			.replace(/[-_]+/g, ' ')
			.replace(/\b\p{L}/gu, (character) => character.toUpperCase());

		return `${routeTitle} – zaki.gg`;
	}

	const pageTitle = $derived(titleFromPathname(page.url.pathname));

	// onNavigate((navigation) => {
	// 	if (!document.startViewTransition) return;

	// 	return new Promise((resolve) => {
	// 		document.startViewTransition(async () => {
	// 			resolve();
	// 			await navigation.complete;
	// 		});
	// 	});
	// });
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content="Crafting interfaces. Building polished software and web experiences. Toronto-based Full Stack Developer and Entrepreneur."
	/>
</svelte:head>

<div class="app">
	<Header />
	<main id="main" class="grid-bg">
		{@render children()}
	</main>
	<div class="preview"></div>
</div>

{#if browser}
	<script
		async
		defer
		src="https://zaki.click/script.js"
		data-website-id="d6215ab0-c4ac-44fb-beaf-b9c5c2265a64"
	></script>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background-color: var(--base);
	}

	main {
		display: flex;
		flex-wrap: wrap;
		flex-direction: column;
		width: 100%;
		flex: 1;
	}

	@media (max-width: 48rem) {
		main {
			padding-bottom: calc(4rem + env(safe-area-inset-bottom));
		}
	}

	.grid-bg {
		background-color: var(--base);
		background-image: radial-gradient(
			circle at calc(var(--grid-spacing, var(--s4)) * 0.5)
				calc(var(--grid-spacing, var(--s4)) * 0.5),
			color-mix(in oklch, var(--brand) 15%, transparent) var(--grid-dot-size, 2px),
			transparent 0
		);
		background-size: var(--grid-spacing, var(--s4)) var(--grid-spacing, var(--s4));
		background-position: 0 0;
	}
</style>
