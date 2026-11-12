/* 用无头 Edge 跑 _selftest.html 并打印自检结果
 * 用法：node dev-run-selftest.cjs [页面文件] [budget_ms] */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = __dirname;
const PAGE = process.argv[2] || '_selftest.html';
const page = path.join(dir, PAGE);
if (!fs.existsSync(page)) { console.error('缺少 ' + PAGE + '，请先运行 node dev-selftest.cjs'); process.exit(2); }

const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH || ''
].filter(Boolean);
const edge = candidates.find(p => fs.existsSync(p));
if (!edge) { console.error('未找到 Edge/Chrome'); process.exit(2); }

const out = path.join(dir, '_selftest-dom.txt');
const err = path.join(dir, '_selftest-err.txt');
const prof = path.join(os.tmpdir(), 'dsh-edge-' + Date.now().toString(36));
const url = 'file:///' + page.replace(/\\/g, '/');
const budget = process.argv[3] || '40000';

const fdOut = fs.openSync(out, 'w'), fdErr = fs.openSync(err, 'w');
const t0 = Date.now();
const r = spawnSync(edge, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + prof, '--hide-scrollbars', '--window-size=1500,1000',
  '--virtual-time-budget=' + budget, '--dump-dom', url
], { stdio: ['ignore', fdOut, fdErr], timeout: 180000 });
fs.closeSync(fdOut); fs.closeSync(fdErr);
console.log('edge exit=' + r.status + '  ' + (Date.now() - t0) + 'ms  stdout=' + fs.statSync(out).size + 'B');

const dom = fs.readFileSync(out, 'utf8');
const title = (dom.match(/<title>([\s\S]*?)<\/title>/) || [, '?'])[1];
console.log('title: ' + title);
const m = dom.match(/<pre id="selftest"[^>]*>([\s\S]*?)<\/pre>/);
if (!m) { console.error('未找到自检输出'); process.exit(1); }
const txt = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
console.log(txt.trim());

// 收拾临时产物，只留下源码与 shots/
for (const f of [PAGE, '_selftest-dom.txt', '_selftest-err.txt']) {
  try { fs.unlinkSync(path.join(dir, f)); } catch (e) {}
}
process.exit(/FAIL/.test(title) ? 1 : 0);
