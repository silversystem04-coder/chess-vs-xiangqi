/* 生成截图用页面并调用无头 Edge 出图
 * 用法：node dev-shot.cjs   → 输出 shot-start.png / shot-mid.png / shot-ai.png */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;

/* --- 用引擎自对弈生成一段中局棋谱 --- */
function playGame(plies, depth) {
  const b = E.initialBoard();
  const log = [];
  let side = E.CN;
  for (let i = 0; i < plies; i++) {
    const mv = E.bestMove(b, side, depth);
    if (!mv) break;
    log.push([mv.fx, mv.fy, mv.tx, mv.ty]);
    const cap = E.applyMove(b, mv);
    if (cap && E.isKing(cap)) break;
    side = E.other(side);
  }
  return log;
}
const midMoves = playGame(16, 2);
console.log('中局棋谱 ' + midMoves.length + ' 手：' + midMoves.map(m => m.join(',')).join(' | '));

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const inject = moves => `<script>
window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message+' @'+e.lineno));
window.addEventListener('load',()=>setTimeout(()=>{
  const api=window.__api;
  const seq=${JSON.stringify(moves)};
  let i=0;
  (function step(){
    if(i>=seq.length){ window.__shotReady=true; document.title='SHOT READY'; return; }
    const m=seq[i++];
    api.tryMove({fx:m[0],fy:m[1],tx:m[2],ty:m[3]});
    setTimeout(step, 300);
  })();
},250));
</script>`;

function write(name, extra) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, html.replace('</body>', (extra || '') + '\n</body>'));
  return p;
}
const pages = {
  'start.png': write('_shot-start.html', '<script>window.addEventListener("load",()=>setTimeout(()=>{window.__game.anim=null;document.title="SHOT READY";},300));</script>'),
  'mid.png': write('_shot-mid.html', inject(midMoves)),
  'ai.png': write('_shot-ai.html', `<script>
window.addEventListener('load',()=>setTimeout(()=>{
  [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='电脑执国际').click();
  setTimeout(()=>{ window.__game.anim=null; document.title='SHOT READY'; }, 900);
},300));
</script>`),
  // 选中棋子：可走点 + 上一步高亮
  'select.png': write('_shot-select.html', `<script>
window.addEventListener('load',()=>setTimeout(()=>{
  const api=window.__api;
  api.tryMove({fx:1,fy:7,tx:4,ty:7});                 // 红炮 b3→e3（中炮）
  setTimeout(()=>{
    api.tryMove({fx:2,fy:1,tx:2,ty:3});               // 黑兵 c9→c7
    setTimeout(()=>{ api.selectAt(4,7); window.__game.anim=null; document.title='SHOT READY'; }, 400);
  }, 400);
},300));
</script>`),
  // 被将军：红色光晕 + 将军标签
  'check.png': write('_shot-check.html', `<script>
window.addEventListener('load',()=>setTimeout(()=>{
  const api=window.__api, G=window.__game, E=api.E;
  const b=G.board;
  for(let i=0;i<b.length;i++) b[i]=null;
  b[E.idx(4,9)]={s:0,t:'K'};   // 红帅
  b[E.idx(0,0)]={s:1,t:'k'};   // 黑王
  b[E.idx(4,6)]={s:1,t:'r'};   // 黑车沿 e 列照住红帅（中间不留子）
  b[E.idx(3,7)]={s:0,t:'C'};   // 红炮放在 d3，别挡住那条线
  b[E.idx(1,9)]={s:0,t:'R'};
  b[E.idx(1,0)]={s:1,t:'n'};
  G.turn=0; G.lastMove={fx:4,fy:2,tx:4,ty:6}; G.selected=null; G.legal=[];
  api.updateUI();
  setTimeout(()=>{ window.__game.anim=null; document.title='SHOT READY'; },300);
},300));
</script>`)
};

const edge = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => fs.existsSync(p));
if (!edge) { console.error('未找到 Edge'); process.exit(2); }

const outDir = path.join(dir, 'shots');
fs.mkdirSync(outDir, { recursive: true });

for (const [png, page] of Object.entries(pages)) {
  const url = 'file:///' + page.replace(/\\/g, '/');
  const prof = path.join(os.tmpdir(), 'dsh-shot-' + Date.now().toString(36));
  const errf = path.join(dir, '_shot-err.txt');
  const fd = fs.openSync(errf, 'w');
  const target = path.join(outDir, png);
  const r = spawnSync(edge, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + prof, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1560,1040', '--virtual-time-budget=20000',
    '--screenshot=' + target, url
  ], { stdio: ['ignore', fd, fd], timeout: 120000 });
  fs.closeSync(fd);
  const st = fs.existsSync(target) ? fs.statSync(target).size : 0;
  console.log('shots/' + png + ' → exit=' + r.status + ' ' + st + 'B' + (st ? '' : '  (失败)'));
  try { fs.unlinkSync(page); } catch (e) {}
}
try { fs.unlinkSync(path.join(dir, '_shot-err.txt')); } catch (e) {}
