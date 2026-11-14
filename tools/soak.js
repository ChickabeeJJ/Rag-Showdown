// Headless soak test: CPU vs CPU matches at high speed across the roster.
// Checks for thrown errors, NaN / escaped bodies, stuck rounds and broken state,
// and prints win rates per fighter as a balance check.
// Usage: serve the repo (python3 -m http.server 8123) then
//   NODE_PATH=$(npm root -g) node tools/soak.js [matchesPerPair=1] [url]
const { chromium } = require('playwright');
const PER = +(process.argv[2] || 1);
const URL = process.argv[3] || 'http://localhost:8123/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForTimeout(1500);
  const out = await p.evaluate(async (PER) => {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('home').classList.add('hidden');
    const ids = ROSTER.map(d => d.id);
    const res = { matches: 0, issues: [], wins: {}, games: {}, rounds: 0, roundTime: 0, supers: 0, finishers: 0, bf: 0, maxCombo: 0, kos: 0, timeouts: 0 };
    ids.forEach(i => { res.wins[i] = 0; res.games[i] = 0; });
    const stages = ['dojo', 'city', 'temple', 'void', 'crater', 'lab'];
    const check = (tag) => {
      for (const f of Game.fighters) {
        for (const q of f.pts.concat([f.root])) {
          if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) { res.issues.push(tag + ' NaN ' + f.def.id); return false; }
          if (q.x < WALL_L - 80 || q.x > WALL_R + 80 || q.y > GROUND + 40 || q.y < -200) { res.issues.push(tag + ' escape ' + f.def.id + ' ' + Math.round(q.x) + ',' + Math.round(q.y) + ' mode ' + f.mode); return false; }
        }
        if (f.hp > f.maxHp + 1) res.issues.push(tag + ' hp>max');
        if (f.meter < 0 || f.meter > 100.01) res.issues.push(tag + ' meter ' + f.meter);
      }
      return true;
    };
    for (let rep = 0; rep < PER; rep++) for (const a of ids) for (const bId of ids) {
      if (rep > 0 && a === bId) continue;
      let ended = null;
      const L = 3 + ((rep * 7 + res.matches) % 6), lv = [L, L];
      Game.startMatch({ p1: a, p2: bId, ctrls: [new CpuCtrl(lv[0]), new CpuCtrl(lv[1])], stage: stages[(res.matches) % stages.length], mode: 'versus', toWin: 2, onEnd: r => { ended = r; } });
      Game.speed = 16;
      let simGuard = 0, lastRound = 1, roundStart = Game.t, ok = true, supersSeen = 0;
      while (!ended && simGuard < 40000) {
        simGuard++;
        Game.update(1 / 60);
        if (simGuard % 25 === 0) Game.render();
        if (Game.cut && Game.cut.t < 0.02) supersSeen++;
        if (!check(a + ' vs ' + bId)) { ok = false; break; }
        if (Game.round !== lastRound) { res.rounds++; res.roundTime += Game.t - roundStart; lastRound = Game.round; roundStart = Game.t; }
        if (Game.t - roundStart > 140) { res.issues.push('stuck round ' + a + ' vs ' + bId + ' state ' + Game.state + ' modes ' + Game.fighters.map(f => f.mode + '/' + (f.action && f.action.key)).join(',')); ok = false; break; }
        if (window.__errors.length) { res.issues.push('error ' + window.__errors[0]); ok = false; break; }
      }
      if (!ended && ok) res.issues.push('no end ' + a + ' vs ' + bId + ' state ' + Game.state);
      if (ended) {
        res.matches++; res.rounds++; res.roundTime += Game.t - roundStart;
        const w = ended.winner === 0 ? a : bId;
        if (a !== bId) { res.wins[w]++; res.games[a]++; res.games[bId]++; }
        res.finishers += ended.stats.finishers; res.bf += ended.stats.bf; res.maxCombo = Math.max(res.maxCombo, ended.stats.maxCombo);
        if (Game.koKind === 'time') res.timeouts++;
      }
      res.supers += supersSeen;
      await new Promise(r => setTimeout(r, 0));
    }
    res.avgRound = +(res.roundTime / Math.max(1, res.rounds)).toFixed(1);
    res.winRate = Object.fromEntries(ids.map(i => [i, res.games[i] ? +(res.wins[i] / res.games[i]).toFixed(2) : null]));
    delete res.wins; delete res.games; delete res.roundTime;
    return res;
  }, PER);
  console.log(JSON.stringify(out, null, 1));
  console.log('PAGE ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
  process.exit(out.issues.length || errs.length ? 1 : 0);
})();
