// Piece shapes as top-down ASCII art: one hex digit per cell (quarter mask),
// '#' = full (15), '.' = empty. Edit freely — /puzzle/pieces previews live.
import { shapeCells, type Cell, type Pose } from './geometry';

export interface PieceDef {
	id: string;
	cells: Cell[];
	/** Reference solution pose (board coordinates). */
	home: Pose;
}

export const BOARD_W = 11;
export const BOARD_H = 9;

/** Target silhouette: union of the reference solution. */
export const BOARD_CELLS: Cell[] = shapeCells(`
	6#e###e#e#c
	#.#.#.#.#.#
	##########d
	#.#.#.#.#.#
	7#########d
	#.#.#.#.#.#
	7#########d
	#.#.#.#.#.#
	3#b#b#b#b#9
`);

export const PIECES: PieceDef[] = [
	{
		id: '1',
		cells: shapeCells(`
			4
			#
			d
			#
			1
		`),
		home: { x: 2, y: 8, rot: 1, flip: false }
	},
	{
		id: '2',
		cells: shapeCells(`
			2#c
			..#
			6#9
			#..
			3#8
		`),
		home: { x: 6, y: 4, rot: 3, flip: true }
	},
	{
		id: '3',
		cells: shapeCells(`
			2#c
			..#
			2#d
			..#
			2#9
		`),
		home: { x: 0, y: 0, rot: 1, flip: false }
	},
	{
		id: '4',
		cells: shapeCells(`
			4.4
			#.#
			3#d
			..#
			..1
		`),
		home: { x: 4, y: 0, rot: 1, flip: false }
	},
	{
		id: '5',
		cells: shapeCells(`
			6#8
			#..
			3#c
			..#
			2#9
		`),
		home: { x: 4, y: 2, rot: 2, flip: false }
	},
	{
		id: '6',
		cells: shapeCells(`
			6#8
			#..
			7#c
			#.#
			3#9
		`),
		home: { x: 6, y: 6, rot: 1, flip: false }
	},
	{
		id: '7',
		cells: shapeCells(`
			6#8
			#..
			d..
			#..
			1..
		`),
		home: { x: 0, y: 6, rot: 1, flip: true }
	},
	{
		id: '8',
		cells: shapeCells(`
			6#c
			#.#
			7#d
			#.#
			3#9
		`),
		home: { x: 8, y: 0, rot: 0, flip: false }
	},
	{
		id: '9',
		cells: shapeCells(`
			6#c
			#.#
			3#d
			..#
			2#9
		`),
		home: { x: 0, y: 2, rot: 1, flip: false }
	},
	{
		id: '0',
		cells: shapeCells(`
			6#c
			#.#
			d.1
			#.#
			3#9
		`),
		home: { x: 0, y: 4, rot: 0, flip: false }
	}
];
