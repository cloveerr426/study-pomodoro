/**
 * 布局与渲染审计：多种屏幕尺寸下检查溢出 / 重叠，并对截图做像素级亮度与对比度检查
 * （包括不同壁纸明暗下标题栏文字是否清晰可读）。
 * 运行：node tests/layout.mjs
 */
import { serve, launch, Checker, decodePNG, regionStats, sleep } from './lib/harness.mjs';

const server = await serve();
const session = await launch({ url: server.url('index.html') });
const { js, json } = session;
const c = new Checker('布局与渲染审计');

const LAYOUT = `(function(){
  const de = document.documentElement, W = innerWidth;
  const rect = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const over = [];
  document.querySelectorAll('body *').forEach(e => {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    if (st.display === 'none' || st.visibility === 'hidden' || r.width === 0) return;
    if (e.closest('#bg-layer, #bg-tint, #bg-vignette')) return;
    const dr = e.closest('.drawer');
    if (dr && !dr.classList.contains('open')) return;
    if (r.right > W + 1.5) over.push((e.id ? '#' + e.id : (e.className || e.tagName)) + '->' + Math.round(r.right));
  });
  const brand = rect('.brand'), acts = rect('.top-actions');
  const overlapTop = brand && acts && !(brand.right <= acts.left + 0.5 || acts.right <= brand.left + 0.5 || brand.bottom <= acts.top || acts.bottom <= brand.top);
  const card = rect('.card'), ring = rect('.ring-wrap'), controls = rect('.controls');
  const ctrlOverflow = controls && card ? (controls.left < card.left - 1 || controls.right > card.right + 1) : false;
  const tr = rect('#timeDisplay');
  return JSON.stringify({
    W, hScroll: de.scrollWidth > W + 2, scrollW: de.scrollWidth,
    overflow: over.slice(0, 6), overlapTop,
    ringInsideCard: card && ring ? (ring.left >= card.left - 1 && ring.right <= card.right + 1) : false,
    ctrlOverflow,
    timeRect: tr && { x: tr.x, y: tr.y, w: tr.width, h: tr.height },
    cardRect: card && { x: card.x, y: card.y, w: card.width, h: card.height }
  });
})()`;

async function auditViewport(w, h, label, mobile = false) {
  await session.viewport(w, h, mobile);
  const L = await json(LAYOUT);
  c.check(label + '：无横向滚动', !L.hScroll, 'scrollWidth=' + L.scrollW);
  c.check(label + '：无元素超出右边界', L.overflow.length === 0, L.overflow.join(', '));
  c.check(label + '：标题栏与按钮不重叠', !L.overlapTop);
  c.check(label + '：进度环在卡片内', L.ringInsideCard);
  c.check(label + '：控制按钮不溢出卡片', !L.ctrlOverflow);
  const img = decodePNG(await session.screenshot());
  const whole = regionStats(img, 0, 0, img.w, img.h);
  const tr = L.timeRect;
  const text = tr ? regionStats(img, tr.x, tr.y, tr.w, tr.h) : null;
  const card = L.cardRect || { x: 0, y: 0, w: 1, h: 1 };
  const cardBg = regionStats(img, card.x + 8, card.y + card.h - 26, card.w - 16, 12);
  c.check(label + '：画面正常渲染（非纯色）', whole.std > 8, 'std=' + whole.std.toFixed(1));
  c.check(label + '：计时数字与背景有对比', text && (text.max - text.min) > 120,
    text ? 'min=' + text.min.toFixed(0) + ' max=' + text.max.toFixed(0) : '未取到区域');
  c.check(label + '：卡片区域可见', cardBg.mean > 12 && cardBg.mean < 246, 'mean=' + cardBg.mean.toFixed(0));
  return L;
}

await js(`['整理线性代数笔记','背 60 个考研单词','刷 2 篇英语阅读'].forEach(t => addTask(t)); 'ok'`);
await auditViewport(1280, 880, 'desktop');
await auditViewport(900, 900, 'tablet');
const phone = await auditViewport(400, 860, 'phone', true);
await auditViewport(340, 720, 'small-phone', true);

/* 抽屉：收起时在屏幕外，打开后完整可见且可滚动 */
await session.viewport(400, 860, true);
const closed = await json(`(function(){ closeDrawers(); const r = document.querySelector('#settingsDrawer').getBoundingClientRect(); return JSON.stringify({ left: r.left, W: innerWidth }); })()`);
c.check('手机端抽屉默认收在屏幕外', closed.left >= closed.W - 2, closed.left + '/' + closed.W);
await js(`openDrawer('#settingsDrawer'); 'ok'`);
await sleep(700);
const opened = await json(`(function(){
  const d = document.querySelector('#settingsDrawer');
  const r = d.getBoundingClientRect();
  const b = d.querySelector('.drawer-body');
  return JSON.stringify({
    left: r.left, right: r.right, W: innerWidth,
    scrollable: b.scrollHeight > b.clientHeight,
    scrim: document.querySelector('#scrim').classList.contains('open'),
    over: [...d.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1.5).length
  });
})()`);
c.check('打开设置抽屉后完整可见', opened.left > 0 && opened.right <= opened.W + 1, opened.left + ' -> ' + opened.right);
c.check('抽屉内容可滚动', opened.scrollable);
c.check('遮罩同步打开', opened.scrim);
c.check('抽屉内部无元素溢出屏幕', opened.over === 0, opened.over);

/* 桌面运行态 */
await session.viewport(1280, 880);
await js(`(function(){ closeDrawers(); document.querySelector('#taskList li').click(); start(); return 'ok'; })()`);
await sleep(1300);
const running = await json(`JSON.stringify({
  btn: document.querySelector('#startBtn').textContent,
  task: document.querySelector('#taskNow').textContent
})`);
c.check('桌面端运行态正常（按钮=暂停 且 圆环内显示当前任务）',
  running.btn === '暂停' && running.task.includes('🎯'), running.btn + '/' + running.task);

/* 深色面板 + 深色壁纸 */
await js(`(function(){ S.scheme = 'dark'; applyTheme(); S.wallpaper = { type:'builtin', id:'night' }; S.dim = 25; applyWallpaper(); return 'ok'; })()`);
await sleep(700);
const darkImg = decodePNG(await session.screenshot());
const timeRect = await json(`JSON.stringify(document.querySelector('#timeDisplay').getBoundingClientRect())`);
const dt = regionStats(darkImg, timeRect.x, timeRect.y, timeRect.width, timeRect.height);
c.check('深色面板下计时数字清晰', (dt.max - dt.min) > 120, 'min=' + dt.min.toFixed(0) + ' max=' + dt.max.toFixed(0));
c.check('深色壁纸已铺满（角落偏暗）', regionStats(darkImg, 0, 0, 60, 60).mean < 140);

/* 浅色壁纸 + 浅色面板 */
await js(`(function(){ S.scheme = 'light'; S.wallpaper = { type:'builtin', id:'paper' }; S.dim = 8; applyTheme(); applyWallpaper(); return 'ok'; })()`);
await sleep(700);
const pt = regionStats(decodePNG(await session.screenshot()), timeRect.x, timeRect.y, timeRect.width, timeRect.height);
c.check('浅色壁纸下计时数字仍可辨认', (pt.max - pt.min) > 90, 'min=' + pt.min.toFixed(0) + ' max=' + pt.max.toFixed(0));

/* 标题栏文字在深 / 浅壁纸上的自动明暗适配 */
const brandRect = await json(`JSON.stringify(document.querySelector('.brand').getBoundingClientRect())`);
await js(`(function(){ S.tintAuto = true; S.wallpaper = { type:'builtin', id:'aurora' }; applyWallpaper(); return 'ok'; })()`);
await sleep(800);
const darkTone = await js(`document.documentElement.getAttribute('data-wp-tone')`);
const darkTint = await js(`JSON.parse(localStorage.getItem('pomodoro.settings.v1')).tint`);
const dSt = regionStats(decodePNG(await session.screenshot()), brandRect.x, brandRect.y, brandRect.width, brandRect.height);
c.check('深色壁纸 → 文字自动转为浅色', darkTone === 'dark', darkTone);
c.check('深色壁纸 → 遮罩自动为暗色', darkTint === 'dark', darkTint);
c.check('深色壁纸下标题栏文字清晰可读', (dSt.max - dSt.min) > 90, 'min=' + dSt.min.toFixed(0) + ' max=' + dSt.max.toFixed(0));

await js(`(function(){ S.wallpaper = { type:'builtin', id:'paper' }; applyWallpaper(); return 'ok'; })()`);
await sleep(800);
const lightTone = await js(`document.documentElement.getAttribute('data-wp-tone')`);
const lightTint = await js(`JSON.parse(localStorage.getItem('pomodoro.settings.v1')).tint`);
const lSt = regionStats(decodePNG(await session.screenshot()), brandRect.x, brandRect.y, brandRect.width, brandRect.height);
c.check('浅色壁纸 → 文字自动转为深色', lightTone === 'light', lightTone);
c.check('浅色壁纸 → 遮罩自动为亮色', lightTint === 'light', lightTint);
c.check('浅色壁纸下标题栏文字清晰可读', (lSt.max - lSt.min) > 90, 'min=' + lSt.min.toFixed(0) + ' max=' + lSt.max.toFixed(0));

/* 手动选择遮罩后不再自动调整，文字仍清晰 */
const manual = await json(`(function(){
  [...document.querySelectorAll('#tintSeg button')].find(x => x.dataset.tint === 'dark').click();
  return JSON.stringify({ auto: S.tintAuto, tint: S.tint, tone: document.documentElement.getAttribute('data-wp-tone') });
})()`);
c.check('手动选遮罩后停止自动调整', manual.auto === false && manual.tint === 'dark', JSON.stringify(manual));
await sleep(800);
const mSt = regionStats(decodePNG(await session.screenshot()), brandRect.x, brandRect.y, brandRect.width, brandRect.height);
c.check('手动遮罩后标题栏文字依然清晰', (mSt.max - mSt.min) > 90,
  'tone=' + manual.tone + ' min=' + mSt.min.toFixed(0) + ' max=' + mSt.max.toFixed(0));

c.info('浏览器: ' + session.browserPath + '（手机断点 ' + phone.W + 'px 检查通过）');
const failed = c.report(session.problems);
await session.close();
await server.close();
process.exit(failed ? 1 : 0);
