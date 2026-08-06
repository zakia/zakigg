// ---------------------------------------------------------------------------
// Pure game logic for Number Snug: occupancy, collision, snapping, win check,
// scatter layout. No DOM, no reactivity — the Svelte component owns state and
// events and delegates every geometric question here.
// ---------------------------------------------------------------------------

import {
	bounds,
	cellKey,
	orientCached,
	outlinePath,
	pointedTipCorners,
	type Cell,
	type Pose
} from './geometry';
import type { PieceDef } from './pieces';

export interface PlacedPiece {
	def: PieceDef;
	rot: number;
	flip: boolean;
	x: number;
	y: number;
}

export function bitCount(m: number): number {
	let n = 0;
	for (let v = m; v; v &= v - 1) n++;
	return n;
}

/** cellKey -> quarter mask for a piece at integer position. */
export function pieceOccupancy(p: PlacedPiece): Map<number, number> {
	const out = new Map<number, number>();
	for (const [x, y, m] of orientCached(p.def.id, p.def.cells, p.rot, p.flip)) {
		out.set(cellKey(x + p.x, y + p.y), m);
	}
	return out;
}

export function occupancyAt(
	def: PieceDef,
	rot: number,
	flip: boolean,
	x: number,
	y: number
): Map<number, number> {
	return pieceOccupancy({ def, rot, flip, x, y });
}

export function collidesWithAny(
	cand: Map<number, number>,
	pieces: readonly PlacedPiece[],
	excludeId: string
): boolean {
	for (const other of pieces) {
		if (other.def.id === excludeId) continue;
		const occ = pieceOccupancy(other);
		for (const [k, m] of cand) {
			const o = occ.get(k);
			if (o !== undefined && (o & m) !== 0) return true;
		}
	}
	return false;
}

/**
 * Snap to (x, y) or the nearest free spot within a small search radius,
 * clamped to the canvas. Returns null when everything nearby collides.
 */
export function findFreeSpot(
	pieces: readonly PlacedPiece[],
	def: PieceDef,
	rot: number,
	flip: boolean,
	x: number,
	y: number,
	cw: number,
	ch: number
): { x: number; y: number } | null {
	const { w, h } = bounds(orientCached(def.id, def.cells, rot, flip));
	const offsets: [number, number][] = [];
	for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) offsets.push([dx, dy]);
	offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
	for (const [dx, dy] of offsets) {
		const nx = Math.min(Math.max(x + dx, 0), cw - w);
		const ny = Math.min(Math.max(y + dy, 0), ch - h);
		if (!collidesWithAny(occupancyAt(def, rot, flip, nx, ny), pieces, def.id)) {
			return { x: nx, y: ny };
		}
	}
	return null;
}

export interface BoardTarget {
	mask: Map<number, number>;
	quarters: number;
}

export function buildBoardTarget(cells: Cell[], bx: number, by: number): BoardTarget {
	const mask = new Map<number, number>();
	let quarters = 0;
	for (const [x, y, m] of cells) {
		mask.set(cellKey(x + bx, y + by), m);
		quarters += bitCount(m);
	}
	return { mask, quarters };
}

/** True when the pieces exactly cover the target with no overlap. */
export function isSolved(pieces: readonly PlacedPiece[], target: BoardTarget): boolean {
	let quarters = 0;
	const seen = new Map<number, number>();
	for (const p of pieces) {
		for (const [k, m] of pieceOccupancy(p)) {
			const t = target.mask.get(k);
			if (t === undefined || (t & m) !== m) return false;
			const prev = seen.get(k) ?? 0;
			if ((prev & m) !== 0) return false;
			seen.set(k, prev | m);
			quarters += bitCount(m);
		}
	}
	return quarters === target.quarters;
}

export function samePose(a: PlacedPiece, b: PlacedPiece): boolean {
	const oa = pieceOccupancy(a);
	const ob = pieceOccupancy(b);
	if (oa.size !== ob.size) return false;
	for (const [k, m] of oa) if (ob.get(k) !== m) return false;
	return true;
}

export interface ScatterZone {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Random non-overlapping poses inside the given zones (best effort). */
export function scatterPoses(
	defs: readonly PieceDef[],
	zones: readonly ScatterZone[],
	cw: number,
	ch: number,
	random: () => number = Math.random
): PlacedPiece[] {
	const order = [...defs].sort(() => random() - 0.5);
	const placed: PlacedPiece[] = [];
	for (const def of order) {
		let rot = Math.floor(random() * 4);
		let flip = random() < 0.5;
		let spot: { x: number; y: number } | null = null;
		{
			const { w, h } = bounds(orientCached(def.id, def.cells, rot, flip));
			for (let attempt = 0; attempt < 250 && !spot; attempt++) {
				const zone = zones[attempt % zones.length];
				if (zone.w < w || zone.h < h) continue;
				const x = zone.x + Math.floor(random() * (zone.w - w + 1));
				const y = zone.y + Math.floor(random() * (zone.h - h + 1));
				if (x < 0 || y < 0 || x + w > cw || y + h > ch) continue;
				if (!collidesWithAny(occupancyAt(def, rot, flip, x, y), placed, def.id)) {
					spot = { x, y };
				}
			}
		}
		// deterministic fallback: scan every orientation and position
		if (!spot) {
			outer: for (let r = 0; r < 4; r++) {
				for (const f of [false, true]) {
					const { w, h } = bounds(orientCached(def.id, def.cells, r, f));
					for (let y = 0; y <= ch - h; y++) {
						for (let x = 0; x <= cw - w; x++) {
							if (!collidesWithAny(occupancyAt(def, r, f, x, y), placed, def.id)) {
								rot = r;
								flip = f;
								spot = { x, y };
								break outer;
							}
						}
					}
				}
			}
		}
		placed.push({ def, rot, flip, x: spot?.x ?? 0, y: spot?.y ?? 0 });
	}
	return placed;
}

export interface PieceShape {
	path: string;
	w: number;
	h: number;
}

const shapeCache = new Map<string, PieceShape>();

/** Cached SVG path + bounds for a piece orientation. */
export function pieceShape(
	def: PieceDef,
	rot: number,
	flip: boolean,
	unit: number,
	cornerR: number
): PieceShape {
	const key = `${def.id}|${((rot % 4) + 4) % 4}|${flip ? 1 : 0}|${unit}|${cornerR}`;
	let hit = shapeCache.get(key);
	if (!hit) {
		const cells = orientCached(def.id, def.cells, rot, flip);
		const { w, h } = bounds(cells);
		hit = { path: outlinePath(cells, unit, cornerR, h, pointedTipCorners(cells)), w, h };
		shapeCache.set(key, hit);
	}
	return hit;
}

export interface AssemblyReport {
	/** quarters claimed by two pieces at once */
	overlaps: Cell[];
	/** target quarters no piece covers */
	gaps: Cell[];
	/** piece quarters outside the target */
	strays: Cell[];
}

/** Quarter-level diff between placed piece cells and the target silhouette. */
export function assemblyReport(placedCells: Cell[][], boardCells: Cell[]): AssemblyReport {
	const board = new Map<string, number>();
	for (const [x, y, m] of boardCells) board.set(`${x},${y}`, m);
	const coverage = new Map<string, number>();
	const overlapMap = new Map<string, number>();
	for (const cells of placedCells) {
		for (const [x, y, m] of cells) {
			const k = `${x},${y}`;
			const prev = coverage.get(k) ?? 0;
			if (prev & m) overlapMap.set(k, (overlapMap.get(k) ?? 0) | (prev & m));
			coverage.set(k, prev | m);
		}
	}
	const toCells = (map: Map<string, number>): Cell[] =>
		[...map].map(([k, m]): Cell => {
			const [x, y] = k.split(',').map(Number);
			return [x, y, m];
		});
	const gapMap = new Map<string, number>();
	for (const [k, m] of board) {
		const missing = m & ~(coverage.get(k) ?? 0);
		if (missing) gapMap.set(k, missing);
	}
	const strayMap = new Map<string, number>();
	for (const [k, m] of coverage) {
		const extra = m & ~(board.get(k) ?? 0);
		if (extra) strayMap.set(k, extra);
	}
	return { overlaps: toCells(overlapMap), gaps: toCells(gapMap), strays: toCells(strayMap) };
}

export function orientedBounds(
	def: PieceDef,
	rot: number,
	flip: boolean
): { w: number; h: number } {
	return bounds(orientCached(def.id, def.cells, rot, flip));
}

export type { Pose };
