<script lang="ts">
	import { browser } from '$app/environment';
	import '$lib/prism.css';
	import '@fontsource-variable/inter';
	import '@fontsource/fira-mono';
	import '../app.css';
	import Header from '../lib/components/Header.svelte';

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
	<title>Adham Zaki</title>
	<meta
		name="description"
		content="Crafting interfaces. Building polished software and web experiences. Toronto-based Full Stack Developer and Entrepreneur."
	/>
</svelte:head>

<div class="app">
	<Header />
	<main id="main">
		<slot />
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
	}

	main {
		display: flex;
		flex-wrap: wrap;
		flex-direction: column;
		width: 100%;
		flex: 1;

		--grid-size: var(--s4);
		background-image: radial-gradient(
			circle at calc(var(--grid-size) * 0.5) calc(var(--grid-size) * 0.5),
			color-mix(in oklch, var(--brand) 15%, transparent) 2px,
			transparent 0
		);
		background-size: var(--grid-size) var(--grid-size);
		background-position: 0 0;
	}
</style>
