/* 多尺寸布局校验：node test-sizes.cjs
 * 检查每种棋盘尺寸下双方阵型、九宫、河界、走法生成是否都自洽 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;
const CN = E.CN, IN = E.IN;

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  if (c) { pass++; }
  else { fail++; console.log('  FAIL [' + CUR + '] ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); }
};
let CUR = '';

const SIZES = [[9, 10], [9, 12], [10, 10], [11, 12], [12, 12], [13, 12]];
const counts = [];

for (const [N, M] of SIZES) {
  CUR = N + '×' + M;
  const b = E.initialBoard(N, M);
  const CF = E.CF, RIVER = E.RIVER;
  const at = (x, y) => b[E.idx(x, y)];
  const pieces = b.filter(Boolean);

  // 基本几何
  ok('棋盘大小正确', b.length === N * M, b.length);
  ok('所有棋子都在盘内', pieces.length > 0 && b.every(p => p === null || (p.s === CN || p.s === IN)));
  ok('中央列 ' + CF + '、河在第 ' + RIVER + ' 行', CF === (N % 2 ? (N - 1) / 2 : N / 2 - 1) && RIVER === M / 2);

  // 双方主帅位置
  ok('帅在中央列底线', at(CF, M - 1) && at(CF, M - 1).t === 'K' && at(CF, M - 1).s === CN);
  ok('王在王后正前方', at(CF, 0) && at(CF, 0).t === 'q' && at(CF, 1) && at(CF, 1).t === 'k');

  // 兵力数量
  const cnP = pieces.filter(p => p.s === CN);
  const inP = pieces.filter(p => p.s === IN);
  ok('红方 16 子', cnP.length === 16, cnP.length);
  ok('蓝方 13 子（5 兵）', inP.length === 13 && inP.filter(p => p.t === 'p').length === 5, inP.length);
  ok('红方 5 兵 / 2 炮 / 2 车', cnP.filter(p => p.t === 'P').length === 5 &&
    cnP.filter(p => p.t === 'C').length === 2 && cnP.filter(p => p.t === 'R').length === 2);

  // 九宫约束
  const km = E.movesFrom(b, CF, M - 1);
  ok('帅只能在九宫内', km.length > 0 && km.every(m => Math.abs(m.tx - CF) <= 1 && m.ty >= M - 3 && m.ty <= M - 1), km.length);
  const am = E.movesFrom(b, CF - 1, M - 1);
  ok('仕只能在九宫内斜走', am.length > 0 && am.every(m => Math.abs(m.tx - CF) <= 1 && m.ty >= M - 3), am.length);

  // 象不过河
  const em = E.movesFrom(b, CF - 2, M - 1);
  ok('相不过河', em.every(m => m.ty >= RIVER), em.map(m => E.sqName(m.tx, m.ty)));

  // 兵未过河不能横走
  const pm = E.movesFrom(b, CF, M - 4);
  ok('未过河的兵只能直进', pm.length === 1 && pm[0].tx === CF && pm[0].ty === M - 5);
  const crossed = E.emptyBoard();
  crossed[E.idx(CF, RIVER - 1)] = { s: CN, t: 'P' };
  crossed[E.idx(CF, M - 1)] = { s: CN, t: 'K' };
  crossed[E.idx(CF, 1)] = { s: IN, t: 'k' };
  ok('过河后的兵可横走', E.movesFrom(crossed, CF, RIVER - 1).length === 3);

  // 国际象棋：兵首步两格（兵的位置随阵型变，动态找一个）
  let pawnX = -1;
  for (let x = 0; x < E.N; x++) { const q = b[E.idx(x, 1)]; if (q && q.s === E.IN && q.t === 'p') { pawnX = x; break; } }
  const ip = pawnX >= 0 ? E.movesFrom(b, pawnX, 1) : [];
  ok('蓝兵首步可走两格', ip.some(m => m.ty === 3), pawnX);

  // 奇数宽度应当左右镜像对称
  if (N % 2 === 1) {
    let sym = true;
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < CF; x++) {
        const a = at(x, y), c = at(2 * CF - x, y);
        if ((a ? a.t : null) !== (c ? c.t : null)) sym = false;
      }
    }
    ok('奇数宽度下两军阵型左右镜像对称', sym);
  }

  // 走法与随机对弈健壮性
  const cm = E.genMoves(b, CN), im = E.genMoves(b, IN);
  ok('开局双方都有走法', cm.length > 0 && im.length > 0, [cm.length, im.length]);
  ok('开局无子越界', cm.concat(im).every(m => m.tx >= 0 && m.tx < N && m.ty >= 0 && m.ty < M));

  let err = null, plies = 0;
  try {
    let side = CN, bb = b.slice();
    for (let i = 0; i < 200; i++) {
      const ms = E.genMoves(bb, side);
      if (!ms.length) break;
      const m = ms[Math.floor(Math.random() * ms.length)];
      if (m.tx < 0 || m.tx >= N || m.ty < 0 || m.ty >= M) throw new Error('越界走法');
      const cap = E.applyMove(bb, m);
      plies++;
      if (cap && E.isKing(cap)) break;
      side = E.other(side);
    }
  } catch (e) { err = e; }
  ok('随机自对弈 200 步无异常且不越界', !err, err && err.message);

  // AI 能给出合法着法
  const mv = E.bestMove(b, CN, 2);
  ok('AI 能给出合法着法', !!mv && cm.some(m => m.fx === mv.fx && m.fy === mv.fy && m.tx === mv.tx && m.ty === mv.ty));

  counts.push({ size: CUR, red: cm.length, blue: im.length, plies });
  console.log('  ' + CUR.padEnd(7) + ' 中央列 ' + CF + '  红走法 ' + String(cm.length).padStart(3) +
    '  蓝走法 ' + String(im.length).padStart(3) + '  随机对弈 ' + String(plies).padStart(3) + ' 步   ' +
    (N % 2 ? '左右对称' : '偶数宽度：阵型以中央列对称，右侧多留空格'));
}

console.log('\n多尺寸布局校验：' + pass + ' 通过 / ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
