# Number Snug piece-design pipeline

These scripts designed and verified the piece geometry in
`src/lib/puzzle/pieces.ts`. They are development tools, not part of the build.

- `solve7.py` — the core model: the 11×9 waffle board, quarter-triangle cell
  encoding, digit skeleton variants (bend style, per-end tip style), parity
  analysis, and the exact-cover solver.
- `solve10.py` — guided backtracking that places 7 fixed digits
  (8, 3, 2, 5, 9, 6, 0) and requires the leftover region to split into 3
  connected fragments (which become the 1, 4, 7). Usage:
  `python3 solve10.py <seed> <node_limit>` → writes `hits10_<seed>.json`.
- `solve11.py` — same, parameterized: `SNUG_ORDER="8,3,2,5,9,6,0,7"
SNUG_TAG=w7 python3 solve11.py <seed> <limit>` fixes 8 pieces and derives 2.
- `rank_hits.py` — ranks hits by rim-notch count and renders layouts/leftovers
  as ASCII for eyeballing digit-likeness.
- `gen_pieces2.py` — emits `src/lib/puzzle/pieces.ts` from a chosen hit:
  `python3 gen_pieces2.py <hits_json> <index> "1,7,4"` (labels are assigned to
  leftovers sorted by area).
- `solve12.py` — the photo-faithful piece catalog: open-C 0 (a closed ring
  taller than 3 would trap unreachable cells), hooked 6/9 tails, diagonal
  staircase 1, diagonal-leg 7, y-shaped 4, plus tip/bend variants of each.
- `solve15.py` — multi-variant exact cover over that catalog: one bit-driven
  search in which each digit's variant is chosen dynamically.
- `gen_pieces4.py` — emits `pieces.ts` from a `solutions15_*.json` entry.
- `hits10_q4_22.json` — search output of the first-generation geometry.

Run them from this directory (they import `solve7`). See `docs/puzzle.md` for
why the 45° cuts are structurally necessary.
