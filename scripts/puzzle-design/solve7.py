"""Chamfered digits, per-end tip styles, DP-selected parity-feasible sets.

Quarter-triangle encoding (N=1,E=2,S=4,W=8). Bends always mitered (half toward
neighbors). Each bar end independently: square / chisel-cw / chisel-ccw.
Board: 11x9 waffle; boundary junction cells may keep uncovered outward halves
(notches), silhouette derived from the found tiling.
"""

import itertools
import json
import random
import sys

W, H = 11, 9
N_, E_, S_, W_ = 1, 2, 4, 8
FULLC = 15

HOLES = {(x, y) for x in range(W) for y in range(H) if x % 2 == 1 and y % 2 == 1}
FILLED = [(x, y) for x in range(W) for y in range(H) if (x, y) not in HOLES]
BIT = {c: i * 4 for i, c in enumerate(FILLED)}
NBITS = len(FILLED) * 4

FULL = 0
for c in FILLED:
    FULL |= FULLC << BIT[c]

OPTIONAL = 0
for (x, y) in FILLED:
    m = 0
    if y == H - 1:
        m |= N_ | E_ | W_
    if y == 0:
        m |= S_ | E_ | W_
    if x == 0:
        m |= W_ | N_ | S_
    if x == W - 1:
        m |= E_ | N_ | S_
    if m:
        OPTIONAL |= m << BIT[(x, y)]
REQUIRED = FULL & ~OPTIONAL
MAX_UNCOVERED = bin(OPTIONAL).count("1")

DIRV = {"E": (1, 0), "W": (-1, 0), "N": (0, 1), "S": (0, -1)}
QM = {"N": N_, "E": E_, "S": S_, "W": W_}


def ends_of(cells):
    cs = set(cells)
    out = []
    for c in cells:
        nb = [d for d, (dx, dy) in DIRV.items() if (c[0] + dx, c[1] + dy) in cs]
        if len(nb) == 1:
            out.append((c, nb[0]))
    return out


def build(cells, tipcfg, bends="cut"):
    """tipcfg: dict end-cell -> 'square'|'cw'|'ccw'; bends: 'cut'|'full'"""
    cs = set(cells)
    out = {}
    for (x, y) in cs:
        nb = {d for d, (dx, dy) in DIRV.items() if (x + dx, y + dy) in cs}
        horiz = nb & {"E", "W"}
        vert = nb & {"N", "S"}
        if len(nb) == 2 and len(horiz) == 1 and len(vert) == 1 and bends == "cut":
            out[(x, y)] = QM[horiz.pop()] | QM[vert.pop()]
        elif len(nb) == 1 and tipcfg.get((x, y), "square") != "square":
            d = next(iter(nb))
            style = tipcfg[(x, y)]
            side = {"N": E_, "S": W_, "E": S_, "W": N_}[d] if style == "cw" else \
                   {"N": W_, "S": E_, "E": N_, "W": S_}[d]
            out[(x, y)] = QM[d] | side
        else:
            out[(x, y)] = FULLC
    return out


def area(cm):
    return sum(bin(m).count("1") for m in cm.values()) / 4.0


ROT_Q = {N_: E_, E_: S_, S_: W_, W_: N_}
FLIP_Q = {N_: N_, S_: S_, E_: W_, W_: E_}


def qmap(mask, table):
    out = 0
    for q in (N_, E_, S_, W_):
        if mask & q:
            out |= table[q]
    return out


def transform(cm, rot, flip):
    cur = dict(cm)
    if flip:
        cur = {(-x, y): qmap(m, FLIP_Q) for (x, y), m in cur.items()}
    for _ in range(rot):
        cur = {(y, -x): qmap(m, ROT_Q) for (x, y), m in cur.items()}
    mnx = min(x for x, _ in cur)
    mny = min(y for _, y in cur)
    return {(x - mnx, y - mny): m for (x, y), m in cur.items()}


def orientations(cm):
    seen = {}
    for flip in (False, True):
        for rot in range(4):
            t = transform(cm, rot, flip)
            key = tuple(sorted(t.items()))
            if key not in seen:
                seen[key] = (rot, flip, t)
    return list(seen.values())


def placements(cm):
    out = []
    for rot, flip, t in orientations(cm):
        maxx = max(x for x, _ in t)
        maxy = max(y for _, y in t)
        for ox in range(W - maxx):
            for oy in range(H - maxy):
                mask = 0
                ok = True
                for (x, y), m in t.items():
                    c = (x + ox, y + oy)
                    if c in HOLES:
                        ok = False
                        break
                    mask |= m << BIT[c]
                if ok:
                    out.append((mask, rot, flip, ox, oy))
    return out


def parity_vectors(cm):
    out = set()
    for _rot, _flip, t in orientations(cm):
        for px in (0, 1):
            for py in (0, 1):
                qa = qb = qc = qd = 0
                for (x, y), m in t.items():
                    n = bin(m).count("1")
                    cls = ((x + px) % 2, (y + py) % 2)
                    if cls == (0, 0):
                        qa += n
                    elif cls == (0, 1):
                        qb += n
                    elif cls == (1, 0):
                        qc += n
                    else:
                        qd += n
                if qd == 0:
                    out.add((qa, qb, qc))
    return sorted(out)


SK = {
    "8": {"8": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4)]},
    "0": {"0": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2)]},
    "6": {
        "6t1": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3)],
        "6t2": [(0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (0, 4)],
    },
    "9": {
        "9t1": [(0, 1), (1, 1), (2, 1), (0, 2), (2, 2), (0, 3), (1, 3), (2, 3), (2, 0)],
        "9t2": [(0, 2), (1, 2), (2, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4), (2, 1), (2, 0)],
    },
    "2": {
        "2w": [(0, 4), (1, 4), (2, 4), (2, 3), (0, 2), (1, 2), (2, 2), (0, 1), (0, 0), (1, 0), (2, 0)],
    },
    "5": {
        "5w": [(0, 4), (1, 4), (2, 4), (0, 3), (0, 2), (1, 2), (2, 2), (2, 1), (0, 0), (1, 0), (2, 0)],
    },
    "3": {
        "3w": [(0, 4), (1, 4), (2, 4), (2, 3), (0, 2), (1, 2), (2, 2), (2, 1), (0, 0), (1, 0), (2, 0)],
    },
    "7": {
        "7b": [(0, 3), (1, 3), (1, 2), (1, 1), (1, 0)],
        "7c": [(0, 2), (1, 2), (2, 2), (2, 1), (2, 0)],
        "7d": [(0, 3), (1, 3), (2, 3), (2, 2), (2, 1), (2, 0)],
        "7e": [(0, 4), (1, 4), (2, 4), (2, 3), (2, 2), (2, 1), (2, 0)],
    },
    "4": {
        "4b": [(0, 3), (0, 2), (1, 2), (2, 3), (2, 2), (2, 1), (2, 0)],
        "4c": [(0, 3), (0, 2), (1, 2), (2, 4), (2, 3), (2, 2), (2, 1), (2, 0)],
        "4f": [(0, 4), (0, 3), (0, 2), (1, 2), (2, 4), (2, 3), (2, 2), (2, 1), (2, 0)],
    },
    "1": {
        "1a": [(0, 0), (0, 1), (0, 2)],
        "1b": [(0, 0), (0, 1), (0, 2), (0, 3)],
        "1c": [(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)],
        "1d": [(1, 0), (1, 1), (1, 2), (1, 3), (0, 3)],
        "1e": [(1, 0), (1, 1), (1, 2), (0, 2)],
    },
}
DIGITS = list(SK)

# variants: (digit, vid, tipcfg) deduped by cellmap
VAR = {d: [] for d in DIGITS}  # list of dicts {id, cm, area, pv, pl}
for d in DIGITS:
    seen = set()
    for vid, cells in SK[d].items():
        ends = ends_of(cells)
        for bends in ("cut", "full"):
            for combo in itertools.product(["square", "cw", "ccw"], repeat=len(ends)):
                tipcfg = {c: s for (c, _dir), s in zip(ends, combo)}
                cm = build(cells, tipcfg, bends)
                sig = tuple(sorted(cm.items()))
                if sig in seen:
                    continue
                seen.add(sig)
                pv = parity_vectors(cm)
                if not pv:
                    continue
                VAR[d].append({
                    "id": f"{vid}:{bends[0]}:{''.join(s[0] for s in combo) or '-'}",
                    "vid": vid, "tipcfg": tipcfg, "cm": cm, "bends": bends,
                    "area": area(cm), "pv": pv,
                })
print({d: len(v) for d, v in VAR.items()}, file=sys.stderr)

# ---- DP over digits: find variant picks with sum qb=96, qc=100, 4*area>=316-MAX_UNCOVERED
TB, TC = 96, 100
MINQ = 316 - MAX_UNCOVERED


def find_sets(max_sets=12000):
    """Beam DP retaining parent pointers to enumerate feasible variant sets."""
    # state: (qa, qb, qc) -> list of (digit_index, variant_idx, prev_state) (capped)
    states = {(0, 0, 0): [None]}
    for di, d in enumerate(DIGITS):
        new = {}
        for s, _parents in states.items():
            for vi, v in enumerate(VAR[d]):
                for pv in v["pv"]:
                    t = (s[0] + pv[0], s[1] + pv[1], s[2] + pv[2])
                    if t[0] > 120 or t[1] > TB or t[2] > TC:
                        continue
                    new.setdefault(t, []).append((vi, s))
        # cap fan-in to keep memory sane
        for t in new:
            if len(new[t]) > 40:
                new[t] = random.sample(new[t], 40)
        states = new
        print(f"after {d}: {len(states)} states", file=sys.stderr)
        if not states:
            return []

    finals = [s for s in states if 80 <= s[1] <= TB and 80 <= s[2] <= TC and 288 <= sum(s) <= 304]
    finals.sort(key=lambda s: -sum(s))
    print(f"{len(finals)} final parity states", file=sys.stderr)

    # backtrack to concrete variant picks
    sets_ = []

    def back(di, state, acc):
        if len(sets_) >= max_sets:
            return
        if di < 0:
            sets_.append(list(reversed(acc)))
            return
        d = DIGITS[di]
        # regenerate candidates for this state
        # (recompute: which (vi, prev) could lead here)
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

    # need layer states: recompute forward layers
    global layers
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

    for f in finals[:200]:
        back(len(DIGITS) - 1, f, [])
        if len(sets_) >= max_sets:
            break
    return sets_


piece_bit = {d: 1 << i for i, d in enumerate(DIGITS)}
PL_CACHE = {}


def get_pl(d, vi):
    key = (d, vi)
    if key not in PL_CACHE:
        PL_CACHE[key] = placements(VAR[d][vi]["cm"])
    return PL_CACHE[key]


def try_set(pick, limit=150_000):
    by_cover = [[] for _ in range(NBITS)]
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
        need = REQUIRED & ~covered
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
    random.seed(7)
    sets_ = find_sets()
    print(f"{len(sets_)} candidate variant sets", file=sys.stderr)
    # prefer high area (fewer notches), then diversity
    sets_.sort(key=lambda pick: (sum(1 for d, vi in zip(DIGITS, pick) if VAR[d][vi].get("bends") == "full"), -sum(VAR[d][vi]["area"] for d, vi in zip(DIGITS, pick))))

    solved = []
    for i, pick in enumerate(sets_[:3000]):
        res, nodes = try_set(pick)
        if res == "timeout":
            print(f"[{i}] timeout", file=sys.stderr)
            continue
        if res:
            ids = [VAR[d][vi]['id'] for d, vi in zip(DIGITS, pick)]
            tot = sum(VAR[d][vi]["area"] for d, vi in zip(DIGITS, pick))
            print(f"[{i}] SOLVED area={tot} {ids} nodes={nodes}", file=sys.stderr)
            solved.append((pick, res))
            if len(solved) >= 5:
                break

    print(f"solved {len(solved)}", file=sys.stderr)
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
            t = transform(vmap[d]["cm"], rot, flip)
            entry["solution"][d] = {
                "rot": rot, "flip": flip, "ox": ox, "oy": oy,
                "cells": {f"{x + ox},{y + oy}": m for (x, y), m in t.items()},
            }
        out.append(entry)
    with open("solutions7.json", "w") as f:
        json.dump(out, f, indent=1)

    pick, sol = solved[0]
    vmap = {d: VAR[d][vi] for d, vi in zip(DIGITS, pick)}
    sub = [[" " for _ in range(W * 2)] for _ in range(H * 2)]
    for d, rot, flip, ox, oy in sol:
        t = transform(vmap[d]["cm"], rot, flip)
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
    for row in reversed(sub):
        print("".join(row))


if __name__ == "__main__":
    main()
