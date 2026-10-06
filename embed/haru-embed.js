/*! 하루퍼즐 게임 모듈 붙이기(haru-embed.js) — 다른 웹사이트에 게임 하나를 붙인다.
 *
 *  가장 쉬운 방법(코드 없이):
 *    <div data-haru-game="ball" data-mode="menu"></div>
 *    <script src="https://hyukcap-rgb.github.io/game/embed/haru-embed.js" defer></script>
 *
 *  코드로:
 *    const g = HaruPuzzle.mount('#box', {
 *      game:'fleet',                 // fox sudoku ball fleet match nono block memory merge link …(embed/games.json)
 *      mode:'menu',                  // menu(첫 화면) | daily(오늘의 문제) | solo | practice | duel
 *      modes:['daily','solo'],       // 첫 화면에 보일 모드(생략하면 모두)
 *      level:'normal', stage:1,      // 연습 난이도 · 솔로 시작 스테이지
 *      ns:'siteA', user:'u123',      // 기록을 사이트·사용자별로 나눔
 *      height:'720px',               // '720px' | '100%' | 'auto'(내용 높이에 맞춤)
 *      sound:true,
 *      onEvent(e){ ... },            // 모든 이벤트(ready start finish progress menu quit close resize state)
 *      onFinish(e){ ... }            // 한 판이 끝날 때(점수·별·승패)
 *    });
 *    g.start('daily'); g.menu(); g.sound(false); g.state(); g.restore(saved); g.destroy();
 *
 *  자세한 설명: https://hyukcap-rgb.github.io/game/embed/  (embed/README.md)
 */
(function(){
  'use strict';
  var me = document.currentScript, BASE = (me && me.src) ? me.src.replace(/[^\/]*$/, '') : 'https://hyukcap-rgb.github.io/game/embed/';
  var GAMES = ['fox', 'sudoku', 'ball', 'fleet', 'match', 'nono', 'block', 'memory', 'merge', 'link'];
  /* 은퇴한 게임: 이미 붙여 쓰는 곳이 깨지지 않게 이름은 받아 주고, 모듈 주소는 "종료됐어요" 안내 화면(ready에 retired:true) */
  var RETIRED = ['tower'];
  var list = [];

  function el(t){ return typeof t === 'string' ? document.querySelector(t) : t; }
  function mount(target, o){
    o = o || {};
    var box = el(target); if(!box) throw new Error('HaruPuzzle: 붙일 자리를 찾지 못했어요: ' + target);
    if(GAMES.indexOf(o.game) < 0 && RETIRED.indexOf(o.game) < 0) throw new Error('HaruPuzzle: 게임 이름을 확인해 주세요: ' + o.game + ' (' + GAMES.join(', ') + ')');
    var q = new URLSearchParams();
    q.set('mode', o.mode || 'menu');
    if(o.modes) q.set('modes', [].concat(o.modes).join(','));
    if(o.level) q.set('level', o.level);
    if(o.stage) q.set('stage', String(o.stage));
    if(o.unlock) q.set('unlock', '1');
    if(o.ns) q.set('ns', o.ns);
    if(o.user) q.set('user', o.user);
    if(o.sound === false) q.set('sound', '0');
    if(o.close) q.set('close', '1');
    q.set('origin', location.origin);
    var f = document.createElement('iframe');
    f.src = (o.base || BASE) + o.game + '.html?' + q.toString();
    f.title = o.title || '하루퍼즐 게임';
    f.allow = 'autoplay; fullscreen; vibrate';
    f.setAttribute('allowfullscreen', '');
    f.loading = o.lazy ? 'lazy' : 'eager';
    var auto = o.height === 'auto';
    f.style.cssText = 'display:block;width:100%;max-width:' + (o.maxWidth || '480px') + ';margin:0 auto;border:0;border-radius:' + (o.radius == null ? '18px' : o.radius) + ';background:#1C1250;height:' + (auto ? '720px' : (o.height || '720px'));
    box.innerHTML = ''; box.appendChild(f);
    var api = {
      iframe:f, game:o.game,
      send:function(cmd, data){ var m = { target:'haru-puzzle', cmd:cmd }; for(var k in (data || {})) m[k] = data[k]; f.contentWindow && f.contentWindow.postMessage(m, '*'); },
      start:function(mode, data){ var d = data || {}; d.mode = mode; api.send('start', d); },
      menu:function(){ api.send('menu'); },
      sound:function(on){ api.send('sound', { on:!!on }); },
      state:function(){ api.send('state'); },
      restore:function(state){ api.send('restore', { state:state }); },
      destroy:function(){ window.removeEventListener('message', onMsg); f.remove(); list = list.filter(function(x){ return x !== api; }); }
    };
    function onMsg(e){
      if(e.source !== f.contentWindow) return;
      var d = e.data; if(!d || d.source !== 'haru-puzzle') return;
      if(d.type === 'resize' && auto) f.style.height = Math.max(480, d.height) + 'px';
      if(o.onEvent) try{ o.onEvent(d); }catch(err){ console.error(err); }
      if(d.type === 'finish' && o.onFinish) try{ o.onFinish(d); }catch(err){ console.error(err); }
      if(d.type === 'ready' && o.onReady) try{ o.onReady(d); }catch(err){ console.error(err); }
      if(d.type === 'ready' && o.state) api.restore(o.state);   /* 저장해 둔 진행 상황 넣기 */
      box.dispatchEvent(new CustomEvent('haru-puzzle', { detail:d, bubbles:true }));
    }
    window.addEventListener('message', onMsg);
    list.push(api);
    return api;
  }
  /* data-haru-game 자리 자동으로 채우기 */
  function scan(){
    var nodes = document.querySelectorAll('[data-haru-game]:not([data-haru-on])');
    for(var i = 0; i < nodes.length; i++){
      var n = nodes[i], d = n.dataset; n.setAttribute('data-haru-on', '1');
      mount(n, { game:d.haruGame, mode:d.mode, modes:d.modes ? d.modes.split(',') : null, level:d.level, stage:d.stage ? +d.stage : 0,
        ns:d.ns, user:d.user, height:d.height, sound:d.sound !== '0', close:d.close === '1' });
    }
  }
  window.HaruPuzzle = { mount:mount, scan:scan, games:GAMES.slice(), base:BASE, list:function(){ return list.slice(); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
