/**
 * 重新生成 docs/screenshots 里的文档截图。
 * 运行：node tests/screenshots.mjs
 */
import path from 'node:path';
import { serve, launch, savePng, sleep, ROOT } from './lib/harness.mjs';

const OUT = path.join(ROOT, 'docs', 'screenshots');
const server = await serve();
const session = await launch({ url: server.url('index.html') });
const { js } = session;

async function shot(name, w, h, mobile = false) {
  await session.viewport(w, h, mobile);
  await sleep(800);
  await js(`document.querySelectorAll('#toastLayer .toast').forEach(t => t.remove()); 'ok'`);
  savePng(await session.screenshot(), path.join(OUT, name));
  console.log('已保存 docs/screenshots/' + name);
}

/* 01 默认外观 */
await js(`(function(){
  ['整理线性代数错题','精读 2 篇英语外刊','复习概率论第 3 章'].forEach(t => addTask(t));
  document.querySelectorAll('#taskList li')[1].click();
  return 'ok';
})()`);
await shot('01-default.png', 1200, 820);

/* 02 自定义壁纸 + 樱花主题（运行中） */
await js(`(async function(){
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1050;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1600, 1050);
  g.addColorStop(0, '#ffe3c2'); g.addColorStop(.42, '#ff9f7d');
  g.addColorStop(.75, '#b9678b'); g.addColorStop(1, '#4a3b63');
  x.fillStyle = g; x.fillRect(0, 0, 1600, 1050);
  x.globalAlpha = .22; x.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(1480 - i * 54, 960 - i * 30, 26 + i * 5, 0, 7); x.fill(); }
  x.globalAlpha = .55; x.fillStyle = '#fff3dd'; x.beginPath(); x.arc(1160, 250, 96, 0, 7); x.fill();
  x.globalAlpha = 1;
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92));
  await fileToWallpaper(new File([blob], 'sunset.jpg', { type: 'image/jpeg' }));
  S.theme = 'sakura'; S.scheme = 'light'; S.dim = 26; S.blur = 1;
  applyTheme(); applyWallpaper();
  start();
  return 'ok';
})()`);
await shot('02-custom-wallpaper.png', 1200, 820);

/* 03 手机端 */
await shot('03-mobile.png', 400, 840, true);

/* 04 主题抽屉 */
await js(`(function(){
  document.body.classList.remove('immersive');
  S.scheme = 'dark'; applyTheme();
  openDrawer('#themeDrawer'); return 'ok';
})()`);
await shot('04-theme.png', 1200, 820);

/* 05 壁纸抽屉 */
await js(`openDrawer('#wallpaperDrawer'); 'ok'`);
await shot('05-wallpaper.png', 1200, 820);

/* 06 统计（先造一点历史数据） */
await js(`(function(){
  const counts = [3, 6, 4, 8, 5, 2, 5];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    DATA.history[k] = { count: counts[6 - i], minutes: counts[6 - i] * 25 };
  }
  DATA.tasks[0].poms = 6; DATA.tasks[0].minutes = 150;
  DATA.tasks[1].poms = 4; DATA.tasks[2].poms = 2;
  saveData(); updateStats();
  openDrawer('#statsDrawer'); return 'ok';
})()`);
await shot('06-stats.png', 1200, 820);

/* 07 沉浸模式 */
await js(`(function(){
  closeDrawers();
  document.body.classList.add('immersive');
  return 'ok';
})()`);
await shot('07-immersive.png', 1200, 820);

await session.close();
await server.close();
process.exit(0);
