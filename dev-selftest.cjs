/* 生成 _selftest.html：在 index.html（或指定的其它单文件）里注入错误钩子与端到端点击自检脚本
 * 用法：node dev-selftest.cjs [源文件] [输出文件]
 *   node dev-selftest.cjs chess-vs-xiangqi.html _selftest-standalone.html   # 验证自包含单文件 */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const SRC = process.argv[2] || 'index.html';
const OUT = process.argv[3] || '_selftest.html';
let html = fs.readFileSync(path.join(dir, SRC), 'utf8');

const hook = `<script>
window.__errors = [];
window.addEventListener('error', e => { window.__errors.push((e.message||'?') + ' @' + (e.lineno||0)); });
window.addEventListener('unhandledrejection', e => { window.__errors.push('promise: ' + e.reason); });
</script>
`;
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + hook);

const test = `
<pre id="selftest" style="position:fixed;left:0;bottom:0;z-index:99;background:#000;color:#0f0;font:12px monospace;max-height:40vh;overflow:auto;margin:0;padding:6px"></pre>
<script>
(function(){
  const R = [];
  const ok = (n, c, x) => R.push((c ? 'ok   ' : 'FAIL ') + n + (x !== undefined ? '  → ' + JSON.stringify(x) : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // 无头虚拟时间下 rAF 可能一直不触发，必须带超时兜底
  const raf = () => new Promise(r => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; r(); } }, 60);
    requestAnimationFrame(() => { if (!done) { done = true; clearTimeout(t); r(); } });
  });
  const cv = document.getElementById('board');

  function pt(x, y){
    const L = window.__api.layout();
    const rect = cv.getBoundingClientRect();
    const lx = L.MARGIN + L.PAD + x * L.CELL, ly = L.MARGIN + L.PAD + y * L.CELL;
    return { clientX: rect.left + lx * (rect.width / L.W), clientY: rect.top + ly * (rect.height / L.H) };
  }
  function tap(x, y){
    const p = pt(x, y);
    cv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.clientX, clientY: p.clientY }));
  }
  const btn = t => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);

  async function run(){
    try { await main(); }
    catch (e) { R.push('FAIL 自检脚本中断：' + (e && e.stack ? e.stack.split('\\n')[0] : e)); }
    finish();
  }

  async function main(){
    const G = window.__game, E = window.__api.E;

    // ---- 渲染（等首帧真正画上去：rAF 在虚拟时间下可能还没跑） ----
    const g2 = cv.getContext('2d');
    let lit = 0, tot = 0;
    try {
      for (let tries = 0; tries < 40; tries++) {
        await raf(); await raf();
        const d = g2.getImageData(0, 0, cv.width, cv.height).data;
        lit = 0; tot = 0;
        for (let i = 3; i < d.length; i += 4 * 500) { tot++; if (d[i] > 8) lit++; }
        if (lit > 0) break;
        await sleep(50);
      }
    } catch (e) { R.push('FAIL 读取画布像素：' + e.message); }
    ok('画布已绘制（非空白）', lit > tot * 0.9, lit + '/' + tot);
    ok('棋盘画布尺寸合理', cv.width > 300 && cv.height > 300, cv.width + '×' + cv.height);

    // ---- 红方先走：兵 e4→e5 ----
    tap(4, 6); await sleep(60);
    ok('点击红兵后出现可走点', G.selected && G.selected.x === 4 && G.legal.length === 1, G.legal.length);
    tap(4, 5); await sleep(360);
    ok('红兵走到 e5 并记谱', G.log.length === 1 && G.board[E.idx(4, 5)] && G.board[E.idx(4, 5)].t === 'P', G.log.map(l => l.text));
    ok('走子后轮到国际象棋方', G.turn === 1);
    ok('上一步高亮已记录', G.lastMove && G.lastMove.tx === 4 && G.lastMove.ty === 5);
    ok('棋谱表格已渲染', document.querySelectorAll('#logBody tr').length === 1);

    // ---- 国际象棋方：兵 c9→c7 两格 ----
    tap(2, 1); await sleep(60);
    tap(2, 3); await sleep(360);
    ok('国际兵两格 c9→c7', G.board[E.idx(2, 3)] && G.board[E.idx(2, 3)].t === 'p', G.log.map(l => l.text));
    ok('两格后轮到红方', G.turn === 0);

    // ---- 非法点击不应该走子 ----
    const before = G.log.length;
    tap(0, 0); await sleep(80);           // 对方的车（不该选中）
    tap(0, 6); await sleep(80);           // 不是合法落点
    ok('点击对方棋子不会选中', G.selected === null || G.selected.x !== 0 || G.selected.y !== 0, G.selected);
    ok('非法落点不会走子', G.log.length === before);

    // ---- 悔棋（双人模式退一步） ----
    btn('悔棋').click(); await sleep(150);
    ok('悔棋一步后剩第一手', G.log.length === 1, G.log.length);
    ok('悔棋后棋谱表格同步', document.querySelectorAll('#logBody tr').length === 1);

    // ---- 人机：电脑执国际 ----
    btn('电脑执国际').click(); await sleep(250);
    ok('切换到人机模式后重开新局', G.log.length === 0 && G.mode === 'ai-in');
    tap(4, 6); await sleep(80); tap(4, 5); await sleep(1600);
    ok('人机模式：电脑已应手', G.log.length === 2, G.log.map(l => l.text));
    ok('人机模式：应手后轮到玩家', G.turn === 0 && G.mode === 'ai-in');
    ok('电脑着法在棋谱第二格', !!document.querySelectorAll('#logBody tr td.blue')[0].textContent);

    // ---- 人机：电脑执中国（电脑先行） ----
    btn('电脑执中国').click(); await sleep(1600);
    ok('电脑执中国时会自动开局', G.log.length === 1 && G.turn === 1, G.log.map(l => l.text));

    // ---- 讨回双人模式（否则构造局面时电脑会插手下棋） ----
    btn('双人对弈').click(); await sleep(250);
    ok('切回双人模式', G.mode === 'pvp' && G.log.length === 0);

    // ---- 将军提示 ----
    const b = G.board;
    for (let i = 0; i < b.length; i++) b[i] = null;
    b[E.idx(4, 9)] = { s: 0, t: 'K' };
    b[E.idx(4, 0)] = { s: 1, t: 'k' };
    b[E.idx(0, 9)] = { s: 0, t: 'R' };
    b[E.idx(4, 6)] = { s: 1, t: 'r' };      // 黑车沿 e 列照住红帅
    G.turn = 0; window.__api.updateUI();
    ok('被攻击方会亮出将军标记', !document.getElementById('checkTag').classList.contains('hide'));
    ok('将军时提示会说明原因', document.getElementById('hint').textContent.indexOf('被攻击') >= 0);
    b[E.idx(4, 6)] = null;                  // 挪开车，将军消失
    b[E.idx(3, 6)] = { s: 1, t: 'r' };
    window.__api.updateUI();
    ok('威胁解除后将军标记消失', document.getElementById('checkTag').classList.contains('hide'));
    ok('威胁解除后提示不再残留（回归）', document.getElementById('hint').textContent.indexOf('被攻击') < 0,
      document.getElementById('hint').textContent);
    ok('提示回到默认引导语', document.getElementById('hint').textContent.indexOf('点击你的棋子') >= 0,
      document.getElementById('hint').textContent);

    // ---- 吃王终局 ----
    window.__api.newGame(); await sleep(200);
    const b2 = G.board;
    for (let i = 0; i < b2.length; i++) b2[i] = null;
    b2[E.idx(4, 9)] = { s: 0, t: 'K' };
    b2[E.idx(0, 0)] = { s: 1, t: 'k' };
    b2[E.idx(4, 2)] = { s: 1, t: 'r' };
    G.turn = 1; window.__api.updateUI();
    tap(4, 2); await sleep(80); tap(4, 9); await sleep(400);
    ok('吃掉主帅即终局', G.over === true && G.winner === 1, { over: G.over, winner: G.winner });
    ok('终局弹出结算层', document.getElementById('banner').classList.contains('show'));
    ok('结算文字正确', document.getElementById('bannerTitle').textContent.indexOf('国际象棋') === 0, document.getElementById('bannerTitle').textContent);

    // ---- 摆棋 / 自定义开局 / 导出 ----
    btn('摆棋').click(); await sleep(150);
    ok('进入摆棋模式：编辑器出现', document.getElementById('editorCard').hidden === false);
    ok('摆棋时提示切换到摆棋文案', document.getElementById('hint').textContent.indexOf('摆棋') >= 0,
      document.getElementById('hint').textContent);

    // 放一个炮到 e5（原先空着）
    [...document.querySelectorAll('#palette button')].find(b => b.dataset.p === 'C').click();
    await sleep(80);
    tap(4, 5); await sleep(80);
    ok('选炮后点棋盘可以放置', G.board[E.idx(4, 5)] && G.board[E.idx(4, 5)].t === 'C',
      G.board[E.idx(4, 5)]);

    // 右键删除
    {
      const p = pt(4, 5);
      cv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: p.clientX, clientY: p.clientY }));
      await sleep(80);
      ok('右键删除棋子', !G.board[E.idx(4, 5)]);
    }

    // 校验：删掉帅之后不能保存
    [...document.querySelectorAll('#palette button')].find(b => b.dataset.p === 'X').click();
    await sleep(60);
    tap(4, 9); await sleep(80);
    ok('删掉帅后保存按钮被禁用', document.getElementById('saveStartBtn').disabled === true);
    // 放回帅
    [...document.querySelectorAll('#palette button')].find(b => b.dataset.p === 'K').click();
    await sleep(60);
    tap(4, 9); await sleep(80);
    ok('放回帅后可以保存', document.getElementById('saveStartBtn').disabled === false);

    // 做一个显眼的改动：在 a4 放一辆红车，然后保存
    [...document.querySelectorAll('#palette button')].find(b => b.dataset.p === 'R').click();
    await sleep(60);
    tap(0, 4); await sleep(80);
    document.getElementById('saveStartBtn').click();
    await sleep(200);
    ok('保存后退出摆棋', G.edit === false && document.getElementById('editorCard').hidden === true);
    ok('保存后写进 localStorage',
      (localStorage.getItem('chessCustomStart') || '').length === 90,
      (localStorage.getItem('chessCustomStart') || '').slice(0, 20));
    ok('新局从自定义开局开始（a4 有车）', G.board[E.idx(0, 4)] && G.board[E.idx(0, 4)].t === 'R',
      G.board[E.idx(0, 4)]);
    ok('界面标注为自定义开局', document.getElementById('startInfo').textContent.indexOf('自定义') >= 0,
      document.getElementById('startInfo').textContent);

    // 导出 HTML：拦下 blob，检查文件里真的写进了开局
    {
      let captured = null;
      const origCreate = URL.createObjectURL;
      const origClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = function (blob) { captured = blob; return 'blob:selftest'; };
      HTMLAnchorElement.prototype.click = function () {};
      document.getElementById('exportBtn').click();
      await sleep(150);
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      const text = captured ? await captured.text() : '';
      ok('导出的 HTML 里带自定义开局', text.indexOf('window.__CUSTOM_START__=') >= 0 && text.length > 20000,
        text.length);
      ok('导出的 HTML 是自包含的（无外链脚本）', !/<script[^>]+src=/.test(text) || document.querySelectorAll('script[src]').length > 0);
    }

    // 恢复默认
    btn('摆棋').click(); await sleep(120);
    document.getElementById('defaultStartBtn').click(); await sleep(200);
    ok('恢复默认后 localStorage 被清空', localStorage.getItem('chessCustomStart') === null);
    ok('恢复默认后回到标准开局（a4 无车、a1 有车）',
      !G.board[E.idx(0, 4)] && G.board[E.idx(0, 9)] && G.board[E.idx(0, 9)].t === 'R');

    // ---- 无脚本错误 ----
    ok('运行期无 JS 错误', window.__errors.length === 0, window.__errors);
  }

  function finish(){
    const fail = R.filter(r => r.indexOf('FAIL') === 0).length;
    document.title = 'SELFTEST ' + (fail ? 'FAIL ' + fail : 'PASS');
    document.getElementById('selftest').textContent = '<<<SELFTEST\\n' + R.join('\\n') + '\\n结果 ' + (R.length - fail) + '/' + R.length + '\\n>>>';
  }
  window.addEventListener('load', () => setTimeout(run, 300));
})();
</script>
`;
html = html.replace('</body>', test + '\n</body>');
fs.writeFileSync(path.join(dir, OUT), html);
console.log('已生成 ' + OUT + '（源 ' + SRC + '，' + html.length + ' 字节）');
