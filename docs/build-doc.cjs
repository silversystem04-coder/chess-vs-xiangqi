/* 生成「可游玩文档」：把说明文档 + 五个改动示意 + 实测数据 + 摆棋教程
 * 注入到单文件游戏前面，产出 chess-vs-xiangqi-doc.html
 *
 * 用法：node docs/build-doc.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'chess-vs-xiangqi.html');
const OUT = path.join(ROOT, 'chess-vs-xiangqi-doc.html');
const START = path.join(ROOT, '..', 'chess-mv', 'data', 'start.json');
const CLIPS = path.join(ROOT, '..', 'chess-mv', 'data', 'clips.json');

const startStr = JSON.parse(fs.readFileSync(START, 'utf8')).board;
const clips = JSON.parse(fs.readFileSync(CLIPS, 'utf8')).clips;

const CN_GLYPH = { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' };
const IN_GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function glyph(ch) {
  if (!ch || ch === '.') return '';
  if (ch >= 'A' && ch <= 'Z') return '<span class="pc pc-cn">' + CN_GLYPH[ch] + '</span>';
  return '<span class="pc pc-in">' + IN_GLYPH[ch] + '</span>';
}

/* 9×10 小棋盘：hl = 要高亮的格子 "x,y" 集合 */
function mini(str, hl) {
  const set = new Set(hl || []);
  let out = '<div class="mini">';
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const ch = str[y * 9 + x];
      const dark = (x + y) % 2 === 1;
      const cls = ['mc', dark ? 'mc-d' : 'mc-l'];
      if (y === 5) cls.push('river');
      if (set.has(x + ',' + y)) cls.push('hl');
      out += '<div class="' + cls.join(' ') + '">' + glyph(ch) + '</div>';
    }
  }
  out += '</div>';
  out += '<div class="cols">' + 'abcdefghi'.split('').map(c => '<span>' + c + '</span>').join('') + '</div>';
  out += '<div class="mini-cap">上行 = 蓝方（国际象棋）· 下行 = 红方（中国象棋）</div>';
  return out;
}

function clipById(id) {
  return clips.find(c => c.id === id);
}

/* 飞将：取真实那一局的「飞之前 / 飞之后」两个盘面 */
const fly = clipById('fly-1');
const flyBefore = fly.moves[fly.focus - 2].b;
const flyAfter = fly.moves[fly.focus - 1].b;
const flyMv = fly.moves[fly.focus - 1];

const H = [];
const push = s => H.push(s);

push(`<header class="doc-nav">
  <div class="dn-in">
    <b>中西对弈</b><span class="dn-sub">可游玩文档</span>
    <nav>
      <a href="#p1">它是什么</a>
      <a href="#p2">怎么玩</a>
      <a href="#p3">五个改动</a>
      <a href="#p4">实测数据</a>
      <a href="#p5">摆棋</a>
      <a href="#p6">问答</a>
      <a class="dn-play" href="#play">开始对局 ↓</a>
    </nav>
  </div>
</header>

<main class="doc">
  <h1>中西对弈<span class="dots">·</span>可游玩文档</h1>
  <p class="lede">一张 9×10 的棋盘：下方是中国象棋（红方、先手），上方是国际象棋（钢蓝方）。
  两军各走各的规矩，<b>吃掉对方的「帅 / 王」就赢</b>。这一版加了五条改动，每条都配了实测。</p>
  <p class="lede small">这份文档就是游戏本体 —— 往下滚到底，随时可以下。整个文件没有任何外部依赖，断网也能用。</p>
`);

push(`<section id="p1">
  <h2><span>01</span> 它是什么</h2>
  <ul class="ticks">
    <li><b>两军同盘、规则异构</b>：红方 16 子只按中国象棋走，蓝方 13 子只按国际象棋走。</li>
    <li><b>吃主帅即胜</b>：没有「将死」判定，帅 / 王被吃掉的那一手就是终局。</li>
    <li><b>不判送将</b>：把帅走进对方火力网是允许的，只是会被吃掉 —— 这是让两套规则能共存的前提。</li>
    <li><b>和棋</b>：连续 50 回合（100 步）无吃子判和。</li>
    <li><b>棋盘尺寸</b>：9×10 / 9×12 / 11×12 / 12×12 四档，九宫、河界与阵型会按尺寸自动重排。</li>
  </ul>
  <div class="figrow">
    <figure class="fig">
      ${mini(startStr, [])}
      <figcaption>当前开局：蓝方兵墙在 c9 / d9 / f9 / g9，双车所在的 b9 / h9 留空；红兵在 b4 / c4 / e4 / g4 / h4。</figcaption>
    </figure>
  </div>
</section>`);

push(`<section id="p2">
  <h2><span>02</span> 怎么玩</h2>
  <ol class="steps">
    <li><b>红方先手</b>：点自己的棋子，高亮出可落点，再点落点。</li>
    <li><b>金色角标</b>是上一步走的子；主帅被攻击时会有红环 + 面板上的「将军！」。</li>
    <li><b>右侧面板</b>：双人对弈 / 电脑执国际 / 电脑执中国；棋力三档（2、3、4 层搜索）；四种棋盘尺寸。</li>
    <li><b>按钮</b>：新局、悔棋、音效、规则、摆棋、导出 HTML。</li>
    <li><b>快捷键</b>：<kbd>N</kbd> 新局 · <kbd>U</kbd> 悔棋 · <kbd>Esc</kbd> 取消选中。</li>
  </ol>
</section>`);

push(`<section id="p3">
  <h2><span>03</span> 五个改动</h2>
  <p class="lede small">这一版改了五次规则 / 阵型，目标只有一个：让红方不是「开局就死」。</p>

  <article class="chg">
    <h3><span class="no">①</span> 飞将 <em class="tag-r">规则</em></h3>
    <p>同一列上没有阻挡时，红帅可以<b>直接飞过去吃掉蓝王</b>。这个特权只有红方有，蓝王没有。</p>
    <div class="figrow two">
      <figure class="fig">${mini(flyBefore, [flyMv.fx + ',' + flyMv.fy])}<figcaption>飞之前：帅在 ${'abcdefghi'[flyMv.fx]}${10 - flyMv.fy}，整条 e 线已经空了（原局第 ${flyMv.orig - 1} 手）</figcaption></figure>
      <figure class="fig">${mini(flyAfter, [flyMv.tx + ',' + flyMv.ty])}<figcaption>一手之后：帅直接飞到 e10，吃掉王 —— 这一手就终局了</figcaption></figure>
    </div>
    <p class="why">为什么加：红帅在九宫里只有 3 个相邻格，两个仕还堵着两侧 —— 加一条「远程斩首」才有一点点主动。</p>
    <p class="data">实测：520 局 AI 自战里只出现 <b>2 次</b>，罕见但一旦出现就是终局。</p>
  </article>

  <article class="chg">
    <h3><span class="no">②</span> 兵墙堵后 <em class="tag-b">阵型</em></h3>
    <p>蓝方五个兵压在王与双象前面（c9 / d9 / f9 / g9），把「后」的四条出路全堵死：<b>后开局一步都走不了</b>。</p>
    <figure class="fig">${mini(startStr, ['4,0', '3,1', '5,1', '2,1', '6,1', '4,2'])}<figcaption>后（e10）四面是王、双象、d9 / f9 的兵 —— 和真棋一样被自己的兵锁住。</figcaption></figure>
    <p class="why">为什么改：之前蓝后 6 步就能冲进九宫吃掉王，整局 10 步结束。</p>
    <p class="data">实测：蓝后第一次动从第 3 回合推迟到 <b>第 8–11 回合</b>；对局长度从 12 步回到 89 步。</p>
  </article>

  <article class="chg">
    <h3><span class="no">③</span> 兵不挡车 <em class="tag-b">阵型</em></h3>
    <p>双车所在的 b、h 两条线特意留空（b9 / h9 不放兵），车可以直接沿直线冲下来。</p>
    <figure class="fig">${mini(startStr, ['1,1', '7,1', '1,0', '7,0'])}<figcaption>b9 / h9 空着，车开局就有 7 步可走（原来只有 1 步）。</figcaption></figure>
    <p class="why">为什么改：七子缩进成一排之后，每个子都被自己的兵堵死，车几乎动不了 —— 这不是国际象棋的样子。</p>
    <p class="data">实测：蓝方开局走法 29 → 31，车从各 1 步变成各 7 步。</p>
  </article>

  <article class="chg">
    <h3><span class="no">④</span> 红兵 b4 / h4 <em class="tag-r">阵型</em></h3>
    <p>中国象棋的两个边兵从 a4 / i4 往里挪一格，落在 b4 / h4。</p>
    <figure class="fig">${mini(startStr, ['1,6', '7,6', '1,7', '7,7'])}<figcaption>兵在 b4 / h4，正好成了 b3 / h3 双炮的<b>炮架</b>：炮可以隔着自己的兵吃 b10 / h10。</figcaption></figure>
    <p class="why">为什么改：原阵型里双炮的线上没有自己的子当炮架，炮的远程威力发挥不出来。</p>
    <p class="data">实测：红炮第一手就能隔子吃 b10 / h10 的车 —— 这也是当前阵型最大的漏洞之一。</p>
  </article>

  <article class="chg">
    <h3><span class="no">⑤</span> 斜走不跨河 <em class="tag-g">规则</em></h3>
    <p>后、象、王的<b>斜走一律停在岸边</b>；要过河，必须另走一格<b>直走</b>（比如象 e6 → e5），过去之后才能在对面继续斜打。</p>
    <figure class="fig">${mini((() => {
      const b = new Array(90).fill('.');
      b[4 + 0 * 9] = 'k'; b[4 + 9 * 9] = 'K'; b[4 + 4 * 9] = 'b'; b[1 + 6 * 9] = 'P';
      return b.join('');
    })(), ['4,4', '4,5'])}<figcaption>象在 e6（蓝方岸边）：斜线只能走到河边，过河要 e6 → e5 直走一格。</figcaption></figure>
    <p class="why">为什么改：蓝方的后和象过河太容易，红方九宫完全挡不住。</p>
    <p class="data">实测：这一条把红方胜率从 2.5% 抬到 <b>9.2%</b> —— 五个改动里最有效的一条。</p>
  </article>
</section>`);

push(`<section id="p4">
  <h2><span>04</span> 实测数据</h2>
  <p class="lede small">AI 自战，双方同深度。红 = 中国象棋，蓝 = 国际象棋。</p>
  <table class="tb">
    <thead><tr><th>版本</th><th>红胜</th><th>蓝胜</th><th>和</th></tr></thead>
    <tbody>
      <tr><td>初版（8 兵、对称后排）</td><td>0%</td><td class="b">89.2%</td><td>10.8%</td></tr>
      <tr><td>五兵 + e8 哨兵</td><td>4.2%</td><td class="b">48.3%</td><td>47.5%</td></tr>
      <tr><td>七子缩进 + b4/h4 + 飞将</td><td>2.5%</td><td class="b">78.3%</td><td>19.2%</td></tr>
      <tr><td>加「斜走不跨河」</td><td>9.2%</td><td class="b">75.8%</td><td>15.0%</td></tr>
      <tr class="now"><td>兵墙堵后 + 兵不挡车（当前）</td><td>5.8%</td><td class="b">75.8%</td><td>18.3%</td></tr>
      <tr><td>标准国际象棋阵（8 兵）</td><td>10.0%</td><td class="b">55.0%</td><td>35.0%</td></tr>
    </tbody>
  </table>
  <p class="small dim">每行 60–240 局，深度 2。红方始终是劣势方 —— 这不是 bug，是两套规则的天然差距：蓝方多一个「后」，红方的相和仕还不能进攻。</p>
</section>`);

push(`<section id="p5">
  <h2><span>05</span> 摆棋：自己改开局</h2>
  <ol class="steps">
    <li>点面板上的 <b>「摆棋」</b>，棋盘进入编辑态。</li>
    <li>在调色板里选一个子（红：帅仕相马车炮兵；蓝：王后车象马兵；✕ 是橡皮），再点棋盘放置。</li>
    <li>不选子时，点两下可以搬子；<b>右键删除</b>。</li>
    <li>编辑器实时统计「红 N 子（帅 x）· 蓝 M 子（王 y）」，<b>必须有且只有一个帅、一个王</b>才能保存。</li>
    <li><b>保存为初始棋盘</b> → 之后每局都从这里开始；<b>恢复默认开局</b>一键还原。</li>
    <li><b>导出 HTML</b> → 把当前局面写进一个新文件，发给别人就是你这一版。</li>
  </ol>
  <p class="small dim">自定义开局存在浏览器本地；换电脑要用「导出 HTML」带走。</p>
</section>`);

push(`<section id="p6">
  <h2><span>06</span> 常见问题</h2>
  <dl class="faq">
    <dt>为什么红方胜率这么低？</dt>
    <dd>蓝方多一个「后」（900 分），红方的相、仕不能进攻，九宫的 d2 / f2 又是仕够不到的闷宫点。飞将和「斜走不跨河」就是专门补这两点的。</dd>
    <dt>为什么没有「将死」？</dt>
    <dd>两套棋的将死规则没法统一（中国象棋的将军限制会破坏国际象棋的走法），所以简化成「吃掉主帅即胜」。</dd>
    <dt>为什么蓝方的后在开局不动？</dt>
    <dd>兵墙堵死了它的四条出路 —— 这是故意的，和真棋开局一样。</dd>
    <dt>能离线、能在手机上玩吗？</dt>
    <dd>能。这是单文件，没有任何外部依赖；手机上会自动竖排。</dd>
    <dt>棋盘为什么是 9 宽？</dt>
    <dd>中国象棋要 9 路、还要九宫居中，奇数宽度才能左右对称。国际象棋只有 8 路，所以多出来的一列留空。</dd>
  </dl>
</section>
</main>

<div class="play-hd" id="play">
  <div class="ph-in">
    <span>开始对局</span>
    <p>下面就是游戏本体 —— 红方先手，点棋子再点落点。</p>
  </div>
</div>
`);

const DOC_CSS = `
  /* ---------- 可游玩文档 ---------- */
  .doc-nav{position:sticky;top:0;z-index:50;background:rgba(13,16,20,.92);backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line)}
  .dn-in{max-width:1000px;margin:0 auto;padding:11px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .dn-in b{letter-spacing:3px;font-size:15px}
  .dn-sub{font-size:12px;color:var(--dim);letter-spacing:1px}
  .doc-nav nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}
  .doc-nav a{color:var(--dim);text-decoration:none;font-size:13px}
  .doc-nav a:hover{color:var(--txt)}
  .doc-nav a.dn-play{color:var(--gold);font-weight:700}

  .doc{max-width:880px;margin:0 auto;padding:54px 22px 20px}
  .doc h1{font-size:44px;letter-spacing:2px;margin:0 0 18px;font-family:"Songti SC","Noto Serif SC",serif}
  .doc h1 .dots{color:var(--gold);margin:0 8px}
  .doc h2{font-size:26px;margin:52px 0 16px;letter-spacing:1px;display:flex;align-items:center;gap:12px}
  .doc h2 span{font-family:ui-monospace,Consolas,monospace;font-size:14px;color:var(--gold);
    border:1px solid rgba(217,180,91,.4);border-radius:6px;padding:3px 8px;letter-spacing:1px}
  .doc h3{font-size:20px;margin:0 0 10px;display:flex;align-items:center;gap:10px}
  .doc h3 .no{color:var(--gold);font-size:22px}
  .doc p{margin:0 0 12px;line-height:1.85;font-size:15.5px;color:#d7dfe8}
  .doc p.small{font-size:13.5px;line-height:1.75}
  .doc p.dim,.doc .dim{color:var(--dim)}
  .doc b{color:#fff}
  .lede{font-size:17px;line-height:1.9;color:#eaf0f7;border-left:3px solid var(--gold);padding-left:16px}
  .doc ul.ticks,.doc ol.steps{margin:0 0 14px;padding-left:22px;line-height:1.95;font-size:15px}
  .doc li{margin:7px 0}
  .doc kbd{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:var(--panel2);
    border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:1px 6px}
  .chg{border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:18px 0;
    background:linear-gradient(180deg,rgba(30,36,45,.55),rgba(20,25,32,.4))}
  .tag-r,.tag-b,.tag-g{font-style:normal;font-size:11.5px;font-weight:700;letter-spacing:1px;
    border-radius:999px;padding:3px 9px}
  .tag-r{color:#ff9a95;border:1px solid rgba(217,82,79,.5);background:rgba(217,82,79,.12)}
  .tag-b{color:#a8c9ea;border:1px solid rgba(127,178,229,.5);background:rgba(127,178,229,.12)}
  .tag-g{color:#f0d9a0;border:1px solid rgba(217,180,91,.5);background:rgba(217,180,91,.12)}
  .why{color:#c9d4e0;font-size:14.5px;border-left:2px solid rgba(255,255,255,.14);padding-left:12px}
  .data{font-size:14.5px;color:#f0d9a0}
  .figrow{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin:14px 0 6px}
  .figrow.two .fig{margin:0}
  .fig{margin:14px auto;text-align:center}
  .fig figcaption{font-size:12.5px;color:var(--dim);margin-top:8px;line-height:1.6;max-width:330px}
  .mini{display:grid;grid-template-columns:repeat(9,30px);grid-template-rows:repeat(10,30px);
    border:6px solid #4a3a2c;border-radius:8px;overflow:hidden;
    box-shadow:0 10px 26px rgba(0,0,0,.5);margin:0 auto;width:max-content}
  .mc{display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;position:relative}
  .mc-l{background:#f0d9b5}
  .mc-d{background:#b58863}
  .mc.river{box-shadow:inset 0 2px 0 rgba(66,120,162,.85)}
  .mc.hl{outline:2px solid rgba(217,180,91,.95);outline-offset:-2px;background:rgba(217,180,91,.35)}
  .pc{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:12.5px;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,.45)}
  .pc-cn{background:linear-gradient(180deg,#fbf3e2,#ead9b6);color:#c2261f;border:1px solid #d8bf8e;
    font-family:"KaiTi","STKaiti","Songti SC",serif;font-weight:700;font-size:14px}
  .pc-in{background:linear-gradient(180deg,#3b5169,#22303f);color:#eaf2fb;border:1px solid #5b7ea3;
    font-family:"Segoe UI Symbol","DejaVu Sans",serif;font-size:13px}
  .cols{display:grid;grid-template-columns:repeat(9,30px);width:max-content;margin:6px auto 0;
    font-size:11px;color:var(--dim);font-family:ui-monospace,Consolas,monospace}
  .cols span{text-align:center}
  .mini-cap{font-size:11.5px;color:var(--dim);margin-top:7px;letter-spacing:.5px}
  .tb{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0 8px}
  .tb th,.tb td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left}
  .tb th{font-size:12px;color:var(--dim);font-weight:600;letter-spacing:1px}
  .tb td.b{color:#a8c9ea}
  .tb tr.now{background:rgba(217,180,91,.08)}
  .tb tr.now td{color:#f0d9a0}
  .faq{margin:0}
  .faq dt{font-weight:700;margin:16px 0 6px;color:#fff}
  .faq dd{margin:0 0 4px;color:#c9d4e0;line-height:1.8;font-size:14.5px}
  .play-hd{margin:44px 0 0;padding:34px 20px 10px;text-align:center;
    border-top:1px solid var(--line);background:linear-gradient(180deg,rgba(217,180,91,.05),transparent)}
  .play-hd span{font-size:26px;letter-spacing:6px;font-family:"Songti SC","Noto Serif SC",serif;color:#f0d9a0}
  .play-hd p{color:var(--dim);font-size:13px;margin:8px 0 0}
  .doc-foot{max-width:880px;margin:30px auto 60px;padding:22px 22px 0;border-top:1px solid var(--line);
    text-align:center;color:var(--dim);font-size:12.5px;line-height:1.9}
  .doc-foot a{color:var(--gold);text-decoration:none}
  @media (max-width:720px){
    .doc h1{font-size:30px}
    .doc{padding-top:34px}
    .mini{grid-template-columns:repeat(9,24px);grid-template-rows:repeat(10,24px)}
    .doc-nav nav{display:none}
    .doc{padding-left:16px;padding-right:16px}
  }
`;

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('<title>中西对弈 · 国际象棋 vs 中国象棋</title>', '<title>中西对弈 · 可游玩文档</title>');
const before = html.length;
// 1) 注入文档样式（游戏样式表末尾）
html = html.replace(/\n\s*\.panel\{width:352px/, '\n' + DOC_CSS + '\n  .panel{width:352px');
// 2) 文档主体插到 .app 之前
const anchor = '<div class="app">';
if (html.indexOf(anchor) < 0) { console.error('找不到 .app 锚点'); process.exit(1); }
html = html.replace(anchor, H.join('\n') + '\n' + anchor);

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成 ' + path.relative(ROOT, OUT) + '（' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB，原 ' + (before / 1024).toFixed(0) + ' KB）');
console.log('  小棋盘 ' + (H.join('').match(/class="mini"/g) || []).length + ' 个');
