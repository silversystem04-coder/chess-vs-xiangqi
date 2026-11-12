/* ============================================================
 * 中西对弈 · 引擎（纯逻辑，无 DOM 依赖，可在 Node 中测试）
 * 棋盘：9 列 × 10 行交叉点，下方 = 中国象棋（红方 CN），上方 = 国际象棋（钢蓝方 IN）
 * 各方棋子只遵守自己棋种的走法；吃掉对方主帅/国王即获胜。
 * ============================================================ */
(function (global) {
  'use strict';

  const CN = 0, IN = 1;

  /* ---------- 棋盘尺寸（可配置） ----------
   * N = 列数，M = 行数，CF = 帅/王/后所在的中央列，RIVER = 河所在行（第 RIVER-1 与 RIVER 行之间）
   * 中国象棋的九宫必须居中，所以 N 取奇数最自然；偶数宽度只能取左中列（见 configure） */
  let N = 9, M = 10, CF = 4, RIVER = 5, PALY0 = 7;

  function configure(n, m) {
    N = n | 0; M = m | 0;
    CF = (N % 2 === 1) ? (N - 1) / 2 : N / 2 - 1;
    RIVER = M / 2;
    PALY0 = M - 3;
    return { N, M, CF, RIVER };
  }
  configure(9, 10);

  const idx = (x, y) => y * N + x;
  const inside = (x, y) => x >= 0 && x < N && y >= 0 && y < M;
  const other = (s) => (s === CN ? IN : CN);

  /* ---------- 文字表 ---------- */
  const CN_NAME = { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' };
  const IN_NAME = { k: '王', q: '后', r: '车', b: '象', n: '马', p: '兵' };
  const IN_GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const SIDE_NAME = ['中国象棋 · 红方', '国际象棋 · 钢蓝方'];

  function pieceName(p) {
    if (!p) return '';
    return p.s === CN ? CN_NAME[p.t] : IN_GLYPH[p.t];
  }

  function emptyBoard() {
    return new Array(N * M).fill(null);
  }

  /* ---------- 初始布局（随棋盘尺寸自动重排） ---------- */
  // 两军都以 CF 列为轴左右对称：
  //   中国象棋：车马相仕帅仕相马车 占 CF-4..CF+4，炮在 CF±3 列（马的位置），
  //             兵摆在 CF±3 / CF±2 / CF（两个边兵从 a4/i4 挪到 b4/h4）
  //   国际象棋：七子缩进成一排 CF-3..CF+3（车马象·后·象马车），王在王后正前方，
  //             兵压在双车正前方（CF±3）与 CF±2，另加一个 CF 列哨兵
  function initialBoard(n, m) {
    if (n && m) configure(n, m);
    const b = emptyBoard();
    const back = M - 1;
    const put = (t, s, x, y) => { b[idx(x, y)] = { s, t }; };

    // 中国象棋（下方）
    put('R', CN, CF - 4, back); put('H', CN, CF - 3, back); put('E', CN, CF - 2, back);
    put('A', CN, CF - 1, back); put('K', CN, CF, back); put('A', CN, CF + 1, back);
    put('E', CN, CF + 2, back); put('H', CN, CF + 3, back); put('R', CN, CF + 4, back);
    put('C', CN, CF - 3, M - 3); put('C', CN, CF + 3, M - 3);
    for (const d of [-3, -2, 0, 2, 3]) put('P', CN, CF + d, M - 4);

    // 国际象棋（上方）：后排七子紧挨着，缩进一格
    put('r', IN, CF - 3, 0); put('n', IN, CF - 2, 0); put('b', IN, CF - 1, 0);
    put('q', IN, CF, 0);
    put('b', IN, CF + 1, 0); put('n', IN, CF + 2, 0); put('r', IN, CF + 3, 0);
    put('k', IN, CF, 1);
    // 兵墙压在王与双象前面（c9 / d9 / f9 / g9），把「后」彻底堵在 e10：
    // 后的四条出路分别是王(e9)、d9、f9、d10/f10 的象，全是自家子 —— 和真棋开局一样，后一步都走不了。
    // 双车所在的 b10 / h10 前方（b9 / h9）留空，车不挡。
    put('p', IN, CF - 2, 1); put('p', IN, CF - 1, 1);
    put('p', IN, CF + 1, 1); put('p', IN, CF + 2, 1);
    put('p', IN, CF, 2);
    return b;
  }

  /* ---------- 局面 <-> 字符串（摆棋保存 / 导出 HTML 用） ---------- */
  function boardToString(b) {
    let s = '';
    for (let i = 0; i < b.length; i++) {
      const p = b[i];
      s += p ? p.t : '.';
    }
    return s;
  }

  function boardFromString(str) {
    if (typeof str !== 'string' || str.length !== N * M) return null;
    const b = emptyBoard();
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (!ch || ch === '.') continue;
      const isCn = ch >= 'A' && ch <= 'Z';
      if (isCn && !(ch in CN_NAME)) return null;
      if (!isCn && !(ch in IN_NAME)) return null;
      b[i] = { s: isCn ? CN : IN, t: ch };
    }
    return b;
  }

  function countPieces(b, side) {
    let n = 0;
    for (const p of b) if (p && p.s === side) n++;
    return n;
  }

  /* ---------- 走法生成 ---------- */
  const ORTH = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ALL8 = ORTH.concat(DIAG);
  const HORSE = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  const inPalaceCN = (x, y) => x >= CF - 1 && x <= CF + 1 && y >= PALY0 && y <= M - 1;

  // 走一步；返回 true 表示落点为空（可继续滑行）
  function step(b, x, y, nx, ny, out, side) {
    if (!inside(nx, ny)) return false;
    const q = b[idx(nx, ny)];
    if (!q) { out.push({ fx: x, fy: y, tx: nx, ty: ny }); return true; }
    if (q.s !== side) out.push({ fx: x, fy: y, tx: nx, ty: ny });
    return false;
  }

  // 河界：y < RIVER 是蓝方半场，y >= RIVER 是红方半场
  const crossesRiver = (y0, y1) => (y0 < RIVER) !== (y1 < RIVER);

  // 斜着走的子不能跨过乌拉尔河：斜线一律停在岸边，过河要另走一步直走（见 riverStep）。
  function slide(b, x, y, dirs, out, side, opts) {
    const riverPause = !!(opts && opts.river);
    for (const [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy;
      while (inside(nx, ny)) {
        if (riverPause && crossesRiver(y, ny)) break;
        if (!step(b, x, y, nx, ny, out, side)) break;
        nx += dx; ny += dy;
      }
    }
  }

  function genCN(b, x, y, t, out) {
    if (t === 'K') {                       // 帅：宫内一步直行
      for (const [dx, dy] of ORTH) { const nx = x + dx, ny = y + dy; if (inPalaceCN(nx, ny)) step(b, x, y, nx, ny, out, CN); }
      // 飞将（只给中国象棋这一边）：同一列的直线上，若第一个遇到的是对方的王，可以飞过去吃
      for (const dir of [-1, 1]) {
        for (let ny = y + dir; ny >= 0 && ny < M; ny += dir) {
          const q = b[idx(x, ny)];
          if (!q) continue;
          if (q.s === IN && q.t === 'k') out.push({ fx: x, fy: y, tx: x, ty: ny });
          break;                            // 第一个子不是王就挡住了
        }
      }
      return;
    }
    if (t === 'A') {                       // 仕：宫内一步斜行
      for (const [dx, dy] of DIAG) { const nx = x + dx, ny = y + dy; if (inPalaceCN(nx, ny)) step(b, x, y, nx, ny, out, CN); }
      return;
    }
    if (t === 'E') {                       // 相：田字，塞象眼，不过河（y>=5）
      for (const [dx, dy] of DIAG) {
        const nx = x + 2 * dx, ny = y + 2 * dy;
        if (!inside(nx, ny) || ny < RIVER) continue;
        if (b[idx(x + dx, y + dy)]) continue;
        step(b, x, y, nx, ny, out, CN);
      }
      return;
    }
    if (t === 'H') {                       // 马：走日，蹩马腿
      for (const [dx, dy] of HORSE) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const lx = x + (Math.abs(dx) === 2 ? dx / 2 : 0);
        const ly = y + (Math.abs(dy) === 2 ? dy / 2 : 0);
        if (b[idx(lx, ly)]) continue;
        step(b, x, y, nx, ny, out, CN);
      }
      return;
    }
    if (t === 'R') { slide(b, x, y, ORTH, out, CN); return; }   // 车
    if (t === 'C') {                                            // 炮：走同车，吃需翻山
      for (const [dx, dy] of ORTH) {
        let nx = x + dx, ny = y + dy;
        while (inside(nx, ny) && !b[idx(nx, ny)]) {
          out.push({ fx: x, fy: y, tx: nx, ty: ny });
          nx += dx; ny += dy;
        }
        if (!inside(nx, ny)) continue;              // 一路空到底
        nx += dx; ny += dy;                         // 越过炮架
        while (inside(nx, ny)) {
          const q = b[idx(nx, ny)];
          if (q) { if (q.s !== CN) out.push({ fx: x, fy: y, tx: nx, ty: ny }); break; }
          nx += dx; ny += dy;
        }
      }
      return;
    }
    if (t === 'P') {                       // 兵：只进不退，过河（y<=4）可横行
      step(b, x, y, x, y - 1, out, CN);
      if (y < RIVER) { step(b, x, y, x - 1, y, out, CN); step(b, x, y, x + 1, y, out, CN); }
      return;
    }
  }

  // 过河那一步是「直走」：站在岸边时，可以用一格正交步跨过乌拉尔河
  function riverStep(b, x, y, out, side) {
    const ny = (y < RIVER) ? RIVER : RIVER - 1;
    if (Math.abs(ny - y) !== 1 || !inside(x, ny)) return;
    const q = b[idx(x, ny)];
    if (!q || q.s !== side) out.push({ fx: x, fy: y, tx: x, ty: ny });
  }

  function genIN(b, x, y, t, out) {
    if (t === 'k') {                       // 王：周围一格；斜着的那两步不能跨河
      for (const [dx, dy] of ALL8) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && crossesRiver(y, ny)) continue;
        step(b, x, y, nx, ny, out, IN);
      }
      return;
    }
    if (t === 'q') { slide(b, x, y, ORTH, out, IN); slide(b, x, y, DIAG, out, IN, { river: true }); return; }
    if (t === 'r') { slide(b, x, y, ORTH, out, IN); return; }
    if (t === 'b') { slide(b, x, y, DIAG, out, IN, { river: true }); riverStep(b, x, y, out, IN); return; }
    if (t === 'n') {                       // 国际象棋的马：无蹩腿
      for (const [dx, dy] of HORSE) { const nx = x + dx, ny = y + dy; if (inside(nx, ny)) step(b, x, y, nx, ny, out, IN); }
      return;
    }
    if (t === 'p') {                       // 兵：直进、首步两格、斜吃、到底线升后
      // 直进只能落空点（国际象棋的兵不能向前吃子）
      const okFwd = inside(x, y + 1) && !b[idx(x, y + 1)];
      if (okFwd) out.push({ fx: x, fy: y, tx: x, ty: y + 1 });
      if (y === 1 && okFwd && !b[idx(x, 3)]) out.push({ fx: x, fy: y, tx: x, ty: 3 });
      for (const dx of [-1, 1]) {
        const nx = x + dx, ny = y + 1;
        if (!inside(nx, ny)) continue;
        const q = b[idx(nx, ny)];
        if (q && q.s !== IN) out.push({ fx: x, fy: y, tx: nx, ty: ny });
      }
      return;
    }
  }

  function genMoves(b, side) {
    const out = [];
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < N; x++) {
        const p = b[idx(x, y)];
        if (!p || p.s !== side) continue;
        if (side === CN) genCN(b, x, y, p.t, out); else genIN(b, x, y, p.t, out);
      }
    }
    return out;
  }

  function movesFrom(b, x, y) {
    const p = b[idx(x, y)];
    if (!p) return [];
    return genMoves(b, p.s).filter((m) => m.fx === x && m.fy === y);
  }

  /* ---------- 落子 ---------- */
  function applyMove(b, mv) {
    const f = idx(mv.fx, mv.fy), t = idx(mv.tx, mv.ty);
    const p = b[f], cap = b[t];
    b[t] = p; b[f] = null;
    if (p.s === IN && p.t === 'p' && mv.ty === M - 1) b[t] = { s: IN, t: 'q' };
    return cap;
  }

  const isKing = (p) => !!p && (p.t === 'K' || p.t === 'k');

  function hasKing(b, side) {
    for (let i = 0; i < b.length; i++) { const p = b[i]; if (p && p.s === side && isKing(p)) return true; }
    return false;
  }

  function kingSquare(b, side) {
    for (let i = 0; i < b.length; i++) { const p = b[i]; if (p && p.s === side && isKing(p)) return i; }
    return -1;
  }

  // side 一方的王/帅是否正被对方攻击
  function isAttacked(b, side) {
    const kp = kingSquare(b, side);
    if (kp < 0) return false;
    const kx = kp % N, ky = (kp / N) | 0;
    const ms = genMoves(b, other(side));
    for (const m of ms) if (m.tx === kx && m.ty === ky) return true;
    return false;
  }

  /* ---------- 局面评估 ---------- */
  // 王按 0 计（王的存亡由搜索中的 hasKing 判定），避免地平线错觉
  const VAL = { K: 0, A: 220, E: 220, H: 400, R: 900, C: 450, P: 100,
                k: 0, q: 900, r: 500, b: 330, n: 320, p: 100 };

  function evaluate(b, side) {
    let sc = 0;
    for (let y = 0; y < M; y++) {
      for (let x = 0; x < N; x++) {
        const p = b[idx(x, y)];
        if (!p) continue;
        let v = VAL[p.t] || 0;
        if (p.s === CN) {
          if (p.t === 'P') v += (y < RIVER) ? 30 + (RIVER - 1 - y) * 8 : (RIVER + 1 - y) * 4;   // 过河兵更凶
          if (p.t === 'H' || p.t === 'C') v += 4 * (4 - Math.abs(x - 4));      // 中路加成
        } else {
          if (p.t === 'p') v += (y - 1) * 6;                                   // 兵越靠下越值钱
          if (p.t === 'n' || p.t === 'b' || p.t === 'q') v += 3 * (4 - Math.abs(x - 4));
        }
        sc += (p.s === side ? v : -v);
      }
    }
    // 主帅安全：帅/王被攻击要扣分。没有这一项，AI 会为了一个兵把自己的王暴露在对方枪口下，
    // 也会忘记用子去守九宫两侧的闷宫点（d2 / f2）。
    // 注意必须按 side 取反，否则评估不零和 —— negamax 会因此做出自相矛盾的判断。
    const cnAtt = kingSquare(b, CN) >= 0 && isAttacked(b, CN);
    const inAtt = kingSquare(b, IN) >= 0 && isAttacked(b, IN);
    if (cnAtt) sc += (side === CN ? -150 : 150);
    if (inAtt) sc += (side === IN ? -150 : 150);
    return sc;
  }

  /* ---------- 搜索 ---------- */
  const MATE = 1e7, INF = 1e9;
  let nodes = 0, nodeLimit = 400000;

  function orderMoves(b, moves) {
    for (const m of moves) {
      const cap = b[idx(m.tx, m.ty)];
      const att = b[idx(m.fx, m.fy)];
      m.o = cap ? 10000 + (VAL[cap.t] || 0) * 10 - (VAL[att.t] || 0) : 0;
    }
    moves.sort((a, c) => c.o - a.o);
  }

  /* 吃子静态搜索：把「下一步就被吃王/被白吃子」这类地平线外的威胁算进来。
     没有它，AI 会眼睁睁看着对方走到自己帅/王旁边。 */
  function quiesce(b, side, depth, alpha, beta) {
    if (!hasKing(b, side)) return -MATE;
    let stand = evaluate(b, side);
    if (depth <= 0) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const all = genMoves(b, side);
    const caps = [];
    for (const m of all) if (b[idx(m.tx, m.ty)]) caps.push(m);
    if (!caps.length) return alpha;
    orderMoves(b, caps);
    for (const mv of caps) {
      const nb = b.slice();
      applyMove(nb, mv);
      const sc = -quiesce(nb, other(side), depth - 1, -beta, -alpha);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(b, side, depth, alpha, beta) {
    if (!hasKing(b, side)) return -MATE + (10 - depth);
    if (depth <= 0 || nodes > nodeLimit) return quiesce(b, side, 4, alpha, beta);
    nodes++;
    const moves = genMoves(b, side);
    if (!moves.length) return -MATE + (10 - depth);
    orderMoves(b, moves);
    let best = -INF;
    for (const mv of moves) {
      const nb = b.slice();
      applyMove(nb, mv);
      const sc = -negamax(nb, other(side), depth - 1, -beta, -alpha);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function bestMove(board, side, depth) {
    depth = depth || 3;
    nodes = 0;
    const moves = genMoves(board, side);
    if (!moves.length) return null;
    for (const m of moves) {                       // 能直接吃王就吃
      const q = board[idx(m.tx, m.ty)];
      if (isKing(q)) { m.score = MATE; m.nodes = nodes; return m; }
    }
    shuffle(moves);
    orderMoves(board, moves);
    let alpha = -INF, best = moves[0], bestScore = -INF;
    for (const m of moves) {
      const nb = board.slice();
      applyMove(nb, m);
      const sc = -negamax(nb, other(side), depth - 1, -INF, -alpha);
      if (sc > bestScore) { bestScore = sc; best = m; }
      if (sc > alpha) alpha = sc;
      if (bestScore >= MATE - 100) break;
    }
    best.score = bestScore;
    best.nodes = nodes;
    return best;
  }

  /* ---------- 记谱 ---------- */
  const FILES = 'abcdefghijkl';
  const sqName = (x, y) => FILES[x] + (M - y);     // 左下角为 a1

  function moveText(b, mv) {
    const p = b[idx(mv.fx, mv.fy)];
    const cap = b[idx(mv.tx, mv.ty)];
    return pieceName(p) + ' ' + sqName(mv.fx, mv.fy) + (cap ? '×' : '→') + sqName(mv.tx, mv.ty);
  }

  // N/M/CF 做成 getter：configure() 之后读到的始终是当前尺寸
  const API = {
    CN, IN, idx, inside, other, configure,
    get N() { return N; }, get M() { return M; },
    get CF() { return CF; }, get RIVER() { return RIVER; },
    CN_NAME, IN_NAME, IN_GLYPH, SIDE_NAME, FILES,
    emptyBoard, initialBoard, genMoves, movesFrom, applyMove,
    boardToString, boardFromString, countPieces,
    get defaultStart() { return boardToString(initialBoard()); },
    hasKing, kingSquare, isAttacked, isKing, evaluate, bestMove,
    sqName, moveText, pieceName, VAL
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
