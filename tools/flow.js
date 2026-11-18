// End-to-end UI flow test, driven like a player with the real mouse and keyboard.
//  1. A fresh visitor boots straight into level 1-1 and the guide teaches each control.
//  2. Winning gives stars and coins; NEXT LEVEL jumps straight into the next fight.
//  3. Losing shows DEFEATED with RETRY; recruit levels unlock fighters; the level map works.
//  4. Versus (2 players), Survival, Training (pause options) and buying a fighter.
// Usage: serve the repo on :8123, then  NODE_PATH=$(npm root -g) node tools/flow.js [url] [shotDir]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8123/';
const SHOTS = process.argv[3] || null;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const fail = msg => { console.log('FAIL', msg); errs.push(msg); };
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/flow_${n}.png` }); };
  const click = async sel => { await p.waitForSelector(sel, { state: 'visible', timeout: 15000 }); await p.click(sel); };
  const ev = (f, a) => p.evaluate(f, a);
  const tutStep = () => ev(() => UI._tutStep());
  const waitStep = async (n, what) => { try { await p.waitForFunction(n => UI._tutStep() >= n, n, { timeout: 8000 }); } catch (e) { fail('guide stuck before step ' + n + ' (' + what + ') at ' + await tutStep()); } };
  const mouse = async (button, n = 1) => { for (let i = 0; i < n; i++) { await p.mouse.click(640, 400, { button }); await p.waitForTimeout(150); } };
  const near = () => ev(() => { const f = Game.fighters[0], o = Game.fighters[1]; Game.teleport(f, o.root.x - 170, GROUND); f.facing = 1; });
  // finish the current fight quickly with a strong CPU on side 0 (or let side 0 lose)
  const finish = async (win) => {
    await p.waitForFunction(() => UI.fightOn && Game.state === 'fight', null, { timeout: 15000 });
    await ev(win => {
      Game.ctrls[0] = new CpuCtrl(win ? 9 : 0); Game.ctrls[0].reset(Game.fighters[0]); Game.speed = 16;
      clearInterval(window.__rig);
      window.__rig = setInterval(() => { const o = Game.fighters[win ? 1 : 0]; if (o && o.hp > 60 && Game.state === 'fight') o.hp = Math.max(1, o.hp - 50); }, 50);
    }, win);
    await p.waitForFunction(() => document.querySelector('#modal:not(.hidden) .sheet.result'), null, { timeout: 120000 });
    await ev(() => { clearInterval(window.__rig); Game.speed = 1; });
    return p.textContent('#sheet h2');
  };

  await p.goto(URL);
  // ---------------- 1. straight into gameplay, with the guide
  await p.waitForFunction(() => UI.fightOn && Game.cfg && Game.cfg.tutorial && Game.state === 'fight', null, { timeout: 15000 });
  await p.waitForFunction(() => UI._tutStep() === 0, null, { timeout: 5000 });
  await shot('guide');
  await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await p.keyboard.up('KeyD'); await waitStep(1, 'move');
  await p.waitForTimeout(700); await p.keyboard.press('KeyW'); await waitStep(2, 'jump');
  await p.waitForTimeout(900); await near(); await p.waitForTimeout(200);
  await mouse('left', 1); await p.waitForTimeout(350); await mouse('left', 1); await p.waitForTimeout(350); await near(); await mouse('left', 1); await p.waitForTimeout(350);
  await near(); await mouse('left', 1); await waitStep(3, 'light');
  await p.waitForTimeout(800); await near(); await p.waitForTimeout(150); await mouse('right'); await waitStep(4, 'heavy');
  for (let i = 0; i < 4 && (await tutStep()) < 5; i++) {
    await p.waitForTimeout(900); await near(); await p.waitForTimeout(150);
    await p.mouse.click(640, 400); await p.waitForTimeout(110); await p.mouse.click(640, 400); await p.waitForTimeout(110); await p.mouse.click(640, 400, { button: 'right' });
  }
  await waitStep(5, 'combo');
  await p.waitForTimeout(900); await p.keyboard.press('KeyQ'); await waitStep(6, 'special');
  await p.waitForTimeout(900); await near(); await p.keyboard.down('KeyA');
  await waitStep(7, 'guard'); await p.keyboard.up('KeyA');
  await p.waitForTimeout(900); await p.keyboard.press('KeyF'); await waitStep(8, 'super');
  await p.waitForFunction(() => !Game.cfg.tutorial, null, { timeout: 8000 }).catch(() => fail('guide never handed over to the real fight'));
  console.log('guide ok: every control taught with real input');
  let h = await finish(true);
  if (!/CLEAR/.test(h)) fail('1-1 result ' + h);
  await shot('clear');
  const s1 = await ev(() => ({ stars: Campaign.cleared(0), done: Save.data.tutorialDone, coins: Save.data.coins }));
  if (!s1.stars || !s1.done || !s1.coins) fail('1-1 rewards ' + JSON.stringify(s1));

  // ---------------- 2. next level straight away
  await click('#rNext');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'level' && UI.run.L.i === 1 && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
  await p.waitForTimeout(1600); await shot('level2');
  h = await finish(true);
  if (!/CLEAR/.test(h)) fail('1-2 result ' + h);
  // ---------------- 3. lose then retry; recruit level
  await click('#rNext');
  await p.waitForFunction(() => UI.fightOn && UI.run.L.i === 2 && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
  h = await finish(false);
  if (!/DEFEATED/.test(h)) fail('expected defeat, got ' + h);
  await shot('defeat');
  await click('#rRetry');
  await p.waitForFunction(() => UI.fightOn && UI.run.L.i === 2 && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
  h = await finish(true);
  if (!(await ev(() => Save.owned('kohei')))) fail('kohei not recruited at 1-3');
  if (!(await ev(() => !!document.querySelector('.sheet .unlock')))) fail('no recruit card');
  await shot('recruit');
  console.log('levels ok', JSON.stringify(await ev(() => ({ stars: Campaign.stars(), coins: Save.data.coins, next: Campaign.next().label }))));
  await click('#rMenu');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  if ((await p.textContent('#playSub')).indexOf('1-4') < 0) fail('PLAY does not point at 1-4: ' + await p.textContent('#playSub'));
  await shot('home');
  // ---------------- level map
  await click('#btnLevels');
  await p.waitForTimeout(300); await shot('levels');
  if ((await p.$$('#levelGrid .stage-card')).length !== 6) fail('level grid size');
  await p.click('#chapterTabs button[data-c="3"]');
  await p.click('#levelGrid .stage-card');
  if (!(await ev(() => document.querySelectorAll('.toast').length))) fail('locked level gave no message');
  await p.click('#chapterTabs button[data-c="0"]');
  await p.click('#levelGrid .stage-card[data-i="0"]');
  await p.waitForFunction(() => UI.fightOn && UI.run.L.i === 0 && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
  if (await ev(() => Game.cfg.tutorial)) fail('replaying 1-1 restarted the tutorial guide mode');
  await p.keyboard.press('KeyP'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  // PLAY goes straight in, with no select screen
  await click('#btnPlay');
  await p.waitForFunction(() => UI.fightOn && UI.run.L.i === 3, null, { timeout: 15000 });
  if (await ev(() => UI.screen !== null)) fail('PLAY did not go straight into the fight');
  await p.keyboard.press('KeyP'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('map + play ok');

  // ---------------- 4. versus 2P
  await click('#btnVersus');
  await p.click('#optP2 button[data-v="1"]');
  await click('#sdGo');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'versus' && Game.state === 'fight', null, { timeout: 15000 });
  const x0 = await ev(() => Game.fighters.map(f => f.root.x));
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('KeyA'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight'); await p.keyboard.up('KeyA');
  const x1 = await ev(() => Game.fighters.map(f => f.root.x));
  if (!(x1[0] < x0[0] - 20 && x1[1] > x0[1] + 20)) fail('2P movement ' + JSON.stringify([x0, x1]));
  await p.keyboard.press('Period'); await p.waitForTimeout(50);
  if (!(await ev(() => Game.fighters[1].action && Game.fighters[1].action.key))) fail('P2 attack key');
  await p.mouse.click(640, 400); await p.waitForTimeout(40);
  if (!(await ev(() => Game.fighters[0].action && Game.fighters[0].action.key))) fail('P1 left click attack');
  await p.keyboard.press('KeyP'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('versus 2P ok');

  // ---------------- survival
  await click('#btnSurvival'); await click('#sdGo');
  for (let i = 0; i < 2; i++) {
    await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
    await p.waitForFunction(() => UI.fightOn && Game.running && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
    await ev(() => { Game.ctrls[0] = new CpuCtrl(9); Game.ctrls[0].reset(Game.fighters[0]); Game.speed = 16; window.__rig = setInterval(() => { const o = Game.fighters[1]; if (o && o.hp > 60 && Game.state === 'fight') o.hp -= 50; }, 50); });
    await p.waitForFunction(n => UI.run && UI.run.streak === n, i + 1, { timeout: 120000 });
    await ev(() => clearInterval(window.__rig));
  }
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  h = await finish(false);
  if ((await ev(() => Save.data.survivalBest)) !== 2) fail('survival best');
  await click('#rMenu');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('survival ok');

  // ---------------- training
  await click('#btnTraining'); await click('#sdGo');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'training' && Game.state === 'fight', null, { timeout: 15000 });
  await p.keyboard.press('KeyP');
  await click('#pDummy button[data-v="cpu"]');
  await click('#pMoves'); await click('#mBack');
  await click('#pSet'); await p.click('.toggle[data-k="flashes"]'); await click('#sBack');
  await click('#pRestart');
  await p.waitForFunction(() => Game.state === 'fight' && UI.fightOn, null, { timeout: 15000 });
  await p.keyboard.press('Escape'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('training ok');

  // ---------------- roster: buy a coin-exclusive fighter
  await ev(() => { Save.data.coins = Math.max(Save.data.coins, 900); Save.save(); });
  await click('#btnRoster');
  await p.click('.ftile[data-id="ripper"]');
  await click('#sdBuy');
  if (!(await ev(() => Save.owned('ripper')))) fail('buy ripper');
  await click('#sdMain');
  await shot('roster');
  console.log('roster ok');

  const all = errs.concat(await ev(() => window.__errors));
  console.log(all.length ? 'ERRORS\n' + all.join('\n') : 'ALL FLOWS PASSED');
  await b.close();
  process.exit(all.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
