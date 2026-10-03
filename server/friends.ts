// 하루퍼즐 리그 친구 서버 (Railway Function "friends", Bun)
// 친구 코드로 친구 맺기·끊기, 친구 오늘 점수, 하트·"같이 하자"·도전장 알림함.
// 저장: DATABASE_URL(Postgres)이 있으면 Postgres, 없으면 메모리(로컬 시험용 — 껐다 켜면 사라짐).
// 대전 서버(server/index.ts)와는 완전히 따로 돈다. 대전에는 영향 없음.
//
// 모든 요청: POST /api/<이름>, 본문 JSON. 로그인 대신 기기마다 받은 pid + secret(비밀 열쇠)로 본인 확인.
//   register {nick}                         → {pid, secret, code, nick}
//   me       {pid, secret, day, nick?}      → {me:{code,nick}, friends:[{fid,nick,code,score,detail,streak,seen,since}], inbox:[…]}
//   add      {pid, secret, code}            → {friend}   (서로 친구가 됨, 상대 알림함에 "친구가 됐어요")
//   remove   {pid, secret, fid}             → {ok}       (양쪽 모두에서 지움)
//   score    {pid, secret, day, total, detail, streak} → {ok}
//   send     {pid, secret, fid, kind:'heart'|'play'|'challenge', data} → {ok}
//   ack      {pid, secret, ids:[…]}         → {ok}

import { SQL } from "bun";

const MAX_FRIENDS = 200, MAX_NICK = 12, MAX_DATA = 1024;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const now = () => Date.now();
const cleanNick = (v: unknown) => String(v ?? "").replace(/[<>&"'`\\\n\r\t]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NICK) || "퍼즐 친구";
const okDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
const rnd = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const newCode = () => [...rnd(6)].map(b => CODE_CHARS[b % CODE_CHARS.length]).join("");
const newId = () => crypto.randomUUID().replace(/-/g, "");
const newSecret = () => [...rnd(24)].map(b => b.toString(16).padStart(2, "0")).join("");

type Player = { pid: string; secret: string; code: string; nick: string; created: number; seen: number };
type Msg = { id: number; to_pid: string; from_pid: string; kind: string; data: any; created: number; done: boolean };

interface Store {
  init(): Promise<void>;
  player(pid: string): Promise<Player | null>;
  byCode(code: string): Promise<Player | null>;
  insertPlayer(p: Player): Promise<boolean>;
  touch(pid: string, nick?: string): Promise<void>;
  friends(pid: string): Promise<{ fid: string; since: number }[]>;
  isFriend(a: string, b: string): Promise<boolean>;
  link(a: string, b: string): Promise<void>;
  unlink(a: string, b: string): Promise<void>;
  scores(pids: string[], day: string): Promise<Map<string, { total: number; detail: any; streak: number }>>;
  putScore(pid: string, day: string, total: number, detail: any, streak: number): Promise<void>;
  push(to: string, from: string, kind: string, data: any): Promise<void>;
  inbox(pid: string): Promise<Msg[]>;
  ack(pid: string, ids: number[]): Promise<void>;
  sentSince(from: string, since: number, kind?: string, to?: string): Promise<number>;
}

class MemStore implements Store {
  P = new Map<string, Player>(); F = new Map<string, Map<string, number>>(); S = new Map<string, any>(); M: Msg[] = []; seq = 1;
  async init() { console.warn("DATABASE_URL 없음 → 메모리 저장(시험용)"); }
  async player(pid: string) { return this.P.get(pid) || null; }
  async byCode(code: string) { for (const p of this.P.values()) if (p.code === code) return p; return null; }
  async insertPlayer(p: Player) { if (await this.byCode(p.code)) return false; this.P.set(p.pid, p); return true; }
  async touch(pid: string, nick?: string) { const p = this.P.get(pid); if (p) { p.seen = now(); if (nick) p.nick = nick; } }
  async friends(pid: string) { return [...(this.F.get(pid) || new Map()).entries()].map(([fid, since]) => ({ fid, since })); }
  async isFriend(a: string, b: string) { return !!this.F.get(a)?.has(b); }
  async link(a: string, b: string) { const t = now(); for (const [x, y] of [[a, b], [b, a]]) { if (!this.F.has(x)) this.F.set(x, new Map()); if (!this.F.get(x)!.has(y)) this.F.get(x)!.set(y, t); } }
  async unlink(a: string, b: string) { this.F.get(a)?.delete(b); this.F.get(b)?.delete(a); }
  async scores(pids: string[], day: string) { const m = new Map(); for (const p of pids) { const v = this.S.get(p + "|" + day); if (v) m.set(p, v); } return m; }
  async putScore(pid: string, day: string, total: number, detail: any, streak: number) { this.S.set(pid + "|" + day, { total, detail, streak }); }
  async push(to: string, from: string, kind: string, data: any) { this.M.push({ id: this.seq++, to_pid: to, from_pid: from, kind, data, created: now(), done: false }); if (this.M.length > 20000) this.M.splice(0, 5000); }
  async inbox(pid: string) { return this.M.filter(m => m.to_pid === pid && !m.done).slice(-50); }
  async ack(pid: string, ids: number[]) { for (const m of this.M) if (m.to_pid === pid && ids.includes(m.id)) m.done = true; }
  async sentSince(from: string, since: number, kind?: string, to?: string) { return this.M.filter(m => m.from_pid === from && m.created >= since && (!kind || m.kind === kind) && (!to || m.to_pid === to)).length; }
}

class PgStore implements Store {
  db: any;
  constructor(url: string) { this.db = new SQL(url); }
  async init() {
    const db = this.db;
    await db`create table if not exists players(pid text primary key, secret text not null, code text unique not null, nick text not null, created bigint not null, seen bigint not null)`;
    await db`create table if not exists friends(a text not null, b text not null, created bigint not null, primary key(a, b))`;
    await db`create table if not exists scores(pid text not null, day text not null, total int not null, detail jsonb, streak int not null default 0, updated bigint not null, primary key(pid, day))`;
    await db`create table if not exists inbox(id bigserial primary key, to_pid text not null, from_pid text not null, kind text not null, data jsonb, created bigint not null, done boolean not null default false)`;
    await db`create index if not exists inbox_to on inbox(to_pid, done)`;
    await db`create index if not exists inbox_from on inbox(from_pid, created)`;
  }
  async player(pid: string) { const r = await this.db`select * from players where pid = ${pid}`; return r[0] ? { ...r[0], created: Number(r[0].created), seen: Number(r[0].seen) } : null; }
  async byCode(code: string) { const r = await this.db`select * from players where code = ${code}`; return r[0] || null; }
  async insertPlayer(p: Player) { try { await this.db`insert into players ${this.db(p)}`; return true; } catch { return false; } }
  async touch(pid: string, nick?: string) { if (nick) await this.db`update players set seen = ${now()}, nick = ${nick} where pid = ${pid}`; else await this.db`update players set seen = ${now()} where pid = ${pid}`; }
  async friends(pid: string) { const r = await this.db`select b as fid, created as since from friends where a = ${pid} order by created`; return r.map((x: any) => ({ fid: x.fid, since: Number(x.since) })); }
  async isFriend(a: string, b: string) { const r = await this.db`select 1 from friends where a = ${a} and b = ${b}`; return r.length > 0; }
  async link(a: string, b: string) { const t = now(); await this.db`insert into friends(a, b, created) values (${a}, ${b}, ${t}), (${b}, ${a}, ${t}) on conflict do nothing`; }
  async unlink(a: string, b: string) { await this.db`delete from friends where (a = ${a} and b = ${b}) or (a = ${b} and b = ${a})`; }
  async scores(pids: string[], day: string) {
    const m = new Map(); if (!pids.length) return m;
    const r = await this.db`select pid, total, detail, streak from scores where day = ${day} and pid in ${this.db(pids)}`;
    for (const x of r) m.set(x.pid, { total: x.total, detail: x.detail, streak: x.streak }); return m;
  }
  async putScore(pid: string, day: string, total: number, detail: any, streak: number) {
    await this.db`insert into scores(pid, day, total, detail, streak, updated) values (${pid}, ${day}, ${total}, ${detail}, ${streak}, ${now()})
      on conflict (pid, day) do update set total = excluded.total, detail = excluded.detail, streak = excluded.streak, updated = excluded.updated`;
  }
  async push(to: string, from: string, kind: string, data: any) { await this.db`insert into inbox(to_pid, from_pid, kind, data, created) values (${to}, ${from}, ${kind}, ${data}, ${now()})`; }
  async inbox(pid: string) { const r = await this.db`select * from inbox where to_pid = ${pid} and done = false order by id desc limit 50`; return r.map((x: any) => ({ ...x, id: Number(x.id), created: Number(x.created) })).reverse(); }
  async ack(pid: string, ids: number[]) { if (ids.length) await this.db`update inbox set done = true where to_pid = ${pid} and id in ${this.db(ids)}`; }
  async sentSince(from: string, since: number, kind?: string, to?: string) {
    const r = kind && to ? await this.db`select count(*)::int as n from inbox where from_pid = ${from} and created >= ${since} and kind = ${kind} and to_pid = ${to}`
      : await this.db`select count(*)::int as n from inbox where from_pid = ${from} and created >= ${since}`;
    return r[0]?.n || 0;
  }
}

const store: Store = Bun.env.DATABASE_URL ? new PgStore(Bun.env.DATABASE_URL) : new MemStore();
await store.init();

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" };
const json = (o: unknown, status = 200) => Response.json(o, { status, headers: CORS });
const fail = (e: string, status = 400) => json({ error: e }, status);

/* 같은 주소에서 너무 자주 부르면 막기(아주 단순한 분당 한도) */
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) { const t = now(), h = hits.get(ip); if (!h || t - h.t > 60000) { hits.set(ip, { n: 1, t }); return false; } h.n++; if (hits.size > 50000) hits.clear(); return h.n > 120; }

async function auth(b: any) {
  if (typeof b?.pid !== "string" || typeof b?.secret !== "string") return null;
  const p = await store.player(b.pid);
  return p && p.secret === b.secret ? p : null;
}

async function friendView(pid: string, day: string) {
  const fs = await store.friends(pid);
  const ids = fs.map(f => f.fid);
  const sc = await store.scores(ids, day);
  const out = [];
  for (const f of fs) {
    const p = await store.player(f.fid); if (!p) continue;
    const s = sc.get(f.fid);
    out.push({ fid: f.fid, nick: p.nick, code: p.code, since: f.since, seen: p.seen, score: s ? s.total : 0, detail: s ? s.detail : null, streak: s ? s.streak : 0, played: !!s });
  }
  return out;
}
async function inboxView(pid: string) {
  const ms = await store.inbox(pid), out = [];
  for (const m of ms) { const p = await store.player(m.from_pid); out.push({ id: m.id, kind: m.kind, data: m.data, created: m.created, from: m.from_pid, nick: p ? p.nick : "알 수 없음" }); }
  return out;
}

const API: Record<string, (b: any) => Promise<Response>> = {
  async register(b) {
    const nick = cleanNick(b.nick);
    for (let i = 0; i < 8; i++) {
      const p: Player = { pid: newId(), secret: newSecret(), code: newCode(), nick, created: now(), seen: now() };
      if (await store.insertPlayer(p)) return json({ pid: p.pid, secret: p.secret, code: p.code, nick: p.nick });
    }
    return fail("try again", 503);
  },
  async me(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    const nick = b.nick != null ? cleanNick(b.nick) : undefined;
    await store.touch(p.pid, nick);
    const day = okDay(b.day);
    return json({ me: { code: p.code, nick: nick || p.nick }, friends: day ? await friendView(p.pid, day) : [], inbox: await inboxView(p.pid) });
  },
  async add(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const q = code.length === 6 ? await store.byCode(code) : null;
    if (!q) return fail("no such code", 404);
    if (q.pid === p.pid) return fail("self", 400);
    if (await store.isFriend(p.pid, q.pid)) return json({ friend: { fid: q.pid, nick: q.nick, code: q.code }, already: true });
    if ((await store.friends(p.pid)).length >= MAX_FRIENDS || (await store.friends(q.pid)).length >= MAX_FRIENDS) return fail("too many friends", 409);
    await store.link(p.pid, q.pid);
    await store.push(q.pid, p.pid, "friend", {});
    return json({ friend: { fid: q.pid, nick: q.nick, code: q.code } });
  },
  async remove(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    if (typeof b.fid !== "string") return fail("fid");
    await store.unlink(p.pid, b.fid);
    return json({ ok: true });
  },
  async score(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    const day = okDay(b.day); if (!day) return fail("day");
    const total = Math.max(0, Math.min(20000, Math.round(Number(b.total) || 0)));
    const streak = Math.max(0, Math.min(10000, Math.round(Number(b.streak) || 0)));
    let detail = b.detail && typeof b.detail === "object" ? b.detail : null;
    if (detail && JSON.stringify(detail).length > MAX_DATA) detail = null;
    await store.putScore(p.pid, day, total, detail, streak);
    return json({ ok: true });
  },
  async send(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    const kind = String(b.kind || "");
    if (!["heart", "play", "challenge"].includes(kind)) return fail("kind");
    if (typeof b.fid !== "string" || !(await store.isFriend(p.pid, b.fid))) return fail("not friend", 403);
    if (await store.sentSince(p.pid, now() - 3600000) >= 60) return fail("slow down", 429);
    if (kind === "heart" && await store.sentSince(p.pid, now() - 20 * 3600000, "heart", b.fid) >= 1) return fail("already sent today", 409);
    let data = b.data && typeof b.data === "object" ? b.data : {};
    if (JSON.stringify(data).length > MAX_DATA) data = {};
    await store.push(b.fid, p.pid, kind, data);
    return json({ ok: true });
  },
  async ack(b) {
    const p = await auth(b); if (!p) return fail("auth", 401);
    const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isFinite).slice(0, 100) : [];
    await store.ack(p.pid, ids);
    return json({ ok: true });
  },
};

const server = Bun.serve({
  port: Number(Bun.env.PORT || 3000),
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, service: "haru-puzzle friends", store: Bun.env.DATABASE_URL ? "postgres" : "memory" });
    const m = url.pathname.match(/^\/api\/(\w+)$/);
    if (!m || req.method !== "POST" || !API[m[1]]) return fail("not found", 404);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || srv.requestIP(req)?.address || "?";
    if (limited(ip)) return fail("slow down", 429);
    let body: any; try { body = await req.json(); } catch { return fail("bad json"); }
    try { return await API[m[1]](body); } catch (e) { console.error(m[1], e); return fail("server error", 500); }
  },
});
console.log(`friends server listening on ${server.port}`);
