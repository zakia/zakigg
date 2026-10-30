<script lang="ts">
	import { resolve } from '$app/paths';
	import BackLink from '#lib/components/BackLink.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { copyToClipboard } from '#lib/attachments/copy-to-clipboard.js';
	import { springLinear } from '#lib/utils/spring.js';

	// --- Physics State ---
	let mass = $state(1);
	let stiffness = $state(240);
	let damping = $state(20);
	let velocity = $state(0);

	// --- Interactive Demo State ---
	let demoActive = $state(true);
	let animationKey = $state(0);
	let codeTab = $state<'css' | 'linear' | 'ts'>('css');

	// --- Presets ---
	interface Preset {
		name: string;
		desc: string;
		mass: number;
		stiffness: number;
		damping: number;
		velocity: number;
	}

	const presets: Preset[] = [
		{
			name: 'Balanced (Motion)',
			desc: 'Crisp ~7% overshoot, firm brake',
			mass: 1,
			stiffness: 240,
			damping: 20,
			velocity: 0
		},
		{
			name: 'Snappy UI',
			desc: 'High tension, quick snap',
			mass: 1,
			stiffness: 420,
			damping: 34,
			velocity: 0
		},
		{
			name: 'Bouncy / Playful',
			desc: 'Multiple visible oscillations',
			mass: 1,
			stiffness: 180,
			damping: 12,
			velocity: 0
		},
		{
			name: 'Weighty Physics',
			desc: 'Heavy mass with solid inertia',
			mass: 2.8,
			stiffness: 260,
			damping: 28,
			velocity: 0
		},
		{
			name: 'Critically Damped',
			desc: 'Fastest settle, zero bounce',
			mass: 1,
			stiffness: 144,
			damping: 24,
			velocity: 0
		},
		{
			name: 'Overdamped',
			desc: 'Viscous, gentle deceleration',
			mass: 1,
			stiffness: 100,
			damping: 32,
			velocity: 0
		}
	];

	function applyPreset(p: Preset) {
		mass = p.mass;
		stiffness = p.stiffness;
		damping = p.damping;
		velocity = p.velocity;
		replay();
	}

	// --- Analytical Spring Derivation ---
	const spring = $derived(
		springLinear({
			mass,
			stiffness,
			damping,
			velocity,
			resolution: 12
		})
	);

	// Physical characteristics
	const w0 = $derived(Math.sqrt(Math.max(stiffness, 0.01) / Math.max(mass, 0.01)));
	const zeta = $derived(damping / (2 * Math.sqrt(Math.max(stiffness, 0.01) * Math.max(mass, 0.01))));
	const regime = $derived(
		zeta < 0.999 ? 'Underdamped' : zeta > 1.001 ? 'Overdamped' : 'Critically Damped'
	);

	// Peak calculation
	const maxOvershoot = $derived.by(() => {
		const durSec = spring.duration / 1000;
		const samples = 100;
		let maxVal = 0;
		for (let i = 0; i <= samples; i++) {
			const v = spring.solver((i / samples) * durSec);
			if (v > maxVal) maxVal = v;
		}
		return maxVal > 1.001 ? ((maxVal - 1) * 100).toFixed(1) : '0';
	});

	function replay() {
		animationKey++;
	}

	function toggleDemo() {
		demoActive = !demoActive;
		animationKey++;
	}

	// --- SVG Curve Geometry ---
	const chart = $derived.by(() => {
		const durSec = spring.duration / 1000;
		const samples = 120;
		let minVal = 0;
		let maxVal = 1;
		let peak = { val: -Infinity, timeMs: 0 };

		const rawPoints: { t: number; v: number }[] = [];
		for (let i = 0; i <= samples; i++) {
			const t = (i / samples) * durSec;
			const v = spring.solver(t);
			rawPoints.push({ t, v });
			if (v > peak.val) {
				peak = { val: v, timeMs: Math.round(t * 1000) };
			}
			if (v < minVal) minVal = v;
			if (v > maxVal) maxVal = v;
		}

		const padLeft = 45;
		const padRight = 25;
		const padTop = 32;
		const padBottom = 28;
		const width = 640;
		const height = 210;
		const plotW = width - padLeft - padRight;
		const plotH = height - padTop - padBottom;

		const minYVal = Math.min(0, minVal - 0.05);
		const maxYVal = Math.max(1.15, maxVal + 0.08);
		const valSpan = maxYVal - minYVal || 1;

		const mapX = (t: number) => padLeft + (t / durSec) * plotW;
		const mapY = (v: number) => padTop + plotH - ((v - minYVal) / valSpan) * plotH;

		const pts = rawPoints.map((p) => `${mapX(p.t).toFixed(1)},${mapY(p.v).toFixed(1)}`);
		const path = `M ${pts.join(' L ')}`;

		const peakPoint =
			peak.val > 1.002
				? {
						x: mapX(peak.timeMs / 1000),
						y: mapY(peak.val),
						val: peak.val,
						timeMs: peak.timeMs
					}
				: null;

		return {
			width,
			height,
			plotW,
			plotH,
			padLeft,
			path,
			peakPoint,
			targetY: mapY(1),
			zeroY: mapY(0)
		};
	});

	// Swatch demo palette items
	const demoSwatches = [
		{ label: 'Ruby', hue: 25 },
		{ label: 'Amber', hue: 50 },
		{ label: 'Sky', hue: 215 },
		{ label: 'Iris', hue: 290 }
	];

	// Formatted code snippets
	const cssSnippet = $derived(
		`/* Damped Harmonic Oscillator -> CSS linear() */\n.element {\n  --spring-duration: ${spring.duration}ms;\n  --spring-ease: ${spring.css};\n\n  transition: transform var(--spring-duration) var(--spring-ease);\n}`
	);

	const linearSnippet = $derived(spring.css);

	const tsSnippet = $derived(
		`import { springLinear } from '#lib/utils/spring.js';\n\nconst spring = springLinear({\n  mass: ${mass},\n  stiffness: ${stiffness},\n  damping: ${damping},\n  velocity: ${velocity}\n});\n\nconsole.log(spring.duration); // ${spring.duration}ms\nconsole.log(spring.css);      // linear(...)`
	);

	const activeCode = $derived(
		codeTab === 'css' ? cssSnippet : codeTab === 'linear' ? linearSnippet : tsSnippet
	);
</script>

<div
	class="spring-playground"
	style={`--spring-duration: ${spring.duration}ms; --spring-ease: ${spring.css};`}
>
	<div class="playground-inner">
		<!-- Navigation Header -->
		<header class="playground-header">
			<BackLink href={resolve('tools')} label="Tools" />
			<div class="header-titles">
				<h1>Spring Physics & CSS linear()</h1>
				<p>
					Damped harmonic oscillator engine that compiles continuous differential equations into
					GPU-accelerated CSS <code>linear(...)</code> easing functions.
				</p>
			</div>
		</header>

		<!-- Diagnostics Ribbon -->
		<div class="diagnostics-ribbon" role="region" aria-label="Spring diagnostics">
			<div class="diagnostic-card">
				<span class="diag-label">Duration</span>
				<span class="diag-value"><strong>{spring.duration}</strong>ms</span>
			</div>
			<div class="diagnostic-card">
				<span class="diag-label">Damping Ratio (ζ)</span>
				<span class="diag-value"><strong>{zeta.toFixed(2)}</strong></span>
				<span class="regime-badge" class:underdamped={zeta < 1} class:critically={zeta === 1}>
					{regime}
				</span>
			</div>
			<div class="diagnostic-card">
				<span class="diag-label">Overshoot</span>
				<span class="diag-value">
					<strong>{maxOvershoot !== '0' ? `+${maxOvershoot}%` : '0%'}</strong>
				</span>
			</div>
			<div class="diagnostic-card">
				<span class="diag-label">Natural Frequency</span>
				<span class="diag-value"><strong>{w0.toFixed(1)}</strong> rad/s</span>
			</div>
		</div>

		<!-- Presets Bar -->
		<section class="presets-section" aria-label="Presets">
			<span class="presets-title">Presets:</span>
			<div class="presets-list">
				{#each presets as p (p.name)}
					{@const active =
						mass === p.mass &&
						stiffness === p.stiffness &&
						damping === p.damping &&
						velocity === p.velocity}
					<button
						type="button"
						class="preset-button"
						class:is-active={active}
						onclick={() => applyPreset(p)}
						title={p.desc}
					>
						{p.name}
					</button>
				{/each}
			</div>
		</section>

		<!-- Main Workspace Grid -->
		<div class="workspace-grid">
			<!-- Left Column: Controls & Physics Curve -->
			<div class="panel controls-panel">
				<h2>Physics Parameters</h2>

				<div class="controls-stack">
					<!-- Stiffness Slider -->
					<div class="control-row">
						<div class="control-label-group">
							<label for="input-stiffness">Stiffness (k)</label>
							<span class="control-hint">Tension & snap</span>
						</div>
						<div class="control-input-group">
							<input
								id="input-stiffness"
								type="range"
								min="20"
								max="600"
								step="10"
								bind:value={stiffness}
								oninput={replay}
							/>
							<input
								type="number"
								min="10"
								max="1000"
								step="10"
								bind:value={stiffness}
								oninput={replay}
								class="number-box"
							/>
						</div>
					</div>

					<!-- Damping Slider -->
					<div class="control-row">
						<div class="control-label-group">
							<label for="input-damping">Damping (c)</label>
							<span class="control-hint">Braking resistance</span>
						</div>
						<div class="control-input-group">
							<input
								id="input-damping"
								type="range"
								min="2"
								max="60"
								step="1"
								bind:value={damping}
								oninput={replay}
							/>
							<input
								type="number"
								min="0"
								max="100"
								step="1"
								bind:value={damping}
								oninput={replay}
								class="number-box"
							/>
						</div>
					</div>

					<!-- Mass Slider -->
					<div class="control-row">
						<div class="control-label-group">
							<label for="input-mass">Mass (m)</label>
							<span class="control-hint">Inertia & weight</span>
						</div>
						<div class="control-input-group">
							<input
								id="input-mass"
								type="range"
								min="0.2"
								max="5"
								step="0.1"
								bind:value={mass}
								oninput={replay}
							/>
							<input
								type="number"
								min="0.1"
								max="10"
								step="0.1"
								bind:value={mass}
								oninput={replay}
								class="number-box"
							/>
						</div>
					</div>

					<!-- Initial Velocity Slider -->
					<div class="control-row">
						<div class="control-label-group">
							<label for="input-velocity">Initial Velocity (v₀)</label>
							<span class="control-hint">Release kick</span>
						</div>
						<div class="control-input-group">
							<input
								id="input-velocity"
								type="range"
								min="-40"
								max="40"
								step="2"
								bind:value={velocity}
								oninput={replay}
							/>
							<input
								type="number"
								min="-100"
								max="100"
								step="1"
								bind:value={velocity}
								oninput={replay}
								class="number-box"
							/>
						</div>
					</div>
				</div>

				<!-- SVG Spring Curve Visualizer -->
				<div class="curve-visualizer" aria-label="Spring displacement curve">
					<div class="curve-header">
						<span class="curve-title">Displacement Curve x(t)</span>
						<span class="curve-legend">
							<span class="legend-target">Target (1.0)</span>
							{#if chart.peakPoint}
								<span class="legend-peak">Peak ({chart.peakPoint.val.toFixed(2)})</span>
							{/if}
						</span>
					</div>

					<div class="svg-container">
						<svg
							viewBox={`0 0 ${chart.width} ${chart.height}`}
							preserveAspectRatio="none"
							class="curve-svg"
						>
							<!-- Grid Lines -->
							<!-- Baseline 0 -->
							<line
								x1={chart.padLeft}
								y1={chart.zeroY}
								x2={chart.width - 25}
								y2={chart.zeroY}
								class="axis-line"
							/>
							<text x="32" y={chart.zeroY + 4} class="axis-label">0.0</text>

							<!-- Target Line 1 -->
							<line
								x1={chart.padLeft}
								y1={chart.targetY}
								x2={chart.width - 25}
								y2={chart.targetY}
								class="target-line"
							/>
							<text x="32" y={chart.targetY + 4} class="axis-label">1.0</text>

							<!-- Time Label Markers -->
							<text x={chart.padLeft} y={chart.height - 8} class="time-label">0ms</text>
							<text x={chart.padLeft + chart.plotW / 2} y={chart.height - 8} class="time-label mid"
								>{Math.round(spring.duration / 2)}ms</text
							>
							<text x={chart.width - 25} y={chart.height - 8} class="time-label end"
								>{spring.duration}ms</text
							>

							<!-- Spring Curve Path -->
							<path d={chart.path} class="spring-path" />

							<!-- Peak Overshoot Marker -->
							{#if chart.peakPoint}
								<circle
									cx={chart.peakPoint.x}
									cy={chart.peakPoint.y}
									r="4.5"
									class="peak-marker-dot"
								/>
								<text
									x={chart.peakPoint.x}
									y={Math.max(chart.peakPoint.y - 10, 14)}
									class="peak-marker-text"
								>
									+{maxOvershoot}% ({chart.peakPoint.timeMs}ms)
								</text>
							{/if}

							<!-- Animated Playhead Line -->
							{#key animationKey}
								<line
									x1={chart.padLeft}
									y1={10}
									x2={chart.padLeft}
									y2={chart.height - 24}
									class="playhead-line"
									style={`--sweep-distance: ${chart.plotW}px; animation-duration: ${spring.duration}ms;`}
								/>
							{/key}
						</svg>
					</div>
				</div>
			</div>

			<!-- Right Column: Interactive Demos & Code Output -->
			<div class="panel demos-panel">
				<div class="demos-header">
					<h2>Interactive Testbeds</h2>
					<div class="demo-actions">
						<button type="button" class="action-button" onclick={replay} title="Replay current animation">
							<Icon icon="mdi:replay" />
							<span>Replay</span>
						</button>
						<button
							type="button"
							class="action-button primary"
							onclick={toggleDemo}
							title="Toggle demo state between open/closed"
						>
							<Icon icon={demoActive ? 'mdi:arrow-collapse-horizontal' : 'mdi:arrow-expand-horizontal'} />
							<span>{demoActive ? 'Retract' : 'Launch'}</span>
						</button>
					</div>
				</div>

				<div class="demos-stack">
					<!-- Demo 1: Fan-Out Swatches (Theme Controls pattern) -->
					<div class="testbed-card">
						<div class="testbed-label">
							<span class="testbed-title">1. Fanning Launcher (Natural Stagger)</span>
							<span class="testbed-subtitle">All release simultaneously; relative distance scales velocity</span>
						</div>

						<div class="launcher-stage" class:is-expanded={demoActive}>
							<div class="launcher-items">
								{#each demoSwatches as swatch, i (i)}
									{@const slotOffset = demoSwatches.length - i}
									<div class="swatch-slot" style={`--slot-offset: ${slotOffset};`}>
										<div
											class="demo-swatch-ball"
											style={`--swatch-hue: ${swatch.hue};`}
											title={swatch.label}
										></div>
									</div>
								{/each}
							</div>

							<button
								type="button"
								class="launcher-trigger"
								onclick={toggleDemo}
								aria-label="Toggle launcher demo"
								title="Toggle launcher"
							>
								<Icon icon="mdi:palette" />
							</button>
						</div>
					</div>

					<!-- Demo 2: Weighted Sliding Puck -->
					<div class="testbed-card">
						<div class="testbed-label">
							<span class="testbed-title">2. Slider Track & Puck</span>
							<span class="testbed-subtitle">Direct linear translation with tangible physical braking</span>
						</div>

						<div
							class="track-stage"
							role="button"
							tabindex="0"
							onclick={toggleDemo}
							onkeydown={(e) => e.key === 'Enter' && toggleDemo()}
						>
							<div class="track-line" aria-hidden="true"></div>
							<div class="track-endpoints">
								<span class="endpoint-marker left">A</span>
								<span class="endpoint-marker right">B</span>
							</div>
							<div class="track-puck" class:at-b={demoActive}>
								<Icon icon="mdi:lightning-bolt" />
							</div>
						</div>
					</div>

					<!-- Demo 3: Modal / Card Pop -->
					<div class="testbed-card">
						<div class="testbed-label">
							<span class="testbed-title">3. Pop Scale & Overshoot</span>
							<span class="testbed-subtitle">Tangible scale pop without bouncy wobbles</span>
						</div>

						<div class="pop-stage">
							<div class="pop-card" class:is-expanded={demoActive}>
								<div class="pop-card-icon">
									<Icon icon="mdi:check-circle" />
								</div>
								<div class="pop-card-content">
									<strong>Confirmed</strong>
									<span>Compositor accelerated</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Code Output Inspector -->
				<div class="code-inspector">
					<div class="code-inspector-header">
						<div class="code-tabs" role="tablist">
							<button
								type="button"
								class="code-tab"
								class:is-active={codeTab === 'css'}
								onclick={() => (codeTab = 'css')}
								role="tab"
								aria-selected={codeTab === 'css'}
							>
								CSS Transition
							</button>
							<button
								type="button"
								class="code-tab"
								class:is-active={codeTab === 'linear'}
								onclick={() => (codeTab = 'linear')}
								role="tab"
								aria-selected={codeTab === 'linear'}
							>
								linear() Easing
							</button>
							<button
								type="button"
								class="code-tab"
								class:is-active={codeTab === 'ts'}
								onclick={() => (codeTab = 'ts')}
								role="tab"
								aria-selected={codeTab === 'ts'}
							>
								TypeScript API
							</button>
						</div>

						<button
							type="button"
							class="copy-code-btn"
							{@attach copyToClipboard(() => activeCode, 'Code')}
							title="Copy to clipboard"
						>
							<Icon icon="mdi:content-copy" />
							<span>Copy</span>
						</button>
					</div>

					<pre class="code-display"><code>{activeCode}</code></pre>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.spring-playground {
		background-color: var(--base);
		color: var(--content);
		min-height: 100vh;
		min-height: 100dvh;
		padding: var(--s2) var(--s0) var(--s5);
		width: 100%;
	}

	.playground-inner {
		display: flex;
		flex-direction: column;
		gap: var(--s2);
		margin: 0 auto;
		max-width: 78rem;
		width: 100%;
	}

	/* Header */
	.playground-header {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}

	.header-titles h1 {
		font-size: var(--s2);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
		margin: var(--s-2) 0 var(--s-4);
	}

	.header-titles p {
		color: var(--content-1);
		font-size: var(--s0);
		line-height: 1.5;
		margin: 0;
		max-width: 50rem;
	}

	.header-titles code {
		background: var(--base-2);
		border-radius: var(--s-4);
		font-family: inherit;
		font-size: 0.9em;
		padding: 0.15em 0.4em;
	}

	/* Diagnostics Ribbon */
	.diagnostics-ribbon {
		display: grid;
		gap: var(--s-1);
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
	}

	.diagnostic-card {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-1) var(--s0);
		position: relative;
	}

	.diag-label {
		color: var(--content-1);
		font-size: var(--s-1);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.diag-value {
		font-size: var(--s1);
		font-weight: 400;
	}

	.diag-value strong {
		color: var(--brand);
		font-size: var(--s2);
		font-weight: 700;
	}

	.regime-badge {
		align-self: flex-start;
		border-radius: var(--s-4);
		font-size: var(--s-2);
		font-weight: 600;
		padding: 0.15rem 0.5rem;
		background: var(--base-2);
		color: var(--content-1);
	}

	.regime-badge.underdamped {
		background: color-mix(in oklch, var(--brand) 18%, transparent);
		color: var(--brand);
	}

	.regime-badge.critically {
		background: color-mix(in oklch, oklch(75% 0.18 145) 18%, transparent);
		color: oklch(75% 0.18 145);
	}

	/* Presets */
	.presets-section {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}

	.presets-title {
		color: var(--content-1);
		font-size: var(--s-1);
		font-weight: 600;
	}

	.presets-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
	}

	.preset-button {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: 9999px;
		color: var(--content);
		cursor: pointer;
		font-size: var(--s-1);
		font-weight: 500;
		padding: var(--s-3) var(--s-1);
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.preset-button:hover {
		border-color: var(--edge-1);
		background: var(--base-2);
	}

	.preset-button.is-active {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-content);
	}

	/* Workspace Grid */
	.workspace-grid {
		display: grid;
		gap: var(--s2);
		grid-template-columns: 1fr;
	}

	@media (min-width: 64rem) {
		.workspace-grid {
			grid-template-columns: 1.1fr 0.9fr;
		}
	}

	.panel {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: var(--s1);
		padding: var(--s1);
	}

	.panel h2 {
		font-size: var(--s1);
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0;
	}

	/* Controls */
	.controls-stack {
		display: flex;
		flex-direction: column;
		gap: var(--s0);
	}

	.control-row {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}

	@media (min-width: 32rem) {
		.control-row {
			align-items: center;
			flex-direction: row;
			justify-content: space-between;
		}
	}

	.control-label-group {
		display: flex;
		flex-direction: column;
		min-width: 11rem;
	}

	.control-label-group label {
		font-weight: 600;
		font-size: var(--s-1);
	}

	.control-hint {
		color: var(--content-1);
		font-size: var(--s-2);
	}

	.control-input-group {
		align-items: center;
		display: flex;
		flex: 1;
		gap: var(--s-2);
		max-width: 24rem;
		width: 100%;
	}

	.control-input-group input[type='range'] {
		accent-color: var(--brand);
		flex: 1;
	}

	.number-box {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		font-family: inherit;
		font-size: var(--s-1);
		font-weight: 600;
		padding: var(--s-4) var(--s-2);
		text-align: right;
		width: 4.5rem;
	}

	.number-box:focus {
		border-color: var(--brand);
		outline: 2px solid color-mix(in oklch, var(--brand) 25%, transparent);
	}

	/* Curve Visualizer */
	.curve-visualizer {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		margin-top: var(--s-1);
		padding: var(--s0);
	}

	.curve-header {
		align-items: center;
		display: flex;
		justify-content: space-between;
	}

	.curve-title {
		font-size: var(--s-1);
		font-weight: 600;
	}

	.curve-legend {
		display: flex;
		gap: var(--s-1);
		font-size: var(--s-2);
	}

	.legend-target {
		color: var(--content-1);
	}

	.legend-peak {
		color: var(--brand);
		font-weight: 600;
	}

	.svg-container {
		border-radius: var(--s-3);
		overflow: hidden;
		position: relative;
		width: 100%;
	}

	.curve-svg {
		display: block;
		height: auto;
		width: 100%;
	}

	.axis-line {
		stroke: var(--edge);
		stroke-width: 1;
	}

	.target-line {
		stroke: var(--content-1);
		stroke-dasharray: 4 4;
		stroke-opacity: 0.45;
		stroke-width: 1.5;
	}

	.axis-label {
		fill: var(--content-1);
		font-size: 10px;
		font-weight: 500;
		text-anchor: end;
	}

	.time-label {
		fill: var(--content-1);
		font-size: 10px;
		font-weight: 500;
	}

	.time-label.mid {
		text-anchor: middle;
	}

	.time-label.end {
		text-anchor: end;
	}

	.spring-path {
		fill: none;
		stroke: var(--brand);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.75;
	}

	.peak-marker-dot {
		fill: var(--brand);
		stroke: var(--base);
		stroke-width: 2;
	}

	.peak-marker-text {
		fill: var(--brand);
		font-size: 11px;
		font-weight: 700;
		text-anchor: middle;
	}

	@keyframes sweep-line {
		from {
			transform: translateX(0px);
		}
		to {
			transform: translateX(var(--sweep-distance));
		}
	}

	.playhead-line {
		animation: sweep-line linear forwards;
		stroke: var(--content);
		stroke-opacity: 0.7;
		stroke-width: 1.5;
	}

	/* Demos Panel */
	.demos-panel {
		gap: var(--s1);
	}

	.demos-header {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		justify-content: space-between;
	}

	.demo-actions {
		display: flex;
		gap: var(--s-3);
	}

	.action-button {
		align-items: center;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		cursor: pointer;
		display: inline-flex;
		font-size: var(--s-1);
		font-weight: 600;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-1);
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.15s ease;
	}

	.action-button:hover {
		background: var(--base);
		border-color: var(--edge-1);
	}

	.action-button.primary {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-content);
	}

	.action-button:active {
		transform: scale(0.97);
	}

	.demos-stack {
		display: flex;
		flex-direction: column;
		gap: var(--s0);
	}

	.testbed-card {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s0);
	}

	.testbed-label {
		display: flex;
		flex-direction: column;
	}

	.testbed-title {
		font-size: var(--s-1);
		font-weight: 600;
	}

	.testbed-subtitle {
		color: var(--content-1);
		font-size: var(--s-2);
	}

	/* Stage 1: Launcher Stage */
	.launcher-stage {
		align-items: center;
		background: var(--base-1);
		border: 1px dashed var(--edge);
		border-radius: var(--radius);
		display: flex;
		height: 4.75rem;
		justify-content: flex-end;
		padding: 0 var(--s1);
		position: relative;
	}

	.launcher-items {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		pointer-events: none;
		position: absolute;
		right: calc(var(--s1) + 2.5rem + var(--s-2));
	}

	.swatch-slot {
		align-items: center;
		display: flex;
		height: 2.25rem;
		justify-content: center;
		opacity: 0;
		transform: translateX(calc(var(--slot-offset) * (2.25rem + var(--s-2))));
		transition:
			transform var(--spring-duration) var(--spring-ease),
			opacity var(--spring-duration) var(--spring-ease);
		width: 2.25rem;
		will-change: transform, opacity;
	}

	.launcher-stage.is-expanded .swatch-slot {
		opacity: 1;
		transform: translateX(0);
	}

	.demo-swatch-ball {
		background: oklch(75% 0.18 var(--swatch-hue));
		border-radius: 50%;
		box-shadow: 0 4px 12px oklch(75% 0.18 var(--swatch-hue) / 0.35);
		height: 2.25rem;
		width: 2.25rem;
	}

	.launcher-trigger {
		align-items: center;
		background: var(--brand);
		border: 0;
		border-radius: 50%;
		box-shadow: 0 4px 14px color-mix(in oklch, var(--brand) 35%, transparent);
		color: var(--brand-content);
		cursor: pointer;
		display: flex;
		height: 2.5rem;
		justify-content: center;
		padding: 0;
		position: relative;
		transition: transform 180ms ease;
		width: 2.5rem;
		z-index: 2;
	}

	.launcher-trigger:hover {
		transform: scale(1.08);
	}

	/* Stage 2: Slider Puck Track */
	.track-stage {
		align-items: center;
		background: var(--base-1);
		border: 1px dashed var(--edge);
		border-radius: var(--radius);
		cursor: pointer;
		display: flex;
		height: 4.25rem;
		padding: 0 var(--s1);
		position: relative;
	}

	.track-line {
		background: var(--edge);
		height: 4px;
		left: var(--s1);
		position: absolute;
		right: var(--s1);
		top: calc(50% - 2px);
	}

	.track-endpoints {
		display: flex;
		justify-content: space-between;
		position: absolute;
		left: var(--s1);
		right: var(--s1);
	}

	.endpoint-marker {
		align-items: center;
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: 50%;
		color: var(--content-1);
		display: flex;
		font-size: 11px;
		font-weight: 700;
		height: 1.5rem;
		justify-content: center;
		width: 1.5rem;
		z-index: 1;
	}

	.track-puck {
		align-items: center;
		background: var(--brand);
		border-radius: var(--s-3);
		box-shadow: 0 4px 14px color-mix(in oklch, var(--brand) 40%, transparent);
		color: var(--brand-content);
		display: flex;
		height: 2.25rem;
		justify-content: center;
		left: var(--s1);
		position: absolute;
		transform: translateX(0);
		transition: transform var(--spring-duration) var(--spring-ease);
		width: 2.25rem;
		will-change: transform;
		z-index: 2;
	}

	.track-puck.at-b {
		transform: translateX(calc(100% * 8.5));
	}

	@media (max-width: 40rem) {
		.track-puck.at-b {
			transform: translateX(calc(100% * 5));
		}
	}

	/* Stage 3: Pop Card */
	.pop-stage {
		align-items: center;
		background: var(--base-1);
		border: 1px dashed var(--edge);
		border-radius: var(--radius);
		display: flex;
		height: 4.75rem;
		justify-content: center;
		padding: 0 var(--s1);
	}

	.pop-card {
		align-items: center;
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: 9999px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		display: flex;
		gap: var(--s-2);
		padding: var(--s-3) var(--s0);
		transform: scale(0.82) translateY(8px);
		opacity: 0.3;
		transition:
			transform var(--spring-duration) var(--spring-ease),
			opacity 200ms ease;
		will-change: transform, opacity;
	}

	.pop-card.is-expanded {
		opacity: 1;
		transform: scale(1) translateY(0);
	}

	.pop-card-icon {
		color: var(--brand);
		display: flex;
		font-size: var(--s1);
	}

	.pop-card-content {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.pop-card-content strong {
		font-size: var(--s-1);
	}

	.pop-card-content span {
		color: var(--content-1);
		font-size: var(--s-2);
	}

	/* Code Inspector */
	.code-inspector {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.code-inspector-header {
		align-items: center;
		background: var(--base-2);
		border-bottom: 1px solid var(--edge);
		display: flex;
		justify-content: space-between;
		padding: var(--s-3) var(--s-1);
	}

	.code-tabs {
		display: flex;
		gap: var(--s-4);
	}

	.code-tab {
		background: transparent;
		border: 0;
		border-radius: var(--s-4);
		color: var(--content-1);
		cursor: pointer;
		font-size: var(--s-1);
		font-weight: 500;
		padding: var(--s-4) var(--s-2);
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.code-tab:hover {
		color: var(--content);
	}

	.code-tab.is-active {
		background: var(--base);
		color: var(--content);
		font-weight: 600;
	}

	.copy-code-btn {
		align-items: center;
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--s-4);
		color: var(--content);
		cursor: pointer;
		display: inline-flex;
		font-size: var(--s-2);
		font-weight: 600;
		gap: var(--s-4);
		padding: var(--s-4) var(--s-2);
		transition: background 0.15s ease;
	}

	.copy-code-btn:hover {
		background: var(--base-1);
	}

	.code-display {
		font-family: 'Fira Mono', ui-monospace, monospace;
		font-size: var(--s-1);
		line-height: 1.5;
		margin: 0;
		max-height: 14rem;
		overflow-x: auto;
		padding: var(--s0);
		white-space: pre-wrap;
		word-break: break-all;
	}

	.code-display code {
		color: var(--content);
	}
</style>
