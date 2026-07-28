<script lang="ts">
	import { onMount } from 'svelte';
	import {
		buildBoardTarget,
		collidesWithAny,
		findFreeSpot,
		isSolved,
		occupancyAt,
		orientedBounds,
		pieceShape,
		samePose,
		scatterPoses,
		type PlacedPiece
	} from './engine';
	import { outlinePath, orientCached, bounds, pointedTipCorners, type Cell } from './geometry';
	import { BOARD_CELLS, BOARD_H, BOARD_W, PIECES } from './pieces';

	// ---- layout ------------------------------------------------------------
	const U = 40; // svg units per cell
	const CW = 19; // canvas width in cells
	const CH = 19; // canvas height in cells
	const BX = 4; // board origin (bottom-left corner) in canvas cells
	const BY = 9;
	const CORNER_R = 4;

	interface PieceState extends PlacedPiece {
		z: number;
		fx?: number; // float position while dragging
		fy?: number;
		shake?: boolean;
	}

	let pieces = $state<PieceState[]>([]);
	let selectedId = $state<string | null>(null);
	let draggingId = $state<string | null>(null);
	let mounted = $state(false);
	let won = $state(false);
	let startedAt = $state<number | null>(null);
	let finishedIn = $state<number | null>(null);
	let moves = $state(0);
	let nowTick = $state(0);
	let hintPiece = $state<string | null>(null);

	let svgEl: SVGSVGElement;
	let confettiCanvas = $state<HTMLCanvasElement | null>(null);

	const STORAGE_KEY = 'number-snug-v2';

	const target = buildBoardTarget(BOARD_CELLS, BX, BY);
	const boardPath = outlinePath(
		BOARD_CELLS.map(([x, y, m]): Cell => [x + BX, y + BY, m]),
		U,
		CORNER_R,
		CH
	);

	// ---- interactions ------------------------------------------------------
	function touch() {
		if (!startedAt) startedAt = Date.now();
	}

	interface DragInfo {
		id: string;
		pointerId: number;
		grabDX: number;
		grabDY: number;
		startX: number;
		startY: number;
		startRot: number;
		startFlip: boolean;
		movedFar: boolean;
	}
	let drag: DragInfo | null = null;
	let lastTapAt = 0;
	let lastTapId: string | null = null;

	function svgPoint(e: PointerEvent): { gx: number; gy: number } {
		const ctm = svgEl.getScreenCTM();
		if (!ctm) return { gx: 0, gy: 0 };
		const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		return { gx: pt.x / U, gy: CH - pt.y / U };
	}

	function topZ(): number {
		return pieces.reduce((z, p) => Math.max(z, p.z), 0) + 1;
	}

	function onPointerDown(e: PointerEvent, p: PieceState) {
		e.preventDefault();
		const el = e.currentTarget as SVGGElement;
		el.focus(); // preventDefault suppresses native focus; keep keyboard shortcuts working
		try {
			el.setPointerCapture(e.pointerId);
		} catch {
			// synthetic events may carry an unknown pointerId
		}
		selectedId = p.def.id;
		p.z = topZ();
		const { gx, gy } = svgPoint(e);
		drag = {
			id: p.def.id,
			pointerId: e.pointerId,
			grabDX: gx - p.x,
			grabDY: gy - p.y,
			startX: p.x,
			startY: p.y,
			startRot: p.rot,
			startFlip: p.flip,
			movedFar: false
		};
		draggingId = p.def.id;
		p.fx = p.x;
		p.fy = p.y;
	}

	function onPointerMove(e: PointerEvent, p: PieceState) {
		if (!drag || drag.id !== p.def.id || e.pointerId !== drag.pointerId) return;
		if (e.pointerType === 'mouse' && e.buttons === 0) {
			// the pointerup was lost (e.g. mid-drag re-render) — settle the piece
			// instead of letting it chase the cursor on hover
			onPointerUp(e, p);
			return;
		}
		const { gx, gy } = svgPoint(e);
		const fx = gx - drag.grabDX;
		const fy = gy - drag.grabDY;
		if (Math.abs(fx - drag.startX) + Math.abs(fy - drag.startY) > 0.35) drag.movedFar = true;
		p.fx = fx;
		p.fy = fy;
	}

	function onPointerUp(e: PointerEvent, p: PieceState) {
		if (!drag || drag.id !== p.def.id) return;
		const wasTap = !drag.movedFar;
		const { w, h } = pieceShape(p.def, p.rot, p.flip, U, CORNER_R);
		const tx = Math.min(Math.max(Math.round(p.fx ?? p.x), 0), CW - w);
		const ty = Math.min(Math.max(Math.round(p.fy ?? p.y), 0), CH - h);
		const spot = findFreeSpot(pieces, p.def, p.rot, p.flip, tx, ty, CW, CH);
		if (spot && (spot.x !== drag.startX || spot.y !== drag.startY)) {
			p.x = spot.x;
			p.y = spot.y;
			moves++;
			touch();
		} else if (!spot) {
			// no room where it was dropped — put it back exactly as it was
			// picked up (a mid-drag rotation may have changed its footprint)
			p.x = drag.startX;
			p.y = drag.startY;
			p.rot = drag.startRot;
			p.flip = drag.startFlip;
		}
		p.fx = undefined;
		p.fy = undefined;
		draggingId = null;
		drag = null;

		const now = Date.now();
		if (wasTap) {
			if (lastTapId === p.def.id && now - lastTapAt < 350) {
				rotateSelected();
				lastTapAt = 0;
			} else {
				lastTapAt = now;
				lastTapId = p.def.id;
			}
		}
		save();
		checkWin();
	}

	function transformSelected(fn: (p: PieceState) => { rot: number; flip: boolean }) {
		const p = pieces.find((q) => q.def.id === selectedId);
		if (!p) return;
		const next = fn(p);
		const before = orientedBounds(p.def, p.rot, p.flip);
		const after = orientedBounds(p.def, next.rot, next.flip);
		if (drag && drag.id === p.def.id) {
			// rotating mid-drag: spin the floating piece around the cursor and
			// defer snapping/collision until it is dropped
			const dx = before.w / 2 - after.w / 2;
			const dy = before.h / 2 - after.h / 2;
			p.rot = next.rot;
			p.flip = next.flip;
			p.fx = (p.fx ?? p.x) + dx;
			p.fy = (p.fy ?? p.y) + dy;
			drag.grabDX -= dx;
			drag.grabDY -= dy;
			return;
		}
		const nx = Math.round(p.x + before.w / 2 - after.w / 2);
		const ny = Math.round(p.y + before.h / 2 - after.h / 2);
		const spot = findFreeSpot(pieces, p.def, next.rot, next.flip, nx, ny, CW, CH);
		if (spot) {
			p.rot = next.rot;
			p.flip = next.flip;
			p.x = spot.x;
			p.y = spot.y;
			p.z = topZ();
			moves++;
			touch();
			save();
			checkWin();
		} else {
			p.shake = true;
			setTimeout(() => (p.shake = false), 300);
		}
	}

	function rotateSelected() {
		transformSelected((p) => ({ rot: (p.rot + 1) % 4, flip: p.flip }));
	}
	function flipSelected() {
		transformSelected((p) => ({ rot: p.rot, flip: !p.flip }));
	}

	function moveSelected(dx: number, dy: number) {
		const p = pieces.find((q) => q.def.id === selectedId);
		if (!p) return;
		const { w, h } = orientedBounds(p.def, p.rot, p.flip);
		const nx = Math.min(Math.max(p.x + dx, 0), CW - w);
		const ny = Math.min(Math.max(p.y + dy, 0), CH - h);
		if (!collidesWithAny(occupancyAt(p.def, p.rot, p.flip, nx, ny), pieces, p.def.id)) {
			p.x = nx;
			p.y = ny;
			moves++;
			touch();
			save();
			checkWin();
		}
	}

	/**
	 * Keyboard shortcuts act on the selected piece and are handled at the
	 * window level: selecting a piece re-stacks it in the DOM, which can drop
	 * element focus mid-interaction and eat the first keypress.
	 */
	function onGlobalKey(e: KeyboardEvent) {
		if (!selectedId) return;
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
		const k = e.key.toLowerCase();
		if (k === 'arrowleft') moveSelected(-1, 0);
		else if (k === 'arrowright') moveSelected(1, 0);
		else if (k === 'arrowup') moveSelected(0, 1);
		else if (k === 'arrowdown') moveSelected(0, -1);
		else if (k === 'r') rotateSelected();
		else if (k === 'f') flipSelected();
		else if (k === 'escape') selectedId = null;
		else return;
		e.preventDefault();
	}

	// ---- game state --------------------------------------------------------
	/** Recompute the solved state after every settle; never locks the pieces. */
	function checkWin() {
		const solved = isSolved(pieces, target);
		if (solved && !won) {
			won = true;
			if (finishedIn === null) finishedIn = startedAt ? Date.now() - startedAt : null;
			save();
			if (!revealed) fireConfetti();
		} else if (!solved && won) {
			won = false; // the player broke the solution apart again
			revealed = false; // …so solving it again counts as their own win
			save();
		}
	}

	function scatter() {
		const zones = [
			{ x: 0, y: 0, w: CW, h: BY - 1 }, // tray band below the board
			{ x: 0, y: BY, w: BX, h: BOARD_H }, // left column
			{ x: BX + BOARD_W, y: BY, w: CW - BX - BOARD_W, h: BOARD_H } // right column
		];
		pieces = scatterPoses(PIECES, zones, CW, CH).map((p, i) => ({ ...p, z: i + 1 }));
	}

	function reset() {
		won = false;
		revealed = false;
		finishedIn = null;
		startedAt = null;
		moves = 0;
		selectedId = null;
		hintPiece = null;
		scatter();
		save();
	}

	function save() {
		if (!mounted) return;
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					pieces: pieces.map((p) => ({
						id: p.def.id,
						rot: p.rot,
						flip: p.flip,
						x: p.x,
						y: p.y,
						z: p.z
					})),
					moves,
					startedAt,
					finishedIn,
					won,
					revealed
				})
			);
		} catch {
			// storage unavailable; play without persistence
		}
	}

	function restore(): boolean {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return false;
			const data = JSON.parse(raw);
			if (!Array.isArray(data.pieces) || data.pieces.length !== PIECES.length) return false;
			const byId = new Map(PIECES.map((d) => [d.id, d]));
			const restored: PieceState[] = [];
			for (const s of data.pieces) {
				const def = byId.get(s.id);
				if (!def) return false;
				restored.push({ def, rot: s.rot, flip: !!s.flip, x: s.x, y: s.y, z: s.z ?? 1 });
			}
			// saved layout may predate a piece-geometry update; reject if it overlaps
			for (const p of restored) {
				if (collidesWithAny(occupancyAt(p.def, p.rot, p.flip, p.x, p.y), restored, p.def.id)) {
					return false;
				}
			}
			pieces = restored;
			moves = data.moves ?? 0;
			startedAt = data.startedAt ?? null;
			finishedIn = data.finishedIn ?? null;
			won = !!data.won;
			revealed = !!data.revealed;
			return true;
		} catch {
			return false;
		}
	}

	function homePose(def: (typeof PIECES)[number]): PlacedPiece {
		return {
			def,
			rot: def.home.rot,
			flip: def.home.flip,
			x: def.home.x + BX,
			y: def.home.y + BY
		};
	}

	function showHint() {
		const wrong = pieces.filter((p) => !samePose(p, homePose(p.def)));
		if (wrong.length === 0) return;
		hintPiece = wrong[Math.floor(Math.random() * wrong.length)].def.id;
		setTimeout(() => (hintPiece = null), 4000);
	}

	function hintShape(id: string) {
		const def = PIECES.find((d) => d.id === id)!;
		const home = homePose(def);
		const cells = orientCached(def.id, def.cells, home.rot, home.flip);
		const { h } = bounds(cells);
		return {
			path: outlinePath(cells, U, CORNER_R, h, pointedTipCorners(cells)),
			x: home.x,
			y: home.y,
			h
		};
	}

	/** Place everything at the reference solution. */
	function solveAll() {
		for (const p of pieces) {
			const home = homePose(p.def);
			p.rot = home.rot;
			p.flip = home.flip;
			p.x = home.x;
			p.y = home.y;
		}
		touch();
		save();
		checkWin();
	}

	let confirmSolve = $state(false);
	let revealed = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;

	function onSolveClick() {
		if (!confirmSolve) {
			confirmSolve = true;
			clearTimeout(confirmTimer);
			confirmTimer = setTimeout(() => (confirmSolve = false), 3000);
			return;
		}
		clearTimeout(confirmTimer);
		confirmSolve = false;
		revealed = true;
		solveAll();
	}

	// ---- confetti ----------------------------------------------------------
	function fireConfetti() {
		const canvas = confettiCanvas;
		if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * devicePixelRatio;
		canvas.height = rect.height * devicePixelRatio;
		ctx.scale(devicePixelRatio, devicePixelRatio);
		const colors = ['#f7941d', '#fbbf24', '#fde68a', '#ffffff'];
		const parts = Array.from({ length: 120 }, () => ({
			x: rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.4,
			y: rect.height * 0.35,
			vx: (Math.random() - 0.5) * 9,
			vy: -Math.random() * 9 - 3,
			s: Math.random() * 5 + 3,
			a: Math.random() * Math.PI,
			va: (Math.random() - 0.5) * 0.4,
			c: colors[Math.floor(Math.random() * colors.length)]
		}));
		const t0 = performance.now();
		const tick = (t: number) => {
			const dt = (t - t0) / 1000;
			ctx.clearRect(0, 0, rect.width, rect.height);
			if (dt > 2.2) return;
			for (const p of parts) {
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.25;
				p.a += p.va;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.a);
				ctx.globalAlpha = Math.max(0, 1 - dt / 2.2);
				ctx.fillStyle = p.c;
				ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
				ctx.restore();
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}

	// ---- lifecycle ---------------------------------------------------------
	onMount(() => {
		if (!restore()) scatter();
		mounted = true;
		if (!won) checkWin(); // a restored layout may already match the target
		const int = setInterval(() => (nowTick = Date.now()), 1000);
		if (import.meta.env.DEV) {
			(window as unknown as Record<string, unknown>).__snugSolve = solveAll;
		}
		return () => clearInterval(int);
	});

	const elapsed = $derived.by(() => {
		if (!startedAt) return 0;
		if (won && finishedIn !== null) return finishedIn;
		void nowTick;
		return Date.now() - startedAt;
	});

	function fmtTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	function pieceTransform(p: PieceState): string {
		const { h } = pieceShape(p.def, p.rot, p.flip, U, CORNER_R);
		const gx = p.fx ?? p.x;
		const gy = p.fy ?? p.y;
		return `translate(${gx * U}, ${(CH - gy - h) * U})`;
	}
</script>

<svelte:window onkeydown={onGlobalKey} />

<div class="snug">
	<div class="toolbar">
		<div class="stats" aria-live="polite">
			{#if won}
				{#if revealed}
					<span class="win-text">Solution revealed — shuffle or drag to keep playing</span>
				{:else}
					<span class="win-text">Solved in {fmtTime(elapsed)} · {moves} moves 🎉</span>
				{/if}
			{:else}
				<span>{fmtTime(elapsed)}</span>
				<span class="dim">·</span>
				<span>{moves} moves</span>
			{/if}
		</div>
		<div class="actions">
			<button
				class="btn variant-base"
				onclick={rotateSelected}
				disabled={!selectedId}
				title="Rotate selected piece (R)">↻ Rotate</button
			>
			<button
				class="btn variant-base"
				onclick={flipSelected}
				disabled={!selectedId}
				title="Flip selected piece (F)">⇋ Flip</button
			>
			<button class="btn variant-base" onclick={showHint} title="Show where one piece goes"
				>💡 Hint</button
			>
			<button
				class="btn variant-base"
				class:confirming={confirmSolve}
				onclick={onSolveClick}
				title="Give up and reveal the solution">{confirmSolve ? 'Reveal? 👀' : '🏳️ Solve'}</button
			>
			<button class="btn variant-base" onclick={reset} title="Shuffle the pieces">↺ Reset</button>
		</div>
	</div>

	<div class="stage">
		<svg
			bind:this={svgEl}
			viewBox="0 0 {CW * U} {CH * U}"
			role="application"
			aria-label="Number Snug puzzle. Drag the digit pieces into the target outline."
			onpointerdown={(e) => {
				if (e.target === e.currentTarget) selectedId = null;
			}}
		>
			<path class="board" d={boardPath} fill-rule="evenodd" />

			{#if hintPiece}
				{@const g = hintShape(hintPiece)}
				<g transform="translate({g.x * U}, {(CH - g.y - g.h) * U})" class="hint">
					<path d={g.path} fill-rule="evenodd" />
				</g>
			{/if}

			{#if mounted}
				{#each [...pieces].sort((a, b) => a.z - b.z) as p (p.def.id)}
					{@const shape = pieceShape(p.def, p.rot, p.flip, U, CORNER_R)}
					<g
						class="piece"
						class:selected={selectedId === p.def.id}
						class:dragging={draggingId === p.def.id}
						class:shake={p.shake}
						class:won
						transform={pieceTransform(p)}
						tabindex={0}
						role="button"
						aria-label="Digit {p.def.id} piece. Arrow keys move, R rotates, F flips."
						onpointerdown={(e) => onPointerDown(e, p)}
						onpointermove={(e) => onPointerMove(e, p)}
						onpointerup={(e) => onPointerUp(e, p)}
						onpointercancel={(e) => onPointerUp(e, p)}
						onfocus={() => (selectedId = p.def.id)}
					>
						<path d={shape.path} fill-rule="evenodd" />
					</g>
				{/each}
			{/if}
		</svg>
		<canvas bind:this={confettiCanvas} class="confetti" aria-hidden="true"></canvas>
	</div>

	<p class="help">
		Drag pieces into the outline. Double-tap or press <kbd>R</kbd> to rotate, <kbd>F</kbd> to flip — every
		piece is a digit, and they all fit snugly.
	</p>
</div>

<style>
	.snug {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.stats {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		display: flex;
		gap: 0.4rem;
	}

	.dim {
		opacity: 0.4;
	}

	.win-text {
		color: var(--brand);
		font-weight: 700;
	}

	.confirming {
		outline: 2px solid #f7941d;
	}

	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.stage {
		position: relative;
		width: 100%;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		touch-action: none;
		user-select: none;
		border-radius: 0.75rem;
		background:
			radial-gradient(
				circle at 30% 20%,
				color-mix(in oklch, #f7941d 6%, transparent),
				transparent 60%
			),
			color-mix(in oklch, var(--content) 4%, transparent);
	}

	.confetti {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.board {
		pointer-events: none;
		fill: color-mix(in oklch, #f7941d 10%, transparent);
		stroke: color-mix(in oklch, #f7941d 55%, transparent);
		stroke-width: 2;
		stroke-dasharray: 6 5;
	}

	.hint path {
		fill: color-mix(in oklch, #f7941d 35%, transparent);
		stroke: #f7941d;
		stroke-width: 2.5;
		stroke-dasharray: 8 5;
		animation: hint-pulse 1.2s ease-in-out infinite;
	}

	@keyframes hint-pulse {
		50% {
			opacity: 0.45;
		}
	}

	.piece {
		cursor: grab;
		outline: none;
	}

	.piece path {
		fill: #f7941dd9;
		stroke: #c96f0e;
		stroke-width: 1.5;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.25));
		transition: filter 150ms ease;
	}

	.piece:not(.dragging) {
		transition: transform 160ms cubic-bezier(0.3, 1.4, 0.6, 1);
	}

	.piece.dragging {
		cursor: grabbing;
	}

	.piece.dragging path {
		filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.3));
		fill: #f7941dee;
	}

	.piece.selected path,
	.piece:focus-visible path {
		stroke: var(--brand);
		stroke-width: 3;
	}

	.piece.won path {
		animation: glow 1.6s ease-in-out;
		stroke: #fbbf24;
	}

	@keyframes glow {
		30% {
			filter: drop-shadow(0 0 14px #fbbf24cc);
		}
	}

	.piece.shake {
		animation: shake 0.3s ease;
	}

	@keyframes shake {
		25% {
			translate: -3px 0;
		}
		75% {
			translate: 3px 0;
		}
	}

	.help {
		opacity: 0.65;
		font-size: 0.9rem;
		margin: 0;
	}

	kbd {
		border: 1px solid color-mix(in oklch, var(--content) 25%, transparent);
		border-radius: 4px;
		padding: 0 4px;
		font-size: 0.85em;
	}

	@media (prefers-reduced-motion: reduce) {
		.piece:not(.dragging) {
			transition: none;
		}
	}
</style>
