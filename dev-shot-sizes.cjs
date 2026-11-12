/* 各棋盘尺寸的外观截图：node dev-shot-sizes.cjs
 * 直接给 index.html 加 ?size=NxM，出图到 shots/size-*.png */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const dir = __dirname;
const outDir = path.join(dir, 'shots');
fs.mkdirSync(outDir, { recursive: true });
const indexUrl = 'file:///' + path.join(dir, 'index.html').replace(/\\/g, '/');

const edge = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => fs.existsSync(p));
if (!edge) { console.error('未找到 Edge'); process.exit(2); }

const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['9x10', '9x12', '11x12', '12x12'];
for (const size of sizes) {
  const target = path.join(outDir, 'size-' + size + '.png');
  const prof = path.join(os.tmpdir(), 'dsh-size-' + Date.now().toString(36));
  const errf = path.join(dir, '_size-err.txt');
  const fd = fs.openSync(errf, 'w');
  const r = spawnSync(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + prof, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1560,1040', '--virtual-time-budget=15000',
    '--screenshot=' + target, indexUrl + '?size=' + size
  ], { stdio: ['ignore', fd, fd], timeout: 120000 });
  fs.closeSync(fd);
  const st = fs.existsSync(target) ? fs.statSync(target).size : 0;
  console.log('shots/size-' + size + '.png → exit=' + r.status + ' ' + st + 'B' + (st ? '' : '  (失败)'));
}
try { fs.unlinkSync(path.join(dir, '_size-err.txt')); } catch (e) {}
