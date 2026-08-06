"""Rank solve10 hits across seeds by notch area; render top layouts."""

import glob
import json
import sys

import solve7 as S

N_, E_, S_, W_ = 1, 2, 4, 8


def parse(cm):
    return {tuple(int(v) for v in k.split(",")): m for k, m in cm.items()}


def qsum(cm):
    return sum(bin(m).count("1") for m in cm.values())


entries = []
for path in sorted(glob.glob("hits10_*.json")):
    for i, h in enumerate(json.load(open(path))):
        fixed = {d: parse(v["cells"]) for d, v in h["fixed"].items()}
        lo = [parse(cm) for cm in h["leftovers"]]
        covered_q = sum(qsum(cm) for cm in fixed.values()) + sum(qsum(cm) for cm in lo)
        notch_q = 316 - covered_q
        areas = sorted(qsum(cm) / 4.0 for cm in lo)
        # thinness: fraction of leftover cells that are full with 3+ full neighbors (blobby)
        blob = 0
        for cm in lo:
            for (x, y), m in cm.items():
                if m == 15:
                    n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                            if cm.get((x + dx, y + dy), 0) == 15)
                    if n >= 3:
                        blob += 1
        entries.append((notch_q, blob, areas, path, i, h, lo))

entries.sort(key=lambda e: (e[0], e[1]))
print(f"{len(entries)} hits total", file=sys.stderr)


def render_full(h, lo):
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

    for d, v in h["fixed"].items():
        paint(parse(v["cells"]), d)
    for i, cm in enumerate(lo):
        paint(cm, "abc"[i])
    return "\n".join("".join(r) for r in reversed(sub))


def render_piece(cm):
    mnx = min(x for x, y in cm)
    mny = min(y for x, y in cm)
    n = {(x - mnx, y - mny): m for (x, y), m in cm.items()}
    W = max(x for x, y in n) + 1
    H = max(y for x, y in n) + 1
    sub = [[" "] * (W * 2) for _ in range(H * 2)]
    for (x, y), m in n.items():
        if m & N_ and m & W_:
            sub[y * 2 + 1][x * 2] = "#"
        if m & N_ and m & E_:
            sub[y * 2 + 1][x * 2 + 1] = "#"
        if m & S_ and m & W_:
            sub[y * 2][x * 2] = "#"
        if m & S_ and m & E_:
            sub[y * 2][x * 2 + 1] = "#"
    return "\n".join("".join(r) for r in reversed(sub))


TOP = int(sys.argv[1]) if len(sys.argv) > 1 else 8
shown = set()
count = 0
for notch_q, blob, areas, path, i, h, lo in entries:
    sig = tuple(sorted((x, y, m) for cm in lo for (x, y), m in cm.items()))
    if sig in shown:
        continue
    shown.add(sig)
    print(f"=== {path}[{i}] notch_quarters={notch_q} blob={blob} areas={areas}")
    print(render_full(h, lo))
    for cm in lo:
        print("-- leftover:")
        print(render_piece(cm))
    count += 1
    if count >= TOP:
        break
