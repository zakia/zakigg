<script lang="ts">
	import { createSpring } from '$lib/utils/spring';

	function springFlip(node: HTMLElement, { from, to }: { from: DOMRect; to: DOMRect }) {
		const dx = from.left - to.left;
		const dy = from.top - to.top;

		const [duration, easing] = createSpring({
			mass: 1,
			stiffness: 200,
			damping: 10,
			velocity: 0
		});

		return {
			delay: 0,
			duration,
			easing,
			css: (t: number, u: number) => `transform: translate(${u * dx}px, ${u * dy}px);`
		};
	}

	let list = $state([
		'🍎 Apple',
		'🍌 Banana',
		'🍕 Pizza',
		'🚗 Car',
		'🌞 Sun',
		'💡 Lightbulb',
		'🎲 Dice',
		'🐧 Penguin'
	]);

	const shuffle = () => {
		return list.sort(() => Math.random() - 0.5);
	};
</script>

<div class="flex flex-col items-start gap-2 p-4">
	{#each list as item, index (item)}
		<div animate:springFlip class="border p-2">{item}</div>
	{/each}
</div>

<button onclick={shuffle}>Shuffle</button>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="1.25rem"
	height="1.25rem"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="arrow-icon"
>
	<style>
		/* 1. Define the Keyframes (The Animation Script) */

		/* The Head moves right, then snaps back */
		@keyframes poke-head {
			0% {
				transform: translateX(0);
			}
			30% {
				transform: translateX(5px);
			} /* The Peak of the movement */
			100% {
				transform: translateX(0);
			}
		}

		/* The Line grows, then shrinks back */
		@keyframes poke-line {
			0% {
				transform: scaleX(1);
			}
			30% {
				transform: scaleX(1.4);
			} /* The Peak of the stretch */
			100% {
				transform: scaleX(1);
			}
		}

		/* 2. Assign the animations on Hover */
		.arrow-icon {
			cursor: pointer;
		}

		.arrow-icon:hover .arrow-head {
			/* Play the animation once, for 0.4 seconds */
			animation: poke-head 0.4s ease-in-out;
		}

		.arrow-icon:hover .arrow-line {
			transform-origin: 5px 12px; /* Anchor the line to the left */
			animation: poke-line 0.4s ease-in-out;
		}
	</style>

	<line x1="5" y1="12" y2="12" x2="18" class="arrow-line"></line>
	<polyline points="12 5 19 12 12 19" class="arrow-head"></polyline>
</svg>
