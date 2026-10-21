// 서버 시간을 빠르게: setTimeout/setInterval 지연을 SCALE배로 줄이고, Date.now도 같은 비율로 빠르게 흐르게
const SCALE = Number(process.env.SIM_SCALE || 0.05);
const realNow = Date.now.bind(Date);
const t0 = realNow();
Date.now = () => t0 + (realNow() - t0) / SCALE;
const st = global.setTimeout, si = global.setInterval;
global.setTimeout = (fn, ms, ...a) => st(fn, Math.max(0, (Number(ms) || 0) * SCALE), ...a);
global.setInterval = (fn, ms, ...a) => si(fn, Math.max(1, (Number(ms) || 0) * SCALE), ...a);
process.on('uncaughtException', (e) => { console.error('UNCAUGHT', e && e.stack || e); });
process.on('unhandledRejection', (e) => { console.error('UNHANDLED', e && e.stack || e); });
