"""Photo-faithful catalog, full 10-piece exact cover.

New shapes matching the reference photo:
- 0: large OPEN C-ring (3x5 ring with a gap; a closed one would trap cells)
- 6/9: ring + hooked L-tail (mitred, looks curved like the acrylic ones)
- 1: diagonal staircase stroke (the little lightning zigzag)
- 7: top bar + true 45-degree staircase leg
- 4: open "y": leg + two mitred arms
- 2/5/3/8: as before (S-shapes, comb 3, double-ring 8)
"""

import itertools
import json
import sys

import solve7 as S

N_, E_, S_, W_ = 1, 2, 4, 8


def chisel_variants_direct(base, cell, keep_options):
    """yield (suffix, cm) for tip variants of a direct cellmap."""
    yield "s", dict(base)
    for i, keep in enumerate(keep_options):
        cm = dict(base)
        cm[cell] = keep
        yield "c" + str(i), cm


# --- skeleton pieces (bends mitred, per-end tips) --------------------------
SKELS = {
    "8": {"8": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4)]},
    "0": {
        # open C rings; gap opens the inner channel so it stays fillable
        "0Cm": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4)],
        "0Cl": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (2, 2), (0, 3), (0, 4), (1, 4), (2, 4)],
        "0C4": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (0, 3), (1, 3), (2, 3)],
        "0C4b": [(0, 0), (1, 0), (2, 0), (0, 1), (0, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
    },
    "6": {
        "6h": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (0, 4), (1, 4)],
        "6s": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3)],
        "6t": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (0, 4)],
    },
    "9": {
        "9h": [(0, 2), (1, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4), (2, 1), (2, 0), (1, 0)],
        "9s": [(0, 1), (1, 1), (2, 1), (0, 2), (2, 2), (0, 3), (1, 3), (2, 3), (2, 0), (1, 0)],
        "9t": [(0, 2), (1, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4), (2, 1), (2, 0)],
    },
    "4": {
        "4b": [(0, 3), (0, 2), (1, 2), (2, 3), (2, 2), (2, 1), (2, 0)],
        "4c": [(0, 3), (0, 2), (1, 2), (2, 4), (2, 3), (2, 2), (2, 1), (2, 0)],
    },
    "2": {"2w": [(0, 4), (1, 4), (2, 4), (2, 3), (0, 2), (1, 2), (2, 2), (0, 1), (0, 0), (1, 0), (2, 0)]},
    "5": {"5w": [(0, 4), (1, 4), (2, 4), (0, 3), (0, 2), (1, 2), (2, 2), (2, 1), (0, 0), (1, 0), (2, 0)]},
    "3": {"3w": [(0, 4), (1, 4), (2, 4), (2, 3), (0, 2), (1, 2), (2, 2), (2, 1), (0, 0), (1, 0), (2, 0)]},
}

# --- direct cellmap pieces --------------------------------------------------
DIRECT = {"1": [], "7": [], "4": []}

# 1: diagonal staircases (fulls on the diagonal, halves bridging)
D1_3 = {(0, 0): 15, (1, 0): 9, (1, 1): 15, (1, 2): 6, (2, 2): 15}
D1_2 = {(0, 0): 15, (1, 0): 9, (1, 1): 15}
for sfx, cm in chisel_variants_direct(D1_3, (0, 0), [3, 12]):
    DIRECT["1"].append((f"1d3{sfx}", cm))
for sfx, cm in chisel_variants_direct(D1_2, (1, 1), [3, 12]):
    DIRECT["1"].append((f"1d2{sfx}", cm))

# 7: top bar + diagonal staircase leg (bridging halves share a row: legal)
D7 = {(0, 3): 15, (1, 3): 15, (2, 3): 15,
      (2, 2): 15, (2, 1): 9, (1, 1): 15, (0, 1): 6, (0, 0): 15}
for sfx, cm in chisel_variants_direct(D7, (0, 3), [3, 6]):
    for sfx2, cm2 in chisel_variants_direct(cm, (0, 0), [3, 6]):
        DIRECT["7"].append((f"7d{sfx}{sfx2}", cm2))
# short-bar variant
D7s = {(1, 3): 15, (2, 3): 15,
       (2, 2): 15, (2, 1): 9, (1, 1): 15, (0, 1): 6, (0, 0): 15}
for sfx, cm in chisel_variants_direct(D7s, (0, 0), [3, 6]):
    DIRECT["7"].append((f"7s{sfx}", cm))

# 4: open "y"/lambda — mitred diagonal arm + vertical leg
D4 = {(0, 3): 15, (1, 3): 12, (1, 2): 15, (1, 1): 15, (1, 0): 15}
for sfx, cm in chisel_variants_direct(D4, (1, 0), [6, 12]):
    for sfx2, cm2 in chisel_variants_direct(cm, (0, 3), [3, 9]):
        DIRECT["4"].append((f"4y{sfx}{sfx2}", cm2))
# longer leg
D4L = {(0, 4): 15, (1, 4): 12, (1, 3): 15, (1, 2): 15, (1, 1): 15, (1, 0): 15}
for sfx, cm in chisel_variants_direct(D4L, (1, 0), [6, 12]):
    DIRECT["4"].append((f"4L{sfx}", cm))

DIGITS = ["8", "0", "6", "9", "2", "5", "3", "4", "7", "1"]
TIPS = ["square", "cw", "ccw"]

VAR = {d: [] for d in DIGITS}
for d in DIGITS:
    seen = set()
    if d in SKELS:
        for vid, cells in SKELS[d].items():
            ends = S.ends_of(cells)
            for combo in itertools.product(TIPS, repeat=len(ends)):
                tipcfg = {c: st for (c, _dir), st in zip(ends, combo)}
                cm = S.build(cells, tipcfg)
                sig = tuple(sorted(cm.items()))
                if sig in seen:
                    continue
                seen.add(sig)
                pv = S.parity_vectors(cm)
                if not pv:
                    continue
                VAR[d].append({"id": f"{vid}:{''.join(t[0] for t in combo) or '-'}",
                               "cm": cm, "area": S.area(cm), "pv": pv})
    if d in DIRECT:
        for vid, cm in DIRECT[d]:
            sig = tuple(sorted(cm.items()))
            if sig in seen:
                continue
            seen.add(sig)
            pv = S.parity_vectors(cm)
            if not pv:
                continue
            VAR[d].append({"id": vid, "cm": cm, "area": S.area(cm), "pv": pv})

print({d: len(v) for d, v in VAR.items()}, file=sys.stderr)
for d in DIGITS:
    if not VAR[d]:
        print(f"!! digit {d} has NO legal variants", file=sys.stderr)
        sys.exit(1)

piece_bit = {d: 1 << i for i, d in enumerate(DIGITS)}
PL_CACHE = {}


def get_pl(d, vi):
    key = (d, vi)
    if key not in PL_CACHE:
        PL_CACHE[key] = S.placements(VAR[d][vi]["cm"])
    return PL_CACHE[key]


TB, TC = 96, 100


def find_sets(max_sets=8000):
    layers = []
    states = {(0, 0, 0)}
    for d in DIGITS:
        new = set()
        for s in states:
            for v in VAR[d]:
                for pv in v["pv"]:
                    t = (s[0] + pv[0], s[1] + pv[1], s[2] + pv[2])
                    if t[0] <= 120 and t[1] <= TB and t[2] <= TC:
                        new.add(t)
        states = new
        layers.append(states)
        print(f"after {d}: {len(states)} states", file=sys.stderr)
        if not states:
            return []

    finals = [s for s in states if 80 <= s[1] <= TB and 80 <= s[2] <= TC and 288 <= sum(s) <= 316]
    finals.sort(key=lambda s: -sum(s))
    print(f"{len(finals)} final parity states", file=sys.stderr)

    sets_ = []

    def back(di, state, acc):
        if len(sets_) >= max_sets or di < 0:
            if di < 0:
                sets_.append(list(reversed(acc)))
            return
        d = DIGITS[di]
        for vi, v in enumerate(VAR[d]):
            for pv in v["pv"]:
                prev = (state[0] - pv[0], state[1] - pv[1], state[2] - pv[2])
                if min(prev) < 0:
                    continue
                if di == 0:
                    if prev == (0, 0, 0):
                        back(di - 1, prev, acc + [vi])
                else:
                    if prev in layers[di - 1]:
                        back(di - 1, prev, acc + [vi])
                if len(sets_) >= max_sets:
                    return

    for f in finals[:400]:
        back(len(DIGITS) - 1, f, [])
        if len(sets_) >= max_sets:
            break
    return sets_


def try_set(pick, limit=250_000):
    by_cover = [[] for _ in range(S.NBITS)]
    for d, vi in zip(DIGITS, pick):
        for mask, rot, flip, ox, oy in get_pl(d, vi):
            m = mask
            while m:
                b = (m & -m).bit_length() - 1
                by_cover[b].append((d, mask, rot, flip, ox, oy))
                m &= m - 1
    solution = []
    nodes = 0

    def solve(covered, used):
        nonlocal nodes
        nodes += 1
        if nodes > limit:
            raise TimeoutError
        need = S.REQUIRED & ~covered
        if need == 0:
            return True
        b = (need & -need).bit_length() - 1
        for d, mask, rot, flip, ox, oy in by_cover[b]:
            if used & piece_bit[d] or mask & covered:
                continue
            solution.append((d, rot, flip, ox, oy))
            if solve(covered | mask, used | piece_bit[d]):
                return True
            solution.pop()
        return False

    try:
        ok = solve(0, 0)
    except TimeoutError:
        return "timeout", nodes
    return (solution if ok else None), nodes


def main():
    import random
    random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 3)
    sets_ = find_sets()
    print(f"{len(sets_)} candidate sets", file=sys.stderr)
    random.shuffle(sets_)
    sets_.sort(key=lambda pick: -sum(VAR[d][vi]["area"] for d, vi in zip(DIGITS, pick)))

    solved = []
    tested = 0
    for pick in sets_:
        tested += 1
        if tested > 2500:
            break
        res, nodes = try_set(pick)
        if res == "timeout":
            continue
        if res:
            ids = [VAR[d][vi]['id'] for d, vi in zip(DIGITS, pick)]
            tot = sum(VAR[d][vi]["area"] for d, vi in zip(DIGITS, pick))
            print(f"SOLVED area={tot} {ids} nodes={nodes} (tested {tested})", file=sys.stderr)
            solved.append((pick, res))
            if len(solved) >= 6:
                break

    print(f"tested {tested}, solved {len(solved)}", file=sys.stderr)
    if not solved:
        return

    out = []
    for pick, sol in solved:
        vmap = {d: VAR[d][vi] for d, vi in zip(DIGITS, pick)}
        entry = {
            "variants": {d: vmap[d]["id"] for d in DIGITS},
            "cells": {d: {f"{x},{y}": m for (x, y), m in vmap[d]["cm"].items()} for d in DIGITS},
            "solution": {},
        }
        for d, rot, flip, ox, oy in sol:
            t = S.transform(vmap[d]["cm"], rot, flip)
            entry["solution"][d] = {
                "rot": rot, "flip": flip, "ox": ox, "oy": oy,
                "cells": {f"{x + ox},{y + oy}": m for (x, y), m in t.items()},
            }
        out.append(entry)
    with open("solutions12.json", "w") as f:
        json.dump(out, f, indent=1)

    for pick, sol in solved[:3]:
        vmap = {d: VAR[d][vi] for d, vi in zip(DIGITS, pick)}
        sub = [["·" for _ in range(S.W * 2)] for _ in range(S.H * 2)]
        for d, rot, flip, ox, oy in sol:
            t = S.transform(vmap[d]["cm"], rot, flip)
            for (x, y), m in t.items():
                gx, gy = x + ox, y + oy
                if m & N_ and m & W_:
                    sub[gy * 2 + 1][gx * 2] = d
                if m & N_ and m & E_:
                    sub[gy * 2 + 1][gx * 2 + 1] = d
                if m & S_ and m & W_:
                    sub[gy * 2][gx * 2] = d
                if m & S_ and m & E_:
                    sub[gy * 2][gx * 2 + 1] = d
        print("\n".join("".join(r) for r in reversed(sub)))
        print("=" * 44)


if __name__ == "__main__":
    main()
