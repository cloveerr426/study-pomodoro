/**
 * 零依赖的端到端测试工具。
 *
 * 做的事情：
 *   1. 用 Node 内置 http 起一个本地静态服务器，托管 index.html；
 *   2. 启动本机已有的 Chrome / Edge 无头模式（不需要 npm install）；
 *   3. 通过 DevTools 协议（CDP）驱动页面：执行脚本、断言、截图；
 *   4. 附带一个极简 PNG 解码器，可以对截图做像素级亮度 / 对比度检查。
 *
 * 依赖：Node.js >= 22（需要内置的 fetch 与 WebSocket）。浏览器路径可用
 * 环境变量 BROWSER 或 CHROME_PATH 指定，否则自动探测常见安装位置。
 */
import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP_URL = () => pathToFileURL(path.join(ROOT, 'index.html')).href;

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- 端口 / 静态服务器 ---------------- */

export async function freePort() {
  return new Promise(res => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

/**
 * 起一个本地静态服务器。
 * @param {string} rootDir 站点根目录，默认仓库根目录
 * @param {number} preferredPort 期望端口，被占用时自动换一个空闲端口
 */
export async function serve(rootDir = ROOT, preferredPort = 0) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(String(req.url).split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(rootDir, rel || 'index.html');
    if (!file.startsWith(rootDir)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
  let port = preferredPort || await freePort();
  try {
    await new Promise((r, j) => {
      server.once('error', j);
      server.listen(port, '127.0.0.1', r);
    });
  } catch (e) {
    port = await freePort();
    await new Promise(r => server.listen(port, '127.0.0.1', r));
  }
  return {
    port,
    url: p => `http://127.0.0.1:${port}/${String(p || 'index.html').replace(/^\/+/, '')}`,
    close: () => new Promise(r => server.close(r))
  };
}

/* ---------------- 浏览器探测 ---------------- */

function which(bin) {
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter(Boolean)
    : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, bin + ext);
      try { if (fs.existsSync(p)) return p; } catch (e) {}
    }
  }
  return null;
}

export function findBrowser() {
  const local = process.env.LOCALAPPDATA;
  const candidates = [
    process.env.BROWSER,
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'google-chrome-stable',
    'google-chrome',
    'chromium',
    'chromium-browser',
    'microsoft-edge',
    'msedge'
  ].filter(Boolean);
  for (const c of candidates) {
    if (path.isAbsolute(c)) {
      if (fs.existsSync(c)) return c;
    } else {
      const p = which(c);
      if (p) return p;
    }
  }
  return null;
}

/* ---------------- CDP 会话 ---------------- */

async function connect(devtoolsPort) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('需要 Node.js 22 及以上版本（内置 WebSocket）。当前版本：' + process.version);
  }
  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`)).json();
      target = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
    } catch (e) {}
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('浏览器启动超时（拿不到调试目标）');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('无法连接 DevTools 协议'));
  });

  let id = 0;
  const pending = new Map();
  const problems = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      problems.push('未捕获异常: ' + (d.exception?.description || d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      problems.push('控制台 ' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      problems.push('日志错误: ' + m.params.entry.text);
    }
  };
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  return { ws, send, problems };
}

/**
 * 启动浏览器并打开页面。
 * @param {{url?:string, width?:number, height?:number, args?:string[], wait?:number}} opts
 */
export async function launch(opts = {}) {
  const bin = findBrowser();
  if (!bin) {
    throw new Error('找不到 Chrome / Edge。请设置环境变量 BROWSER 指向浏览器可执行文件。');
  }
  const width = opts.width || 1280;
  const height = opts.height || 880;
  const devtoolsPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-e2e-'));
  const args = [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-software-rasterizer',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-sync',
    '--mute-audio',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${devtoolsPort}`,
    ...(opts.args || [])
  ];
  if (opts.url) args.push(opts.url);

  const proc = spawn(bin, args, { stdio: 'ignore' });
  const kill = () => {
    try { proc.kill(); } catch (e) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  };
  process.on('exit', kill);

  const session = await connect(devtoolsPort);
  session.browserPath = bin;

  session.js = async expression => {
    const r = await session.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true
    });
    if (r.result?.exceptionDetails) {
      throw new Error('页面执行出错: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    }
    return r.result?.result?.value;
  };
  session.json = async expression => JSON.parse(await session.js(expression));
  session.viewport = async (w, h, mobile = false) => {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile
    });
    await sleep(opts.viewportDelay ?? 500);
  };
  session.screenshot = async () => {
    const r = await session.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(r.result.data, 'base64');
  };
  session.reload = async (wait = 1600) => {
    await session.send('Page.reload', { ignoreCache: false });
    await sleep(wait);
  };
  session.close = async () => {
    try { session.ws.close(); } catch (e) {}
    kill();
  };

  await sleep(opts.wait ?? 1800);
  return session;
}

/* ---------------- 断言收集 ---------------- */

export class Checker {
  constructor(title) { this.title = title; this.items = []; }
  check(name, ok, detail = '') {
    this.items.push({ name, ok: !!ok, detail: String(detail ?? '').slice(0, 180) });
    return !!ok;
  }
  info(text) { console.log('[信息] ' + text); }
  report(problems = []) {
    console.log(`\n===== ${this.title} =====`);
    for (const it of this.items) {
      console.log(`${it.ok ? 'PASS' : 'FAIL'}  ${it.name}${it.detail ? '   [' + it.detail + ']' : ''}`);
    }
    const failed = this.items.filter(i => !i.ok);
    console.log(`\n通过 ${this.items.length - failed.length}/${this.items.length}`);
    if (problems.length) {
      console.log('\n页面异常:');
      problems.slice(0, 12).forEach(p => console.log(' - ' + p));
    } else {
      console.log('页面无 JS 报错');
    }
    return failed.length + Math.min(problems.length, 1);
  }
}

/* ---------------- 截图解析（PNG → 亮度统计） ---------------- */

export function decodePNG(buf) {
  let p = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error('暂不支持的 PNG 格式（bitDepth=' + bitDepth + ', colorType=' + colorType + '）');
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const x = line[i];
      let v;
      if (ft === 0) v = x;
      else if (ft === 1) v = x + a;
      else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = x + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
      }
      cur[i] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, bpp, data: out };
}

/** 统计某个矩形区域内的亮度：均值、标准差、最小值、最大值 */
export function regionStats(img, rx, ry, rw, rh) {
  const x0 = Math.max(0, Math.round(rx)), y0 = Math.max(0, Math.round(ry));
  const x1 = Math.min(img.w, Math.round(rx + rw)), y1 = Math.min(img.h, Math.round(ry + rh));
  let n = 0, sum = 0, sum2 = 0, min = 255, max = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = y * img.w * img.bpp + x * img.bpp;
      const l = 0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2];
      n++; sum += l; sum2 += l * l;
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  if (!n) return { mean: 0, std: 0, min: 0, max: 0 };
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), min, max };
}

export function savePng(buf, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}
