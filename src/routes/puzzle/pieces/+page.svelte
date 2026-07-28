<script lang="ts">
	import {
		QN,
		QE,
		QS,
		QW,
		bounds,
		orient,
		outlinePath,
		pointedTipCorners,
		type Cell
	} from '$lib/puzzle/geometry';
	import { assemblyReport } from '$lib/puzzle/engine';
	import { BOARD_CELLS, BOARD_H, BOARD_W, PIECES } from '$lib/puzzle/pieces';

	const U = 44; // px per cell in piece views
	const AU = 34; // px per cell in the assembly view
	const MARGIN = 1; // editable ring of empty cells around each shape

	// ---- quarter-triangle helpers ------------------------------------------
	/** SVG polygon points for one quarter triangle of cell (x,y), y-up, in px. */
	function quarterPoints(x: number, y: number, bit: number, unit: number, H: number): string {
		const sx = (v: number) => v * unit;
		const sy = (v: number) => (H - v) * unit;
		const c = [sx(x + 0.5), sy(y + 0.5)];
		const bl = [sx(x), sy(y)];
		const br = [sx(x + 1), sy(y)];
		const tr = [sx(x + 1), sy(y + 1)];
		const tl = [sx(x), sy(y + 1)];
		const tri =
			bit === QN ? [tl, tr, c] : bit === QE ? [tr, br, c] : bit === QS ? [br, bl, c] : [bl, tl, c];
		return tri.map((p) => p.join(',')).join(' ');
	}

	const QUARTERS = [
		{ bit: QN, name: 'N (1)' },
		{ bit: QE, name: 'E (2)' },
		{ bit: QS, name: 'S (4)' },
		{ bit: QW, name: 'W (8)' }
	];

	const LEGEND_MASKS = [
		{ m: 15, label: '# / 15 — full cell' },
		{ m: 3, label: '3 — upper-right half' },
		{ m: 6, label: '6 — lower-right half' },
		{ m: 12, label: 'c / 12 — lower-left half' },
		{ m: 9, label: '9 — upper-left half' },
		{ m: 1, label: '1 — top spike' },
		{ m: 2, label: '2 — right spike' },
		{ m: 4, label: '4 — bottom spike' },
		{ m: 8, label: '8 — left spike' },
		{ m: 14, label: 'e / 14 — all but N' },
		{ m: 13, label: 'd / 13 — all but E' },
		{ m: 11, label: 'b / 11 — all but S' },
		{ m: 7, label: '7 — all but W' }
	];

	// ---- editable piece state ----------------------------------------------
	interface EditablePiece {
		id: string;
		cells: Cell[];
		home: { x: number; y: number; rot: number; flip: boolean };
	}

	function cloneFromFile(): EditablePiece[] {
		return PIECES.map((d) => ({
			id: d.id,
			cells: d.cells.map((c) => [...c] as Cell),
			home: { ...d.home }
		}));
	}

	let pieces = $state<EditablePiece[]>(cloneFromFile());

	function maskAt(p: EditablePiece, x: number, y: number): number {
		const hit = p.cells.find(([cx, cy]) => cx === x && cy === y);
		return hit ? hit[2] : 0;
	}

	function toggleQuarter(p: EditablePiece, x: number, y: number, bit: number) {
		const i = p.cells.findIndex(([cx, cy]) => cx === x && cy === y);
		if (i >= 0) {
			const next = p.cells[i][2] ^ bit;
			if (next === 0) p.cells.splice(i, 1);
			else p.cells[i][2] = next;
		} else {
			p.cells.push([x, y, bit]);
		}
	}

	function resetPiece(p: EditablePiece) {
		const orig = PIECES.find((d) => d.id === p.id)!;
		p.cells = orig.cells.map((c) => [...c] as Cell);
		p.home = { ...orig.home };
	}

	/** Editable canvas range: the shape's bounds plus an empty ring. */
	function canvasRange(cells: Cell[]) {
		const xs = cells.map(([x]) => x);
		const ys = cells.map(([, y]) => y);
		const minX = (cells.length ? Math.min(...xs) : 0) - MARGIN;
		const minY = (cells.length ? Math.min(...ys) : 0) - MARGIN;
		const maxX = (cells.length ? Math.max(...xs) : 0) + MARGIN;
		const maxY = (cells.length ? Math.max(...ys) : 0) + MARGIN;
		return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 };
	}

	/** Emit the shape as top-down ASCII art (normalized). */
	function cellsToArt(cells: Cell[]): string {
		if (cells.length === 0) return '(empty)';
		const minX = Math.min(...cells.map(([x]) => x));
		const minY = Math.min(...cells.map(([, y]) => y));
		const norm = cells.map(([x, y, m]): Cell => [x - minX, y - minY, m]);
		const { w, h } = bounds(norm);
		const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
		for (const [x, y, m] of norm) grid[h - 1 - y][x] = m === 15 ? '#' : m.toString(16);
		return grid.map((r) => r.join('')).join('\n');
	}

	async function copyArt(p: EditablePiece) {
		const art = cellsToArt(p.cells);
		const snippet = 'cells: shapeCells(`\n' + art.replace(/^/gm, '\t\t\t') + '\n\t\t`),';
		try {
			await navigator.clipboard.writeText(snippet);
			copied = p.id;
			setTimeout(() => (copied = null), 1500);
		} catch {
			// clipboard unavailable; the art is visible to copy manually
		}
	}

	let copied = $state<string | null>(null);

	// ---- live assembly check ----------------------------------------------
	const placed = $derived(
		pieces.map((p) => {
			// normalize like the game does, so home poses mean the same thing
			const oriented = orient(p.cells, p.home.rot, p.home.flip);
			const { h } = bounds(oriented);
			const abs = oriented.map(([x, y, m]): Cell => [x + p.home.x, y + p.home.y, m]);
			const xs = abs.map(([x]) => x + 0.5);
			const ys = abs.map(([, y]) => y + 0.5);
			return {
				id: p.id,
				cells: abs,
				path: outlinePath(oriented, AU, 3, h, pointedTipCorners(oriented)),
				x: p.home.x,
				y: p.home.y,
				h,
				cx: xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) * AU : 0,
				cy: ys.length ? (BOARD_H - ys.reduce((a, b) => a + b, 0) / ys.length) * AU : 0
			};
		})
	);

	const report = $derived(
		assemblyReport(
			placed.map((p) => p.cells),
			BOARD_CELLS
		)
	);

	const boardPath = outlinePath(BOARD_CELLS, AU, 3, BOARD_H);

	function pieceArea(cells: Cell[]): number {
		let quarters = 0;
		for (const [, , m] of cells) {
			for (const q of QUARTERS) if (m & q.bit) quarters++;
		}
		return quarters / 4;
	}
</script>

<svelte:head>
	<title>Piece editor · Number Snug</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="layout editor-layout">
	<header>
		<h1>Number Snug — piece editor</h1>
		<p class="subtitle">
			<strong>Click any triangle to toggle it.</strong> The outline, the art text, and the assembly
			check below update live. When a shape looks right, hit <em>copy</em> and paste the snippet
			over that piece's <code>cells:</code> block in <code>src/lib/puzzle/pieces.ts</code>. Edits
			here are local until you do — reloading the page resets to the file.
		</p>
	</header>

	<section class="card">
		<h2>Assembly check — pieces at their <code>home</code> poses</h2>
		<p>
			<span class="chip overlap">red</span> = two pieces claim the same quarter ·
			<span class="chip gap">blue</span> = target quarter no piece covers ·
			<span class="chip stray">purple</span> = piece quarter outside the target.
			{#if report.overlaps.length === 0 && report.gaps.length === 0 && report.strays.length === 0}
				<strong>All clean — the set tiles the board exactly. ✓</strong>
			{:else}
				<strong>
					{report.overlaps.length} overlap / {report.gaps.length} gap / {report.strays.length} stray cells
					to fix.
				</strong>
			{/if}
		</p>
		<svg
			viewBox="-8 -8 {BOARD_W * AU + 16} {BOARD_H * AU + 16}"
			class="assembly"
			style="max-width: {BOARD_W * AU + 16}px"
		>
			<path d={boardPath} class="board" fill-rule="evenodd" />
			{#each placed as p (p.id)}
				<g transform="translate({p.x * AU}, {(BOARD_H - p.y - p.h) * AU})">
					<path d={p.path} class="apiece" fill-rule="evenodd" />
				</g>
				<text x={p.cx} y={p.cy} class="alabel">{p.id}</text>
			{/each}
			{#each report.overlaps as [x, y, m] (`o${x},${y}`)}
				{#each QUARTERS.filter((q) => m & q.bit) as q (q.bit)}
					<polygon points={quarterPoints(x, y, q.bit, AU, BOARD_H)} class="err overlap" />
				{/each}
			{/each}
			{#each report.gaps as [x, y, m] (`g${x},${y}`)}
				{#each QUARTERS.filter((q) => m & q.bit) as q (q.bit)}
					<polygon points={quarterPoints(x, y, q.bit, AU, BOARD_H)} class="err gap" />
				{/each}
			{/each}
			{#each report.strays as [x, y, m] (`s${x},${y}`)}
				{#each QUARTERS.filter((q) => m & q.bit) as q (q.bit)}
					<polygon points={quarterPoints(x, y, q.bit, AU, BOARD_H)} class="err stray" />
				{/each}
			{/each}
		</svg>
	</section>

	{#each pieces as p (p.id)}
		{@const range = canvasRange(p.cells)}
		{@const oriented0 = p.cells.map(([x, y, m]): Cell => [x - range.minX, y - range.minY, m])}
		{@const path = outlinePath(oriented0, U, 4, range.h, pointedTipCorners(oriented0))}
		<section class="card piece-card">
			<div class="piece-head">
				<h2>Digit {p.id}</h2>
				<div class="piece-actions">
					<button class="btn variant-base small" onclick={() => copyArt(p)}>
						{copied === p.id ? 'copied ✓' : 'copy cells snippet'}
					</button>
					<button class="btn variant-base small" onclick={() => resetPiece(p)}>reset</button>
				</div>
			</div>
			<div class="piece-row">
				<svg
					viewBox="-2 -2 {range.w * U + 4} {range.h * U + 4}"
					style="max-width: {range.w * U + 4}px"
					class="editcanvas"
				>
					{#each Array.from({ length: range.w }, (_, i) => i) as gx (gx)}
						{#each Array.from({ length: range.h }, (_, j) => j) as gy (gy)}
							{@const cx = range.minX + gx}
							{@const cy = range.minY + gy}
							{@const m = maskAt(p, cx, cy)}
							<rect x={gx * U} y={(range.h - gy - 1) * U} width={U} height={U} class="cellframe" />
							{#each QUARTERS as q (q.bit)}
								<polygon
									points={quarterPoints(gx, gy, q.bit, U, range.h)}
									class="quarter"
									class:on={(m & q.bit) !== 0}
									role="button"
									tabindex="-1"
									aria-label="toggle {q.name} of cell {cx},{cy}"
									onclick={() => toggleQuarter(p, cx, cy, q.bit)}
									onkeydown={(e) => e.key === 'Enter' && toggleQuarter(p, cx, cy, q.bit)}
								/>
							{/each}
							{#if m > 0}
								<text x={gx * U + U / 2} y={(range.h - gy) * U - U / 2 + 5} class="mask">
									{m}
								</text>
							{/if}
						{/each}
					{/each}
					<g style="pointer-events: none">
						<path d={path} class="outline" fill-rule="evenodd" />
					</g>
				</svg>
				<dl class="meta">
					<dt>art (top-down)</dt>
					<dd><pre>{cellsToArt(p.cells)}</pre></dd>
					<dt>home</dt>
					<dd>
						<label>x <input type="number" bind:value={p.home.x} /></label>
						<label>y <input type="number" bind:value={p.home.y} /></label>
						<label>
							rot
							<input type="number" min="0" max="3" bind:value={p.home.rot} />
						</label>
						<label>flip <input type="checkbox" bind:checked={p.home.flip} /></label>
					</dd>
					<dt>area</dt>
					<dd>{pieceArea(p.cells)} cells</dd>
				</dl>
			</div>
		</section>
	{/each}

	<section class="card legend">
		<h2>Mask cheat sheet</h2>
		<div class="legend-grid">
			{#each LEGEND_MASKS as lm (lm.m)}
				<figure>
					<svg viewBox="-2 -2 48 48" width="48" height="48">
						<rect x="0" y="0" width="44" height="44" class="cellframe" />
						{#each QUARTERS as q (q.bit)}
							<polygon
								points={quarterPoints(0, 0, q.bit, 44, 1)}
								class="quarter"
								class:on={(lm.m & q.bit) !== 0}
							/>
						{/each}
					</svg>
					<figcaption>{lm.label}</figcaption>
				</figure>
			{/each}
		</div>
	</section>
</div>

<style>
	.editor-layout {
		max-width: 52rem;
		gap: 1rem;
	}

	h1 {
		font-size: 1.6rem;
		font-weight: 800;
	}

	h2 {
		font-size: 1.05rem;
		font-weight: 700;
		margin-bottom: 0.35rem;
	}

	.subtitle {
		opacity: 0.75;
		max-width: 44rem;
	}

	.card {
		padding: 1rem;
		background: color-mix(in oklch, var(--content) 4%, transparent);
	}

	.legend-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin-top: 0.6rem;
	}

	.legend-grid figure {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		width: 8.5rem;
	}

	.legend-grid figcaption {
		font-size: 0.72rem;
		opacity: 0.7;
		text-align: center;
	}

	.cellframe {
		fill: none;
		stroke: color-mix(in oklch, var(--content) 30%, transparent);
		stroke-width: 1;
		stroke-dasharray: 3 2;
		pointer-events: none;
	}

	.quarter {
		fill: transparent;
		stroke: color-mix(in oklch, var(--content) 12%, transparent);
		stroke-width: 0.5;
		cursor: pointer;
		outline: none;
	}

	.editcanvas .quarter:hover {
		fill: color-mix(in oklch, var(--brand) 30%, transparent);
	}

	.quarter.on {
		fill: #f7941d99;
		stroke: #c96f0e88;
	}

	.editcanvas .quarter.on:hover {
		fill: #f7941dcc;
	}

	.outline {
		fill: none;
		stroke: #c96f0e;
		stroke-width: 2.5;
	}

	.mask {
		font-size: 13px;
		font-weight: 800;
		text-anchor: middle;
		fill: var(--content);
		paint-order: stroke;
		stroke: var(--base);
		stroke-width: 3px;
		pointer-events: none;
	}

	.piece-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.piece-actions {
		display: flex;
		gap: 0.4rem;
	}

	.btn.small {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
	}

	.piece-row {
		display: flex;
		gap: 1.2rem;
		flex-wrap: wrap;
		align-items: flex-start;
		margin-top: 0.5rem;
	}

	.meta {
		font-size: 0.8rem;
		max-width: 24rem;
	}

	.meta dt {
		font-weight: 700;
		margin-top: 0.4rem;
		opacity: 0.6;
	}

	.meta pre {
		font-size: 0.8rem;
		line-height: 1.15;
		letter-spacing: 0.35em;
		background: color-mix(in oklch, var(--content) 6%, transparent);
		padding: 0.4rem 0.6rem;
		border-radius: 6px;
		display: inline-block;
	}

	.meta label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-right: 0.6rem;
	}

	.meta input[type='number'] {
		width: 3.2rem;
		padding: 0.1rem 0.25rem;
		border: 1px solid color-mix(in oklch, var(--content) 25%, transparent);
		border-radius: 4px;
		background: var(--base);
		color: var(--content);
	}

	.assembly {
		width: 100%;
		height: auto;
	}

	.board {
		fill: color-mix(in oklch, #f7941d 8%, transparent);
		stroke: color-mix(in oklch, #f7941d 50%, transparent);
		stroke-width: 1.5;
		stroke-dasharray: 5 4;
	}

	.apiece {
		fill: #f7941d55;
		stroke: #c96f0e;
		stroke-width: 1.5;
	}

	.alabel {
		font-size: 15px;
		font-weight: 800;
		text-anchor: middle;
		fill: var(--content);
		paint-order: stroke;
		stroke: var(--base);
		stroke-width: 3px;
	}

	.err {
		stroke-width: 0.5;
		pointer-events: none;
	}

	.err.overlap {
		fill: #dc2626cc;
		stroke: #991b1b;
	}

	.err.gap {
		fill: #2563ebaa;
		stroke: #1e40af;
	}

	.err.stray {
		fill: #9333eaaa;
		stroke: #6b21a8;
	}

	.chip {
		font-weight: 700;
		padding: 0 0.35rem;
		border-radius: 4px;
	}

	.chip.overlap {
		background: #dc262633;
		color: #dc2626;
	}

	.chip.gap {
		background: #2563eb33;
		color: #2563eb;
	}

	.chip.stray {
		background: #9333ea33;
		color: #9333ea;
	}
</style>
