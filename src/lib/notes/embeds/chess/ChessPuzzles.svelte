<script lang="ts">
	import { tick } from 'svelte';

	type Puzzle = {
		title: string;
		id: string;
		description: string;
	};

	const puzzles: Puzzle[] = [
		{
			title: 'Deflection',
			id: '12803027',
			description: 'A simple checkmate pattern.'
		},
		{
			title: 'Always look for all the checks',
			id: '12803371',
			description: 'Find the fork to gain material advantage.'
		},
		{
			title: 'Sometimes you need to sac',
			id: '12803541',
			description: 'A forcing sacrifice opens the position.'
		},
		{
			title: 'Zugzwang',
			id: '12803625',
			description: 'Every available move makes the position worse.'
		}
	];

	let puzzleIndex = $state(0);
	let iframe = $state<HTMLIFrameElement>();
	const puzzle = $derived(puzzles[puzzleIndex]);

	async function handleMessage(event: MessageEvent) {
		if (event.source !== iframe?.contentWindow || !isResizeMessage(event.data)) return;
		if (event.data.id !== puzzle.id) return;

		await tick();
		iframe.height = `${Math.max(320, Math.min(event.data.frameHeight + 37, 1_200))}px`;
	}

	function nextPuzzle() {
		puzzleIndex = (puzzleIndex + 1) % puzzles.length;
	}

	function isResizeMessage(value: unknown): value is { id: string; frameHeight: number } {
		if (!value || typeof value !== 'object') return false;

		const message = value as { id?: unknown; frameHeight?: unknown };
		return (
			typeof message.id === 'string' &&
			typeof message.frameHeight === 'number' &&
			Number.isFinite(message.frameHeight)
		);
	}
</script>

<svelte:window onmessage={handleMessage} />

<section class="chess-puzzles" aria-labelledby="chess-puzzle-title">
	<header>
		<p class="eyebrow">Puzzle {puzzleIndex + 1} of {puzzles.length}</p>
		<h2 id="chess-puzzle-title">{puzzle.title}</h2>
		<p>{puzzle.description}</p>
	</header>

	<iframe
		bind:this={iframe}
		title={`Chess puzzle: ${puzzle.title}`}
		id={puzzle.id}
		class="puzzle-frame"
		frameborder="0"
		src={`https://www.chess.com/emboard?id=${puzzle.id}`}
	></iframe>

	<button type="button" onclick={nextPuzzle} class="btn variant-primary">Next puzzle</button>
</section>

<style>
	.chess-puzzles {
		display: grid;
		gap: var(--s0);
		width: 100%;
	}

	.chess-puzzles header {
		display: grid;
		gap: var(--s-2);
	}

	.chess-puzzles header > * {
		margin: 0;
	}

	.eyebrow {
		color: var(--content-1);
		font-size: var(--text-s-1);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.puzzle-frame {
		min-height: 320px;
		width: 100%;
		max-width: 600px;
		overflow: hidden;
		border-radius: var(--s-2);
	}

	button {
		justify-self: center;
	}
</style>
