<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import ProfileAccount from '$lib/auth/ProfileAccount.svelte';
	import { useGridSettings } from '$lib/grid-settings.svelte';

	const grid = useGridSettings();
</script>

<svelte:head>
	<title>Profile – zaki.gg</title>
	<meta name="description" content="Account and appearance settings for zaki.gg." />
</svelte:head>

<div class="profile-page">
	<header>
		<p>zaki.gg</p>
		<h1>Profile</h1>
	</header>

	<ProfileAccount />

	<section class="setting-card" aria-labelledby="background-heading">
		<div class="setting-heading">
			<Icon icon="mdi:dots-grid" />
			<div>
				<h2 id="background-heading">Dot background</h2>
				<p>Adjust the site canvas to your taste.</p>
			</div>
		</div>

		<label>
			<span><strong>Spacing</strong><output>{grid.spacing}px</output></span>
			<input
				type="range"
				min="24"
				max="112"
				step="4"
				value={grid.spacing}
				oninput={(event) => grid.setSpacing(Number(event.currentTarget.value))}
			/>
		</label>
		<label>
			<span><strong>Dot size</strong><output>{grid.dotSize}px</output></span>
			<input
				type="range"
				min="0"
				max="6"
				step="0.5"
				value={grid.dotSize}
				oninput={(event) => grid.setDotSize(Number(event.currentTarget.value))}
			/>
		</label>
		<button type="button" class="reset" onclick={grid.reset}>Reset background</button>
	</section>
</div>

<style>
	.profile-page {
		display: grid;
		gap: var(--s0);
		margin-inline: auto;
		max-width: 42rem;
		padding: var(--s2) var(--s0) calc(7rem + env(safe-area-inset-bottom));
		width: 100%;
	}

	header {
		margin-bottom: var(--s0);
	}

	header p,
	header h1,
	h2,
	.setting-heading p {
		margin: 0;
	}

	header p {
		color: var(--brand);
		font-size: var(--s-1);
		font-weight: 700;
		text-transform: uppercase;
	}

	header h1 {
		font-size: var(--s2);
	}

	.setting-card {
		background: color-mix(in oklch, var(--base-1) 82%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--s-1);
		display: grid;
		gap: var(--s0);
		padding: var(--s1);
	}

	.setting-heading,
	button,
	label span {
		align-items: center;
		display: flex;
	}

	.setting-heading {
		gap: var(--s-1);
	}

	.setting-heading :global(svg) {
		color: var(--brand);
		height: 1.5rem;
		width: 1.5rem;
	}

	h2 {
		font-size: 1rem;
	}

	.setting-heading p {
		color: var(--content-1);
		font-size: 0.8rem;
	}

	button {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: 999px;
		color: var(--content);
		gap: var(--s-3);
		padding: var(--s-2) var(--s0);
	}

	button :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	label {
		display: grid;
		gap: var(--s-2);
	}

	label span {
		font-size: 0.85rem;
		justify-content: space-between;
	}

	output {
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
	}

	input[type='range'] {
		accent-color: var(--brand);
		width: 100%;
	}

	.reset {
		justify-self: start;
	}
</style>
