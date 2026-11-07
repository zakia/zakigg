<script lang="ts">
	export type BezierPoints = [number, number, number, number];

	let {
		label,
		samples = [0, 1],
		points,
		duration,
		easing,
		playback,
		onchange,
		oncommit
	}: {
		label: string;
		samples?: number[];
		points?: BezierPoints;
		duration: number;
		easing: string;
		playback: number;
		onchange?: (points: BezierPoints) => void;
		oncommit?: () => void;
	} = $props();

	let svg: SVGSVGElement;
	let drag = $state<{ index: number; pointer: number; min: number; max: number } | null>(null);
	const left = 32;
	const top = 24;
	const width = 212;
	const height = 204;
	const bounds = $derived.by(() => {
		const values = points ? [0, 1, points[1], points[3]] : samples;
		return { min: Math.min(-0.15, ...values) - 0.05, max: Math.max(1.15, ...values) + 0.05 };
	});
	const min = $derived(drag?.min ?? bounds.min);
	const max = $derived(drag?.max ?? bounds.max);
	const x = (value: number) => left + value * width;
	const y = (value: number) => top + ((max - value) / (max - min)) * height;
	const path = $derived(
		points
			? `M ${x(0)},${y(0)} C ${x(points[0])},${y(points[1])} ${x(points[2])},${y(points[3])} ${x(1)},${y(1)}`
			: samples
					.map(
						(value, index) => `${index ? 'L' : 'M'} ${x(index / (samples.length - 1))},${y(value)}`
					)
					.join(' ')
	);
	const id = $props.id();
	const clipId = `${id}-reveal`;
	const instructionsId = `${id}-instructions`;

	function update(index: number, nextX: number, nextY: number) {
		if (!points || !onchange) return;
		const next: BezierPoints = [...points];
		next[index * 2] = Math.round(Math.max(0, Math.min(1, nextX)) * 100) / 100;
		next[index * 2 + 1] = Math.round(Math.max(-1, Math.min(2, nextY)) * 100) / 100;
		onchange(next);
	}

	function startDrag(event: PointerEvent & { currentTarget: SVGGElement }, index: number) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.focus();
		drag = { index, pointer: event.pointerId, min, max };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function move(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointer) return;
		const rect = svg.getBoundingClientRect();
		const svgX = ((event.clientX - rect.left) / rect.width) * 272;
		const svgY = ((event.clientY - rect.top) / rect.height) * 260;
		update(drag.index, (svgX - left) / width, max - ((svgY - top) / height) * (max - min));
	}

	function stopDrag(event: PointerEvent) {
		if (event.pointerId !== drag?.pointer) return;
		drag = null;
		if (event.type !== 'pointercancel') oncommit?.();
	}

	function adjust(event: KeyboardEvent, index: number) {
		if (!points) return;
		const step = event.shiftKey ? 0.1 : 0.01;
		let nextX = points[index * 2];
		let nextY = points[index * 2 + 1];
		switch (event.key) {
			case 'ArrowLeft':
				nextX -= step;
				break;
			case 'ArrowRight':
				nextX += step;
				break;
			case 'ArrowUp':
				nextY += step;
				break;
			case 'ArrowDown':
				nextY -= step;
				break;
			case 'Home':
				nextX = 0;
				break;
			case 'End':
				nextX = 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		update(index, nextX, nextY);
		oncommit?.();
	}
</script>

<figure
	class="curve"
	style={`--duration: ${duration}ms; --easing: ${easing}; --distance: ${width}px; --rise: ${y(1) - y(0)}px;`}
>
	<svg
		bind:this={svg}
		viewBox="0 0 272 260"
		role="group"
		aria-label={`${label} easing curve`}
		onpointermove={move}
		onpointerup={stopDrag}
		onpointercancel={stopDrag}
	>
		<text x={left} y="12" class="axis-title">Progress</text>
		<rect x={left} y={y(1)} {width} height={y(0) - y(1)} class="quadrant" />
		{#each [0, 0.25, 0.5, 0.75, 1] as tick}
			<line x1={x(tick)} x2={x(tick)} y1={y(1)} y2={y(0)} class="grid-line" />
			<line x1={x(0)} x2={x(1)} y1={y(tick)} y2={y(tick)} class="grid-line" />
		{/each}
		<path d={`M ${x(0)},${y(0)} L ${x(1)},${y(1)}`} class="diagonal" />
		<text x={left - 8} y={y(1) + 3} class="tick-label">1</text>
		<text x={left - 8} y={y(0) + 3} class="tick-label">0</text>
		<text x={left} y="248" class="time-label">0</text>
		<text x={left + width / 2} y="248" class="time-label center">Time →</text>
		<text x={left + width} y="248" class="time-label end">{duration}ms</text>
		{#if points}
			<path
				d={`M ${x(0)},${y(0)} L ${x(points[0])},${y(points[1])} M ${x(1)},${y(1)} L ${x(points[2])},${y(points[3])}`}
				class="handle-lines"
			/>
		{/if}
		<path d={path} class="curve-path" />
		{#if playback > 0}
			{#key playback}
				<defs
					><clipPath id={clipId}
						><rect x={left} y="0" {width} height="260" class="trace-window" /></clipPath
					></defs
				>
				<path d={path} class="curve-path played-path" clip-path={`url(#${clipId})`} />
				<g class="time-marker" aria-hidden="true">
					<line x1={left} x2={left} y1={top} y2={top + height} class="playhead" />
					<g class="value-marker"><circle cx={left} cy={y(0)} r="5" class="playhead-dot" /></g>
				</g>
			{/key}
		{/if}
		{#each [0, 1] as endpoint}
			<circle cx={x(endpoint)} cy={y(endpoint)} r="3" class="endpoint" />
		{/each}
		{#if points && onchange}
			{#each [0, 1] as index}
				<g
					class="handle"
					class:dragging={drag?.index === index}
					role="slider"
					tabindex="0"
					aria-label={`Bézier control point ${index + 1}`}
					aria-valuemin="0"
					aria-valuemax="1"
					aria-valuenow={points[index * 2]}
					aria-valuetext={`x ${points[index * 2]}, y ${points[index * 2 + 1]}`}
					aria-describedby={instructionsId}
					onpointerdown={(event) => startDrag(event, index)}
					onkeydown={(event) => adjust(event, index)}
					onlostpointercapture={() => (drag = null)}
				>
					<circle
						cx={x(points[index * 2])}
						cy={y(points[index * 2 + 1])}
						r="16"
						class="handle-hit"
					/>
					<circle
						cx={x(points[index * 2])}
						cy={y(points[index * 2 + 1])}
						r="6"
						class="handle-dot"
					/>
				</g>
			{/each}
		{/if}
	</svg>
	<figcaption id={instructionsId}>
		{points ? 'Drag points · arrow keys to fine-tune' : 'Physics determines the curve & duration'}
	</figcaption>
</figure>

<style>
	.curve {
		margin: 0;
		min-width: 0;
		width: 100%;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.quadrant {
		fill: var(--base);
	}
	.grid-line {
		stroke: var(--edge);
		stroke-width: 1;
	}
	.diagonal {
		fill: none;
		stroke: var(--content-1);
		stroke-opacity: 0.25;
		stroke-dasharray: 3 4;
	}
	.axis-title,
	.tick-label,
	.time-label {
		fill: var(--content-1);
		font-size: 9px;
		font-family: var(--font-body);
	}
	.tick-label {
		text-anchor: end;
	}
	.time-label.center {
		text-anchor: middle;
	}
	.time-label.end {
		text-anchor: end;
	}
	.curve-path {
		fill: none;
		stroke: var(--motion-color);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.85;
	}
	.played-path {
		opacity: 1;
	}
	.handle-lines {
		fill: none;
		stroke: var(--motion-color);
		stroke-width: 1.25;
		stroke-opacity: 0.55;
	}
	.endpoint {
		fill: var(--motion-color);
	}
	.handle {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.handle.dragging {
		cursor: grabbing;
	}
	.handle-hit {
		fill: transparent;
	}
	.handle-dot {
		fill: var(--base-1);
		stroke: var(--motion-color);
		stroke-width: 2.5;
	}
	.handle:hover .handle-dot,
	.handle:focus-visible .handle-dot,
	.handle.dragging .handle-dot {
		fill: var(--motion-color);
		stroke: var(--base-1);
		stroke-width: 2;
		filter: drop-shadow(0 0 2px var(--motion-color));
	}
	.playhead {
		stroke: var(--motion-color);
		stroke-width: 1;
		stroke-opacity: 0.25;
		stroke-dasharray: 3 3;
	}
	.playhead-dot {
		fill: var(--motion-color);
		stroke: var(--base-1);
		stroke-width: 2;
	}
	.time-marker {
		transform: translateX(var(--distance));
		animation: progress-x var(--duration) linear both;
	}
	.value-marker {
		transform: translateY(var(--rise));
		animation: progress-y var(--duration) var(--easing) both;
	}
	.trace-window {
		transform-origin: 32px 0;
		animation: reveal var(--duration) linear both;
	}
	figcaption {
		color: var(--content-1);
		font-size: 0.62rem;
		text-align: center;
		line-height: 1.4;
		margin-top: 0.4rem;
	}
	@keyframes progress-x {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(var(--distance));
		}
	}
	@keyframes progress-y {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(var(--rise));
		}
	}
	@keyframes reveal {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.time-marker,
		.value-marker,
		.trace-window {
			animation: none;
		}
	}
</style>
