<script lang="ts">
	// import { onNavigate } from '$app/navigation';
	import '@fontsource/fira-mono';
	import '@fontsource-variable/inter';
	import '../app.css';
	import '$lib/prism.css';
	import Header from './Header.svelte';
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
	<main id="main" class="pb-32 print:pb-0">
		<slot />
	</main>
	<div class="preview"></div>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		view-transition-name: main;

		--grid-size: 4rem;
		flex-wrap: wrap;
		gap: 2rem;
		background-image: radial-gradient(
			circle at calc(1rem - 1px) calc(1rem - 1px),
			color-mix(in oklch, var(--color-primary) 15%, transparent) 2px,
			transparent 0
		);
		background-size: var(--grid-size) var(--grid-size);
		background-position: 0 0;
	}

	@keyframes fade-in {
		from {
			filter: blur(4px);
			opacity: 0;
		}
	}
	@keyframes fade-out {
		to {
			filter: blur(4px);
			opacity: 0;
		}
	}

	/* Target only the main content for transitions */
	::view-transition-old(main) {
		animation: 0.5s both fade-out;
	}
	::view-transition-new(main) {
		animation: 0.5s both fade-in;
	}
</style>
