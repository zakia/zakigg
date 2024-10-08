<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import '@unocss/reset/tailwind.css';
	import 'virtual:uno.css';
	import 'open-props/open-props.min.css';
	import 'open-props/colors-oklch.min.css';
	import 'open-props/oklch-hues.min.css';
	import '../app.css';
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

	<main id="main">
		<slot />
	</main>
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
		@apply mb-20 print:mb-0;
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

	:root:view-transition-old(root) {
		animation: 0.5s both fade-out;
	}

	:root::view-transition-new(root) {
		animation: 0.5s both fade-in;
	}
</style>
