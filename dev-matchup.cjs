/* 中西对弈 · 平衡性实验
 * 用法：node dev-matchup.cjs [基准局数]
 * 红=中国象棋方（下方），蓝=国际象棋方（上方）
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;

const CN = E.CN, IN = E.IN;
const MAX_PLIES = 300, NOCAP_DRAW = 100;
const val = p => E.VAL[p.t] || 0;

/* 让子 / 让先：直接在初始局面上增删子力 */
const VARIANTS = {
  none: () => {},
  '红少一相': b => { b[E.idx(2, 9)] = null; },
  '红少一炮': b => { b[E.idx(1, 7)] = null; },
  '红少一车': b => { b[E.idx(0, 9)] = null; },
  '蓝少一象': b => { b[E.idx(2, 0)] = null; },
  '蓝少一马': b => { b[E.idx(1, 0)] = null; },
  '蓝少一车': b => { b[E.idx(0, 0)] = null; },
  '蓝少一后': b => { b[E.idx(3, 0)] = null; },
  '红连走两步': () => {}                       // 让先：红方开局连走两手（在 playOne 里处理）
};

function playOne(mode, variant) {
  const b = E.initialBoard();
  (VARIANTS[variant] || VARIANTS.none)(b);
  const depthFor = side => (typeof mode === 'object' ? (side === CN ? mode.cn : mode.in) : mode);

  let side = CN, plies = 0, noCap = 0;
  let capByCN = 0, capByIN = 0, mobCN = 0, mobIN = 0, tCN = 0, tIN = 0, firstCap = -1, matePly = 0;
  const done = extra => Object.assign({ plies, capByCN, capByIN, mobCN, mobIN, tCN, tIN, firstCap, matePly }, extra);

  while (plies < MAX_PLIES) {
    const moves = E.genMoves(b, side);
    if (!moves.length) return done({ winner: E.other(side), by: '无着可走' });
    if (side === CN) { mobCN += moves.length; tCN++; } else { mobIN += moves.length; tIN++; }

    let mv;
    const d = depthFor(side);
    if (d === 'random') mv = moves[Math.floor(Math.random() * moves.length)];
    else { mv = E.bestMove(b, side, d); if (!mv) return done({ winner: E.other(side), by: '无着可走' }); }

    const cap = E.applyMove(b, mv);
    plies++;
    if (cap) {
      if (firstCap < 0) firstCap = plies;
      if (cap.s === IN) capByCN += val(cap); else capByIN += val(cap);
      noCap = 0;
      if (E.isKing(cap)) return done({ winner: side, by: '吃王', matePly: plies });
    } else {
      noCap++;
      if (noCap >= NOCAP_DRAW) return done({ winner: null, by: '50回合无吃子' });
    }
    side = E.other(side);
    if (variant === '红连走两步' && plies === 1) side = CN;   // 红方连走
  }
  return done({ winner: null, by: '超时' });
}

function run(name, mode, games, variant) {
  let cn = 0, intl = 0, draw = 0, plies = 0, capByCN = 0, capByIN = 0;
  let mobCN = 0, mobIN = 0, tCN = 0, tIN = 0, firstCapSum = 0, firstCapN = 0, mateSum = 0, byMate = 0;
  const by = {};
  const t0 = Date.now();
  for (let i = 0; i < games; i++) {
    const g = playOne(mode, variant);
    if (g.winner === CN) cn++; else if (g.winner === IN) intl++; else draw++;
    by[g.by] = (by[g.by] || 0) + 1;
    plies += g.plies; capByCN += g.capByCN; capByIN += g.capByIN;
    mobCN += g.mobCN; mobIN += g.mobIN; tCN += g.tCN; tIN += g.tIN;
    if (g.firstCap > 0) { firstCapSum += g.firstCap; firstCapN++; }
    if (g.by === '吃王') { byMate++; mateSum += g.matePly; }
  }
  const pct = x => (100 * x / games).toFixed(0).padStart(3) + '%';
  const dec = cn + intl;
  console.log(
    name.padEnd(24) +
    ' 红 ' + pct(cn) + '  蓝 ' + pct(intl) + '  和 ' + pct(draw) +
    ' │ 红方占决胜局 ' + (dec ? (100 * cn / dec).toFixed(0).padStart(3) + '%' : '  —') +
    ' │ 均 ' + (plies / games).toFixed(0).padStart(3) + ' 步' +
    ' │ 吃子价 红' + (capByCN / games).toFixed(0).padStart(4) + '/蓝' + (capByIN / games).toFixed(0).padStart(4) +
    ' │ 机动 红' + (mobCN / Math.max(1, tCN)).toFixed(1) + '/蓝' + (mobIN / Math.max(1, tIN)).toFixed(1) +
    ' │ 首吃' + (firstCapN ? (firstCapSum / firstCapN).toFixed(0).padStart(2) : '—') + '步' +
    ' │ 吃王局均' + (byMate ? (mateSum / byMate).toFixed(0).padStart(3) : '—') + '步' +
    ' │ ' + Object.entries(by).map(([k, v]) => k + v).join(' ') +
    ' │ ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'
  );
}

const N = +(process.argv[2] || 80);
console.log('\n红=中国象棋方，蓝=国际象棋方。基准每档 ' + N + ' 局。\n');

console.log('== A 纯随机走子（不含任何搜索，测局面/规则的先天强弱） ==');
run('随机 vs 随机', 'random', N * 4, 'none');

console.log('\n== B AI 同深度自战（看搜索深度是否改变结论） ==');
run('AI 深度2 vs 深度2', 2, N, 'none');
run('AI 深度3 vs 深度3', 3, Math.round(N * 0.6), 'none');
run('AI 深度4 vs 深度4', 4, Math.max(10, Math.round(N * 0.2)), 'none');

console.log('\n== C 强弱归因：一方加深搜索（若红方只是"难下"而非"下不赢"） ==');
run('红深度5 vs 蓝深度2', { cn: 5, in: 2 }, Math.max(8, Math.round(N * 0.15)), 'none');
run('红深度2 vs 蓝深度5', { cn: 2, in: 5 }, Math.max(8, Math.round(N * 0.15)), 'none');

console.log('\n== D 让子定位：蓝方的优势值多少子 ==');
run('均势基准', 2, N, 'none');
run('红连走两步（让先）', 2, N, '红连走两步');
run('红少一相', 2, N, '红少一相');
run('红少一炮', 2, N, '红少一炮');
run('红少一车', 2, N, '红少一车');
run('蓝少一象', 2, N, '蓝少一象');
run('蓝少一马', 2, N, '蓝少一马');
run('蓝少一车', 2, N, '蓝少一车');
run('蓝少一后', 2, N, '蓝少一后');
console.log('');
