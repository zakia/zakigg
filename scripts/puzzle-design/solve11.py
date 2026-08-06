"""Exhaustive backtracking: place 7 fixed digits so the leftover splits into
exactly 3 connected regions (the future 1, 4, 7). Prunes on fragment size."""

import json
import random
import sys
from collections import deque

import solve7 as S

N_, E_, S_, W_ = 1, 2, 4, 8

import os
ORDER = os.environ.get("SNUG_ORDER", "8,3,2,5,9,6,0").split(",")
AREAS = {"8": 11, "3": 8.5, "2": 8, "5": 8, "9": 7.5, "6": 7.5, "0": 6, "7": 4.5, "4": 6, "1": 2.5}
MIN_FRAG = 2.0
MAX_FRAG = 10.0


def digit_placements(d):
    """all placements over all cut-bend variants of digit d (dedup by mask)."""
    seen = set()
    out = []
    for vi, v in enumerate(S.VAR[d]):
        if v.get("bends", "cut") != "cut":
            continue
        for p in S.get_pl(d, vi):
            if p[0] in seen:
                continue
            seen.add(p[0])
            out.append((vi,) + p)
    return out


PLACES = {d: digit_placements(d) for d in ORDER}
print({d: len(v) for d, v in PLACES.items()}, file=sys.stderr)


def components(covered):
    """uncovered-material components (incl. optional rim quarters)."""
    need = S.FULL & ~covered
    quarters = {}
    for c in S.FILLED:
        m = (need >> S.BIT[c]) & 15
        if m:
            quarters[c] = m
    seen = set()
    comps = []
    cyc = {N_: (E_, W_), E_: (N_, S_), S_: (E_, W_), W_: (N_, S_)}
    for c0, m0 in quarters.items():
        for q0 in (N_, E_, S_, W_):
            if not (m0 & q0) or (c0, q0) in seen:
                continue
            comp = {}
            dq = deque([(c0, q0)])
            seen.add((c0, q0))
            while dq:
                (c, q) = dq.popleft()
                comp[c] = comp.get(c, 0) | q
                x, y = c
                nbrs = [((x, y), q2) for q2 in cyc[q]]
                across = {N_: ((x, y + 1), S_), S_: ((x, y - 1), N_),
                          E_: ((x + 1, y), W_), W_: ((x - 1, y), E_)}
                nbrs.append(across[q])
                for (nc, nq) in nbrs:
                    if (nc, nq) in seen:
                        continue
                    if nc in quarters and quarters[nc] & nq:
                        seen.add((nc, nq))
                        dq.append((nc, nq))
            comps.append(comp)
    return comps


def comp_area(cm):
    return sum(bin(m).count("1") for m in cm.values()) / 4.0


def comp_req_area(cm):
    """area of the component's REQUIRED quarters only."""
    total = 0
    for (x, y), m in cm.items():
        req = (S.REQUIRED >> S.BIT[(x, y)]) & 15
        total += bin(m & req).count("1")
    return total / 4.0


hits = []
seen_sigs = set()
nodes = 0
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 3_000_000
MAX_HITS = 120


def dfs(idx, covered, chosen, rng):
    global nodes
    nodes += 1
    if nodes > LIMIT:
        raise TimeoutError
    if idx == len(ORDER):
        comps = [c for c in components(covered) if comp_req_area(c) > 0]
        if len(comps) != 10 - len(ORDER):
            return
        areas = sorted(comp_req_area(c) for c in comps)
        if not (MIN_FRAG <= areas[0] <= 4.5 and all(a <= 9.5 for a in areas[1:])):
            return
        # reject fat blobs: any 2x2 all-full block inside a leftover
        for c in comps:
            for (x, y) in c:
                if all(c.get((x + dx, y + dy), 0) == 15 for dx in (0, 1) for dy in (0, 1)):
                    return
        sig = tuple(sorted((x, y, m) for c in comps for (x, y), m in c.items()))
        if sig in seen_sigs:
            return
        seen_sigs.add(sig)
        hits.append((list(chosen), comps))
        print(f"HIT #{len(hits)} areas={areas} nodes={nodes}", file=sys.stderr)
        return
    d = ORDER[idx]
    remaining_fixed_min = min((AREAS[o] for o in ORDER[idx:]), default=99)
    cands = PLACES[d][:]
    rng.shuffle(cands)
    for cand in cands:
        vi, mask, rot, flip, ox, oy = cand
        if mask & covered:
            continue
        cov2 = covered | mask
        comps = [c for c in components(cov2) if comp_req_area(c) > 0]
        small = [c for c in comps if comp_req_area(c) < remaining_fixed_min]
        if len(small) > 3:
            continue
        if any(comp_req_area(c) < MIN_FRAG for c in small):
            continue
        if any(comp_req_area(c) > MAX_FRAG for c in small):
            continue
        # each small fragment must be a plausible wildcard chunk; large ones must
        # be able to host remaining fixed pieces + up to 3 wildcards total
        chosen.append((d, vi, rot, flip, ox, oy))
        dfs(idx + 1, cov2, chosen, rng)
        chosen.pop()
        if len(hits) >= MAX_HITS:
            return


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    rng = random.Random(seed)
    try:
        dfs(0, 0, [], rng)
    except TimeoutError:
        pass
    print(f"nodes={nodes} hits={len(hits)}", file=sys.stderr)
    out = []
    for chosen, comps in hits:
        entry = {"fixed": {}, "leftovers": []}
        for (d, vi, rot, flip, ox, oy) in chosen:
            t = S.transform(S.VAR[d][vi]["cm"], rot, flip)
            entry["fixed"][d] = {
                "rot": rot, "flip": flip, "ox": ox, "oy": oy, "vid": S.VAR[d][vi]["id"],
                "cells": {f"{x + ox},{y + oy}": m for (x, y), m in t.items()},
            }
        for cm in comps:
            entry["leftovers"].append({f"{x},{y}": m for (x, y), m in cm.items()})
        out.append(entry)
    with open(f"hits10_{os.environ.get('SNUG_TAG', 'x')}_{seed}.json", "w") as f:
        json.dump(out, f)

    # render
    for chosen, comps in hits[:6]:
        sub = [["·" for _ in range(S.W * 2)] for _ in range(S.H * 2)]

        def paint(cellmap, ch):
            for (x, y), m in cellmap.items():
                if m & N_ and m & W_:
                    sub[y * 2 + 1][x * 2] = ch
                if m & N_ and m & E_:
                    sub[y * 2 + 1][x * 2 + 1] = ch
                if m & S_ and m & W_:
                    sub[y * 2][x * 2] = ch
                if m & S_ and m & E_:
                    sub[y * 2][x * 2 + 1] = ch

        for (d, vi, rot, flip, ox, oy) in chosen:
            t = S.transform(S.VAR[d][vi]["cm"], rot, flip)
            paint({(x + ox, y + oy): m for (x, y), m in t.items()}, d)
        for i, cm in enumerate(comps):
            paint(cm, "abc"[i])
        print("\n".join("".join(r) for r in reversed(sub)))
        print("=" * 44)


if __name__ == "__main__":
    main()
