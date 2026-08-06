"""Multi-variant exact cover: one search, digit variants chosen dynamically.

by_cover holds placements of EVERY allowed variant of every digit; the search
branches on the lowest uncovered required quarter-bit, using each digit once.
"""

import json
import random
import sys

import solve7 as S7
import solve12 as C

N_, E_, S_, W_ = 1, 2, 4, 8

DIGITS = ["8", "0", "6", "9", "2", "5", "3", "4", "7", "1"]
piece_bit = {d: 1 << i for i, d in enumerate(DIGITS)}

ALLOWED_PREFIX = {
    "0": ("0C",),
    "6": ("6h", "6s"),
    "9": ("9h", "9s"),
    "1": ("1d",),
    "7": ("7d", "7s"),
    "4": ("4y", "4L", "4b", "4c"),
}


def allowed_variants(d):
    out = []
    for vi, v in enumerate(C.VAR[d]):
        pref = ALLOWED_PREFIX.get(d)
        if pref and not v["id"].startswith(pref):
            continue
        out.append(vi)
    return out


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20_000_000
    max_sols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    rng = random.Random(seed)

    by_cover = [[] for _ in range(S7.NBITS)]
    nplace = 0
    for d in DIGITS:
        for vi in allowed_variants(d):
            for mask, rot, flip, ox, oy in C.get_pl(d, vi):
                nplace += 1
                m = mask
                while m:
                    b = (m & -m).bit_length() - 1
                    by_cover[b].append((d, vi, mask, rot, flip, ox, oy))
                    m &= m - 1
    for lst in by_cover:
        rng.shuffle(lst)
    print(f"{nplace} placements indexed", file=sys.stderr)

    # area-bound pruning: quarters each unused digit can still contribute
    qmin = {}
    qmax = {}
    for d in DIGITS:
        areas = [C.VAR[d][vi]["area"] for vi in allowed_variants(d)]
        qmin[d] = int(min(areas) * 4)
        qmax[d] = int(max(areas) * 4)

    solutions = []
    solution = []
    nodes = 0

    def solve(covered, used):
        nonlocal nodes
        nodes += 1
        if nodes > limit:
            raise TimeoutError
        need = S7.REQUIRED & ~covered
        rem = bin(need).count("1")
        lo = hi = 0
        for d in DIGITS:
            if not (used & piece_bit[d]):
                lo += qmin[d]
                hi += qmax[d]
        # unused pieces must cover all required bits; anything beyond that can
        # only land on still-uncovered optional rim bits
        if hi < rem or lo > rem + bin(S7.OPTIONAL & ~covered).count("1"):
            return False
        if need == 0:
            if used == (1 << len(DIGITS)) - 1:
                solutions.append(list(solution))
                print(f"SOLVED #{len(solutions)} nodes={nodes}", file=sys.stderr)
                return len(solutions) >= max_sols
            return False  # covered but pieces left over -> impossible area-wise
        b = (need & -need).bit_length() - 1
        for d, vi, mask, rot, flip, ox, oy in by_cover[b]:
            if used & piece_bit[d] or mask & covered:
                continue
            solution.append((d, vi, rot, flip, ox, oy))
            if solve(covered | mask, used | piece_bit[d]):
                return True
            solution.pop()
        return False

    try:
        solve(0, 0)
    except TimeoutError:
        pass
    print(f"nodes={nodes} solutions={len(solutions)}", file=sys.stderr)

    out = []
    for sol in solutions:
        entry = {"variants": {}, "cells": {}, "solution": {}}
        for d, vi, rot, flip, ox, oy in sol:
            v = C.VAR[d][vi]
            entry["variants"][d] = v["id"]
            entry["cells"][d] = {f"{x},{y}": m for (x, y), m in v["cm"].items()}
            t = S7.transform(v["cm"], rot, flip)
            entry["solution"][d] = {
                "rot": rot, "flip": flip, "ox": ox, "oy": oy,
                "cells": {f"{x + ox},{y + oy}": m for (x, y), m in t.items()},
            }
        out.append(entry)
    with open(f"solutions15_{seed}.json", "w") as f:
        json.dump(out, f, indent=1)

    for sol in solutions[:3]:
        sub = [["·" for _ in range(S7.W * 2)] for _ in range(S7.H * 2)]
        for d, vi, rot, flip, ox, oy in sol:
            t = S7.transform(C.VAR[d][vi]["cm"], rot, flip)
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
