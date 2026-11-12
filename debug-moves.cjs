const fs = require('fs'), vm = require('vm');
const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/engine.js', 'utf8'), sandbox);
const E = sandbox.module.exports;

const b = E.initialBoard();
for (const side of [E.CN, E.IN]) {
  console.log('\n== ' + E.SIDE_NAME[side] + ' ==');
  let total = 0;
  for (let y = 0; y < E.M; y++) for (let x = 0; x < E.N; x++) {
    const p = b[E.idx(x, y)];
    if (!p || p.s !== side) continue;
    const ms = E.movesFrom(b, x, y);
    total += ms.length;
    console.log('  ' + E.pieceName(p) + ' ' + E.sqName(x, y) + ' → ' + ms.length + ' 种  ' +
      ms.map(m => E.sqName(m.tx, m.ty)).join(' '));
  }
  console.log('  合计 ' + total);
}
