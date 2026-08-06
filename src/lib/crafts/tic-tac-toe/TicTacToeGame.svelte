<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { AI, bestMove, checkWinner, EMPTY, HUMAN } from './minimax';

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
		}

		return false;
	}

	function playAiMove() {
		disabled = true;
		setTimeout(() => {
			playMove(bestMove(board));
			disabled = false;
		}, 750);
	}

	function handleClick(index: number) {
		if (playMove(index) && winner === -1 && !is2Player) {
			playAiMove();
		}
	}

	function restartGame() {
		board.fill(0);
		winner = -1;
		winPattern = [];
		updateTitle();
		if (step % 2 === 1 && !is2Player) {
			playAiMove();
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

	let status1 = $state<HTMLElement>();
	let status2 = $state<HTMLElement>();
</script>

<div class="tic-tac-toe-game w-full">
	<div
		class="relative grid w-full grid-cols-[100%_100%] overflow-hidden text-center"
		class:text-brand={!(step % 2)}
	>
		<h2 bind:this={status1}>X's Turn</h2>
		<h2 bind:this={status2}>O's Turn</h2>
	</div>
	<div
		class="gap-s-4 relative mx-auto grid h-100 w-100 max-w-full grid-cols-3 place-items-center select-none"
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
	<div class="gap-s0 flex justify-center">
		<div class="btn-group flex">
			<button
				class="btn variant-base first:rounded-r-none"
				onclick={() => (is2Player = false)}
				class:variant-primary={!is2Player}
			>
				<Icon icon="mdi:person" class="h-6 w-6" />
			</button>
			<button
				class="btn variant-base mr-s0 last:rounded-l-none"
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
</div>

<style>
	.box {
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
		--ring-color: var(--brand);
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
		--ring-color: var(--content);
		box-shadow: inset 0 0 0 1px var(--ring-color);
		filter: drop-shadow(12px 12px 0px oklch(from var(--ring-color) l c h / 0.2));
		border-radius: 50%;
	}
</style>
