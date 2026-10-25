// 하루퍼즐 리그 대전 서버 (Railway Function, Bun)
// 방(room)마다 접속자 목록과 각자의 presence(작은 JSON)를 모두에게 알려 주는 중계 서버.
// 게임 규칙은 브라우저가 처리하고, 서버는 "누가 어느 방에 있고 무엇을 올렸는지"만 전달한다.
//
// 브라우저 → 서버: {t:'join', r} / {t:'leave', r} / {t:'p', r, p:{...부분 갱신}} / {t:'ping'}
// 서버 → 브라우저: {t:'hello', you, now, f} / {t:'peers', r, you, peers:[{peer, presence}], joined:[], left:[]} / {t:'pong', now}
//
// 2026-10-25 동시접속 10만 대비(더하기만 함 — 예전 클라이언트는 그대로 동작):
//  · 짝짓기 대기열 q: {t:'q', q, p} 줄 서기 / {t:'uq', q} 빠지기 → 서버가 같은 줄의 두 사람을 짝지어 {t:'match', q, r, seat, opp:{peer, p}}.
//    대기실 방(모두에게 모두의 정보를 뿌림, 사람 수의 제곱만큼 메시지)을 쓰지 않아도 상대를 찾는다. {t:'qok', q, n} = 지금 줄 길이.
//  · 방 메시지 m: {t:'m', r, d} → 같은 대전 방(fl-*)의 다른 사람에게만 {t:'m', r, from, d}. 수 하나만 보내기(전체 기록 다시 보내기 대신).
//  · hello의 f = 지원 기능 목록 ['q','m'].

type Data = { id: string; rooms: Map<string, Record<string, unknown>>; qs?: Set<string> };
type WS = import("bun").ServerWebSocket<Data>;

const rooms = new Map<string, Set<WS>>();
const lastSent = new Map<string, string[]>(); // 방별 직전 접속자 id 목록 (joined/left 계산용)
const pending = new Map<string, ReturnType<typeof setTimeout>>();

const MAX_ROOM_NAME = 64;
const MAX_PRESENCE = 8 * 1024;
const MAX_ROOMS_PER_CONN = 4;
const MAX_ROOM_SIZE = 500;
const ALLOWED_ORIGINS = (Bun.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const MAX_Q_NAME = 64, MAX_Q_INFO = 512, MAX_MSG = 4 * 1024, MAX_Q_LEN = 100000;
type QE = { ws: WS; p: Record<string, unknown>; at: number };
const queues = new Map<string, QE[]>();
function unqueue(ws: WS, q?: string) {
  const keys = q ? [q] : [...(ws.data.qs || [])];
  for (const k of keys) {
    const L = queues.get(k); if (L) { const i = L.findIndex(e => e.ws === ws); if (i >= 0) L.splice(i, 1); if (!L.length) queues.delete(k); }
    ws.data.qs?.delete(k);
  }
}
function enqueue(ws: WS, q: string, p: Record<string, unknown>) {
  unqueue(ws, q);
  let L = queues.get(q); if (!L) { L = []; queues.set(q, L); }
  const opp = L.find(e => e.ws !== ws && e.ws.readyState === 1);
  if (opp) {
    unqueue(opp.ws, q);
    const r = "fl-q-" + rid();
    opp.ws.send(JSON.stringify({ t: "match", q, r, seat: 0, opp: { peer: ws.data.id, p } }));
    ws.send(JSON.stringify({ t: "match", q, r, seat: 1, opp: { peer: opp.ws.data.id, p: opp.p } }));
    return;
  }
  if (L.length >= MAX_Q_LEN) { ws.send(JSON.stringify({ t: "err", q, e: "queue full" })); return; }
  L.push({ ws, p, at: Date.now() }); (ws.data.qs ||= new Set()).add(q);
  ws.send(JSON.stringify({ t: "qok", q, n: L.length }));
}
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

function snapshot(r: string) {
  const set = rooms.get(r);
  if (!set) return [];
  return [...set].map(ws => ({ peer: ws.data.id, presence: ws.data.rooms.get(r) || {} }));
}

function flush(r: string) {
  pending.delete(r);
  const set = rooms.get(r);
  const peers = snapshot(r);
  const ids = peers.map(p => p.peer);
  const prev = lastSent.get(r) || [];
  const joined = ids.filter(x => !prev.includes(x)).map(peer => ({ peer }));
  const left = prev.filter(x => !ids.includes(x)).map(peer => ({ peer }));
  if (!set || set.size === 0) { rooms.delete(r); lastSent.delete(r); return; }
  lastSent.set(r, ids);
  for (const ws of set) {
    ws.send(JSON.stringify({ t: "peers", r, you: ws.data.id, peers, joined, left }));
  }
}

// 여러 변화가 몰리면 한 번에 묶어서 보낸다(대기실이 붐빌 때 대비).
function schedule(r: string, now = false) {
  if (now) { const t = pending.get(r); if (t) clearTimeout(t); flush(r); return; }
  if (pending.has(r)) return;
  pending.set(r, setTimeout(() => flush(r), 60));
}

function leave(ws: WS, r: string) {
  if (!ws.data.rooms.has(r)) return;
  ws.data.rooms.delete(r);
  const set = rooms.get(r);
  if (set) { set.delete(ws); schedule(r, true); }
}

const server = Bun.serve<Data>({
  port: Number(Bun.env.PORT || 3000),
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const origin = req.headers.get("origin") || "";
      if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) return new Response("forbidden", { status: 403 });
      if (srv.upgrade(req, { data: { id: rid(), rooms: new Map() } })) return;
      return new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/stats") {
      const byRoom: Record<string, number> = {};
      for (const [r, s] of rooms) { const k = r.startsWith("fl-") ? "matches" : r; byRoom[k] = (byRoom[k] || 0) + s.size; }
      const q: Record<string, number> = {}; for (const [k, L] of queues) q[k] = L.length;
      return Response.json({ ok: true, rooms: rooms.size, byRoom, queues: q }, { headers: { "access-control-allow-origin": "*" } });
    }
    return new Response("haru-puzzle battle server ok", { headers: { "access-control-allow-origin": "*" } });
  },
  websocket: {
    idleTimeout: 60,
    maxPayloadLength: 16 * 1024,
    open(ws) { ws.send(JSON.stringify({ t: "hello", you: ws.data.id, now: Date.now(), f: ["q", "m"] })); },
    message(ws, raw) {
      let m: any;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m !== "object") return;
      if (m.t === "ping") { ws.send(JSON.stringify({ t: "pong", now: Date.now() })); return; }
      if (m.t === "q" || m.t === "uq") {
        const q = typeof m.q === "string" ? m.q.slice(0, MAX_Q_NAME) : ""; if (!q) return;
        if (m.t === "uq") { unqueue(ws, q); return; }
        const p = m.p && typeof m.p === "object" ? m.p : {};
        if (JSON.stringify(p).length > MAX_Q_INFO) { ws.send(JSON.stringify({ t: "err", q, e: "info too large" })); return; }
        enqueue(ws, q, p); return;
      }
      const r = typeof m.r === "string" ? m.r.slice(0, MAX_ROOM_NAME) : "";
      if (!r) return;
      if (m.t === "join") {
        if (ws.data.rooms.has(r)) { schedule(r, true); return; }
        if (ws.data.rooms.size >= MAX_ROOMS_PER_CONN) { ws.send(JSON.stringify({ t: "err", r, e: "too many rooms" })); return; }
        let set = rooms.get(r);
        if (!set) { set = new Set(); rooms.set(r, set); }
        if (set.size >= MAX_ROOM_SIZE) { ws.send(JSON.stringify({ t: "err", r, e: "room full" })); return; }
        set.add(ws); ws.data.rooms.set(r, {});
        schedule(r, true);
      } else if (m.t === "leave") {
        leave(ws, r);
      } else if (m.t === "m") {
        if (!r.startsWith("fl-") || !ws.data.rooms.has(r)) return;
        const out = JSON.stringify({ t: "m", r, from: ws.data.id, d: m.d });
        if (out.length > MAX_MSG) { ws.send(JSON.stringify({ t: "err", r, e: "message too large" })); return; }
        for (const o of rooms.get(r) || []) if (o !== ws) o.send(out);
      } else if (m.t === "p") {
        const cur = ws.data.rooms.get(r);
        if (!cur || !m.p || typeof m.p !== "object") return;
        const next = { ...cur, ...m.p };
        if (JSON.stringify(next).length > MAX_PRESENCE) { ws.send(JSON.stringify({ t: "err", r, e: "presence too large" })); return; }
        ws.data.rooms.set(r, next);
        // 대전 방(2명)은 바로, 대기실은 묶어서
        schedule(r, r.startsWith("fl-"));
      }
    },
    close(ws) { unqueue(ws); for (const r of [...ws.data.rooms.keys()]) leave(ws, r); },
  },
});

console.log(`battle server listening on ${server.port}`);
