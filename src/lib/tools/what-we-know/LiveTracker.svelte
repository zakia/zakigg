<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	let {
		mouseX,
		mouseY,
		scrollY,
		scrollPct,
		viewportW,
		viewportH
	}: {
		mouseX: number | null;
		mouseY: number | null;
		scrollY: number;
		scrollPct: number;
		viewportW: number;
		viewportH: number;
	} = $props();

	let collapsed = $state(false);
</script>

<aside class="tracker" class:collapsed aria-label="Live browser tracking readout">
	<button
		class="toggle"
		onclick={() => (collapsed = !collapsed)}
		aria-expanded={!collapsed}
		aria-label={collapsed ? 'Expand live tracker' : 'Collapse live tracker'}
	>
		<span class="dot" aria-hidden="true"></span>
		<span class="toggle-label">Live</span>
		<Icon icon={collapsed ? 'lucide:chevron-up' : 'lucide:chevron-down'} class="chev" />
	</button>

	{#if !collapsed}
		<div class="body">
			<div class="row">
				<span class="key"><Icon icon="lucide:mouse-pointer-2" class="k-ic" /> Mouse</span>
				<span class="val mono">
					{mouseX !== null && mouseY !== null ? `${mouseX}, ${mouseY}` : 'move mouse…'}
				</span>
			</div>
			<div class="row">
				<span class="key"><Icon icon="lucide:mouse" class="k-ic" /> Scroll Y</span>
				<span class="val mono">{scrollY}px</span>
			</div>
			<div class="row">
				<span class="key"><Icon icon="lucide:percent" class="k-ic" /> Page</span>
				<span class="val mono">{scrollPct.toFixed(0)}%</span>
			</div>
			<div class="bar" aria-hidden="true">
				<div class="fill" style="width: {scrollPct}%"></div>
			</div>
			<div class="row">
				<span class="key"><Icon icon="lucide:monitor" class="k-ic" /> Viewport</span>
				<span class="val mono">{viewportW} × {viewportH}</span>
			</div>
			<p class="hint">Every site can log these 60×/sec while you read. Try resizing the window.</p>
		</div>
	{/if}
</aside>

<style>
	.tracker {
		position: fixed;
		right: clamp(0.75rem, 2vw, 1.25rem);
		bottom: clamp(0.75rem, 2vw, 1.25rem);
		z-index: 40;
		min-width: 14rem;
		max-width: 17rem;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-1);
		border: 1px solid color-mix(in oklch, var(--brand) 35%, var(--edge));
		border-radius: var(--s-1);
		background: color-mix(in oklch, var(--base-1) 92%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow:
			0 8px 24px rgb(0 0 0 / 0.12),
			0 2px 6px rgb(0 0 0 / 0.06);
		font-size: 0.78rem;
		color: var(--content);
		animation: slide-in 0.4s ease-out;
	}

	.tracker.collapsed {
		min-width: 0;
		max-width: none;
		padding: var(--s-3);
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-2);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--content);
		font: inherit;
		border-radius: var(--s-2);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.68rem;
		font-weight: 600;
	}

	.toggle:hover {
		background: color-mix(in oklch, var(--brand) 8%, transparent);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: oklch(62% 0.2 145);
		box-shadow: 0 0 0 0 oklch(62% 0.2 145 / 0.55);
		animation: pulse 1.8s ease-out infinite;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 oklch(62% 0.2 145 / 0.55);
		}
		100% {
			box-shadow: 0 0 0 8px oklch(62% 0.2 145 / 0);
		}
	}

	.toggle-label {
		flex: 1;
	}

	.toggle :global(.chev) {
		width: 0.85rem;
		height: 0.85rem;
		opacity: 0.6;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: 0 var(--s-2) var(--s-2);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		color: var(--content-1);
	}

	.key :global(.k-ic) {
		width: 0.85rem;
		height: 0.85rem;
	}

	.val {
		font-weight: 600;
		color: var(--content);
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		width: 100%;
		height: 3px;
		background: var(--base-2);
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--brand),
			color-mix(in oklch, var(--brand) 60%, var(--content))
		);
		transition: width 0.08s linear;
	}

	.hint {
		margin: var(--s-3) 0 0;
		font-size: 0.66rem;
		line-height: 1.4;
		color: var(--content-1);
		font-style: italic;
	}

	@media (max-width: 480px) {
		.tracker {
			right: 0.5rem;
			left: 0.5rem;
			bottom: 0.5rem;
			max-width: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tracker,
		.dot {
			animation: none;
		}
		.fill {
			transition: none;
		}
	}
</style>
