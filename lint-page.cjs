/* 检查 index.html 内联脚本的语法，并列出关键结构 */
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('内联脚本块数：' + scripts.length);
let bad = 0;
scripts.forEach((s, i) => {
  try { new Function(s); console.log('  块 ' + (i + 1) + ' 语法 OK（' + s.split('\n').length + ' 行）'); }
  catch (e) { bad++; console.log('  块 ' + (i + 1) + ' 语法错误：' + e.message); }
});
const ex = html.match(/<script src="([^"]+)"><\/script>/g) || [];
console.log('外链脚本：' + ex.join(' '));
for (const f of ['engine.js']) {
  const p = __dirname + '/' + f;
  console.log((fs.existsSync(p) ? '存在 ' : '缺失 ') + f);
}
// 检查 id 引用是否都存在
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const refs = new Set([...scripts.join('\n').matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]));
const missing = [...refs].filter(r => !ids.has(r));
console.log('脚本引用的 id 共 ' + refs.size + ' 个，缺失：' + (missing.length ? missing.join(', ') : '无'));
process.exit(bad || missing.length ? 1 : 0);
