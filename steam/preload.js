/* 게임 모듈(embed/shell.js)은 window.HaruPuzzle.postMessage(json)로 이벤트를 보낸다 → 메인 프로세스로 전달 */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('HaruPuzzle', {
  postMessage:json => { try{ ipcRenderer.send('haru-event', String(json)); }catch(_){} }
});
contextBridge.exposeInMainWorld('SteamApp', {
  info:() => ipcRenderer.invoke('steam-info'),
  isDesktop:true
});
