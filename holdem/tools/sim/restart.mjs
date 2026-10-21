// 4명이 친구 대전 중일 때 서버가 다시 켜지면(배포) 각 화면이 어떻게 되는지
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const DIR = process.argv[2], PORT = 4120, DATA = process.argv[3];
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true }); try { fs.rmSync(DATA + '.log'); } catch (e) {}
let srv;
const start = () => { srv = spawn('node', ['server.js'], { cwd: DIR, env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_PASSWORD: 'simpw' }, stdio: ['ignore', fs.openSync(DATA + '.log', 'a'), fs.openSync(DATA + '.log', 'a')] }); };
start(); await new Promise((r) => setTimeout(r, 1200));
const U = 'http://127.0.0.1:' + PORT + '/';
const tk = (await (await fetch(U + 'admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":"simpw"}' })).json()).token;
await fetch(U + 'admin/api/settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': tk }, body: '{"autoApprove":true,"welcomeChips":1000000}' });
const b = await chromium.launch(); const errs = [];
async function pl(n) { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
  await p.goto(U); await p.fill('#nick', n); await p.fill('#pin', '1234'); await p.click('#loginBtn'); await p.waitForSelector('#modesBox:not([hidden])'); return p; }
const t = Date.now().toString(36).slice(-4);
const P = []; for (const k of 'abcd') P.push(await pl('r' + k + t));
const A = P[0];
await A.click('[data-mode=friends]'); await A.click('#rbCreate'); await A.click('#biOk'); await A.waitForSelector('#lobby.active');
const code = (await A.textContent('#roomCode')).trim();
for (const p of P.slice(1)) { await p.click('[data-mode=friends]'); await p.click(`#rbList [data-join="${code}"]`, { timeout: 8000 }); await p.click('#biOk'); await p.waitForSelector('#lobby.active'); }
await A.waitForTimeout(500); await A.click('#startBtn');
const play = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { for (const p of P) { try { if (await p.evaluate(() => document.querySelector('#actions').classList.contains('mine'))) await p.click('#callBtn', { timeout: 800 }); } catch (e) {} } await A.waitForTimeout(150); } };
await play(8000);
// 화면 그리기 오류를 일부러 한 명(b)에게 일으켜 봄
await P[1].evaluate(() => { const R = window.__rh.R; const o = R.renderPot; let n = 0; R.renderPot = function (v) { if (n++ < 2) throw new Error('테스트용 그리기 오류'); return o.call(this, v); }; });
await play(6000);
console.log('b 버튼 상태', await P[1].evaluate(() => document.querySelector('#actions').className));
const snap = async (label) => { for (const [i, p] of P.entries()) console.log(label, 'abcd'[i], JSON.stringify(await p.evaluate(() => ({ screen: [...document.querySelectorAll('.screen.active')].map((e) => e.id).join(), modal: document.querySelector('#modal').classList.contains('show') ? document.querySelector('#modalCard').innerText.slice(0, 50).replace(/\n/g, ' ') : '', gate: document.querySelector('#gateBox').hidden ? '' : document.querySelector('#gateBox').innerText.slice(0, 40).replace(/\n/g, ' '), toast: document.querySelector('#toast').innerText, hand: window.__rh.R.v && window.__rh.R.v.handNo, mine: document.querySelector('#actions').classList.contains('mine') })))); };
await snap('before');
srv.kill('SIGTERM');
await A.waitForTimeout(Number(process.argv[4] || 15000));   // 새 서버가 뜨기까지(로그상 약 15~20초)
start();
await A.waitForTimeout(20000);
await snap('after');
// 멈춘 화면에서 버튼을 눌러 보기
for (const [i, p] of P.entries()) { const before = await p.evaluate(() => [...document.querySelectorAll('.screen.active')].map((e) => e.id).join()); if (before === 'game') { await p.click('#foldBtn', { timeout: 1000 }).catch(() => {}); await p.click('#exitBtn', { timeout: 1000 }).catch(() => {}); await p.waitForTimeout(1500); console.log('click-test', 'abcd'[i], await p.evaluate(() => [...document.querySelectorAll('.screen.active')].map((e) => e.id).join() + ' | ' + (document.querySelector('#modal').classList.contains('show') ? document.querySelector('#modalCard').innerText.slice(0, 50).replace(/\n/g, ' ') : ''))); } }
console.log('errs', errs);
await b.close(); srv.kill();
