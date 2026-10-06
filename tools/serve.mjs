/**
 * 本地开发用静态服务器：node tools/serve.mjs（等价于 npm start）
 * 通过 http:// 打开可以让图片壁纸走 IndexedDB，保留更好的画质。
 */
import { serve } from '../tests/lib/harness.mjs';

const PREFERRED = Number(process.env.PORT || 5173);
const site = await serve(undefined, PREFERRED);
const url = site.url('index.html');

console.log('番茄自习室已启动：');
console.log('  ' + url);
console.log('按 Ctrl+C 停止。');
