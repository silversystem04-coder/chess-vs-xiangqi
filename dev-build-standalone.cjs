/* 把 index.html + engine.js 打包成一个自包含的单文件（可直接下载、双击打开）
 * 用法：node dev-build-standalone.cjs [输出文件名]
 * 默认输出：chess-vs-xiangqi.html */
const fs = require('fs'), path = require('path');
const dir = __dirname;
const outName = process.argv[2] || 'chess-vs-xiangqi.html';
const outPath = path.join(dir, outName);

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8');

const tag = '<script src="engine.js"></script>';
if (!html.includes(tag)) { console.error('index.html 里找不到 ' + tag + '，无法内联'); process.exit(1); }
if (engine.includes('</script')) { console.error('engine.js 里含 </script，需要转义'); process.exit(1); }

const banner = [
  '<script>',
  '/* ===== 内联的 engine.js（由 dev-build-standalone.cjs 自动打包，请勿手改） =====',
  ' * 源文件：engine.js —— 纯逻辑引擎；本文件是自包含版本，双击即可离线运行。',
  ' * 棋盘尺寸可配置，页面右下角有切换；也支持 ?size=9x12 这样的地址参数。',
  ' */',
  engine,
  '</script>'
].join('\n');

html = html.replace(tag, banner);
html = html.replace('<title>中西对弈 · 国际象棋 vs 中国象棋</title>',
  '<title>中西对弈 · 国际象棋 vs 中国象棋</title>\n<!-- 自包含单文件：内联了 engine.js，无任何外部依赖，可离线双击运行 -->');

fs.writeFileSync(outPath, html);
const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log('已生成 ' + outName + '（' + kb + ' KB）');
console.log('  外链脚本残留：' + (/<script[^>]+src=/.test(html) ? '有！' : '无'));
console.log('  内联 engine 标记：' + (html.includes('内联的 engine.js') ? '有' : '无'));
