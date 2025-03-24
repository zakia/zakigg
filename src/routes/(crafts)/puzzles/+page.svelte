<script module>
	export const metadata = {
		title: 'Chess Puzzles',
		description: 'A Collection of chess puzzles that helped me discover new ideas.',
		date: '2025-02-11',
		draft: false,
		tags: ['teaching']
	};
</script>

<script lang="ts">
	import Layout from '$lib/Layout.svelte';
	import { tick } from 'svelte';

	const puzzles = $state(
		[
			{
				title: 'Deflection',
				id: '12803027',
				description: 'A simple checkmate pattern'
			},
			{
				title: 'Always look for all the checks',
				id: '12803371',
				description: 'Find the fork to gain material advantage'
			},
			{
				title: 'Sometimes you need to sac',
				id: '12803541',
				description: 'Find the fork to gain material advantage'
			},
			{
				title: 'Zugszwang',
				id: '12803625',
				description: 'Find the fork to gain material advantage'
			}
		].sort(() => Math.random() - 0.5)
	);

	let puzzleIndex = $state(0);
	let iframe = $state<HTMLIFrameElement>();
	const handleMessage = async (e: MessageEvent) => {
		if (e['data'] && iframe && puzzles[puzzleIndex].id === e['data']['id']) {
			await tick();
			iframe.height = `${e['data']['frameHeight'] + 37}px`;
		}
	};
</script>

<svelte:window onmessage={handleMessage} />

<Layout {...metadata}>
	<p>Collections of chess puzzles I've come across that helped me discover new ideas.</p>

	<h2>{puzzles[puzzleIndex].title}</h2>
	<iframe
		bind:this={iframe}
		title="Chess Puzzle"
		id={puzzles[puzzleIndex].id}
		allowtransparency
		class="w-full max-w-150 overflow-hidden rounded-md"
		frameborder="0"
		src={`https://www.chess.com/emboard?id=${puzzles[puzzleIndex].id}`}
	></iframe>

	<button
		onclick={() => (puzzleIndex = (puzzleIndex + 1) % puzzles.length)}
		class="btn variant-primary justify-self-center">Next</button
	>
</Layout>
