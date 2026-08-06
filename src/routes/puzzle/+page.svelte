<script lang="ts">
	import NumberSnug from '$lib/puzzle/NumberSnug.svelte';
</script>

<svelte:head>
	<title>Number Snug · Adham Zaki</title>
	<meta
		name="description"
		content="A drag-and-drop digit-tiling puzzle: rotate and flip ten digit-shaped pieces so they snug together into a waffle grid."
	/>
</svelte:head>

<div class="layout puzzle-layout">
	<header>
		<h1>Number Snug</h1>
		<p class="subtitle">
			Ten pieces, one for each digit. Drag, rotate and flip them until they all snug together into
			the target grid — every gap closed, every hole aligned.
		</p>
	</header>

	<NumberSnug />

	<footer class="colophon">
		A web homage to <em>INQ's Number Snug</em> from the Curiosity Box. The piece shapes were modeled on
		the original acrylic set, and the reference solution was solved by hand — the 45° cuts aren't decoration,
		the tiling math doesn't work without them.
	</footer>
</div>

<style>
	.puzzle-layout {
		max-width: 46rem;
		gap: 1.25rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.subtitle {
		opacity: 0.7;
		margin-top: 0.35rem;
		max-width: 38rem;
	}

	.colophon {
		font-size: 0.85rem;
		opacity: 0.55;
		max-width: 38rem;
	}
</style>
