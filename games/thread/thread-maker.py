#!/usr/bin/env python3
"""색실 잇기 문제 목록 만들기 (node 게임이 아니라 이 스크립트를 직접 돌린다. game.json에 넣지 않음)

    pip install python-sat
    python3 games/thread/thread-maker.py            # 전부 다시 (2코어 약 15분)
    python3 games/thread/thread-maker.py 7w 8x      # 그 갈래만 기존 목록에 덮어쓰기

만드는 방법
1. 판(크기 N, 구멍·다리 칸)을 그래프로 본다. 다리 칸은 가로 층·세로 층 두 마디.
2. 마디마다 길이 1짜리 실에서 시작해, 끝끼리 맞닿은 실 두 개를 무작위로 이어 붙인다(같은 실이 자기 옆을 스치면 안 됨).
   → 판을 빈틈없이 덮는 실 묶음 = 정답.
3. SAT 풀이기로 "정답 말고 다른 답"이 있는지 본다. 다른 답이 있으면
   - 기본 판: 버림
   - 벽(w)·구슬(b) 판: 다른 답만 쓰는 이음매에 벽을 세우거나, 다른 답과 색이 다른 칸에 구슬을 둬서 답을 하나로 만든다(규칙이 꼭 필요한 판).
4. 사람처럼 푸는 간단한 추론기로 어려움 점수를 매기고, 갈래마다 점수 순으로 담는다.

갈래 열쇠 = 크기 + 규칙 글자(h 구멍 · w 벽 · b 구슬 · x 다리). 예: '7', '7w', '8bx'
한 줄 = '판|벽|구슬|다리|점수'
  판: N×N 글자. 대문자 = 단추(실 끝), 소문자 = 실이 지나는 칸(정답 색), '#' = 구멍, '+' = 다리
  벽: 칸 번호 a와 오른쪽(r)/아래(d) 이웃 사이 → 'a' + r|d, 쉼표로
  구슬: 칸 번호 쉼표로(정답 색 칸에 구슬)
  다리: '칸번호:가로색세로색' 쉼표로
  점수: 어려움 0~999 (같은 갈래 안에서만 비교)
"""
import json, os, random, sys, time
from pysat.solvers import Cadical153

ABC = 'abcdefghijklmnopqrstuvwxyz'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thread-bank.js')

# ---------- 판 그래프 ----------
class Board:
    def __init__(self, N, holes=(), bridges=(), walls=()):
        self.N = N
        self.holes = set(holes)
        self.bridges = set(bridges)
        self.walls = set(walls)          # (a, b) a<b 칸 번호
        self.nodes = []                  # (칸, 층)
        self.nid = {}
        for i in range(N * N):
            if i in self.holes:
                continue
            for L in ((0, 1) if i in self.bridges else (0,)):
                self.nid[(i, L)] = len(self.nodes)
                self.nodes.append((i, L))
        self.build()

    def node_at(self, cell, horiz):
        if cell in self.bridges:
            return self.nid[(cell, 0 if horiz else 1)]
        return self.nid.get((cell, 0))

    def build(self):
        N = self.N
        self.adj = [[] for _ in self.nodes]
        self.edges = []
        for i in range(N * N):
            if i in self.holes:
                continue
            r, c = divmod(i, N)
            for j, horiz in ((i + 1, True) if c + 1 < N else (None, None), (i + N, False) if r + 1 < N else (None, None)):
                if j is None or j in self.holes or (i, j) in self.walls:
                    continue
                u, v = self.node_at(i, horiz), self.node_at(j, horiz)
                e = len(self.edges)
                self.edges.append((u, v))
                self.adj[u].append((v, e))
                self.adj[v].append((u, e))


# ---------- 실 묶음 만들기(이어 붙이기) ----------
def make_cover(B, rng, max_len, min_len=3):
    n = len(B.nodes)
    path = {u: [u] for u in range(n)}       # 실 번호(첫 마디) → 마디 목록
    owner = list(range(n))
    nbrs = [set(v for v, _ in B.adj[u]) for u in range(n)]

    def ends(p):
        return (p[0], p[-1]) if len(p) > 1 else (p[0],)

    def touches(p):
        S = set(p)
        pos = {u: k for k, u in enumerate(p)}
        for k, u in enumerate(p):
            for v in nbrs[u]:
                if v in S and abs(pos[v] - k) > 1:
                    return True
        return False

    stall = 0
    while stall < 400:
        ids = list(path.keys())
        # 짧은 실을 먼저 고른다
        ids.sort(key=lambda q: len(path[q]) + rng.random() * 3)
        pid = ids[min(len(ids) - 1, int((rng.random() ** 2) * len(ids)))]
        p = path[pid]
        e = rng.choice(ends(p))
        cand = []
        for v in nbrs[e]:
            q = owner[v]
            if q == pid:
                continue
            qp = path[q]
            if v not in ends(qp):
                continue
            if len(p) + len(qp) > max_len:
                continue
            cand.append(v)
        if not cand:
            stall += 1
            continue
        v = rng.choice(cand)
        q = owner[v]
        a = p if p[-1] == e else p[::-1]
        b = path[q] if path[q][0] == v else path[q][::-1]
        m = a + b
        if touches(m):
            stall += 1
            continue
        stall = 0
        del path[q]
        del path[pid]
        path[m[0]] = m
        for u in m:
            owner[u] = m[0]
    paths = list(path.values())
    if any(len(p) < min_len for p in paths):
        return None
    # 다리: 두 층 모두 실 가운데, 두 층의 실이 서로 달라야
    for cell in B.bridges:
        h, v = B.nid[(cell, 0)], B.nid[(cell, 1)]
        if owner[h] == owner[v]:
            return None
        for u in (h, v):
            p = path[owner[u]]
            if u in (p[0], p[-1]):
                return None
    return paths


# ---------- SAT: 다른 답이 있나 ----------
def solve_alt(B, paths, beads=()):
    """정답(paths)과 다른 답(순환 없는)을 찾으면 (마디 색 목록, 이음매 집합), 없으면 None"""
    K = len(paths)
    n = len(B.nodes)
    col = [0] * n
    endp = {}
    for k, p in enumerate(paths):
        for u in p:
            col[u] = k
        endp[p[0]] = k
        endp[p[-1]] = k
    X = lambda u, k: 1 + u * K + k
    base = n * K
    Evar = lambda e: base + 1 + e
    cl = []
    for u in range(n):
        cl.append([X(u, k) for k in range(K)])
        for a in range(K):
            for b in range(a + 1, K):
                cl.append([-X(u, a), -X(u, b)])
        if u in endp:
            cl.append([X(u, endp[u])])
        es = [Evar(e) for _, e in B.adj[u]]
        need = 1 if u in endp else 2
        # 정확히 need개
        m = len(es)
        from itertools import combinations
        # 최대 need: need+1개 동시에 켜지면 안 됨
        for comb in combinations(es, need + 1):
            cl.append([-x for x in comb])
        # 최소 need: (m-need+1)개 중 하나는 켜져야
        if m < need:
            return 'bad'
        for comb in combinations(es, m - need + 1):
            cl.append(list(comb))
    for u in beads:
        cl.append([X(u, col[u])])
    for e, (u, v) in enumerate(B.edges):
        for k in range(K):
            cl.append([-Evar(e), -X(u, k), X(v, k)])
            cl.append([-Evar(e), -X(v, k), X(u, k)])
    # 다리: 두 층 다른 색
    for cell in B.bridges:
        h, v = B.nid[(cell, 0)], B.nid[(cell, 1)]
        for k in range(K):
            cl.append([-X(h, k), -X(v, k)])
    # 정답 이음매 집합
    sol_edges = set()
    for p in paths:
        for a, b in zip(p, p[1:]):
            for v, e in B.adj[a]:
                if v == b:
                    sol_edges.add(e)
                    break
    cl.append([-Evar(e) for e in sol_edges])      # 정답과 하나라도 달라야
    with Cadical153(bootstrap_with=cl) as S:
        for _ in range(400):
            if not S.solve():
                return None
            mdl = S.get_model()
            on = set(e for e in range(len(B.edges)) if mdl[Evar(e) - 1] > 0)
            # 순환 찾기: 단추에서 출발한 실이 덮지 않은 마디가 있으면 순환
            seen = set()
            g = {u: [] for u in range(n)}
            for e in on:
                a, b = B.edges[e]
                g[a].append((b, e))
                g[b].append((a, e))
            for u in endp:
                if u in seen:
                    continue
                stack = [u]
                while stack:
                    x = stack.pop()
                    if x in seen:
                        continue
                    seen.add(x)
                    stack.extend(y for y, _ in g[x])
            if len(seen) == n:
                acol = [next(k for k in range(K) if mdl[X(u, k) - 1] > 0) for u in range(n)]
                return acol, on
            # 순환 하나 막기
            rest = [u for u in range(n) if u not in seen]
            cyc = set()
            stack = [rest[0]]
            vis = set()
            while stack:
                x = stack.pop()
                if x in vis:
                    continue
                vis.add(x)
                for y, e in g[x]:
                    cyc.add(e)
                    stack.append(y)
            S.add_clause([-Evar(e) for e in cyc])
    return 'slow'


# ---------- 어려움: 사람처럼 푸는 간단한 추론 ----------
def difficulty(B, paths, beads=()):
    n = len(B.nodes)
    K = len(paths)
    endp = {}
    col = [0] * n
    for k, p in enumerate(paths):
        for u in p:
            col[u] = k
        endp[p[0]] = k
        endp[p[-1]] = k
    E = len(B.edges)
    need = [1 if u in endp else 2 for u in range(n)]
    cross = {}
    for cell in B.bridges:
        h, v = B.nid[(cell, 0)], B.nid[(cell, 1)]
        cross[h] = v
        cross[v] = h

    def propagate(st, cs):
        st = st[:]
        cs = [set(x) for x in cs]
        ch = True
        while ch:
            ch = False
            for u in range(n):
                on = [e for _, e in B.adj[u] if st[e] == 1]
                un = [e for _, e in B.adj[u] if st[e] == 0]
                if len(on) > need[u] or len(on) + len(un) < need[u]:
                    return None
                if un and len(on) == need[u]:
                    for e in un:
                        st[e] = -1
                    ch = True
                elif un and len(on) + len(un) == need[u]:
                    for e in un:
                        st[e] = 1
                    ch = True
            for e, (a, b) in enumerate(B.edges):
                if st[e] == -1:
                    continue
                inter = cs[a] & cs[b]
                if not inter:
                    if st[e] == 1:
                        return None
                    st[e] = -1
                    ch = True
                elif st[e] == 1 and (cs[a] != inter or cs[b] != inter):
                    cs[a] = set(inter)
                    cs[b] = set(inter)
                    ch = True
            for u, w in cross.items():
                if len(cs[u]) == 1 and cs[u] & cs[w]:
                    cs[w] -= cs[u]
                    if not cs[w]:
                        return None
                    ch = True
        return st, cs

    st0 = [0] * E
    cs0 = [set([endp[u]]) if u in endp else set(range(K)) for u in range(n)]
    for u in beads:
        cs0[u] = {col[u]}
    r = propagate(st0, cs0)
    st, cs = r
    unk0 = sum(1 for x in st if x == 0) / max(1, E)
    passes = 0
    tries = 0
    while any(x == 0 for x in st) and passes < 30:
        passes += 1
        progress = False
        for e in range(E):
            if st[e] != 0:
                continue
            for val in (1, -1):
                t = st[:]
                t[e] = val
                tries += 1
                if propagate(t, cs) is None:
                    t2 = st[:]
                    t2[e] = -val
                    r2 = propagate(t2, cs)
                    if r2 is None:
                        break
                    st, cs = r2
                    progress = True
                    break
            if progress:
                break
        if not progress:
            break
    left = sum(1 for x in st if x == 0) / max(1, E)
    avg = n / K
    score = int(min(999, 300 * unk0 + 22 * passes + 500 * left + 6 * avg))
    return score


# ---------- 갈래 하나 만들기 ----------
def encode(B, paths, beads, walls):
    N = B.N
    grid = ['#'] * (N * N)
    br = {}
    for k, p in enumerate(paths):
        for idx, u in enumerate(p):
            cell, L = B.nodes[u]
            if cell in B.bridges:
                br.setdefault(cell, ['', ''])[L] = ABC[k]
                grid[cell] = '+'
            else:
                grid[cell] = ABC[k].upper() if idx in (0, len(p) - 1) else ABC[k]
    ws = ','.join(f"{a}{'r' if b == a + 1 else 'd'}" for a, b in sorted(walls))
    bs = ','.join(str(B.nodes[u][0]) for u in sorted(beads))
    xs = ','.join(f"{c}:{v[0]}{v[1]}" for c, v in sorted(br.items()))
    return ''.join(grid), ws, bs, xs


def pick_holes(N, rng):
    cnt = rng.choice([2, 3, 3, 4]) if N <= 7 else rng.choice([3, 4, 4, 5, 6])
    holes = set()
    while len(holes) < cnt:
        if holes and rng.random() < .55:
            h = rng.choice(sorted(holes))
            r, c = divmod(h, N)
            dr, dc = rng.choice(((0, 1), (1, 0), (0, -1), (-1, 0)))
            if 0 <= r + dr < N and 0 <= c + dc < N:
                holes.add((r + dr) * N + c + dc)
        else:
            holes.add(rng.randrange(N * N))
    return holes


def pick_bridges(N, rng, holes):
    cnt = 1 if N <= 6 else rng.choice([1, 2, 2]) if N <= 8 else rng.choice([2, 2, 3])
    out = set()
    tries = 0
    while len(out) < cnt and tries < 200:
        tries += 1
        r, c = rng.randrange(1, N - 1), rng.randrange(1, N - 1)
        i = r * N + c
        if i in holes or i in out:
            continue
        nb = [i - 1, i + 1, i - N, i + N]
        if any(x in holes or x in out for x in nb):
            continue
        out.add(i)
    return out


def colors_ok(N, K):
    lo = {5: 4, 6: 5, 7: 6, 8: 7, 9: 8}[N]
    hi = {5: 6, 6: 7, 7: 9, 8: 11, 9: 12}[N]
    return lo <= K <= hi


def make_one(N, flags, rng):
    holes = pick_holes(N, rng) if 'h' in flags else set()
    bridges = pick_bridges(N, rng, holes) if 'x' in flags else set()
    B = Board(N, holes, bridges)
    rule_kill = 'w' in flags or 'b' in flags
    cells = N * N - len(holes)
    # 벽·구슬 판은 실을 길게(답이 여러 개인 판에서 시작해 규칙으로 하나로)
    max_len = (cells // (6 if N <= 6 else 7)) + (6 if rule_kill else 3)
    paths = make_cover(B, rng, max_len)
    if not paths:
        return None
    K = len(paths)
    if not colors_ok(N, K) and not (rule_kill and K >= 3 and K <= {5: 6, 6: 7, 7: 9, 8: 11, 9: 12}[N]):
        return None
    beads = set()
    walls = set()
    for step in range(14):
        r = solve_alt(B, paths, beads)
        if r in ('bad', 'slow'):
            return None
        if r is None:
            break
        if not rule_kill:
            return None
        acol, aon = r
        # 둘 중 하나: 벽(정답이 안 쓰는 이음매) / 구슬(색이 다른 칸)
        use_wall = 'w' in flags and ('b' not in flags or rng.random() < .5)
        if use_wall:
            sol_e = set()
            for p in paths:
                for a, b in zip(p, p[1:]):
                    for v, e in B.adj[a]:
                        if v == b:
                            sol_e.add(e)
            cand = [e for e in aon if e not in sol_e and B.nodes[B.edges[e][0]][0] not in B.bridges and B.nodes[B.edges[e][1]][0] not in B.bridges]
            if not cand:
                return None
            e = rng.choice(cand)
            a, b = B.nodes[B.edges[e][0]][0], B.nodes[B.edges[e][1]][0]
            walls.add((min(a, b), max(a, b)))
            B = Board(N, holes, bridges, walls)
            # 마디 번호는 그대로(벽은 이음매만 바꿈)
        else:
            col = {}
            for k, p in enumerate(paths):
                for idx, u in enumerate(p):
                    if 0 < idx < len(p) - 1:
                        col[u] = k
            cand = [u for u, k in col.items() if acol[u] != k and B.nodes[u][0] not in B.bridges and u not in beads]
            if not cand:
                return None
            beads.add(rng.choice(cand))
    else:
        return None
    if 'w' in flags and not walls:
        return None
    if 'b' in flags and not beads:
        return None
    if len(walls) > N + 1 or len(beads) > 5:
        return None
    sc = difficulty(B, paths, beads)
    return encode(B, paths, beads, walls) + (sc,)


PLAN = {}
for N, cnt in ((5, 50), (6, 90), (7, 90), (8, 80), (9, 50)):
    PLAN[str(N)] = cnt
for f in ('h', 'w', 'b', 'x', 'bh', 'bw', 'bx', 'hw', 'hx', 'wx'):   # 규칙 글자는 abc 순(게임이 같은 순서로 찾음)
    for N, cnt in ((6, 24), (7, 24), (8, 22), (9, 12)):
        PLAN[f'{N}{f}'] = cnt


def run(key, seed):
    N = int(key[0])
    flags = key[1:]
    rng = random.Random(seed)
    want = PLAN[key]
    got = {}
    t0 = time.time()
    tries = 0
    while len(got) < want * 3 and time.time() - t0 < (160 if N >= 8 else 100):
        tries += 1
        r = make_one(N, flags, rng)
        if r and r[0] not in got:
            got[r[0]] = r
    items = sorted(got.values(), key=lambda x: x[4])
    # 점수 고르게: 정렬된 목록에서 같은 간격으로 want개
    if len(items) > want:
        items = [items[round(i * (len(items) - 1) / (want - 1))] for i in range(want)]
    lines = ['|'.join(map(str, x)) for x in items]
    print(f'{key}: {len(lines)}개 (시도 {tries}, {time.time() - t0:.0f}초)', file=sys.stderr)
    return key, lines


def load_old():
    if not os.path.exists(OUT):
        return {}
    s = open(OUT, encoding='utf-8').read()
    j = s[s.index('{'): s.rindex('}') + 1]
    return json.loads(j)


def save(bank):
    keys = sorted(bank, key=lambda k: (int(k[0]), len(k), k))
    body = ',\n'.join(f'  {json.dumps(k)}:{json.dumps(bank[k], ensure_ascii=False)}' for k in keys)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* 색실 잇기 문제 목록 — thread-maker.py가 만든 파일(손으로 고치지 않기). 한 줄 = 판|벽|구슬|다리|점수 */\n')
        f.write('const THREAD_BANK = {\n' + body + '\n};\n')


if __name__ == '__main__':
    from multiprocessing import Pool
    keys = sys.argv[1:] or list(PLAN.keys())
    bank = load_old()
    with Pool(int(os.environ.get('JOBS', os.cpu_count() or 2))) as pool:
        for k, lines in pool.starmap(run, [(k, 1000 + i * 7919) for i, k in enumerate(keys)]):
            bank[k] = lines
            save(bank)
