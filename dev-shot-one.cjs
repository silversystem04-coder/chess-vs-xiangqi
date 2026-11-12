/* 通用单页截图：node dev-shot-one.cjs <页面路径|URL> <输出png> [宽] [高] */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const target = process.argv[2];
const outPng = process.argv[3] || 'shots/shot.png';
const W = process.argv[4] || '1560', H = process.argv[5] || '1040';
if (!target) { console.error('用法：node dev-shot-one.cjs <页面路径|URL> <输出png> [宽] [高]'); process.exit(2); }

const dir = __dirname;
const outPath = path.isAbsolute(outPng) ? outPng : path.join(dir, outPng);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const url = /^https?:|^file:/.test(target)
  ? target
  : 'file:///' + (path.isAbsolute(target) ? target : path.join(dir, target)).replace(/\\/g, '/');

const edge = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => fs.existsSync(p));
if (!edge) { console.error('未找到 Edge'); process.exit(2); }

const prof = path.join(os.tmpdir(), 'dsh-shot1-' + Date.now().toString(36));
const errf = path.join(dir, '_shot1-err.txt');
const fd = fs.openSync(errf, 'w');
const r = spawnSync(edge, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + prof, '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=' + W + ',' + H, '--virtual-time-budget=15000',
  '--screenshot=' + outPath, url
], { stdio: ['ignore', fd, fd], timeout: 120000 });
fs.closeSync(fd);
const st = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
console.log(url.split('/').pop() + ' → ' + path.relative(dir, outPath) + '  exit=' + r.status + '  ' + st + 'B' + (st ? '' : '  (失败)'));
try { fs.unlinkSync(errf); } catch (e) {}
