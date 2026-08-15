<script lang="ts">
	import { onMount } from 'svelte';

	type DiagnosticReport = Record<string, string | number | boolean | null>;

	let safeAreaProbe: HTMLDivElement;
	let report = $state<DiagnosticReport>({});
	let copied = $state(false);
	const reportText = $derived(JSON.stringify(report, null, 2));

	function collectMeasurements() {
		const styles = getComputedStyle(safeAreaProbe);
		const viewport = window.visualViewport;
		const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

		report = {
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
			displayModeFullscreen: matchMedia('(display-mode: fullscreen)').matches,
			displayModeStandalone: matchMedia('(display-mode: standalone)').matches,
			displayModeMinimalUi: matchMedia('(display-mode: minimal-ui)').matches,
			navigatorStandalone: navigatorWithStandalone.standalone ?? null,
			screenWidth: screen.width,
			screenHeight: screen.height,
			screenAvailableWidth: screen.availWidth,
			screenAvailableHeight: screen.availHeight,
			windowInnerWidth: innerWidth,
			windowInnerHeight: innerHeight,
			windowOuterWidth: outerWidth,
			windowOuterHeight: outerHeight,
			devicePixelRatio,
			visualViewportWidth: viewport?.width ?? null,
			visualViewportHeight: viewport?.height ?? null,
			visualViewportOffsetTop: viewport?.offsetTop ?? null,
			visualViewportOffsetLeft: viewport?.offsetLeft ?? null,
			visualViewportPageTop: viewport?.pageTop ?? null,
			visualViewportScale: viewport?.scale ?? null,
			safeAreaInsetTop: styles.paddingTop,
			safeAreaInsetRight: styles.paddingRight,
			safeAreaInsetBottom: styles.paddingBottom,
			safeAreaInsetLeft: styles.paddingLeft,
			orientationType: screen.orientation?.type ?? null,
			orientationAngle: screen.orientation?.angle ?? null,
			viewportFitCoverSupported: CSS.supports('padding-top: env(safe-area-inset-top)')
		};
	}

	async function copyReport() {
		await navigator.clipboard.writeText(reportText);
		copied = true;
		window.setTimeout(() => (copied = false), 1600);
	}

	onMount(() => {
		collectMeasurements();
		window.addEventListener('resize', collectMeasurements);
		window.addEventListener('orientationchange', collectMeasurements);
		window.visualViewport?.addEventListener('resize', collectMeasurements);
		window.visualViewport?.addEventListener('scroll', collectMeasurements);

		return () => {
			window.removeEventListener('resize', collectMeasurements);
			window.removeEventListener('orientationchange', collectMeasurements);
			window.visualViewport?.removeEventListener('resize', collectMeasurements);
			window.visualViewport?.removeEventListener('scroll', collectMeasurements);
		};
	});
</script>

<svelte:head>
	<title>Viewport Test – zaki.gg</title>
	<meta
		name="description"
		content="Android PWA viewport, display mode, and safe-area diagnostics."
	/>
</svelte:head>

<div class="viewport-top-probe" aria-hidden="true">WEB VIEWPORT TOP</div>
<div class="viewport-bottom-probe" aria-hidden="true">WEB VIEWPORT BOTTOM</div>

<div class="safe-area-probe" bind:this={safeAreaProbe} aria-hidden="true"></div>

<section class="diagnostics">
	<div class="panel">
		<p class="eyebrow">Android PWA diagnostics</p>
		<h1>Can the page paint the whole screen?</h1>

		<div class="instructions">
			<p><span class="swatch top"></span> The pink line marks the web viewport’s real top edge.</p>
			<p><span class="swatch bottom"></span> The cyan line marks its real bottom edge.</p>
		</div>

		<div class="verdict">
			<strong>Look at the physical top of the phone.</strong>
			<p>
				If black remains above the pink line, Android has excluded that area and the page cannot
				paint it. If pink reaches the physical top edge, the black area is coming from app CSS.
			</p>
		</div>

		<div class="actions">
			<button type="button" onclick={collectMeasurements}>Refresh measurements</button>
			<button type="button" class="secondary" onclick={copyReport}>
				{copied ? 'Copied' : 'Copy results'}
			</button>
		</div>

		<pre>{reportText}</pre>
	</div>
</section>

<style>
	.safe-area-probe {
		padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
			env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
		pointer-events: none;
		position: fixed;
		visibility: hidden;
	}

	.viewport-top-probe,
	.viewport-bottom-probe {
		align-items: center;
		color: white;
		display: flex;
		font: 700 10px/1 var(--font-mono);
		height: 18px;
		justify-content: center;
		left: 0;
		letter-spacing: 0.12em;
		pointer-events: none;
		position: fixed;
		right: 0;
		z-index: 2147483647;
	}

	.viewport-top-probe {
		background: #ff006e;
		top: 0;
	}

	.viewport-bottom-probe {
		background: #007f8b;
		bottom: 0;
	}

	.diagnostics {
		background: #f6f7fb;
		color: #161824;
		inset: 0;
		overflow: auto;
		padding: calc(2.5rem + env(safe-area-inset-top, 0px))
			max(1rem, env(safe-area-inset-right, 0px))
			calc(2.5rem + env(safe-area-inset-bottom, 0px))
			max(1rem, env(safe-area-inset-left, 0px));
		position: fixed;
		z-index: 2000;
	}

	.panel {
		margin: 0 auto;
		max-width: 48rem;
	}

	.eyebrow {
		color: #6b6f82;
		font: 700 0.75rem/1.2 var(--font-mono);
		letter-spacing: 0.12em;
		margin: 0 0 0.5rem;
		text-transform: uppercase;
	}

	h1 {
		font-size: clamp(1.6rem, 7vw, 2.75rem);
		letter-spacing: -0.04em;
		line-height: 1.05;
		margin: 0 0 1.5rem;
	}

	.instructions,
	.verdict,
	pre {
		background: white;
		border: 1px solid #dfe1ea;
		border-radius: 0.75rem;
		box-shadow: 0 0.5rem 1.5rem rgb(21 25 38 / 0.06);
		margin-bottom: 1rem;
		padding: 1rem;
	}

	.instructions p,
	.verdict p {
		line-height: 1.5;
		margin: 0;
	}

	.instructions p + p {
		margin-top: 0.75rem;
	}

	.swatch {
		border-radius: 999px;
		display: inline-block;
		height: 0.75rem;
		margin-right: 0.45rem;
		vertical-align: -0.05rem;
		width: 0.75rem;
	}

	.swatch.top {
		background: #ff006e;
	}

	.swatch.bottom {
		background: #007f8b;
	}

	.verdict {
		border-left: 0.3rem solid #ff006e;
	}

	.verdict p {
		margin-top: 0.5rem;
	}

	.actions {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 1fr 1fr;
		margin: 1rem 0;
	}

	button {
		background: #161824;
		border: 1px solid #161824;
		border-radius: 0.6rem;
		color: white;
		font: 650 0.9rem/1 var(--font-body);
		min-height: 2.8rem;
		padding: 0.75rem 1rem;
	}

	button.secondary {
		background: white;
		color: #161824;
	}

	pre {
		font: 0.75rem/1.55 var(--font-mono);
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	@media (max-width: 30rem) {
		.actions {
			grid-template-columns: 1fr;
		}
	}
</style>
