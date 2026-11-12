/* 逐步追踪一局 AI 自战，看清胜负是怎么产生的
 * 用法：node dev-trace.cjs [深度] [让子] */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;
const CN = E.CN, IN = E.IN;

const depth = +(process.argv[2] || 3);
const hand = process.argv[3] || 'none';
const b = E.initialBoard();
if (hand === 'in-R') b[E.idx(0, 0)] = null;

let side = CN, ply = 0;
const hist = [];
while (ply < 60) {
  const mv = E.bestMove(b, side, depth);
  if (!mv) { console.log('无着可走，' + E.SIDE_NAME[E.other(side)] + ' 胜'); break; }
  const txt = E.moveText(b, mv);
  const mover = side === CN ? '红(中象)' : '蓝(国象)';
  const cap = E.applyMove(b, mv);
  ply++;
  hist.push(mover + ' ' + txt + (cap ? '   吃掉 ' + E.pieceName(cap) : '') +
    '   [评分 ' + (mv.score === undefined ? '?' : mv.score) + ', ' + mv.nodes + ' 节点]');
  console.log(String(ply).padStart(2) + '. ' + hist[hist.length - 1]);
  if (cap && E.isKing(cap)) { console.log('\n>>> 第 ' + ply + ' 步：' + mover + ' 吃掉对方主帅，终局'); break; }
  side = E.other(side);
}

const glyph = p => p ? (p.s === CN ? E.CN_NAME[p.t] : E.IN_GLYPH[p.t]) : '·';
console.log('\n终局局面：');
for (let y = 0; y < E.M; y++) {
  let row = String(E.M - y).padStart(2) + ' ';
  for (let x = 0; x < E.N; x++) row += glyph(b[E.idx(x, y)]) + ' ';
  console.log(row);
}
console.log('   ' + E.FILES.split('').join(' '));
