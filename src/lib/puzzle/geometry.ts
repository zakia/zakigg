// ---------------------------------------------------------------------------
// Number Snug geometry: unit cells that are empty, full, or diagonal halves.
//
// Each unit cell is described by a quarter-triangle mask (the four triangles
// meeting at the cell center): N=1, E=2, S=4, W=8. A full cell is 15; the
// four diagonal half-cells are N|E, S|E, S|W, N|W. Two pieces collide iff
// their masks intersect anywhere, which makes 45°-mitred edges mate exactly.
// ---------------------------------------------------------------------------

export const QN = 1;
export const QE = 2;
export const QS = 4;
export const QW = 8;
export const QFULL = 15;

/**
 * One occupied unit cell of a piece: `[x, y, quarterMask]`.
 *
 * - `x`, `y` — integer cell coordinates in the piece's own frame, `y` up,
 *   origin at the piece's bottom-left cell.
 * - `quarterMask` — which of the cell's four center triangles the piece
 *   fills: N=1, E=2, S=4, W=8, so:
 *   - `15` — the whole cell,
 *   - `3` (N|E) — upper-right half, cut along the `/` diagonal,
 *   - `6` (S|E) — lower-right half, cut along the `\` diagonal,
 *   - `12` (S|W) — lower-left half (`/` cut),
 *   - `9` (N|W) — upper-left half (`\` cut).
 *   Complementary halves (3+12, 6+9) tile one cell exactly, which is how the
 *   45° mitres of two pieces mate.
 */
export type Cell = [number, number, number];

export interface Pose {
	x: number;
	y: number;
	rot: number; // 0..3, quarter turns clockwise
	flip: boolean; // horizontal mirror applied before rotation
}

/**
 * Parse a shape drawn as ASCII art into cells.
 *
 * Rows are written top-down, exactly as the piece looks on screen. Each
 * character is one cell's quarter-mask in hex (`1`–`9`, `a`–`f`), `#` as an
 * alias for a full cell (15), and `.` (or space) for empty. The directions in
 * the mask are visual: N(+1) is up, E(+2) right, S(+4) down, W(+8) left.
 *
 * Example — a lower-left half above a full cell:
 * ```
 * shapeCells(`
 *   c.
 *   ##
 * `)
 * ```
 */
export function shapeCells(art: string): Cell[] {
	const rows = art
		.split('\n')
		.map((r) => r.replace(/\s+$/, ''))
		.filter((r) => r.trim().length > 0);
	const indent = Math.min(...rows.map((r) => r.length - r.trimStart().length));
	const trimmed = rows.map((r) => r.slice(indent));
	const h = trimmed.length;
	const cells: Cell[] = [];
	trimmed.forEach((row, i) => {
		for (let j = 0; j < row.length; j++) {
			const ch = row[j];
			if (ch === '.' || ch === ' ') continue;
			const mask = ch === '#' ? QFULL : parseInt(ch, 16);
			if (!Number.isInteger(mask) || mask < 1 || mask > 15) {
				throw new Error(`shapeCells: bad character "${ch}" at row ${i}, col ${j}`);
			}
			cells.push([j, h - 1 - i, mask]);
		}
	});
	return normalize(cells);
}

/** Inverse of {@link shapeCells}: cells -> normalized top-down ASCII art. */
export function cellsToArt(cells: Cell[]): string {
	if (cells.length === 0) return '';
	const minX = Math.min(...cells.map(([x]) => x));
	const minY = Math.min(...cells.map(([, y]) => y));
	const norm = cells.map(([x, y, m]): Cell => [x - minX, y - minY, m]);
	const w = Math.max(...norm.map(([x]) => x)) + 1;
	const h = Math.max(...norm.map(([, y]) => y)) + 1;
	const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
	for (const [x, y, m] of norm) grid[h - 1 - y][x] = m === QFULL ? '#' : m.toString(16);
	return grid.map((r) => r.join('')).join('\n');
}

const ROT_Q: Record<number, number> = { [QN]: QE, [QE]: QS, [QS]: QW, [QW]: QN };
const FLIP_Q: Record<number, number> = { [QN]: QN, [QS]: QS, [QE]: QW, [QW]: QE };

function mapMask(mask: number, table: Record<number, number>): number {
	let out = 0;
	for (const q of [QN, QE, QS, QW]) if (mask & q) out |= table[q];
	return out;
}

function normalize(cells: Cell[]): Cell[] {
	const mnx = Math.min(...cells.map(([x]) => x));
	const mny = Math.min(...cells.map(([, y]) => y));
	return cells
		.map(([x, y, m]): Cell => [x - mnx, y - mny, m])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Piece cells in a given orientation, normalized to min corner (0,0). */
export function orient(cells: Cell[], rot: number, flip: boolean): Cell[] {
	let cur = cells.map(([x, y, m]): Cell => [x, y, m]);
	if (flip) cur = cur.map(([x, y, m]): Cell => [-x, y, mapMask(m, FLIP_Q)]);
	for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
		cur = cur.map(([x, y, m]): Cell => [y, -x, mapMask(m, ROT_Q)]);
	}
	return normalize(cur);
}

const orientCache = new Map<string, Cell[]>();

export function orientCached(id: string, cells: Cell[], rot: number, flip: boolean): Cell[] {
	const key = `${id}|${((rot % 4) + 4) % 4}|${flip ? 1 : 0}`;
	let hit = orientCache.get(key);
	if (!hit) {
		hit = orient(cells, rot, flip);
		orientCache.set(key, hit);
	}
	return hit;
}

export function bounds(cells: Cell[]): { w: number; h: number } {
	let w = 0;
	let h = 0;
	for (const [x, y] of cells) {
		w = Math.max(w, x + 1);
		h = Math.max(h, y + 1);
	}
	return { w, h };
}

/** Occupancy of a piece at a pose, as cellKey -> quarter mask. */
export function occupancy(cells: Cell[], pose: Pose): Map<number, number> {
	const out = new Map<number, number>();
	const o = orient(cells, pose.rot, pose.flip);
	for (const [x, y, m] of o) {
		const key = cellKey(x + pose.x, y + pose.y);
		out.set(key, (out.get(key) ?? 0) | m);
	}
	return out;
}

/** Pack a (possibly negative) cell coordinate into one integer key. */
export function cellKey(x: number, y: number): number {
	return (x + 512) * 4096 + (y + 512);
}

export function anyOverlap(a: Map<number, number>, b: Map<number, number>): boolean {
	const [small, large] = a.size <= b.size ? [a, b] : [b, a];
	for (const [k, m] of small) {
		const other = large.get(k);
		if (other !== undefined && (other & m) !== 0) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Outline tracing: cells -> closed loops of lattice points -> SVG path.
// ---------------------------------------------------------------------------

type Pt = [number, number];

/**
 * Directed boundary edges of a cell's occupied quarters, CCW around the
 * material. Each quarter is emitted as its own triangle (apex at the cell
 * center); shared edges between adjacent quarters cancel during tracing, so
 * ANY mask 1..15 forms a valid region — halves, single quarter spikes, full
 * cells, even opposite-quarter bowties.
 */
function shapeEdges(x: number, y: number, mask: number): [Pt, Pt][] {
	const bl: Pt = [x, y];
	const br: Pt = [x + 1, y];
	const tr: Pt = [x + 1, y + 1];
	const tl: Pt = [x, y + 1];
	const c: Pt = [x + 0.5, y + 0.5];
	const out: [Pt, Pt][] = [];
	if (mask & QN) out.push([tl, c], [c, tr], [tr, tl]);
	if (mask & QE) out.push([br, tr], [tr, c], [c, br]);
	if (mask & QS) out.push([bl, br], [br, c], [c, bl]);
	if (mask & QW) out.push([bl, c], [c, tl], [tl, bl]);
	return out;
}

const ptKey = (p: Pt) => `${p[0]},${p[1]}`;

/** Trace cells into closed loops (outer loops CCW, holes CW). */
export function traceOutline(cells: Cell[]): Pt[][] {
	// collect directed edges; opposite pairs cancel (interior edges)
	const edges = new Map<string, [Pt, Pt]>();
	const add = (a: Pt, b: Pt) => {
		const back = `${ptKey(b)}|${ptKey(a)}`;
		if (edges.has(back)) edges.delete(back);
		else edges.set(`${ptKey(a)}|${ptKey(b)}`, [a, b]);
	};
	for (const [x, y, m] of cells) for (const [a, b] of shapeEdges(x, y, m)) add(a, b);

	// chain edges into loops
	const byStart = new Map<string, [Pt, Pt][]>();
	for (const e of edges.values()) {
		const k = ptKey(e[0]);
		const list = byStart.get(k);
		if (list) list.push(e);
		else byStart.set(k, [e]);
	}
	const loops: Pt[][] = [];
	while (edges.size > 0) {
		const first = edges.values().next().value as [Pt, Pt];
		const loop: Pt[] = [first[0]];
		let cur = first;
		for (;;) {
			edges.delete(`${ptKey(cur[0])}|${ptKey(cur[1])}`);
			const list = byStart.get(ptKey(cur[0]));
			if (list) {
				const i = list.indexOf(cur);
				if (i >= 0) list.splice(i, 1);
			}
			const nextKey = ptKey(cur[1]);
			if (nextKey === ptKey(loop[0])) break;
			loop.push(cur[1]);
			const candidates = byStart.get(nextKey);
			if (!candidates || candidates.length === 0) throw new Error('open outline');
			// prefer the edge turning most sharply left to keep loops simple
			cur = candidates[0];
			if (candidates.length > 1) {
				const inDir = [cur[0][0] - loop[loop.length - 2][0], cur[0][1] - loop[loop.length - 2][1]];
				let best = -Infinity;
				for (const c of candidates) {
					const outDir = [c[1][0] - c[0][0], c[1][1] - c[0][1]];
					const cross = inDir[0] * outDir[1] - inDir[1] * outDir[0];
					const dot = inDir[0] * outDir[0] + inDir[1] * outDir[1];
					const angle = Math.atan2(cross, dot);
					if (angle > best) {
						best = angle;
						cur = c;
					}
				}
			}
		}
		// drop collinear midpoints
		const simplified: Pt[] = [];
		for (let i = 0; i < loop.length; i++) {
			const p = loop[(i - 1 + loop.length) % loop.length];
			const q = loop[i];
			const r = loop[(i + 1) % loop.length];
			const cross = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
			if (cross !== 0) simplified.push(q);
		}
		loops.push(simplified);
	}
	return loops;
}

/**
 * SVG path for cells, y flipped for screen space, corners rounded by `r`.
 * Coordinates are multiplied by `unit`.
 */
export function outlinePath(
	cells: Cell[],
	unit: number,
	r: number,
	height?: number,
	pointed?: Set<string>
): string {
	const loops = traceOutline(cells);
	const H = height ?? bounds(cells).h;
	const parts: string[] = [];
	for (const loop of loops) {
		const flags = loop.map(([x, y]) => pointed?.has(`${x},${y}`) ?? false);
		const pts = loop.map(([x, y]): Pt => [x * unit, (H - y) * unit]);
		const n = pts.length;
		let dd = '';
		for (let i = 0; i < n; i++) {
			const p = pts[(i - 1 + n) % n];
			const q = pts[i];
			const r2 = pts[(i + 1) % n];
			const v1 = [q[0] - p[0], q[1] - p[1]];
			const v2 = [r2[0] - q[0], r2[1] - q[1]];
			const l1 = Math.hypot(v1[0], v1[1]);
			const l2 = Math.hypot(v2[0], v2[1]);
			// pointed tip corners get a deep 45° facet (half a cell) so bar
			// ends meet in a point like the laser-cut originals
			const cut = flags[i]
				? Math.min(0.5 * unit, l1 * 0.5, l2 * 0.5)
				: Math.min(r, l1 * 0.35, l2 * 0.35);
			const a: Pt = [q[0] - (v1[0] / l1) * cut, q[1] - (v1[1] / l1) * cut];
			const b: Pt = [q[0] + (v2[0] / l2) * cut, q[1] + (v2[1] / l2) * cut];
			if (i === 0) dd += `M${round(a[0])} ${round(a[1])}`;
			else dd += `L${round(a[0])} ${round(a[1])}`;
			if (flags[i]) dd += `L${round(b[0])} ${round(b[1])}`;
			else dd += `Q${round(q[0])} ${round(q[1])} ${round(b[0])} ${round(b[1])}`;
		}
		dd += 'Z';
		parts.push(dd);
	}
	return parts.join('');
}

/**
 * Lattice corners that should render as pointed 45° facets: the two outer
 * corners of every full end-cell (a cell with exactly one orthogonal
 * neighbour). Purely cosmetic — collision still uses the full cell, and the
 * small diamond gaps between facing tips read as the physical kerf notches.
 */
export function pointedTipCorners(cells: Cell[]): Set<string> {
	const have = new Set(cells.map(([x, y]) => `${x},${y}`));
	const out = new Set<string>();
	for (const [x, y, m] of cells) {
		if (m !== QFULL) continue;
		const nbrs: [number, number][] = [
			[x + 1, y],
			[x - 1, y],
			[x, y + 1],
			[x, y - 1]
		];
		const present = nbrs.filter(([nx, ny]) => have.has(`${nx},${ny}`));
		if (present.length !== 1) continue;
		const [nx, ny] = present[0];
		if (ny === y - 1) {
			out.add(`${x},${y + 1}`);
			out.add(`${x + 1},${y + 1}`);
		} else if (ny === y + 1) {
			out.add(`${x},${y}`);
			out.add(`${x + 1},${y}`);
		} else if (nx === x - 1) {
			out.add(`${x + 1},${y}`);
			out.add(`${x + 1},${y + 1}`);
		} else {
			out.add(`${x},${y}`);
			out.add(`${x},${y + 1}`);
		}
	}
	return out;
}

const round = (v: number) => Math.round(v * 100) / 100;
