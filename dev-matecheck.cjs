/* 杀法可辩护性分析（跟着当前布局走，不写死坐标）
 * 1) 让 AI 自战到有人被吃王，检查那一手是不是真杀（逐一看每个合法着法能否解将）
 * 2) 回到开局：红方第一手之后，蓝方是否已有深度 4 内的强制杀
 * 3) 打印红方最佳第一手与蓝方最强回应
 * 用法：node dev-matecheck.cjs [深度]
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;
const CN = E.CN, IN = E.IN;
const MATE_LINE = 9e6;
const DEPTH = +(process.argv[2] || 3);

/* --- 1) 自战到吃王，回看最后一手是否真杀 --- */
console.log('\n【1】AI 深度 ' + DEPTH + ' 自战：被吃王那一手是不是真杀？');
let b = E.initialBoard(), side = CN, ply = 0, moves = [];
let loserBoard = null, loser = -1;
while (ply < 120) {
  const mv = E.bestMove(b, side, DEPTH);
  if (!mv) break;
  const txt = E.moveText(b, mv);
  const cap = E.applyMove(b, mv);
  ply++;
  moves.push((side === CN ? '红 ' : '蓝 ') + txt + (cap ? ' 吃' + E.pieceName(cap) : ''));
  if (cap && E.isKing(cap)) { loserBoard = b; loser = E.other(side); break; }
  side = E.other(side);
}
if (!loserBoard) console.log('    ' + ply + ' 步内无人被吃王');
else {
  console.log('    末手：' + moves[moves.length - 1] + '（第 ' + ply + ' 步）');
  // 把被吃掉的王放回去，看看当时是否真的无解
  const pre = loserBoard.slice();
  pre[E.idx(0, 0)] = null;                       // 占位，下面重新构造
  const back = E.initialBoard();
  // 直接用「被吃前一步」的局面：末手是 mn，从末手前的局面重放
  const preBoard = E.initialBoard();
  for (let i = 0; i < moves.length - 1; i++) {
    const m = moves[i];
  }
  // 更简单可靠：从头重放，停在最后一手之前
  const pb = E.initialBoard();
  let s2 = CN, k = 0;
  let lastMove = null;
  while (k < 120) {
    const mv = E.bestMove(pb, s2, DEPTH);
    if (!mv) break;
    const capx = pb[E.idx(mv.tx, mv.ty)];
    lastMove = { mv, s2, capx, snapshot: pb.slice() };
    E.applyMove(pb, mv);
    k++;
    if (capx && E.isKing(capx)) break;
    s2 = E.other(s2);
  }
  const pb2 = lastMove.snapshot;
  const victim = lastMove.s2 === CN ? IN : CN;
  const mated = lastMove.capx;
  console.log('    被吃的是 ' + (mated.s === CN ? '红帅' : '黑王') + '，末手由 ' + (lastMove.s2 === CN ? '红方' : '蓝方') + '走出');
  console.log('    走这手之前，轮到' + (victim === CN ? '红方' : '蓝方') + '：被将？ ' + E.isAttacked(pb2, victim));
  const vmoves = E.genMoves(pb2, victim);
  let safe = 0, ex = [];
  for (const mv of vmoves) {
    const nb = pb2.slice();
    E.applyMove(nb, mv);
    if (!E.isAttacked(nb, victim)) { safe++; if (ex.length < 5) ex.push(E.moveText(pb2, mv)); }
  }
  console.log('    该方合法着法 ' + vmoves.length + ' 个，能解将的 ' + safe + ' 个 → ' +
    (safe === 0 ? '真杀（无解）' : '有解：' + ex.join('、')));
}

/* --- 2) 开局后蓝方是否已有强制杀 --- */
console.log('\n【2】开局：红方每一手之后，蓝方在 4 层内是否有强制杀？');
const init = E.initialBoard();
const fm = E.genMoves(init, CN);
let threats = 0, tot = 0;
for (const mv of fm) {
  const nb = init.slice();
  E.applyMove(nb, mv);
  const r = E.bestMove(nb, IN, 4);
  tot++;
  if (r && r.score >= MATE_LINE) threats++;
}
console.log('    红方第一手 ' + tot + ' 种，走后蓝方 4 层内已见杀的：' + threats + ' 种');

/* --- 3) 双方首选 --- */
console.log('\n【3】双方首选');
const b3 = E.initialBoard();
const r1 = E.bestMove(b3, CN, 5);
console.log('    红方深度5首选：' + E.moveText(b3, r1) + '（评分 ' + r1.score + '）');
E.applyMove(b3, r1);
const i1 = E.bestMove(b3, IN, 4);
console.log('    蓝方深度4回应：' + E.moveText(b3, i1) + '（评分 ' + i1.score + '）');
E.applyMove(b3, i1);
const r2 = E.bestMove(b3, CN, 4);
console.log('    红方深度4再应：' + E.moveText(b3, r2) + '（评分 ' + r2.score + '）');
console.log('');
