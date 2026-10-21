/* 트럼프 고스톱 — 스팀(PC) 앱
   - app/index.html(= embed/tgostop.html + 로컬 글꼴)을 16:9 창으로 띄운다. 게임 코드는 건드리지 않는다.
   - 게임 모듈이 보내는 이벤트(window.HaruPuzzle.postMessage)를 받아 스팀 업적을 연다.
   - 스팀이 꺼져 있어도 게임은 그대로 돈다(업적만 건너뜀). */
const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('TrumpGostop');                       /* 저장 폴더 이름(영문) — 스팀 클라우드 경로가 단순해지도록 */
const PKG = require('./package.json');
const ACH = require('./achievements.json');

/* ---------- 스팀 ---------- */
let steam = null;
function appId(){
  try{ const t = fs.readFileSync(path.join(path.dirname(process.execPath), 'steam_appid.txt'), 'utf8').trim(); if(+t) return +t; }catch(_){}
  try{ const t = fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8').trim(); if(+t) return +t; }catch(_){}
  return PKG.steamAppId || 480;
}
function initSteam(){
  try{
    const sw = require('steamworks.js');
    steam = sw.init(appId());
    try{ sw.electronEnableSteamOverlay(); }catch(_){}
    console.log('[steam] 연결됨:', steam.localplayer.getName());
  }catch(e){
    steam = null;
    console.log('[steam] 연결 안 됨 — 스팀 없이 실행:', e && e.message);
  }
}
function unlock(id){
  if(!steam) return;
  try{ if(!steam.achievement.isActivated(id)){ steam.achievement.activate(id); console.log('[steam] 업적:', id); } }catch(e){ console.log('[steam] 업적 실패', id, e && e.message); }
}

/* ---------- 기록(업적 판단용, 이 PC에 저장) ---------- */
const STATS_FILE = () => path.join(app.getPath('userData'), 'steam-stats.json');
let stats = { games:0, wins:0, soloWins:0, duelGames:0, duelWins:0, bestStage:0, streak:0 };
function loadStats(){ try{ stats = Object.assign(stats, JSON.parse(fs.readFileSync(STATS_FILE(), 'utf8'))); }catch(_){} }
function saveStats(){ try{ fs.writeFileSync(STATS_FILE(), JSON.stringify(stats)); }catch(_){} }
function checkAchievements(){
  for(const a of ACH.achievements){
    const v = stats[a.stat];
    if(typeof v === 'number' && v >= a.goal) unlock(a.id);
  }
}

/* ---------- 게임 이벤트 ---------- */
function onGameEvent(json){
  let e; try{ e = JSON.parse(json); }catch(_){ return; }
  if(!e || !e.type) return;
  if(e.type === 'close'){ app.quit(); return; }
  if(e.type !== 'finish') return;
  stats.games++;
  if(e.win){ stats.wins++; stats.streak++; } else stats.streak = 0;
  stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);
  if(e.mode === 'solo'){ if(e.win) stats.soloWins++; if(e.stage) stats.bestStage = Math.max(stats.bestStage, e.win ? e.stage : 0); }
  if(e.mode === 'duel'){ stats.duelGames++; if(e.win) stats.duelWins++; if(e.vs === 'live') stats.liveGames = (stats.liveGames || 0) + 1; }
  saveStats(); checkAchievements();
  if(steam){
    try{ steam.localplayer.setRichPresence('steam_display', e.win ? '#Win' : '#Playing'); }catch(_){}
  }
}

/* ---------- 창 ---------- */
let win;
function createWindow(){
  win = new BrowserWindow({
    width:1600, height:900, minWidth:960, minHeight:540, useContentSize:true,
    backgroundColor:'#1b1430', title:'Trump Gostop', autoHideMenuBar:true, show:false,
    webPreferences:{ preload:path.join(__dirname, 'preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { query:{ mode:'menu', close:'1', ns:'steam' } });
  win.once('ready-to-show', () => win.show());
  /* 바깥 링크(영어 설명서 등)는 기본 브라우저로 */
  win.webContents.setWindowOpenHandler(({ url }) => { if(/^https?:/.test(url)) shell.openExternal(url); return { action:'deny' }; });
  win.webContents.on('will-navigate', (ev, url) => { if(/^https?:/.test(url)){ ev.preventDefault(); shell.openExternal(url); } });
  /* F11 · Alt+Enter = 전체 화면 */
  win.webContents.on('before-input-event', (ev, i) => {
    if(i.type !== 'keyDown') return;
    if(i.key === 'F11' || (i.alt && i.key === 'Enter')){ ev.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  if(process.env.SMOKE){
    /* 점검용: 8초 뒤 화면을 smoke.png로 저장하고 종료 */
    win.webContents.on('console-message', (_e, lvl, msg) => { if(lvl >= 3) console.log('[page error]', msg); });
    setTimeout(async () => {
      if(process.env.SMOKE === 'play'){
        /* 솔로 시작 → 19세 확인·안내 창은 첫 버튼으로 넘기며 판 화면까지 */
        for(let i = 0; i < 8; i++){
          await win.webContents.executeJavaScript(`(()=>{const bs=[...document.querySelectorAll('button,[role=button],.btn')].filter(b=>b.offsetParent);for(const p of ['네, 만 19세','연습 판','작은 판','시작','알겠','확인','닫기','솔로']){const b=bs.find(b=>b.textContent.includes(p));if(b){b.click();return p}}return ''})()`).then(t => console.log('[smoke] 누름:', t));
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'smoke.png'), img.toPNG());
      console.log('[smoke] smoke.png 저장, 제목:', await win.webContents.executeJavaScript('document.title'));
      app.quit();
    }, 8000);
  }
}

ipcMain.on('haru-event', (_e, json) => onGameEvent(json));
ipcMain.handle('steam-info', () => ({ connected:!!steam, name:steam ? (() => { try{ return steam.localplayer.getName(); }catch(_){ return ''; } })() : '', lang:app.getLocale() }));

app.whenReady().then(() => { loadStats(); initSteam(); createWindow(); });
app.on('window-all-closed', () => app.quit());
