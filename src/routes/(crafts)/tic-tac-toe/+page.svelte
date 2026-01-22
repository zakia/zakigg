<script module>
	export const metadata = {
		title: 'Tic Tac Toe',
		description: 'How do computers play games?',
		date: '2024-07-23',
		draft: false,
		tags: ['teaching']
	};
</script>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import { AI, bestMove, checkWinner, EMPTY, HUMAN } from './minimax';
	import Layout from '$lib/Layout.svelte';

	let board = $state<number[]>(Array(9).fill(EMPTY));
	let winner = $state(-1);
	let step = $state(0);
	let winPattern = $state<number[]>([]);
	let disabled = $state(false);
	let is2Player = $state(false);

	function playMove(index: number) {
		if (board[index] === 0 && winner === -1) {
			board[index] = (step % 2) + 1;
			const result = checkWinner(board);
			winner = result.winner;
			winPattern = result.pattern;
			step++;
			updateTitle();

			return true;
		} else {
			console.log('Invalid move');
			return false;
		}
	}

	function handleClick(index: number) {
		if (playMove(index) && winner === -1) {
			disabled = true;
			if (is2Player) {
				disabled = false;
			} else {
				setTimeout(() => {
					console.time('minmax');
					const move = bestMove(board);
					console.timeEnd('minmax');
					playMove(move);

					disabled = false;
				}, 750);
			}
		}
	}

	function restartGame() {
		board.fill(0);
		winner = -1;
		winPattern = [];
		updateTitle();
		if (step % 2 === 1 && !is2Player) {
			disabled = true;
			setTimeout(() => {
				console.time('minmax');
				const move = bestMove(board);
				console.timeEnd('minmax');
				playMove(move);
				disabled = false;
			}, 750);
		}
	}

	function updateTitle() {
		let text = '';
		if (winner === 0) {
			text = "It's a draw!";
		} else if (winner === 1) {
			text = 'X wins!';
		} else if (winner === 2) {
			text = 'O wins!';
		} else {
			text = `${step % 2 === 0 ? "X's" : "O's"} Turn`;
		}

		status2!.innerHTML = text;

		status1!.style.transition = 'translate 0.5s';
		status2!.style.transition = 'translate 0.5s';
		status1!.style.translate = '-100% 0';
		status2!.style.translate = '-100% 0';
		setTimeout(() => {
			status1!.style.transition = '';
			status2!.style.transition = '';
			status1!.style.translate = '0%';
			status2!.style.translate = '0%';
			status1!.innerHTML = text;
		}, 500);
	}

	const example0 = [1, 2, 2, 0, 2, 0, 0, 1, 1];
	const example1 = [1, 1, 0, 0, 2, 0, 2, 2, 1];
	const example2 = [1, 1, 0, 1, 2, 0, 2, 2, 1];
	const example3 = [1, 1, 0, 1, 2, 2, 2, 2, 1];
	const example5 = [0, 0, 0, 1, 2, 0, 0, 0, 2];

	let status1 = $state<HTMLElement>();
	let status2 = $state<HTMLElement>();
</script>

<Layout {...metadata}>
	<div
		class="relative mt-8 grid w-full grid-cols-[100%_100%] overflow-hidden text-center"
		class:text-primary={!(step % 2)}
	>
		<h2 bind:this={status1} class="mt-0">X's Turn</h2>
		<h2 bind:this={status2} class="mt-0">O's Turn</h2>
	</div>
	<div
		class="relative mx-auto mb-8 grid h-100 w-100 grid-cols-3 place-items-center gap-1 select-none"
	>
		{#each board as cell, i}
			<button
				aria-label={`cell_${i}`}
				class="box"
				class:circle={cell === AI || (!cell && step % 2 === 1)}
				class:square={cell === HUMAN || (!cell && step % 2 === 0)}
				class:filled={(cell && (winner === -1 || winner === 0)) || winPattern.includes(i)}
				onclick={() => handleClick(i)}
				disabled={winner !== -1 || !!cell || disabled}
			></button>
		{/each}
	</div>
	<div class="flex justify-center gap-4">
		<div class="btn-group flex">
			<button
				class="btn variant-base first:rounded-r-none"
				onclick={() => (is2Player = false)}
				class:variant-primary={!is2Player}
			>
				<Icon icon="mdi:person" class="h-6 w-6" />
			</button>
			<button
				class="btn variant-base mr-4 last:rounded-l-none"
				onclick={() => (is2Player = true)}
				class:variant-primary={is2Player}
			>
				<Icon icon="mdi:people" class="h-6 w-6" />
			</button>
		</div>
		<button class="btn variant-base justify-self-center" onclick={() => restartGame()}>
			Restart Game
		</button>
	</div>
</Layout>

<style>
	.box {
		margin: 12.5px;
		width: 75px;
		height: 75px;
		background: transparent;
		transition: all 0.4s;
	}

	.box:hover {
		box-shadow: inset 0 0 0 5px var(--ring-color);
	}

	.box:active {
		scale: 0.9;
	}

	.square {
		--ring-color: var(--color-primary);
		filter: drop-shadow(12px 12px 0px oklch(from var(--ring-color) l c h / 0.2));
		border-radius: 10%;
		box-shadow: inset 0 0 0 2px var(--ring-color);
	}

	.square.filled {
		box-shadow: inset 0 0 0 38px var(--ring-color);
	}

	.circle.filled {
		box-shadow: inset 0 0 0 18px var(--ring-color);
	}

	.circle {
		--ring-color: var(--color-text);
		box-shadow: inset 0 0 0 1px var(--ring-color);
		filter: drop-shadow(12px 12px 0px oklch(from var(--ring-color) l c h / 0.2));
		border-radius: 50%;
	}
</style>
