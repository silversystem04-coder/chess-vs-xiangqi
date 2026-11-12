/* 单档对局实验：node dev-depth.cjs <局数> <红深度|random> <蓝深度|random> [步数上限] [让子] [尺寸如 12x12] */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox);
const E = sandbox.module.exports;
const CN = E.CN, IN = E.IN;
const val = p => E.VAL[p.t] || 0;

const games = +(process.argv[2] || 10);
const dCN = process.argv[3] === 'random' ? 'random' : +(process.argv[3] || 2);
const dIN = process.argv[4] === 'random' ? 'random' : +(process.argv[4] || 2);
const MAXP = +(process.argv[5] || 200);
const VARIANT = process.argv[6] || 'none';
const SIZE = process.argv[7] || '9x10';
const SN = +SIZE.split('x')[0], SM = +SIZE.split('x')[1];
const NOCAP = 100;

const VARIANTS = {
  none: () => {},
  '蓝少一后': b => { b[E.idx(E.CF, 0)] = null; },
  '蓝少一车': b => { b[E.idx(E.CF - 4, 0)] = null; },
  '蓝少一象': b => { b[E.idx(E.CF - 2, 0)] = null; },
  '红少一炮': b => { b[E.idx(E.CF - 3, E.M - 3)] = null; }
};

function play() {
  const b = E.initialBoard(SN, SM);
  (VARIANTS[VARIANT] || VARIANTS.none)(b);
  let side = CN, plies = 0, noCap = 0, capCN = 0, capIN = 0, firstCap = -1, matePly = 0;
  while (plies < MAXP) {
    const ms = E.genMoves(b, side);
    if (!ms.length) return { w: E.other(side), plies, capCN, capIN, firstCap, by: '无着可走' };
    const d = side === CN ? dCN : dIN;
    const mv = d === 'random' ? ms[Math.floor(Math.random() * ms.length)] : E.bestMove(b, side, d);
    if (!mv) return { w: E.other(side), plies, capCN, capIN, firstCap, by: '无着可走' };
    const cap = E.applyMove(b, mv);
    plies++;
    if (cap) { if (firstCap < 0) firstCap = plies; if (cap.s === IN) capCN += val(cap); else capIN += val(cap); noCap = 0; }
    else if (++noCap >= NOCAP) return { w: null, plies, capCN, capIN, firstCap, by: '无吃子判和' };
    if (cap && E.isKing(cap)) return { w: side, plies, capCN, capIN, firstCap, by: '吃王', matePly: plies };
    side = E.other(side);
    if (VARIANT === '红连走两步' && plies === 1) side = CN;      // 让先：红方开局连走两手
  }
  return { w: null, plies, capCN, capIN, firstCap, by: '超时' };
}

let cn = 0, intl = 0, draw = 0, plies = 0, capCN = 0, capIN = 0, mate = 0, mateSum = 0, fcN = 0, fcSum = 0;
const bys = {};
const t0 = Date.now();
const tag = SIZE + ' 红' + dCN + ' vs 蓝' + dIN + (VARIANT !== 'none' ? ' ' + VARIANT : '') + '（' + games + ' 局）';
for (let i = 0; i < games; i++) {
  const g = play();
  if (g.w === CN) cn++; else if (g.w === IN) intl++; else draw++;
  plies += g.plies; capCN += g.capCN; capIN += g.capIN;
  bys[g.by] = (bys[g.by] || 0) + 1;
  if (g.by === '吃王') { mate++; mateSum += g.matePly; }
  if (g.firstCap > 0) { fcN++; fcSum += g.firstCap; }
  if (games <= 20) console.log('   第 ' + (i + 1) + ' 局：' + (g.w === null ? '和' : g.w === CN ? '红胜' : '蓝胜') + '（' + g.by + '，' + g.plies + ' 步）');
}
const pct = x => (100 * x / games).toFixed(1) + '%';
const dec = cn + intl;
console.log(tag.padEnd(30) +
  ' 红 ' + pct(cn).padStart(6) + ' 蓝 ' + pct(intl).padStart(6) + ' 和 ' + pct(draw).padStart(6) +
  ' │ 红占决胜局 ' + (dec ? (100 * cn / dec).toFixed(1) + '%' : '—') +
  ' │ 均 ' + (plies / games).toFixed(0) + ' 步' +
  ' │ 吃子价 红' + (capCN / games).toFixed(0) + '/蓝' + (capIN / games).toFixed(0) +
  ' │ 吃王局均 ' + (mate ? (mateSum / mate).toFixed(0) : '—') + ' 步' +
  ' │ 首吃 ' + (fcN ? (fcSum / fcN).toFixed(0) : '—') + ' 步' +
  ' │ ' + Object.entries(bys).map(([k, v]) => k + v).join(' ') +
  ' │ ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
