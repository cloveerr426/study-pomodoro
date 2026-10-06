/**
 * 功能与持久化测试：计时、循环、任务、统计、主题、壁纸、设置。
 * 运行：node tests/functional.mjs
 */
import { serve, launch, Checker, sleep } from './lib/harness.mjs';

const server = await serve();
const session = await launch({ url: server.url('index.html') });
const { js, json } = session;
const c = new Checker('功能与持久化测试');

/* 1. 初始化 */
const init = await json(`JSON.stringify({
  tiles: document.querySelectorAll('#builtinTiles .tile').length,
  swatches: document.querySelectorAll('#swatchGrid .swatch').length,
  bars: document.querySelectorAll('#weekChart .bar-wrap').length,
  heat: document.querySelectorAll('#heatGrid i').length,
  time: document.querySelector('#timeDisplay').textContent,
  date: document.querySelector('#dateLine').textContent,
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  bg: (document.querySelector('#bg-layer').style.backgroundImage || '').slice(0, 24),
  idb: idbOk
})`);
c.check('壁纸预设 12 个（10 内置 + 上传/链接）', init.tiles === 12, init.tiles);
c.check('主题色板 8 个', init.swatches === 8, init.swatches);
c.check('7 天柱状图已渲染', init.bars === 7, init.bars);
c.check('30 天打卡格已渲染', init.heat === 30, init.heat);
c.check('初始显示 25:00', init.time === '25:00', init.time);
c.check('日期行已本地化', /月/.test(init.date), init.date);
c.check('默认主题色生效', init.accent === '#6fa87f', init.accent);
c.check('默认壁纸已应用', init.bg.includes('gradient'), init.bg);
c.check('http 环境下 IndexedDB 可用', init.idb === true, init.idb);

/* 2. 开始计时会真实走秒 */
await js(`document.querySelector('#startBtn').click(); 'ok'`);
const btnLabel = await js(`document.querySelector('#startBtn').textContent`);
await sleep(1600);
const running = await json(`JSON.stringify({
  time: document.querySelector('#timeDisplay').textContent,
  label: document.querySelector('#modeLabel').textContent,
  title: document.title,
  ring: document.querySelector('#ringProgress').style.strokeDashoffset
})`);
c.check('点击开始后按钮变为「暂停」', btnLabel === '暂停', btnLabel);
c.check('倒计时真实走动（25:00 → 约 24:59）', running.time === '24:59' || running.time === '24:58', running.time);
c.check('运行中状态文案为「专注中」', running.label === '专注中', running.label);
c.check('页面标题同步剩余时间', /^\d\d:\d\d · 番茄自习室$/.test(running.title), running.title);
c.check('进度环 offset 已变化', parseFloat(running.ring) > 0 && parseFloat(running.ring) <= 666.1, running.ring);

/* 3. 暂停 / 重置 */
await js(`document.querySelector('#startBtn').click(); 'ok'`);
const paused = await json(`JSON.stringify({ label: document.querySelector('#startBtn').textContent })`);
c.check('暂停后按钮变「继续」', paused.label === '继续', paused.label);
await js(`document.querySelector('#resetBtn').click(); 'ok'`);
c.check('重置回到 25:00', (await js(`document.querySelector('#timeDisplay').textContent`)) === '25:00');

/* 4. 任务：新增 / 选中 / 番茄计数 */
await js(`document.querySelector('#taskInput').value = '背 50 个单词';
  document.querySelector('#taskForm').dispatchEvent(new Event('submit', {cancelable:true, bubbles:true})); 'ok'`);
await js(`document.querySelector('#taskList li').click(); 'ok'`);
const taskState = await json(`JSON.stringify({
  items: document.querySelectorAll('#taskList li').length,
  selected: document.querySelector('#taskList li').classList.contains('selected'),
  current: currentTaskId,
  ringTask: document.querySelector('#taskNow').textContent,
  summary: document.querySelector('#taskSummary').textContent
})`);
c.check('任务已加入列表', taskState.items === 1, taskState.items);
c.check('点击任务后成为专注目标', taskState.selected && !!taskState.current, taskState.current);
c.check('圆环内显示当前任务', taskState.ringTask.includes('背 50 个单词'), taskState.ringTask);
c.check('任务摘要正确', taskState.summary.includes('1 项待完成'), taskState.summary);

/* 5. 完成一个专注番茄 */
const after1 = await json(`(function(){
  timer.endAt = Date.now() - 1; tick();
  const t = DATA.tasks.find(x => x.id === currentTaskId);
  return JSON.stringify({
    tomatoes: document.querySelector('#todayTomatoes').textContent,
    minutes: document.querySelector('#todayMinutes').textContent,
    mode: timer.mode,
    label: document.querySelector('#modeLabel').textContent,
    dots: document.querySelectorAll('#roundDots i.on').length,
    poms: t ? t.poms : -1,
    taskMinutes: t ? t.minutes : -1,
    toast: [...document.querySelectorAll('#toastLayer .toast')].map(x => x.textContent).join(' | '),
    bars: document.querySelectorAll('#weekChart .bar').length,
    sToday: document.querySelector('#sToday').textContent,
    heatColored: document.querySelectorAll('#heatGrid i[style]').length,
    stored: !!localStorage.getItem('pomodoro.data.v1')
  });
})()`);
c.check('完成番茄后今日计数 +1', after1.tomatoes === '1', after1.tomatoes);
c.check('今日专注分钟累计 25', after1.minutes === '25', after1.minutes);
c.check('自动切到短休息', after1.mode === 'short', after1.mode);
c.check('短休息自动开始计时', after1.label === '短休息', after1.label);
c.check('循环进度圆点 1 个点亮', after1.dots === 1, after1.dots);
c.check('任务番茄数 +1', after1.poms === 1, after1.poms);
c.check('任务专注分钟 +25', after1.taskMinutes === 25, after1.taskMinutes);
c.check('弹出完成提示', after1.toast.includes('完成一个番茄'), after1.toast);
c.check('统计数据同步到抽屉', after1.sToday === '1', after1.sToday);
c.check('30 天打卡已着色', after1.heatColored >= 1, after1.heatColored);
c.check('数据已写入 localStorage', after1.stored === true, after1.stored);
c.check('7 天图表柱体存在', after1.bars === 7, after1.bars);

/* 6. 连续 4 个番茄 → 长休息；长休息结束 → 循环清零 */
const cycle = await json(`(function(){
  pause();
  for (let i = 0; i < 3; i++) { setMode('focus'); timer.endAt = Date.now() - 1; tick(); }
  const atLong = { mode: timer.mode, dots: document.querySelectorAll('#roundDots i.on').length, round: DATA.round, tomatoes: document.querySelector('#todayTomatoes').textContent };
  setMode('long'); timer.endAt = Date.now() - 1; tick();
  return JSON.stringify({ atLong, afterLong: { mode: timer.mode, round: DATA.round, dots: document.querySelectorAll('#roundDots i.on').length } });
})()`);
c.check('第 4 个番茄后进入长休息', cycle.atLong.mode === 'long', cycle.atLong.mode);
c.check('长休息时圆点全亮', cycle.atLong.dots === 4, cycle.atLong.dots);
c.check('今日累计 4 个番茄', cycle.atLong.tomatoes === '4', cycle.atLong.tomatoes);
c.check('长休息结束后循环清零', cycle.afterLong.round === 0 && cycle.afterLong.dots === 0, JSON.stringify(cycle.afterLong));
c.check('长休息后回到专注模式', cycle.afterLong.mode === 'focus', cycle.afterLong.mode);

/* 7. 主题切换 */
const theme = await json(`(function(){
  document.querySelector('.swatch[data-theme="ocean"]').click();
  [...document.querySelectorAll('#schemeSeg button')].find(b => b.dataset.scheme === 'dark').click();
  return JSON.stringify({
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    gradient: document.querySelector('#gradStop1').getAttribute('stop-color'),
    scheme: document.documentElement.getAttribute('data-scheme'),
    meta: document.querySelector('meta[name=theme-color]').getAttribute('content'),
    saved: JSON.parse(localStorage.getItem('pomodoro.settings.v1')).theme
  });
})()`);
c.check('主色切换为海盐', theme.accent === '#4d8fd6', theme.accent);
c.check('进度环渐变跟随主题', theme.gradient === '#4d8fd6', theme.gradient);
c.check('深色面板切换生效', theme.scheme === 'dark', theme.scheme);
c.check('浏览器主题色同步', theme.meta === '#12161c', theme.meta);
c.check('主题已持久化', theme.saved === 'ocean', theme.saved);

/* 8. 壁纸：内置 / 适应方式 / 模糊 / 遮罩 */
const wp = await json(`(function(){
  document.querySelector('.tile[data-wp="night"]').click();
  [...document.querySelectorAll('#fitSeg button')].find(b => b.dataset.fit === 'contain').click();
  const after = { img: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 20), size: document.querySelector('#bg-layer').style.backgroundSize };
  const dim = document.querySelector('#dimRange');
  dim.value = 70; dim.dispatchEvent(new Event('input', {bubbles:true}));
  const blur = document.querySelector('#blurRange');
  blur.value = 8; blur.dispatchEvent(new Event('input', {bubbles:true}));
  return JSON.stringify({ after,
    tint: getComputedStyle(document.documentElement).getPropertyValue('--tint').trim(),
    blur: getComputedStyle(document.documentElement).getPropertyValue('--blur').trim(),
    blurLabel: document.querySelector('#blurVal').textContent,
    tileActive: document.querySelector('.tile[data-wp="night"]').classList.contains('active')
  });
})()`);
c.check('选择内置壁纸「夜空」生效', wp.after.img.includes('radial-gradient'), wp.after.img);
c.check('适应方式切换为完整显示', wp.after.size === 'contain', wp.after.size);
c.check('遮罩深度滑块生效', wp.tint.includes('0.7'), wp.tint);
c.check('模糊滑块生效', wp.blur === '8px' && wp.blurLabel === '8px', wp.blur);
c.check('当前壁纸高亮', wp.tileActive === true, wp.tileActive);

/* 9. 上传本地图片壁纸（IndexedDB 路径） */
const upload = await json(`(async function(){
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 800);
  g.addColorStop(0, '#ff6b8a'); g.addColorStop(1, '#3a4a8f');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await fileToWallpaper(new File([blob], 'my-wall.png', { type: 'image/png' }));
  const stored = await Media.get('wallpaper');
  return JSON.stringify({
    type: S.wallpaper.type,
    bg: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 5),
    storedSize: stored ? stored.size : 0,
    tileActive: document.querySelector('.tile[data-wp="upload"]').classList.contains('active'),
    hint: document.querySelector('#wpSizeHint').textContent
  });
})()`);
c.check('上传图片后壁纸类型变为 image', upload.type === 'image', upload.type);
c.check('背景使用 blob 图片', upload.bg === 'url("', upload.bg);
c.check('图片已存入 IndexedDB', upload.storedSize > 1000, upload.storedSize);
c.check('上传图块高亮', upload.tileActive === true, upload.tileActive);
c.check('显示已保存提示', upload.hint.includes('已保存'), upload.hint);

/* 10. 重新加载后壁纸与数据仍在 */
await session.reload();
const reload = await json(`JSON.stringify({
  bg: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 5),
  theme: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  scheme: document.documentElement.getAttribute('data-scheme'),
  tomatoes: document.querySelector('#todayTomatoes').textContent,
  tasks: document.querySelectorAll('#taskList li').length,
  sTotal: document.querySelector('#sTotal').textContent,
  streak: document.querySelector('#sStreak').textContent
})`);
c.check('刷新后自定义壁纸仍在', reload.bg === 'url("', reload.bg);
c.check('刷新后主题仍是海盐 + 深色', reload.theme === '#4d8fd6' && reload.scheme === 'dark', reload.theme + '/' + reload.scheme);
c.check('刷新后专注记录仍在（4 个番茄）', reload.tomatoes === '4' && reload.sTotal === '4', reload.tomatoes + '/' + reload.sTotal);
c.check('刷新后任务仍在', reload.tasks === 1, reload.tasks);
c.check('连续天数计算正确（1 天）', reload.streak === '1', reload.streak);

/* 11. 修改时长设置 */
const dur = await json(`(function(){
  pause();
  const f = document.querySelector('#setFocus');
  f.value = 30; f.dispatchEvent(new Event('change', {bubbles:true}));
  const e = document.querySelector('#setEvery');
  e.value = 3; e.dispatchEvent(new Event('change', {bubbles:true}));
  return JSON.stringify({
    focus: S.focus, every: S.longEvery,
    time: document.querySelector('#timeDisplay').textContent,
    dots: document.querySelectorAll('#roundDots i').length,
    stored: JSON.parse(localStorage.getItem('pomodoro.settings.v1')).focus
  });
})()`);
c.check('专注时长改为 30 分钟并应用', dur.focus === 30 && dur.time === '30:00', dur.time);
c.check('每 3 轮长休息的圆点数同步', dur.every === 3 && dur.dots === 3, dur.dots);
c.check('设置已持久化', dur.stored === 30, dur.stored);

/* 12. 跳过 / 数据导出 */
const skip = await js(`(function(){ setMode('focus'); skipSession(); return timer.mode; })()`);
c.check('跳过专注后进入休息', skip === 'short', skip);
const exportOk = await js(`(function(){
  let clicked = null;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ clicked = this.download; };
  document.querySelector('#exportBtn').click();
  HTMLAnchorElement.prototype.click = orig;
  return clicked || '';
})()`);
c.check('导出数据生成文件名', /番茄自习室-数据-\d{4}-\d{2}-\d{2}\.json/.test(exportOk), exportOk);

c.info('浏览器: ' + session.browserPath);
const failed = c.report(session.problems);
await session.close();
await server.close();
process.exit(failed ? 1 : 0);
