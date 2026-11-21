// Usage: serve the repo on :8123, then  NODE_PATH=$(npm root -g) node tools/combo-timing.js
// light, light, heavy pressed with human-like timing: how often does the finisher come out?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const mock = require('fs').readFileSync(require('path').join(__dirname, 'crazygames-mock.js'), 'utf8');
  await p.route('https://sdk.crazygames.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
  await p.goto('http://localhost:8123/?t=' + Date.now()); await p.waitForTimeout(1000);
  console.log(await p.evaluate(() => {
    document.getElementById('modal').classList.add('hidden');
    const res = {};
    // gaps between presses in frames (60 fps): mashed, quick, steady, relaxed, late
    const timings = { mash: [3, 3], quick: [6, 6], steady: [10, 10], relaxed: [14, 14], late: [17, 19], uneven: [4, 16] };
    let lhWrong = 0, lhN = 0;
    for (const [name, gaps] of Object.entries(timings)) {
      let ok = 0, n = 0;
      for (const d of ROSTER) {
        Game.startMatch({ p1: d.id, p2: 'kaze', ctrls: [new DummyCtrl('stand'), new DummyCtrl('stand')], stage: 'lab', mode: 'versus', toWin: 99, quickStart: true, hpMul: [1, 20] });
        for (let i = 0; i < 200 && Game.state !== 'fight'; i++) Game.update(1 / 60);
        const f = Game.fighters[0]; Game.fighters[1].root.x = f.root.x + f.facing * 120;
        const at = [0, gaps[0], gaps[0] + gaps[1]], keys = ['l', 'l', 'h'], seen = [];
        for (let fr = 0; fr < 90; fr++) { const k = at.indexOf(fr); if (k >= 0) Game.press(0, keys[k]); Game.update(1 / 60); if (f.action && seen[seen.length - 1] !== f.action.key) seen.push(f.action.key); }
        n++; if (seen.join(',') === 'l1,l2,hEnd') ok++; else res['miss ' + name + ' ' + d.id] = seen.join(',');
      }
      res[name] = ok + '/' + n;
    }
    // light, heavy must stay a plain heavy at any speed
    for (const g of [3, 8, 14]) for (const d of ROSTER) {
      Game.startMatch({ p1: d.id, p2: 'kaze', ctrls: [new DummyCtrl('stand'), new DummyCtrl('stand')], stage: 'lab', mode: 'versus', toWin: 99, quickStart: true, hpMul: [1, 20] });
      for (let i = 0; i < 200 && Game.state !== 'fight'; i++) Game.update(1 / 60);
      const f = Game.fighters[0]; Game.fighters[1].root.x = f.root.x + f.facing * 120; const seen = [];
      for (let fr = 0; fr < 70; fr++) { if (fr === 0) Game.press(0, 'l'); if (fr === g) Game.press(0, 'h'); Game.update(1 / 60); if (f.action && seen[seen.length - 1] !== f.action.key) seen.push(f.action.key); }
      lhN++; if (seen.includes('hEnd')) lhWrong++;
    }
    res.lightHeavyGaveFinisher = lhWrong + '/' + lhN;
    return JSON.stringify(res, null, 1);
  }));
  await b.close();
})();
