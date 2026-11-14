// End-to-end UI flow test: clicks through Arcade (to the clear), a lost fight with
// continue + give up, Survival, Versus (2P), Training with pause options, and Settings.
// Player 1 is driven by a strong CPU and the simulation runs fast.
// Usage: NODE_PATH=$(npm root -g) node tools/flow.js [url] [shotDir]
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
  // run the current fight with P1 as a CPU at high speed until the result sheet shows
  const autoFight = async (p1Level, win = true) => {
    await p.waitForFunction(() => UI.fightOn && Game.running && (Game.state === 'intro' || Game.state === 'fight') && Game.round === 1, null, { timeout: 15000 });
    await p.evaluate(([lv, win]) => {
      Game.ctrls[0] = new CpuCtrl(lv); Game.ctrls[0].reset(Game.fighters[0]);
      Game.speed = 16;
      window.__rig = setInterval(() => { if (!Game.fighters[1]) return; const o = Game.fighters[win ? 1 : 0]; if (o.hp > 60 && Game.state === 'fight') o.hp = Math.max(1, o.hp - 40); }, 50);
    }, [p1Level, win]);
    await p.waitForFunction(() => document.querySelector('#modal:not(.hidden) .sheet.result'), null, { timeout: 120000 });
    await p.evaluate(() => { clearInterval(window.__rig); Game.speed = 1; });
  };
  await p.goto(URL);
  await p.waitForTimeout(1300);
  await click('#hOk');
  await shot('home');
  const coins0 = await p.evaluate(() => Save.data.coins);

  // ---------------- arcade: win all six fights
  await click('#btnArcade');
  await p.waitForTimeout(300); await shot('select');
  await click('#sdGo');
  for (let i = 0; i < 6; i++) {
    await p.waitForSelector('.sheet.versus', { timeout: 15000 });
    if (i === 0) await shot('versus');
    await p.click('.sheet.versus');
    if (i === 0) { await p.waitForFunction(() => Game.state === 'fight', null, { timeout: 15000 }); await p.waitForTimeout(1500); await shot('hud'); }
    await autoFight(9, true);
    const h = await p.evaluate(() => document.querySelector('#sheet h2').textContent);
    if (i < 5) { if (h !== 'YOU WIN') fail('arcade fight ' + i + ' result ' + h); if (i === 0) await shot('result'); await click('#rNext'); }
    else { if (!/ARCADE CLEAR/.test(h)) fail('arcade end ' + h); await shot('clear'); }
  }
  const st = await p.evaluate(() => ({ coins: Save.data.coins, saibo: Save.owned('saibo'), clears: Save.data.clears }));
  if (!st.saibo) fail('saibo not unlocked'); if (st.coins <= coins0) fail('no coins earned');
  console.log('arcade ok', JSON.stringify(st));
  await click('#rMenu');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });

  // ---------------- arcade: lose, continue, lose, give up
  await click('#btnArcade'); await click('#sdGo');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await autoFight(1, false);
  if (!/CONTINUE/.test(await p.textContent('#sheet h2'))) fail('no continue sheet');
  await shot('continue');
  await click('#rCont');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await autoFight(1, false);
  await click('#rGive');
  if (!/GAME OVER/.test(await p.textContent('#sheet h2'))) fail('no game over');
  await click('#rMenu');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('continue/give up ok');

  // ---------------- survival: two wins then a loss
  await click('#btnSurvival'); await click('#sdGo');
  for (let i = 0; i < 2; i++) {
    await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
    await p.waitForFunction(() => UI.fightOn && Game.running && (Game.state === 'intro' || Game.state === 'fight'), null, { timeout: 15000 });
    await p.evaluate(() => { Game.ctrls[0] = new CpuCtrl(9); Game.ctrls[0].reset(Game.fighters[0]); Game.speed = 16; window.__rig = setInterval(() => { const o = Game.fighters[1]; if (o && o.hp > 60 && Game.state === 'fight') o.hp -= 40; }, 50); });
    await p.waitForFunction((n) => UI.run && UI.run.streak === n, i + 1, { timeout: 120000 });
    await p.evaluate(() => clearInterval(window.__rig));
  }
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await autoFight(1, false);
  const surv = await p.evaluate(() => [document.querySelector('#sheet h2').textContent, Save.data.survivalBest]);
  if (surv[1] !== 2) fail('survival best ' + JSON.stringify(surv));
  await click('#rMenu');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('survival ok', JSON.stringify(surv));

  // ---------------- versus 2P: P2 keys move P2, P1 keys move P1
  await click('#btnVersus');
  await p.click('#optP2 button[data-v="1"]');
  await click('#sdGo');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'versus' && Game.state === 'fight', null, { timeout: 15000 });
  const x0 = await p.evaluate(() => Game.fighters.map(f => f.root.x));
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('KeyA'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight'); await p.keyboard.up('KeyA');
  const x1 = await p.evaluate(() => Game.fighters.map(f => f.root.x));
  if (!(x1[0] < x0[0] - 20 && x1[1] > x0[1] + 20)) fail('2P movement ' + JSON.stringify([x0, x1]));
  await p.keyboard.press('Period'); await p.waitForTimeout(50);
  const p2act = await p.evaluate(() => Game.fighters[1].action && Game.fighters[1].action.key);
  if (p2act !== 'l1' && p2act !== 'h') fail('P2 attack key ' + p2act);
  await shot('versus2p');
  await p.keyboard.press('KeyP');
  await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('versus 2P ok');

  // ---------------- training: moves via keyboard, pause options, restart, quit
  await click('#btnTraining'); await click('#sdGo');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'training' && Game.state === 'fight', null, { timeout: 15000 });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(900); await p.keyboard.up('KeyD');
  for (const k of ['KeyJ', 'KeyJ', 'KeyK']) { await p.keyboard.press(k); await p.waitForTimeout(160); }
  await p.waitForTimeout(400);
  await p.keyboard.press('KeyL'); await p.waitForTimeout(2600);
  const tr = await p.evaluate(() => ({ dummy: Game.fighters[1].hp, max: Game.fighters[1].maxHp, meter: Game.fighters[0].meter }));
  await shot('training');
  await p.keyboard.press('KeyP');
  await click('#pDummy button[data-v="cpu"]');
  await click('#pMoves'); await click('#mBack');
  await click('#pSet'); await p.click('.toggle[data-k="flashes"]'); await click('#sBack');
  await click('#pRestart');
  await p.waitForFunction(() => Game.state === 'fight' && UI.fightOn, null, { timeout: 15000 });
  await p.keyboard.press('Escape'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('training ok', JSON.stringify(tr));

  // ---------------- roster: buy a fighter
  await p.evaluate(() => { Save.data.coins = Math.max(Save.data.coins, 400); Save.save(); });
  await click('#btnRoster');
  await p.click('.ftile[data-id="kohei"]');
  await click('#sdBuy');
  if (!(await p.evaluate(() => Save.owned('kohei')))) fail('buy kohei');
  await click('#sdMain');
  await shot('roster');
  console.log('roster ok');

  const e2 = await p.evaluate(() => window.__errors);
  const all = errs.concat(e2);
  console.log(all.length ? 'ERRORS\n' + all.join('\n') : 'ALL FLOWS PASSED');
  await b.close();
  process.exit(all.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
