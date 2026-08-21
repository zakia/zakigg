<script module lang="ts">
	declare const brain: {
		recurrent: {
			LSTMTimeStep: new () => {
				train: (data: number[][], options?: { iterations?: number }) => void;
				run: (input: number[]) => number;
			};
		};
	};

	// brain.js ships no ESM build; load the CDN script once no matter how many
	// game instances mount (crafts page + any number of note embeds).
	let brainPromise: Promise<void> | null = null;

	function loadBrain(): Promise<void> {
		if (typeof brain !== 'undefined') return Promise.resolve();

		brainPromise ??= new Promise((resolve, reject) => {
			const script = document.createElement('script');

			script.src = 'https://unpkg.com/brain.js';
			script.onload = () => resolve();
			script.onerror = () => {
				brainPromise = null;
				script.remove();
				reject(new Error('Could not load brain.js'));
			};
			document.head.append(script);
		});

		return brainPromise;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let cheating = $state(false);
	let ready = $state(false);
	let loadFailed = $state(false);

	let game = $state({
		pattern: [] as number[],
		scoreHuman: 0,
		scoreAI: 0,
		chosenByHuman: 0,
		chosenByAI: 0,
		winner: '',
		gameCount: 0,
		patternLength: 15,
		confidence: 0,
		prediction: 0,
		scoreTracker: [] as { human: number; ai: number; winner: string }[]
	});

	let scores: HTMLDivElement | null;

	onMount(() => {
		loadBrain().then(
			() => {
				ready = true;
				whatShouldAIAnswer();
			},
			() => {
				loadFailed = true;
			}
		);
	});

	function stringOf(integer: number) {
		switch (integer) {
			case 1:
				return '🪨';
			case 2:
				return '📜';
			case 3:
				return '✂️';
			default:
				return '';
		}
	}

	async function humanInput(rockOrPaperOrScissors: number) {
		game.chosenByHuman = rockOrPaperOrScissors;
		game.gameCount++;
		whoIsTheWinner();
		await whatShouldAIAnswer();
	}

	async function whatShouldAIAnswer() {
		if (game.pattern.length < 1) {
			for (let index = 1; index <= 2; index++) {
				game.pattern.push(Math.floor(Math.random() * 3) + 1);
			}
		}

		const net = new brain.recurrent.LSTMTimeStep();
		net.train([game.pattern], { iterations: 100 });
		const humanWillChose = net.run(game.pattern) as number;
		const roundedHumanWillChose = Math.round(humanWillChose);

		const error = Math.abs(humanWillChose - roundedHumanWillChose);
		game.prediction =
			1 <= roundedHumanWillChose && roundedHumanWillChose <= 3 ? roundedHumanWillChose : 3;

		game.confidence = 1 - error;
		game.chosenByAI =
			1 <= roundedHumanWillChose && roundedHumanWillChose <= 3
				? (roundedHumanWillChose % 3) + 1
				: 1;
	}

	function whoIsTheWinner() {
		if (game.chosenByHuman === game.chosenByAI) {
			game.winner = 'draw';
		} else if (
			(game.chosenByHuman === 1 && game.chosenByAI === 3) ||
			(game.chosenByHuman === 3 && game.chosenByAI === 2) ||
			(game.chosenByHuman === 2 && game.chosenByAI === 1)
		) {
			game.winner = 'human';
			game.scoreHuman++;
		} else {
			game.winner = 'AI';
			game.scoreAI++;
		}

		game.pattern.push(game.chosenByHuman);
		if (game.pattern.length > game.patternLength) {
			game.pattern.shift();
		}

		game.scoreTracker.push({
			human: game.chosenByHuman,
			ai: game.chosenByAI,
			winner: game.winner
		});
	}

	function resetScore() {
		game.pattern = [];
		game.scoreHuman = 0;
		game.scoreAI = 0;
		game.chosenByHuman = 0;
		game.chosenByAI = 0;
		game.winner = '';
		game.gameCount = 0;
		game.scoreTracker = [];

		whatShouldAIAnswer();
	}

	$effect(() => {
		const scoreCount = game.scoreTracker.length;
		if (scores && scoreCount) {
			scores.scrollTo({
				behavior: 'smooth',
				left: scores.scrollWidth,
				top: 0
			});
		}
	});
</script>

<div class="grid w-full justify-items-center">
	{#if loadFailed}
		<p class="text-content-1">Could not load the AI (brain.js) — check your connection.</p>
	{/if}

	<div class="text-center">
		{#if cheating && ready}
			<div>
				I'm <b>{(game.confidence * 100).toFixed(2)}%</b> sure you will go {stringOf(
					game.prediction
				)}
			</div>
		{/if}

		<div class="text-brand text-s3 font-bold">{game.scoreAI}</div>
		<Icon icon="tabler:robot" class="text-brand mx-auto h-16 w-16"></Icon>
	</div>

	<div class="pr-1/4 gap-s-2 p-s0 flex w-full max-w-md overflow-x-auto" bind:this={scores}>
		{#each game.scoreTracker as match, i (`${i}-${match.human}-${match.ai}`)}
			<div
				class="p-s-2 flex flex-col items-center rounded-md"
				class:bg-success={match.winner === 'human'}
				class:bg-info={match.winner === 'draw'}
				class:bg-error={match.winner === 'AI'}
			>
				<div class="text-s-2 opacity-70">{i + 1}</div>
				<div>{stringOf(match.ai)}</div>
				<div>{stringOf(match.human)}</div>
			</div>
		{:else}
			<div class="flex flex-col p-s-2 rounded-md items-center invisible">
				<div class="text-s-2 opacity-50">{1}</div>
				<div>{stringOf(1)}</div>
				<div>{stringOf(1)}</div>
			</div>
		{/each}
	</div>

	<div class="text-center">
		<Icon icon="tabler:user" class="text-brand h-16 w-16"></Icon>
		<div class="text-brand text-s3 font-bold">{game.scoreHuman}</div>
	</div>

	<div class="gap-s-2 mx-auto grid max-w-sm grid-cols-3">
		<button onclick={() => humanInput(1)} disabled={!ready} class="btn variant-primary">
			rock
		</button>
		<button onclick={() => humanInput(2)} disabled={!ready} class="btn variant-primary">
			paper
		</button>
		<button onclick={() => humanInput(3)} disabled={!ready} class="btn variant-primary">
			scissors
		</button>
	</div>

	{#if game.scoreTracker.length}
		<div class="gap-s-2 grid grid-cols-2">
			<button class="btn variant-base" onclick={resetScore}>reset</button>
			<button class="btn variant-base" onclick={() => (cheating = !cheating)}>
				{cheating ? 'stop cheating' : 'cheat'}
			</button>
		</div>
	{/if}
</div>
