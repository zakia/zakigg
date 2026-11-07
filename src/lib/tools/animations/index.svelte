<script lang="ts">
	import { copyToClipboard } from '#lib/attachments/copy-to-clipboard.js';
	import BackLink from '#lib/components/BackLink.svelte';
	import { springLinear } from '#lib/utils/spring.js';
	import { resolve } from '$app/paths';
	import EasingCurve, { type BezierPoints } from './EasingCurve.svelte';
	import InteractionScenes from './InteractionScenes.svelte';

	const springPresets = [
		{ name: 'Snappy', stiffness: 420, damping: 34, mass: 1 },
		{ name: 'Balanced', stiffness: 240, damping: 20, mass: 1 },
		{ name: 'Bouncy', stiffness: 180, damping: 12, mass: 1 },
		{ name: 'Gentle', stiffness: 120, damping: 22, mass: 1.4 }
	];
	const cssPresets: { name: string; value: string; points: BezierPoints }[] = [
		{ name: 'Ease', value: 'ease', points: [0.25, 0.1, 0.25, 1] },
		{ name: 'Ease in', value: 'ease-in', points: [0.42, 0, 1, 1] },
		{ name: 'Ease out', value: 'ease-out', points: [0, 0, 0.58, 1] },
		{ name: 'Ease in out', value: 'ease-in-out', points: [0.42, 0, 0.58, 1] },
		{ name: 'Linear', value: 'linear', points: [0, 0, 1, 1] }
	];
	const coordinates = ['x₁', 'y₁', 'x₂', 'y₂'];
	const durationPresets = [200, 300, 500, 1000];
	let stiffness = $state(240);
	let damping = $state(20);
	let mass = $state(1);
	let easing = $state('ease-in-out');
	let points = $state<BezierPoints>([0.42, 0, 0.58, 1]);
	let duration = $state(500);
	let playback = $state(0);
	let switchOn = $state(false);
	let menuOpen = $state(false);
	let notificationVisible = $state(false);

	const spring = $derived(springLinear({ stiffness, damping, mass }));
	// Use the exact, evenly spaced samples sent to CSS linear().
	const springSamples = $derived(spring.css.slice(7, -1).split(',').map(Number));
	const cssEasing = $derived(easing === 'custom' ? `cubic-bezier(${points.join(', ')})` : easing);
	const allOpen = $derived(switchOn && menuOpen && notificationVisible);

	function animateBoth() {
		const next = !allOpen;
		switchOn = next;
		menuOpen = next;
		notificationVisible = next;
		playback++;
	}

	function toggleSwitch() {
		switchOn = !switchOn;
		playback++;
	}
	function toggleMenu() {
		menuOpen = !menuOpen;
		playback++;
	}
	function toggleNotification() {
		notificationVisible = !notificationVisible;
		playback++;
	}

	function applySpring(preset: (typeof springPresets)[number]) {
		stiffness = preset.stiffness;
		damping = preset.damping;
		mass = preset.mass;
		animateBoth();
	}

	function applyCSS(preset: (typeof cssPresets)[number]) {
		easing = preset.value;
		points = [...preset.points];
		animateBoth();
	}

	function changePoints(next: BezierPoints) {
		points = next;
		easing = 'custom';
	}

	function numberValue(input: HTMLInputElement, fallback: number) {
		const value = input.valueAsNumber;
		return Number.isFinite(value) && value >= Number(input.min) && value <= Number(input.max)
			? value
			: fallback;
	}

	function changeCoordinate(index: number, input: HTMLInputElement) {
		const next: BezierPoints = [...points];
		next[index] = numberValue(input, next[index]);
		changePoints(next);
	}

	function transitionCode(time: number, curve: string) {
		return `.demo {\n  --duration: ${time}ms;\n  --easing: ${curve};\n\n  transition:\n    transform var(--duration) var(--easing),\n    opacity var(--duration) var(--easing);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .demo { transition: none; }\n}`;
	}
	const springCode = $derived(transitionCode(spring.duration, spring.css));
	const easingCode = $derived(transitionCode(duration, cssEasing));
</script>

<div class="spring-playground">
	<header>
		<BackLink href={resolve('tools')} label="Tools" />
		<p class="eyebrow">A feel for motion</p>
		<h1>Springs vs. CSS easing</h1>
		<p class="intro">
			The same interactions, two ways to move. Pick a preset, shape the curve, and see how it feels.
		</p>
	</header>

	<div class="comparison">
		<section class="motion-panel spring-panel" aria-labelledby="spring-title">
			<div class="panel-heading">
				<div class="title-row">
					<span class="motion-dot"></span>
					<h2 id="spring-title">Spring physics</h2>
				</div>
			</div>
			<div class="curve-demo">
				<div class="preset-buttons" role="group" aria-label="Spring presets">
					{#each springPresets as preset (preset.name)}
						<button
							type="button"
							aria-pressed={stiffness === preset.stiffness &&
								damping === preset.damping &&
								mass === preset.mass}
							onclick={() => applySpring(preset)}>{preset.name}</button
						>
					{/each}
				</div>
				<div class="curve-workspace">
					<EasingCurve
						label="Spring"
						samples={springSamples}
						duration={spring.duration}
						easing={spring.css}
						{playback}
					/>
					<div class="curve-controls spring-controls">
						<div class="spring-parameter">
							<label for="stiffness"
								>Stiffness <input
									id="stiffness"
									aria-label="Stiffness value"
									type="number"
									min="50"
									max="500"
									step="10"
									value={stiffness}
									oninput={(e) => (stiffness = numberValue(e.currentTarget, stiffness))}
									onblur={(e) => (e.currentTarget.value = String(stiffness))}
								/></label
							>
							<input
								aria-label="Stiffness"
								type="range"
								min="50"
								max="500"
								step="10"
								bind:value={stiffness}
							/>
						</div>
						<div class="spring-parameter">
							<label for="damping"
								>Damping <input
									id="damping"
									aria-label="Damping value"
									type="number"
									min="5"
									max="50"
									step="1"
									value={damping}
									oninput={(e) => (damping = numberValue(e.currentTarget, damping))}
									onblur={(e) => (e.currentTarget.value = String(damping))}
								/></label
							>
							<input
								aria-label="Damping"
								type="range"
								min="5"
								max="50"
								step="1"
								bind:value={damping}
							/>
						</div>
						<div class="spring-parameter">
							<label for="mass"
								>Mass <input
									id="mass"
									aria-label="Mass value"
									type="number"
									min="0.2"
									max="3"
									step="0.1"
									value={mass}
									oninput={(e) => (mass = numberValue(e.currentTarget, mass))}
									onblur={(e) => (e.currentTarget.value = String(mass))}
								/></label
							>
							<input
								aria-label="Mass"
								type="range"
								min="0.2"
								max="3"
								step="0.1"
								bind:value={mass}
							/>
						</div>
						<p class="timing-note">{spring.duration}ms to settle</p>
					</div>
				</div>
			</div>
			<InteractionScenes
				label="Spring"
				duration={spring.duration}
				easing={spring.css}
				{switchOn}
				{menuOpen}
				{notificationVisible}
				onswitch={toggleSwitch}
				onmenu={toggleMenu}
				onnotification={toggleNotification}
			/>
		</section>

		<section class="motion-panel css-panel" aria-labelledby="css-title">
			<div class="panel-heading">
				<div class="title-row">
					<span class="motion-dot"></span>
					<h2 id="css-title">CSS easing</h2>
				</div>
				<p>Choose a curve. Decide how long it takes.</p>
			</div>
			<div class="curve-demo">
				<div class="preset-buttons" role="group" aria-label="CSS easing presets">
					{#each cssPresets as preset}
						<button
							type="button"
							aria-pressed={easing === preset.value}
							onclick={() => applyCSS(preset)}>{preset.name}</button
						>
					{/each}
				</div>
				<div class="curve-workspace">
					<EasingCurve
						label="CSS"
						{points}
						{duration}
						easing={cssEasing}
						{playback}
						onchange={changePoints}
						oncommit={animateBoth}
					/>
					<div class="curve-controls css-controls">
						<fieldset class="bezier-controls">
							<legend>cubic-bezier</legend>
							{#each coordinates as coordinate, index}
								<label
									>{coordinate}<input
										aria-label={`Bézier ${index % 2 === 0 ? 'x' : 'y'}${Math.floor(index / 2) + 1}`}
										type="number"
										min={index % 2 === 0 ? 0 : -1}
										max={index % 2 === 0 ? 1 : 2}
										step="0.01"
										value={points[index]}
										oninput={(e) => changeCoordinate(index, e.currentTarget)}
										onblur={(e) => (e.currentTarget.value = String(points[index]))}
									/></label
								>
							{/each}
						</fieldset>
						<fieldset class="duration-group">
							<legend>Duration</legend>
							<div class="duration-presets">
								{#each durationPresets as preset}
									<button
										type="button"
										aria-pressed={duration === preset}
										onclick={() => {
											duration = preset;
											animateBoth();
										}}>{preset}ms</button
									>
								{/each}
							</div>
							<label class="duration-control" for="duration"
								>Custom <span
									><input
										id="duration"
										aria-label="Duration"
										type="number"
										min="100"
										max="2000"
										step="50"
										value={duration}
										oninput={(e) => (duration = numberValue(e.currentTarget, duration))}
										onblur={(e) => (e.currentTarget.value = String(duration))}
									/> ms</span
								></label
							>
						</fieldset>
						<p class="timing-note">{easing === 'custom' ? 'Custom curve' : easing}</p>
					</div>
				</div>
			</div>
			<InteractionScenes
				label="CSS"
				{duration}
				easing={cssEasing}
				{switchOn}
				{menuOpen}
				{notificationVisible}
				onswitch={toggleSwitch}
				onmenu={toggleMenu}
				onnotification={toggleNotification}
			/>
		</section>
	</div>

	<details class="code-details">
		<summary>View generated CSS <span>Updates as you tune</span></summary>
		<div class="code-columns">
			{#each [{ label: 'Spring → CSS linear()', code: springCode }, { label: 'CSS easing', code: easingCode }] as snippet}
				<div class="code-panel">
					<div class="code-heading">
						<strong>{snippet.label}</strong><button
							type="button"
							{@attach copyToClipboard(() => snippet.code, snippet.label)}>Copy CSS</button
						>
					</div>
					<pre><code>{snippet.code}</code></pre>
				</div>
			{/each}
		</div>
	</details>

	<article class="writeup" aria-labelledby="writeup-title">
		<h2 id="writeup-title">Performant spring physics</h2>
		<nav class="table-of-contents" aria-label="Write-up contents">
			<h3>Contents</h3>
			<ol>
				<li><a href="#why-springs">Choose the feel</a></li>
				<li><a href="#physics-to-css">Capture the motion with linear()</a></li>
				<li><a href="#sampling-the-curve">Sample only what matters</a></li>
				<li><a href="#knowing-when-to-stop">Stop when the motion settles</a></li>
				<li><a href="#ship-the-css">Generate once, reuse across the project</a></li>
				<li><a href="#saved-curve-tradeoffs">Understand the saved curve’s limits</a></li>
			</ol>
		</nav>

		<section id="why-springs">
			<h3>Choose the feel</h3>
			<ul>
				<li>
					Start with the switch, menu, and notification demos: judge motion in an actual
					interaction.
				</li>
				<li>Tune stiffness, damping, and mass to control snap, bounce, and weight.</li>
				<li>Compare that workflow with choosing a Bézier curve and setting its duration.</li>
			</ul>
		</section>

		<section id="physics-to-css">
			<h3>Capture the motion with <code>linear()</code></h3>
			<ul>
				<li>
					Distinguish constant-speed <code>linear</code> from <code>linear(...)</code>, which
					connects a sequence of progress values.
				</li>
				<li>Solve the spring’s position over time and turn those positions into easing stops.</li>
				<li>
					Show how values above 1 preserve overshoot, with the browser interpolating between
					samples.
				</li>
			</ul>
		</section>

		<section id="sampling-the-curve">
			<h3>Sample only what matters</h3>
			<ul>
				<li>Adjust the sampling interval and compare the resulting motion, curve, and CSS size.</li>
				<li>
					Explore error-based point reduction: retain detail around sharp changes and remove
					redundant samples along flatter stretches.
				</li>
				<li>Choose a fidelity budget and sample count appropriate to each spring.</li>
			</ul>
		</section>

		<section id="knowing-when-to-stop">
			<h3>Stop when the motion settles</h3>
			<ul>
				<li>
					Derive duration from position and velocity thresholds, cutting off the imperceptible tail.
				</li>
				<li>
					Relate those thresholds to the distance an element moves and the size at which it is
					displayed.
				</li>
			</ul>
		</section>

		<section id="ship-the-css">
			<h3>Generate once, reuse across the project</h3>
			<ul>
				<li>
					Export the easing stops and their matching duration. Keep the generator and solver in the
					authoring tool.
				</li>
				<li>
					Package the result as named CSS variables and reuse the same motion across components.
				</li>
				<li>
					Apply it to <code>transform</code> and <code>opacity</code> transitions while respecting reduced-motion
					preferences.
				</li>
			</ul>
		</section>

		<section id="saved-curve-tradeoffs">
			<h3>Understand the saved curve’s limits</h3>
			<ul>
				<li>
					A saved easing replays a fixed motion profile; interrupted transitions do not preserve
					live spring velocity.
				</li>
				<li>
					Identify interactions where a runtime spring is useful, such as repeated retargeting or
					gesture-driven movement.
				</li>
				<li>Measure playback and generated CSS size before making performance claims.</li>
			</ul>
		</section>

		<p class="writeup-reference">
			Related reading: <a href="https://www.joshwcomeau.com/animation/linear-timing-function/"
				>Springs and Bounces in Native CSS</a
			> by Josh W. Comeau.
		</p>
	</article>
</div>

<style>
	.spring-playground {
		width: min(100% - 3rem, 66rem);
		margin: 0 auto;
		padding: 1.75rem 0 8rem;
	}
	header {
		max-width: 42rem;
	}
	.eyebrow {
		margin: 1.75rem 0 0.6rem;
		color: var(--brand);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	h1 {
		font-size: clamp(2rem, 4vw, 2.8rem);
		letter-spacing: -0.045em;
		line-height: 1.12;
		margin: 0;
	}
	.intro {
		color: var(--content-1);
		font-size: 1rem;
		line-height: 1.65;
		margin: 1rem 0 0;
		max-width: 38rem;
	}
	button {
		font: inherit;
	}
	button {
		cursor: pointer;
	}
	.comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		align-items: stretch;
	}
	.motion-panel {
		--motion-color: var(--brand);
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 1rem;
		overflow: hidden;
	}
	.css-panel {
		--motion-color: var(--content-1);
	}
	.panel-heading {
		padding: 1.4rem 1.5rem 1.25rem;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.motion-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--motion-color);
	}
	h2 {
		font-size: 1.1rem;
		font-weight: 650;
		letter-spacing: -0.025em;
		margin: 0;
	}
	.panel-heading p {
		color: var(--content-1);
		font-size: 0.78rem;
		margin: 0.4rem 0 0;
		line-height: 1.5;
	}
	.curve-demo {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 0 1.5rem 1.5rem;
		container-type: inline-size;
	}
	.preset-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-content: start;
		min-height: 2.25rem;
		margin-bottom: 1rem;
	}
	.preset-buttons button,
	.duration-presets button {
		border: 1px solid var(--edge);
		background: var(--base-1);
		color: var(--content-1);
		padding: 0.35rem 0.65rem;
		border-radius: 0.4rem;
		font-size: 0.68rem;
		font-weight: 500;
		white-space: nowrap;
	}
	.preset-buttons button:hover,
	.duration-presets button:hover {
		border-color: var(--motion-color);
		color: var(--content);
	}
	.preset-buttons button[aria-pressed='true'],
	.duration-presets button[aria-pressed='true'] {
		border-color: var(--motion-color);
		background: color-mix(in oklch, var(--motion-color) 10%, var(--base-1));
		color: var(--motion-color);
	}
	.curve-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 9rem;
		align-items: center;
		flex: 1;
		gap: 1rem;
	}
	.curve-controls {
		display: grid;
		gap: 1.25rem;
		align-content: center;
		min-width: 0;
	}
	.curve-controls label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		font-size: 0.72rem;
		line-height: 1.3;
	}
	input[type='number'] {
		appearance: textfield;
		width: 3.75rem;
		min-width: 0;
		padding: 0.35rem 0.2rem 0.35rem 0.4rem;
		border: 1px solid var(--edge);
		border-radius: 0.35rem;
		background: var(--base);
		color: var(--content);
		font: inherit;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}
	.spring-parameter {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--motion-color);
		cursor: pointer;
		margin: 0;
		height: 0.8rem;
	}
	.timing-note {
		color: var(--content-1);
		font-size: 0.64rem;
		line-height: 1.5;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.bezier-controls {
		display: grid;
		align-self: start;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem 0.5rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.bezier-controls legend {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		color: var(--content-1);
		padding: 0 0 0.75rem;
	}
	.bezier-controls label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.65rem;
	}
	.bezier-controls input {
		width: 100%;
	}
	.curve-controls .duration-control {
		flex-direction: column;
		align-items: start;
		gap: 0.5rem;
	}
	.duration-group {
		display: grid;
		gap: 0.65rem;
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	.duration-group legend {
		font-size: 0.72rem;
		padding: 0 0 0.5rem;
	}
	.duration-presets {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.3rem;
	}
	.duration-presets button {
		padding-inline: 0.3rem;
		font-size: 0.64rem;
	}
	.duration-control > span {
		font-size: 0.65rem;
		color: var(--content-1);
	}
	.duration-control input {
		width: 5rem;
	}
	@container (max-width: 25rem) {
		.preset-buttons {
			min-height: 4.5rem;
		}
		.curve-workspace {
			grid-template-columns: 1fr;
		}
		.curve-controls {
			min-height: 6.5rem;
			align-content: start;
		}
		.spring-controls {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0.75rem;
		}
		.spring-parameter label {
			flex-direction: column;
			align-items: start;
		}
		.spring-parameter input[type='number'] {
			width: 100%;
		}
		.spring-controls .timing-note {
			grid-column: 1 / -1;
		}
		.css-controls {
			grid-template-columns: 1fr auto;
			gap: 0.75rem;
		}
		.bezier-controls {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 0.35rem;
		}
		.bezier-controls legend {
			padding-bottom: 0.4rem;
		}
		.css-controls .timing-note {
			grid-column: 1 / -1;
		}
		.curve-controls .duration-control {
			gap: 0.3rem;
			font-size: 0.65rem;
		}
		.duration-control input {
			width: 4rem;
		}
	}
	.writeup {
		max-width: 44rem;
		margin: 3.5rem auto 0;
	}
	.writeup > h2 {
		font-size: 1.6rem;
		margin-bottom: 1.5rem;
	}
	h3 {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		letter-spacing: -0.015em;
	}
	.writeup ul,
	.writeup ol {
		color: var(--content-1);
		font-size: 0.85rem;
		line-height: 1.8;
		margin: 0.6rem 0 0;
		padding-left: 1.25rem;
	}
	.writeup li + li {
		margin-top: 0.4rem;
	}
	.writeup ul {
		list-style: disc;
	}
	.writeup ol {
		list-style: decimal;
	}
	.writeup section {
		margin-top: 2rem;
		scroll-margin-top: 2rem;
	}
	.writeup code {
		font-size: 0.9em;
	}
	.table-of-contents {
		border-left: 2px solid var(--edge);
		padding-left: 1.25rem;
	}
	.table-of-contents a {
		color: var(--content);
		text-decoration: underline;
		text-decoration-color: var(--edge);
		text-underline-offset: 0.2em;
	}
	.table-of-contents a:hover {
		color: var(--brand);
		text-decoration-color: currentColor;
	}
	.writeup-reference {
		margin: 2.5rem 0 0;
		color: var(--content-1);
		font-size: 0.75rem;
		line-height: 1.7;
	}
	.writeup-reference a {
		color: var(--brand);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.code-details {
		margin-top: 1.5rem;
		border-top: 1px solid var(--edge);
	}
	summary {
		cursor: pointer;
		padding: 1rem 0;
		font-size: 0.8rem;
		font-weight: 550;
	}
	summary > span {
		float: right;
		color: var(--content-1);
		font-size: 0.7rem;
		font-weight: 400;
	}
	.code-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		padding-bottom: 1rem;
	}
	.code-panel {
		min-width: 0;
		border: 1px solid var(--edge);
		border-radius: 0.6rem;
		overflow: hidden;
		background: var(--base-1);
	}
	.code-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--edge);
		font-size: 0.7rem;
	}
	.code-heading button {
		background: var(--base);
		color: var(--content);
		border: 1px solid var(--edge);
		border-radius: 0.3rem;
		padding: 0.3rem 0.5rem;
		font-size: 0.65rem;
	}
	pre {
		margin: 0;
		padding: 1rem;
		max-height: 15rem;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 0.65rem;
		line-height: 1.8;
	}
	button:focus-visible,
	input:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 4px;
	}
	@media (max-width: 42rem) {
		.spring-playground {
			width: min(100% - 2rem, 30rem);
			padding-top: 1.5rem;
		}
		.eyebrow {
			margin-top: 2rem;
		}
		.comparison,
		.code-columns {
			grid-template-columns: 1fr;
		}
		.comparison {
			gap: 1rem;
		}
		.panel-heading {
			padding: 1.25rem;
		}
		.curve-demo {
			padding: 0 1.25rem 1.25rem;
		}
		summary > span {
			display: none;
		}
	}
</style>
