<script lang="ts">
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
		<h1>Profile</h1>
		<p>Account and appearance.</p>
	</header>

	<ProfileAccount />

	<section class="settings-section" aria-labelledby="background-heading">
		<div class="section-heading">
			<div>
				<h2 id="background-heading">Background</h2>
				<p>Dot grid appearance across the site.</p>
			</div>
			<button type="button" class="reset" onclick={grid.reset}>Reset</button>
		</div>

		<label class="range-setting">
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
		<label class="range-setting">
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

		<label class="toggle-setting">
			<span>
				<strong>Fixed background</strong>
				<small>Keep the dots anchored while scrolling.</small>
			</span>
			<span class="switch">
				<input
					type="checkbox"
					checked={grid.fixed}
					onchange={(event) => grid.setFixed(event.currentTarget.checked)}
				/>
				<span class="track" aria-hidden="true"></span>
			</span>
		</label>
	</section>
</div>

<style>
	.profile-page {
		display: grid;
		margin-inline: auto;
		max-width: 36rem;
		padding: var(--s2) var(--s0) calc(var(--mobile-nav-height) + var(--s2));
		width: 100%;
	}

	.profile-page > header {
		display: grid;
		gap: var(--s-4);
		padding-bottom: var(--s2);
	}

	header p,
	header h1,
	h2,
	.section-heading p {
		margin: 0;
	}

	header h1 {
		font-size: var(--s2);
		letter-spacing: -0.035em;
		line-height: 1.1;
	}

	header p,
	.section-heading p,
	small {
		color: var(--content-1);
	}

	.settings-section {
		border-top: 1px solid var(--edge);
		display: grid;
		gap: var(--s1);
		padding-block: var(--s1);
	}

	.section-heading,
	.range-setting > span,
	.toggle-setting {
		align-items: center;
		display: flex;
	}

	.section-heading,
	.range-setting > span,
	.toggle-setting {
		justify-content: space-between;
	}

	h2 {
		font-size: 1rem;
	}

	.section-heading p,
	small {
		display: block;
		font-size: 0.8rem;
	}

	button {
		background: transparent;
		border: 0;
		color: var(--content-1);
		font-size: 0.8rem;
		padding: var(--s-2) 0;
	}

	button:hover {
		color: var(--brand);
	}

	.range-setting {
		display: grid;
		gap: var(--s-2);
	}

	.range-setting > span {
		font-size: 0.85rem;
	}

	output {
		color: var(--content-1);
		font-variant-numeric: tabular-nums;
	}

	input[type='range'] {
		accent-color: var(--brand);
		width: 100%;
	}

	.toggle-setting > span:first-child {
		display: grid;
		gap: var(--s-5);
	}

	.switch {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		position: relative;
	}

	.switch input {
		height: 1px;
		opacity: 0;
		position: absolute;
		width: 1px;
	}

	.track {
		background: var(--edge-1);
		border-radius: 999px;
		display: block;
		height: 1.25rem;
		position: relative;
		transition: background 160ms ease;
		width: 2.25rem;
	}

	.track::after {
		background: var(--base-1);
		border-radius: 50%;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
		content: '';
		height: 0.9rem;
		left: 0.18rem;
		position: absolute;
		top: 0.175rem;
		transition: translate 160ms ease;
		width: 0.9rem;
	}

	.switch input:checked + .track {
		background: var(--brand);
	}

	.switch input:checked + .track::after {
		translate: 1rem 0;
	}

	.switch input:focus-visible + .track {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}
</style>
