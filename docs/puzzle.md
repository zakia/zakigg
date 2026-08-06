# Number Snug (`/puzzle`)

A web homage to INQ's "Number Snug" (Curiosity Box): ten digit-shaped acrylic
pieces tile a waffle-shaped target — an 11×9 grid with a 5×4 array of unit
holes (the fused strokes of ten seven-segment "8"s).

## Geometry model

Everything lives on a unit cell grid. Each cell is empty, full, or one of four
**diagonal half-cells**, encoded as quarter-triangle masks (the four triangles
meeting at the cell center): `N=1, E=2, S=4, W=8`, full = 15, halves = `N|E`,
`S|E`, `S|W`, `N|W`. Two pieces collide iff their quarter masks intersect in
any cell, which makes 45°-mitred edges of different pieces mate exactly.
See [`src/lib/puzzle/geometry.ts`](../src/lib/puzzle/geometry.ts).

Digit pieces are polyomino "stroke skeletons" (width-1 strokes) whose L-bends
are mitred (the bend cell keeps the half facing its two neighbours) and whose
bar ends may be square or bevel-cut.

## Why the 45° cuts are load-bearing

Colour the board cells by coordinate parity. Junction cells (even x, even y)
make up only 30 of the 79 filled cells, but any set of plain (uncut) width-1
digit polyominoes provably lands ≥ 38 cells on junctions in every legal
placement — so **plain polyomino digits can never tile the board** (verified
exhaustively; see the counting argument in the generator scripts). Mitred
bends cover only _half_ a junction cell, letting two pieces share one
diagonally, which is exactly how the physical pieces interlock — and why the
acrylic originals have those 45° cuts.

Even with mitred bends, no set of ten digits drawn from a conventional
"catalog" of digit skeletons can cover the full 79 area — the same counting
argument leaves a deficit of ≥ 12 quarter-cells. The way out (and plausibly
what the original designers did): fix the seven strongly-shaped digits
(8, 3, 2, 5, 9, 6, 0) and let a guided search carve the remaining region into
three connected fragments. That counting story is why the physical pieces are
shaped the way they are (the open "broken" 0, the mitred bends, the kerf
notches) — a closed ring taller than 3 cells would even seal cells inside
that no piece could ever reach.

## How the shipped geometry was made

The final piece shapes were hand-modeled on the physical acrylic set using
the visual editor at `/puzzle/pieces` (click quarter-triangles to sculpt a
shape, watch the assembly check flag overlaps and gaps), and the reference
solution was solved by hand in the game itself and captured with a dev-only
save endpoint. `src/lib/puzzle/pieces.ts` stores each shape as top-down
ASCII art (one hex quarter-mask per cell, `#` = full, `.` = empty) plus a
`home` pose per piece; `BOARD_CELLS` is the exact union of the reference
solution, notches included.

The solver scripts in
[`scripts/puzzle-design/`](../scripts/puzzle-design/README.md) remain as the
design-era tooling: they can verify any piece set tiles the board and hunt
for alternative tilings.
