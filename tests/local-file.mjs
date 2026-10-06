/**
 * 本地文件（file://）模式测试：直接双击 index.html 时的存储降级路径。
 * 运行：node tests/local-file.mjs
 */
import { launch, Checker, APP_URL, sleep } from './lib/harness.mjs';

const session = await launch({ url: APP_URL() });
const { js, json } = session;
const c = new Checker('本地文件（file://）模式');

const env = await json(`JSON.stringify({
  idb: idbOk,
  hint: document.querySelector('#wpSizeHint').textContent.slice(0, 40),
  time: document.querySelector('#timeDisplay').textContent,
  tiles: document.querySelectorAll('#builtinTiles .tile').length
})`);
c.check('计时器正常初始化', env.time === '25:00' && env.tiles === 12, env.time + '/' + env.tiles);
c.info('file:// 下 IndexedDB 可用 = ' + env.idb + '；提示文案 = ' + (env.hint || '(无)'));

/* 上传图片：按环境自动走 IndexedDB 或 localStorage 路径 */
const up = await json(`(async function(){
  const c = document.createElement('canvas'); c.width = 1400; c.height = 900;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1400, 900);
  g.addColorStop(0, '#1f6f8b'); g.addColorStop(1, '#0b1d3a');
  x.fillStyle = g; x.fillRect(0, 0, 1400, 900);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await fileToWallpaper(new File([blob], 'wall.png', { type: 'image/png' }));
  const saved = localStorage.getItem('pomodoro.wallpaper.v1') || '';
  return JSON.stringify({
    type: S.wallpaper.type,
    ls: saved.slice(0, 22),
    kb: Math.round(saved.length / 1024),
    bg: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 5),
    hint: document.querySelector('#wpSizeHint').textContent.slice(0, 20)
  });
})()`);
c.check('上传后壁纸类型为 image', up.type === 'image', up.type);
c.check('背景已切换到自定义图片', up.bg === 'url("', up.bg);
c.check('给出了保存结果提示', up.hint.includes('已保存'), up.hint);
if (env.idb) {
  c.check('IndexedDB 路径：图片以 blob 形式保存', up.ls === '', up.ls || 'blob');
} else {
  c.check('降级路径：图片压缩后存入 localStorage', up.ls === 'data:image/jpeg;base64', up.ls);
  c.check('压缩体积合理（< 2MB）', up.kb > 5 && up.kb < 2048, up.kb + 'KB');
}

/* 强制模拟「浏览器禁用 IndexedDB」，验证兜底路径 */
const fb = await json(`(async function(){
  Media.ok = async () => false;
  Media.set = async () => { throw new Error('blocked'); };
  Media.get = async () => null;
  localStorage.removeItem('pomodoro.wallpaper.v1');
  const c = document.createElement('canvas'); c.width = 2000; c.height = 1200;
  const x = c.getContext('2d');
  x.fillStyle = '#f6d365'; x.fillRect(0, 0, 2000, 1200);
  x.fillStyle = '#f2708a'; x.beginPath(); x.arc(1000, 600, 320, 0, 7); x.fill();
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const raw = blob.size;
  await fileToWallpaper(new File([blob], 'big.png', { type: 'image/png' }));
  const saved = localStorage.getItem('pomodoro.wallpaper.v1') || '';
  return JSON.stringify({
    raw: Math.round(raw / 1024),
    kb: Math.round(saved.length / 1024),
    head: saved.slice(0, 22),
    bg: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 12),
    hint: document.querySelector('#wpSizeHint').textContent
  });
})()`);
c.check('禁用 IndexedDB 后回退到 dataURL 存储', fb.head === 'data:image/jpeg;base64', fb.head);
c.check('大图被压缩后保存', fb.kb > 5 && fb.kb < 1900, fb.raw + 'KB → ' + fb.kb + 'KB');
c.check('背景使用 dataURL', fb.bg.startsWith('url("data:'), fb.bg);
c.check('降级提示说明保存位置', fb.hint.includes('已保存到本机'), fb.hint);

/* 计时与记录在 file:// 下同样可用 */
await js(`document.querySelector('#taskInput').value = '复习线性代数';
  document.querySelector('#taskForm').dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
  timer.endAt = Date.now() - 1; tick(); 'ok'`);
c.check('完成番茄计数正常', (await js(`document.querySelector('#todayTomatoes').textContent`)) === '1');

await session.reload();
const re = await json(`JSON.stringify({
  bg: document.querySelector('#bg-layer').style.backgroundImage.slice(0, 12),
  tomatoes: document.querySelector('#todayTomatoes').textContent,
  tasks: document.querySelectorAll('#taskList li').length
})`);
c.check('刷新后自定义壁纸仍在', re.bg.startsWith('url("'), re.bg);
c.check('刷新后番茄记录仍在', re.tomatoes === '1', re.tomatoes);
c.check('刷新后任务仍在', re.tasks === 1, re.tasks);

const failed = c.report(session.problems);
await session.close();
process.exit(failed ? 1 : 0);
