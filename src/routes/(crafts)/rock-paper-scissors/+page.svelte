<script module>
	// Type declaration for brain.js global
	declare const brain: any;

	export const metadata = {
		title: '🗿📄✂️ vs AI',
		description: 'Play Rock, Paper, Scissors vs AI',
		date: '2024-07-14',
		draft: false,
		tags: ['teaching']
	};
</script>

<script lang="ts">
	import Layout from '$lib/Layout.svelte';
	import Icon from '@iconify/svelte';

	let cheating = $state(false);

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

	$effect(() => {
		setTimeout(whatShouldAIAnswer, 500);
	});

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
		const humanWillChose = net.run(game.pattern);
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
		game.scoreTracker.length;
		if (scores) {
			scores.scrollTo({
				behavior: 'smooth',
				left: scores.scrollWidth,
				top: 0
			});
		}
	});
</script>

<svelte:head>
	<script src="//unpkg.com/brain.js"></script>
</svelte:head>

<Layout {...metadata}>
	<!-- <hgroup class="text-center">
		<h1 class="mb-2">Rock, Paper, Scissors</h1>
		<p class="mb-0 text-base-6">with Artificial Intelligence</p>
	</hgroup> -->

	<div class="my-10 grid justify-items-center">
		<div class="text-center">
			{#if cheating}
				<div>
					I'm <b>{(game.confidence * 100).toFixed(2)}%</b> sure you will go {stringOf(
						game.prediction
					)}
				</div>
			{/if}

			<div class="text-primary text-3xl font-bold">{game.scoreAI}</div>
			<Icon icon="tabler:robot" class="text-primary mx-auto h-16 w-16"></Icon>
		</div>

		<div class="pr-1/4 flex w-full max-w-md gap-2 overflow-x-auto p-4" bind:this={scores}>
			{#each game.scoreTracker as match, i}
				<div
					class="flex flex-col items-center rounded-lg p-2"
					class:bg-green-300={match.winner === 'human'}
					class:bg-blue-300={match.winner === 'draw'}
					class:bg-red-300={match.winner === 'AI'}
				>
					<div class="text-dark/70 text-xs">{i + 1}</div>
					<div>{stringOf(match.ai)}</div>
					<div>{stringOf(match.human)}</div>
				</div>
			{:else}
				<div class="flex flex-col p-2 rounded-lg items-center invisible">
					<div class="text-xs opacity-50">{1}</div>
					<div>{stringOf(1)}</div>
					<div>{stringOf(1)}</div>
				</div>
			{/each}
		</div>

		<div class="text-center">
			<Icon icon="tabler:user" class="text-primary h-16 w-16"></Icon>
			<div class="text-primary text-3xl font-bold">{game.scoreHuman}</div>
		</div>

		<div class="mx-auto mt-6 grid max-w-sm grid-cols-3">
			<button onclick={() => humanInput(1)} class="btn variant-primary m-2">rock</button>
			<button onclick={() => humanInput(2)} class="btn variant-primary m-2">paper</button>
			<button onclick={() => humanInput(3)} class="btn variant-primary m-2">scissors</button>
		</div>

		{#if game.scoreTracker.length}
			<div class="grid grid-cols-2">
				<button class="btn variant-base m-2" onclick={resetScore}>reset</button>
				<button class="btn variant-base m-2" onclick={() => (cheating = !cheating)}>
					{cheating ? 'stop cheating' : 'cheat'}
				</button>
			</div>
		{/if}
	</div>
</Layout>
