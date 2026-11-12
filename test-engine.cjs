/* 引擎自测：node test-engine.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const E = sandbox.module.exports;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function has(ms, x, y, tx, ty) { return ms.some(m => m.fx === x && m.fy === y && m.tx === tx && m.ty === ty); }
function put(b, side, t, x, y) { b[E.idx(x, y)] = { s: side, t }; return b; }
function mk() { const b = E.emptyBoard(); put(b, E.CN, 'K', 4, 9); put(b, E.IN, 'k', 4, 0); return b; }

console.log('\n[1] 初始局面');
const init = E.initialBoard();
const cnMoves = E.genMoves(init, E.CN);
const inMoves = E.genMoves(init, E.IN);
console.log('  中国象棋初始走法 ' + cnMoves.length + ' 种，国际象棋 ' + inMoves.length + ' 种');
// 兵从 a4/i4 挪到 b4/h4 后，双炮的两条线变成"炮架=己方兵、目标=对方兵"，红方多了横走空间
ok('象棋初始走法数 = 50（新阵型基线）', cnMoves.length === 50, cnMoves.length);
// 兵墙压在王与双象前、双车放开 → 蓝方开局走法 31
ok('国象初始走法数 = 31（兵墙堵后、双车放开）', inMoves.length === 31, inMoves.length);
ok('后开局一步都走不了（四面被自家人堵死）', E.movesFrom(init, 4, 0).length === 0,
  E.movesFrom(init, 4, 0).length);
ok('双炮开局即可翻山吃 b10 / h10 的车（己方 b4/h4 兵作炮架）',
  has(cnMoves, 1, 7, 1, 0) && has(cnMoves, 7, 7, 7, 0));
ok('红兵落在 b4 / c4 / e4 / g4 / h4（两个边兵从 a4/i4 挪进来）', (() => {
  const files = [0, 1, 2, 3, 4].map(() => null);
  const ps = [];
  for (let x = 0; x < 9; x++) { const p = init[E.idx(x, 6)]; if (p && p.t === 'P') ps.push(x); }
  return ps.join(',') === '1,2,4,6,7';
})(), (() => { const ps = []; for (let x = 0; x < 9; x++) { const p = init[E.idx(x, 6)]; if (p && p.t === 'P') ps.push(x); } return ps; })());
ok('王在王后正前方：后在 e10、王在 e9', init[E.idx(4, 0)].t === 'q' && init[E.idx(4, 1)].t === 'k');
ok('后排七子缩进合拢并左右对称（b10..h10 = 车马象·后·象马车）', (() => {
  const seq = [1, 2, 3, 4, 5, 6, 7];
  for (let i = 0; i < 4; i++) {
    const a = init[E.idx(seq[i], 0)], b = init[E.idx(seq[seq.length - 1 - i], 0)];
    if (!a || !b || a.t !== b.t) return false;
  }
  return true;
})());
ok('a10 / i10 空出（两翼不再有子）', !init[E.idx(0, 0)] && !init[E.idx(8, 0)]);
ok('蓝方只剩 5 个兵', init.filter(p => p && p.s === E.IN && p.t === 'p').length === 5,
  init.filter(p => p && p.s === E.IN && p.t === 'p').length);
ok('双车正前方留空（b9 / h9 没有己方子）', (() => {
  const r1 = init[E.idx(1, 0)], r2 = init[E.idx(7, 0)];
  return r1.t === 'r' && r2.t === 'r' && !init[E.idx(1, 1)] && !init[E.idx(7, 1)];
})());
ok('兵墙在 c9 / d9 / f9 / g9，王前另有 e8 哨兵',
  [2, 3, 5, 6].every(x => init[E.idx(x, 1)] && init[E.idx(x, 1)].t === 'p') &&
  init[E.idx(4, 2)].t === 'p' && !init[E.idx(1, 1)] && !init[E.idx(7, 1)]);
ok('开局双方均未被将军', !E.isAttacked(init, E.CN) && !E.isAttacked(init, E.IN));
ok('d10 / f10 的两个象都被自家兵和王夹死（0 步）', (() => {
  const b1 = init[E.idx(3, 0)], b2 = init[E.idx(5, 0)];
  return b1.t === 'b' && b2.t === 'b' &&
    E.movesFrom(init, 3, 0).length === 0 && E.movesFrom(init, 5, 0).length === 0;
})());
ok('c10 / g10 的两个马各 3 步', (() => {
  const n1 = init[E.idx(2, 0)], n2 = init[E.idx(6, 0)];
  return n1.t === 'n' && n2.t === 'n' &&
    E.movesFrom(init, 2, 0).length === 3 && E.movesFrom(init, 6, 0).length === 3;
})());
ok('双车沿 b / h 线直下（各 7 步：一路到 b4/h4 吃兵 + 横挪一格）',
  E.movesFrom(init, 1, 0).length === 7 && E.movesFrom(init, 7, 0).length === 7,
  [E.movesFrom(init, 1, 0).length, E.movesFrom(init, 7, 0).length]);
ok('王只有 d8 / f8 两个活动格（其余全被自家子占住）', E.movesFrom(init, 4, 1).length === 2,
  E.movesFrom(init, 4, 1).map(m => E.sqName(m.tx, m.ty)));
ok('e8 哨兵挡住了中炮的直线威胁（吃不到王也吃不到后）', (() => {
  const b = E.initialBoard();
  E.applyMove(b, { fx: 1, fy: 7, tx: 4, ty: 7 });       // 炮 b3→e3
  const ms = E.movesFrom(b, 4, 7);
  return !ms.some(m => m.tx === 4 && m.ty === 0) && !ms.some(m => m.tx === 4 && m.ty === 1) &&
    ms.some(m => m.tx === 4 && m.ty === 2) && !E.isAttacked(b, E.IN);
})());
ok('红帅仍在 e1，两侧被仕夹住', E.kingSquare(init, E.CN) === E.idx(4, 9));
ok('开局 e 线上有己方 e4 兵，飞将打不到王', !has(cnMoves, 4, 9, 4, 1));

console.log('\n[1b] 飞将（只给中国象棋）');
{
  // 空盘：帅在 e1、王在 e9（同列且全空）→ 帅可以直接飞过去吃
  const b = E.emptyBoard();
  put(b, E.CN, 'K', 4, 9); put(b, E.IN, 'k', 4, 1);
  const km = E.movesFrom(b, 4, 9);
  ok('同列无阻挡时，帅可以飞将吃王', has(km, 4, 9, 4, 1), km.map(m => E.sqName(m.tx, m.ty)));
  // 中间挡一个子 → 飞将失效
  const b2 = E.emptyBoard();
  put(b2, E.CN, 'K', 4, 9); put(b2, E.IN, 'k', 4, 1); put(b2, E.CN, 'P', 4, 5);
  const km2 = E.movesFrom(b2, 4, 9);
  ok('同列被挡住时不能飞将', !has(km2, 4, 9, 4, 1));
  // 飞将只走直线：不同列不行
  const b3 = E.emptyBoard();
  put(b3, E.CN, 'K', 4, 9); put(b3, E.IN, 'k', 3, 1);
  ok('不同列不能飞将', !E.movesFrom(b3, 4, 9).some(m => m.ty < 7 && Math.abs(m.tx - 4) === 0));
  // 国际象棋的王没有这个特权
  const b4 = E.emptyBoard();
  put(b4, E.CN, 'K', 4, 9); put(b4, E.IN, 'k', 4, 1);
  const kim = E.movesFrom(b4, 4, 1);
  ok('国际象棋的王不能反向飞将（只走一格）', !kim.some(m => m.ty > 2), kim.map(m => E.sqName(m.tx, m.ty)));
  // 飞将吃王 = 终局
  const b5 = E.emptyBoard();
  put(b5, E.CN, 'K', 4, 9); put(b5, E.IN, 'k', 4, 1); put(b5, E.CN, 'R', 0, 9);
  const mv = E.bestMove(b5, E.CN, 2);
  ok('AI 会优先用飞将吃王', mv && mv.tx === 4 && mv.ty === 1, mv && E.moveText(b5, mv));
  const cap = E.applyMove(b5, mv);
  ok('飞将吃王后终局（王被吃）', cap && E.isKing(cap) && !E.hasKing(b5, E.IN));
}

console.log('\n[1c] 局面序列化（摆棋 / 导出 HTML 用）');
{
  const s = E.boardToString(init);
  ok('序列化成 90 字符', s.length === 90, s.length);
  const back = E.boardFromString(s);
  ok('字符串能还原成同样的棋子', JSON.stringify(back.map(p => p && p.t)) === JSON.stringify(init.map(p => p && p.t)));
  ok('非法字符会被拒绝', E.boardFromString('x'.repeat(90)) === null);
  ok('长度不对会被拒绝', E.boardFromString('...') === null);
  ok('defaultStart 与初始局面一致', E.defaultStart === s);
}

console.log('\n[1d] 河界：斜着走的不能跨河，过河那步是直走');
{
  const twoKings = (b) => { put(b, E.CN, 'K', 4, 9); put(b, E.IN, 'k', 4, 0); return b; };
  // 象在 c8：沿斜线走到 e6（岸边）为止，不能一步跨到 f5
  const b1 = twoKings(E.emptyBoard()); put(b1, E.IN, 'b', 2, 2);
  const m1 = E.movesFrom(b1, 2, 2);
  ok('象的斜线停在岸边（能到 e6，到不了 f5）', has(m1, 2, 2, 4, 4) && !has(m1, 2, 2, 5, 5) && !has(m1, 2, 2, 6, 6));
  // 站在岸边：用一格直走过河
  const b2 = twoKings(E.emptyBoard()); put(b2, E.IN, 'b', 4, 4);
  const m2 = E.movesFrom(b2, 4, 4);
  ok('岸边可以直走一格过河（e6→e5）', has(m2, 4, 4, 4, 5));
  ok('过河那一步不是斜的（f5 / d5 都不行）', !has(m2, 4, 4, 5, 5) && !has(m2, 4, 4, 3, 5));
  // 已经在对面：斜走恢复自由
  const b3 = twoKings(E.emptyBoard()); put(b3, E.IN, 'b', 5, 5);
  const m3 = E.movesFrom(b3, 5, 5);
  ok('过了河之后可以正常长距离斜走', has(m3, 5, 5, 7, 7) && has(m3, 5, 5, 3, 7));
  ok('对面岸边可以直走一格回河这侧（f5→f6）', has(m3, 5, 5, 5, 4));
  // 后：直线随便过河，斜线一样要停在岸边
  const b4 = twoKings(E.emptyBoard()); put(b4, E.IN, 'q', 4, 4);
  const m4 = E.movesFrom(b4, 4, 4);
  ok('后的直线可以自由过河', has(m4, 4, 4, 4, 1) && has(m4, 4, 4, 4, 8));
  ok('后的斜线同样不跨河', !has(m4, 4, 4, 5, 5) && !has(m4, 4, 4, 3, 5));
  // 王：斜着那一步不能跨河，直走可以
  const b5 = twoKings(E.emptyBoard()); put(b5, E.IN, 'k', 4, 4);
  const m5 = E.movesFrom(b5, 4, 4);
  ok('王斜着不能跨河、直走可以', !has(m5, 4, 4, 5, 5) && has(m5, 4, 4, 4, 5));
  // 马不受影响
  const b6 = twoKings(E.emptyBoard()); put(b6, E.IN, 'n', 3, 6);
  ok('马可以跳过河（不受这条限制）', has(E.movesFrom(b6, 3, 6), 3, 6, 4, 4));
  // 红方没有斜着滑行的子，直线照旧
  const b7 = twoKings(E.emptyBoard()); put(b7, E.CN, 'C', 4, 5); put(b7, E.CN, 'P', 4, 7);
  ok('红炮的直线不受河界影响', has(E.movesFrom(b7, 4, 5), 4, 5, 4, 1));
  // 直走过河时可以吃子
  const b8 = twoKings(E.emptyBoard()); put(b8, E.IN, 'b', 4, 4); put(b8, E.CN, 'R', 4, 5);
  ok('直走过河那一步可以吃掉对面的子', has(E.movesFrom(b8, 4, 4), 4, 4, 4, 5));
  // 不在岸边就没有直走特权
  const b9 = twoKings(E.emptyBoard()); put(b9, E.IN, 'b', 4, 3);
  ok('不在岸边时没有过河直走', !has(E.movesFrom(b9, 4, 3), 4, 3, 4, 4));
}

console.log('\n[2] 中国象棋特殊规则');{ // 炮翻山
  const b = mk(); put(b, E.CN, 'C', 4, 4); put(b, E.CN, 'P', 4, 5); put(b, E.IN, 'r', 4, 7);
  const ms = E.movesFrom(b, 4, 4);
  ok('炮隔一子吃子', has(ms, 4, 4, 4, 7));
  ok('炮不能落到炮架上', !has(ms, 4, 4, 4, 5));
  ok('炮不能穿过炮架落空点', !has(ms, 4, 4, 4, 6));
  ok('炮沿空路可走', has(ms, 4, 4, 4, 3) && has(ms, 4, 4, 8, 4) && has(ms, 4, 4, 0, 4));
  ok('炮吃子后不再延伸', !has(ms, 4, 4, 4, 8) && !has(ms, 4, 4, 4, 9));
}
{ // 炮横向翻山
  const b = mk(); put(b, E.CN, 'C', 2, 4); put(b, E.IN, 'p', 4, 4); put(b, E.IN, 'r', 6, 4);
  const ms = E.movesFrom(b, 2, 4);
  ok('炮横向隔子吃子', has(ms, 2, 4, 6, 4));
  ok('炮横向不能穿过两个子', !has(ms, 2, 4, 8, 4));
  ok('炮不能吃炮架本身', !has(ms, 2, 4, 4, 4));
}
{ // 马蹩腿
  const b = mk(); put(b, E.CN, 'H', 4, 4); put(b, E.CN, 'P', 4, 5);
  const ms = E.movesFrom(b, 4, 4);
  ok('蹩马腿：不能走 (3,6)/(5,6)', !has(ms, 4, 4, 3, 6) && !has(ms, 4, 4, 5, 6));
  ok('不蹩时其余方向可走', has(ms, 4, 4, 3, 2) && has(ms, 4, 4, 5, 2) && has(ms, 4, 4, 6, 5) && has(ms, 4, 4, 2, 5));
  const b2 = mk(); put(b2, E.CN, 'H', 4, 4); put(b2, E.CN, 'P', 5, 4);
  const ms2 = E.movesFrom(b2, 4, 4);
  ok('横蹩马腿：不能走 (6,3)/(6,5)', !has(ms2, 4, 4, 6, 3) && !has(ms2, 4, 4, 6, 5));
}
{ // 塞象眼 & 不过河
  const b = mk(); put(b, E.CN, 'E', 2, 9);
  let ms = E.movesFrom(b, 2, 9);
  ok('相走田字 (0,7)/(4,7)', has(ms, 2, 9, 0, 7) && has(ms, 2, 9, 4, 7));
  put(b, E.CN, 'P', 1, 8);
  ms = E.movesFrom(b, 2, 9);
  ok('塞象眼后该方向不能走', !has(ms, 2, 9, 0, 7) && has(ms, 2, 9, 4, 7));
  const b2 = mk(); put(b2, E.CN, 'E', 2, 5);
  ok('相不能过河', !E.movesFrom(b2, 2, 5).some(m => m.ty < 5) && E.movesFrom(b2, 2, 5).length === 2);
}
{ // 仕/帅 不出宫
  const b = mk(); put(b, E.CN, 'A', 3, 8);
  const ms = E.movesFrom(b, 3, 8);
  ok('仕在宫内只走斜线', ms.every(m => Math.abs(m.tx - 3) === 1 && Math.abs(m.ty - 8) === 1));
  ok('仕不越宫 (2,7) 不可走', !has(ms, 3, 8, 2, 7) && has(ms, 3, 8, 4, 7));
  ok('仕不能斜回被帅占住的 (4,9)', !has(ms, 3, 8, 4, 9));
  const b2 = mk(); put(b2, E.CN, 'A', 4, 8);
  ok('仕被己方帅占位时不能斜回 (4,9)', !has(E.movesFrom(b2, 4, 8), 4, 8, 4, 9));
  ok('开局帅被双仕夹住只有一步', E.movesFrom(init, 4, 9).length === 1 && has(E.movesFrom(init, 4, 9), 4, 9, 4, 8));
  const kb = E.emptyBoard(); put(kb, E.CN, 'K', 4, 9); put(kb, E.IN, 'k', 0, 1);   // 王错开列，避免飞将混入
  const k = E.movesFrom(kb, 4, 9);
  ok('帅只能走宫内一步直行（两边空时可横走）', k.length === 3 && k.every(m => Math.abs(m.tx - 4) + Math.abs(m.ty - 9) === 1), k.length);
}
{ // 兵
  const b = mk(); put(b, E.CN, 'P', 4, 6);
  let ms = E.movesFrom(b, 4, 6);
  ok('未过河的兵只能直进', ms.length === 1 && has(ms, 4, 6, 4, 5));
  const b2 = mk(); put(b2, E.CN, 'P', 4, 4);
  ms = E.movesFrom(b2, 4, 4);
  ok('过河的兵可横走', ms.length === 3 && has(ms, 4, 4, 3, 4) && has(ms, 4, 4, 5, 4) && has(ms, 4, 4, 4, 3));
  const b3 = mk(); put(b3, E.CN, 'P', 4, 0);
  ms = E.movesFrom(b3, 4, 0);
  ok('兵到底线不能前进但可横走', ms.length === 2 && has(ms, 4, 0, 3, 0) && has(ms, 4, 0, 5, 0));
  const b4 = mk(); put(b4, E.CN, 'P', 4, 4); put(b4, E.IN, 'p', 3, 4);
  ok('兵按走法吃子（横吃）', has(E.movesFrom(b4, 4, 4), 4, 4, 3, 4));
}

console.log('\n[3] 国际象棋特殊规则');
{
  const b = mk(); put(b, E.IN, 'p', 4, 1); put(b, E.CN, 'P', 3, 2);
  const ms = E.movesFrom(b, 4, 1);
  ok('兵首步可走两格', has(ms, 4, 1, 4, 3) && has(ms, 4, 1, 4, 2));
  ok('兵斜吃', has(ms, 4, 1, 3, 2));
  const c = mk(); put(c, E.IN, 'p', 4, 1); put(c, E.CN, 'P', 4, 2);
  const m = E.movesFrom(c, 4, 1);
  ok('兵不吃正前方的敌子', !m.some(x => x.tx === 4 && x.ty === 2));
  const b2 = E.emptyBoard(); put(b2, E.CN, 'K', 0, 9); put(b2, E.IN, 'k', 8, 0); put(b2, E.IN, 'p', 4, 8);
  E.applyMove(b2, E.movesFrom(b2, 4, 8)[0]);
  ok('兵到底线升后', b2[E.idx(4, 9)] && b2[E.idx(4, 9)].t === 'q' && b2[E.idx(4, 9)].s === E.IN);
  const b3 = mk(); put(b3, E.IN, 'p', 0, 1); put(b3, E.CN, 'P', 0, 3);
  const m3 = E.movesFrom(b3, 0, 1);
  ok('两格路上有子则不能走两格', !has(m3, 0, 1, 0, 3) && has(m3, 0, 1, 0, 2));
}
{
  const b = mk(); put(b, E.IN, 'n', 4, 4);
  put(b, E.IN, 'p', 3, 4); put(b, E.IN, 'p', 5, 4); put(b, E.IN, 'p', 4, 3); put(b, E.IN, 'p', 4, 5);
  ok('国际象棋的马不被蹩腿', E.movesFrom(b, 4, 4).length === 8, E.movesFrom(b, 4, 4).length);
}
{
  const b = mk(); put(b, E.IN, 'q', 4, 4); put(b, E.CN, 'P', 4, 6); put(b, E.CN, 'P', 7, 1);
  const ms = E.movesFrom(b, 4, 4);
  ok('后走八个方向（斜线到岸边为止，不跨河）',
    has(ms, 4, 4, 4, 5) && has(ms, 4, 4, 4, 6) && has(ms, 4, 4, 0, 0) &&
    has(ms, 4, 4, 0, 4) && has(ms, 4, 4, 7, 1) && !has(ms, 4, 4, 8, 0) &&
    !has(ms, 4, 4, 5, 5) && !has(ms, 4, 4, 3, 5));
  ok('后吃子后停步', !has(ms, 4, 4, 4, 7) && has(ms, 4, 4, 7, 1) && !has(ms, 4, 4, 8, 0));
  const b2 = mk(); put(b2, E.IN, 'q', 4, 4); put(b2, E.IN, 'p', 4, 6);
  const ms2 = E.movesFrom(b2, 4, 4);
  ok('后被己方子挡住且不能吃', !has(ms2, 4, 4, 4, 6) && has(ms2, 4, 4, 4, 5));
  const b3 = mk(); put(b3, E.IN, 'b', 4, 4);
  const bm = E.movesFrom(b3, 4, 4);
  ok('象在岸边（空盘 9 步：8 斜 + 1 直走过河）',
    bm.length === 9 &&
    bm.filter(m => Math.abs(m.tx - 4) === Math.abs(m.ty - 4)).length === 8, bm.length);
  const b4 = mk(); put(b4, E.IN, 'r', 4, 4); put(b4, E.CN, 'P', 4, 2);
  const rm = E.movesFrom(b4, 4, 4);
  ok('车直行并可吃子', has(rm, 4, 4, 4, 2) && !has(rm, 4, 4, 4, 1) && has(rm, 4, 4, 0, 4));
  const b5 = mk(); put(b5, E.IN, 'r', 4, 4); put(b5, E.IN, 'p', 4, 2);
  ok('车不能吃己方子', !has(E.movesFrom(b5, 4, 4), 4, 4, 4, 2));
}
{
  const b2 = E.emptyBoard(); put(b2, E.CN, 'K', 4, 9); put(b2, E.IN, 'k', 4, 4);
  const km = E.movesFrom(b2, 4, 4);
  ok('王走周围（岸边斜着跨河的两格被河界挡掉，剩 6 格）',
    km.length === 6 && has(km, 4, 4, 5, 3) && has(km, 4, 4, 4, 5) && !has(km, 4, 4, 3, 5), km.length);
  const b6 = E.emptyBoard(); put(b6, E.CN, 'K', 4, 9); put(b6, E.IN, 'k', 0, 0); put(b6, E.CN, 'R', 1, 0);
  ok('王不能吃有保护的敌子（走法层面允许、由搜索避让）', has(E.movesFrom(b6, 0, 0), 0, 0, 1, 0));
}

console.log('\n[4] 吃王与将军判定');
{
  const b = E.emptyBoard();
  put(b, E.CN, 'K', 4, 9); put(b, E.IN, 'k', 0, 0); put(b, E.IN, 'r', 4, 2);
  ok('被车瞄准时判为将军', E.isAttacked(b, E.CN) && !E.isAttacked(b, E.IN));
  const cap = E.applyMove(b, { fx: 4, fy: 2, tx: 4, ty: 9 });
  ok('吃掉帅返回被吃子', cap && cap.t === 'K' && cap.s === E.CN);
  ok('帅被吃后 hasKing = false', !E.hasKing(b, E.CN));
  ok('王被吃后 isAttacked 不报错', E.isAttacked(b, E.CN) === false);
  const c = E.emptyBoard(); put(c, E.CN, 'K', 4, 9); put(c, E.IN, 'k', 3, 3); put(c, E.CN, 'P', 4, 3);
  ok('过河兵横走算将军', E.isAttacked(c, E.IN));
  const d = E.emptyBoard(); put(d, E.CN, 'K', 4, 9); put(d, E.IN, 'k', 4, 3); put(d, E.CN, 'C', 4, 5); put(d, E.CN, 'P', 4, 4);
  ok('炮隔子瞄准王算将军', E.isAttacked(d, E.IN));
  const e2 = E.emptyBoard(); put(e2, E.CN, 'K', 4, 9); put(e2, E.IN, 'k', 4, 3); put(e2, E.CN, 'C', 4, 5);
  ok('炮无炮架时不算将军', !E.isAttacked(e2, E.IN));
}

console.log('\n[5] 随机自对弈（健壮性：20 局，每局上限 400 步）');
{
  const games = [];
  let caps = 0, err = null, ended = 0;
  try {
    for (let g = 0; g < 20; g++) {
      let b = E.initialBoard();
      let side = E.CN, plies = 0;
      for (let i = 0; i < 400; i++) {
        const ms = E.genMoves(b, side);
        if (!ms.length) break;
        const m = ms[Math.floor(Math.random() * ms.length)];
        const piece = b[E.idx(m.fx, m.fy)];
        const promoted = piece.s === E.IN && piece.t === 'p' && m.ty === E.M - 1;
        const cap = E.applyMove(b, m);
        if (cap) caps++;
        const landed = b[E.idx(m.tx, m.ty)];
        if (!landed) throw new Error('落子后目标点为空');
        if (!promoted && landed !== piece) throw new Error('落子后棋子被替换');
        if (promoted && landed.t !== 'q') throw new Error('升后失败');
        if (b[E.idx(m.fx, m.fy)]) throw new Error('起点未清空');
        plies++;
        if (!E.hasKing(b, side)) { ended++; break; }
        side = E.other(side);
      }
      games.push(plies);
    }
  } catch (e) { err = e; }
  const total = games.reduce((a, b) => a + b, 0);
  ok('20 局随机对弈无异常', !err, err && err.message);
  ok('每局都留得下合法着法（无死循环）', games.every(p => p > 0));
  console.log('  各局步数 ' + games.join(', '));
  console.log('  合计 ' + total + ' 步，其中 ' + ended + ' 局以吃王结束，总吃子 ' + caps + ' 次');
  ok('总步数 ≥ 500', total >= 500, total);
  ok('至少有一部分对局由吃王终结', ended >= 1, ended);
}

console.log('\n[6] AI 搜索');
for (const d of [2, 3, 4]) {
  const t0 = Date.now();
  const m1 = E.bestMove(E.initialBoard(), E.CN, d);
  const t1 = Date.now();
  const m2 = E.bestMove(E.initialBoard(), E.IN, d);
  const t2 = Date.now();
  const legal1 = E.genMoves(E.initialBoard(), E.CN).some(m => m.fx === m1.fx && m.fy === m1.fy && m.tx === m1.tx && m.ty === m1.ty);
  const legal2 = E.genMoves(E.initialBoard(), E.IN).some(m => m.fx === m2.fx && m.fy === m2.fy && m.tx === m2.tx && m.ty === m2.ty);
  console.log('  深度 ' + d + '：中国 ' + E.moveText(E.initialBoard(), m1) + ' (' + (t1 - t0) + 'ms/' + m1.nodes + ' 节点)   国际 ' + E.moveText(E.initialBoard(), m2) + ' (' + (t2 - t1) + 'ms/' + m2.nodes + ' 节点)');
  ok('深度 ' + d + ' 中国方给出合法着法', legal1);
  ok('深度 ' + d + ' 国际方给出合法着法', legal2);
}

console.log('\n[7] AI 战术素养');
{
  const b = E.emptyBoard();
  put(b, E.CN, 'K', 4, 9); put(b, E.IN, 'k', 4, 0); put(b, E.IN, 'r', 2, 9); put(b, E.CN, 'P', 0, 6);
  const m = E.bestMove(b, E.IN, 3);
  ok('送上门的主帅一定吃', m && m.tx === 4 && m.ty === 9, m && E.moveText(b, m));

  const b2 = E.emptyBoard();
  put(b2, E.CN, 'K', 4, 9); put(b2, E.IN, 'k', 0, 0);   // 王在 a10，避免帅直接飞将吃王
  put(b2, E.IN, 'q', 3, 3); put(b2, E.CN, 'R', 3, 5); put(b2, E.CN, 'P', 0, 6);
  const m2 = E.bestMove(b2, E.CN, 3);
  ok('中国方会吃掉白送的后', m2 && m2.tx === 3 && m2.ty === 3, m2 && E.moveText(b2, m2));

  const b3 = E.emptyBoard();                      // 国象的王被车照面，必须先解将
  put(b3, E.CN, 'K', 4, 9); put(b3, E.IN, 'k', 4, 0); put(b3, E.CN, 'R', 4, 3);
  ok('构造局面：国象确实被将军', E.isAttacked(b3, E.IN));
  const m3 = E.bestMove(b3, E.IN, 3);
  const after = b3.slice();
  E.applyMove(after, m3);
  ok('被将军时 AI 必须解将（走后不再被将）', !E.isAttacked(after, E.IN), m3 && E.moveText(b3, m3));

  let hang = 0;
  for (let i = 0; i < 10; i++) {                  // 反复搜索，AI 都不该主动送王
    const c = E.emptyBoard();
    put(c, E.CN, 'K', 4, 9); put(c, E.IN, 'k', 4, 0); put(c, E.CN, 'R', 8, 4); put(c, E.IN, 'p', 0, 5);
    const mv = E.bestMove(c, E.IN, 3);
    const nb = c.slice(); E.applyMove(nb, mv);
    if (E.isAttacked(nb, E.IN)) hang++;
  }
  ok('AI 不会把自己的王走到对方车的线上（10 次采样）', hang === 0, hang + '/10');
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
