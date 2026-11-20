// End-to-end UI flow test, driven like a player with the real mouse and keyboard.
//  1. A fresh visitor boots straight into level 1-1 and the guide teaches each control.
//  2. Winning gives stars and coins; NEXT LEVEL jumps straight into the next fight.
//  3. Losing shows DEFEATED with RETRY; recruit levels unlock fighters; the level map works.
//  4. Ascent (floor, card pick, run over), Survival, Training with trials, buying a fighter and an upgrade.
//  5. The CrazyGames SDK integration, against a recording mock.
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

  // the CrazyGames SDK is replaced by a recording mock (tools/crazygames-mock.js)
  const mock = require('fs').readFileSync(require('path').join(__dirname, 'crazygames-mock.js'), 'utf8');
  await p.route('https://sdk.crazygames.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
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

  // ---------------- 4. ascent: a floor, a card choice, then the run ends
  await click('#btnAscent');
  if (await ev(() => !!document.getElementById('optP2'))) fail('two-player option still shown');
  await click('#sdGo');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'ascent' && Game.state === 'fight', null, { timeout: 15000 });
  if (await ev(() => Game.ctrls[1].human)) fail('ascent P2 is not the CPU');
  await p.mouse.click(640, 400); await p.waitForTimeout(40);
  if (!(await ev(() => Game.fighters[0].action && Game.fighters[0].action.key))) fail('P1 left click attack');
  await finish(true);
  await p.waitForSelector('.rcard', { timeout: 10000 });
  if ((await p.$$('.rcard')).length !== 3) fail('ascent should offer 3 cards');
  const cardId = await p.getAttribute('.rcard:nth-child(2)', 'data-b');
  await p.keyboard.press('Digit2');
  await p.waitForSelector('.sheet.versus', { timeout: 10000 });
  const run = await ev(() => ({ floor: UI.run.floor, cards: UI.run.cards, best: Save.data.ascentBest }));
  if (run.floor !== 2 || run.cards[cardId] !== 1 || run.best !== 1) fail('ascent after floor 1: ' + JSON.stringify(run));
  await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.state === 'fight' && UI.run.floor === 2, null, { timeout: 15000 });
  if (!(await ev(id => { const m = Meta.modsFor(UI.run.p1, { upgrades: true, cards: { [id]: 1 } }), f = Game.fighters[0].mods; return Object.keys(m).every(k => m[k] === f[k]); }, cardId))) fail('card not applied to the fighter');
  h = await finish(false);
  if (!/RUN OVER/.test(h)) fail('ascent loss sheet: ' + h);
  await click('#rRetry');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.state === 'fight' && UI.run.floor === 1 && Object.keys(UI.run.cards).length === 0, null, { timeout: 15000 });
  await p.keyboard.press('KeyP'); await click('#pQuit');
  await p.waitForFunction(() => UI.screen === 'home' && !UI.fightOn, null, { timeout: 10000 });
  console.log('ascent ok');

  // ---------------- events: check-in, an Event Battle, rewards, the exclusive fighter, skins
  await click('#btnEvent');
  await p.waitForFunction(() => UI.screen === 'event', null, { timeout: 10000 });
  const ev0 = await ev(() => ({ t: Events.state().tokens, id: Events.current().id, f: Events.current().fighter }));
  await click('#evCheck');
  const ev1 = await ev(() => Events.state().tokens);
  if (ev1 !== ev0.t + 20) fail('event check-in tokens: ' + ev0.t + ' -> ' + ev1);
  if (await p.$('#evCheck')) fail('check-in still offered after checking in');
  await click('#evBattle');
  await p.waitForSelector('.sheet.versus'); await p.click('.sheet.versus');
  await p.waitForFunction(() => UI.fightOn && Game.cfg.mode === 'event' && Game.state === 'fight', null, { timeout: 15000 });
  if (await ev(() => Game.stageId !== Events.current().stage)) fail('event battle not on the event stage');
  h = await finish(true);
  if (!/EVENT BATTLE WON/.test(h)) fail('event battle result: ' + h);
  const ev2 = await ev(() => ({ t: Events.state().tokens, b: Events.state().battles }));
  if (ev2.b !== 1 || ev2.t < ev1 + 24) fail('event battle tokens/battles: ' + JSON.stringify(ev2));
  await click('#rEvent');
  await p.waitForFunction(() => UI.screen === 'event' && !UI.fightOn, null, { timeout: 10000 });
  // the whole track: claim every tier; the last one unlocks the exclusive fighter
  await ev(() => Events.addTokens(Events.MAX)); await ev(() => UI._renderEvent());
  for (let i = 0; i < 7; i++) {
    await click(`[data-claim="${i}"]`);
    if (await p.$('#rvOk')) await click('#rvOk');
  }
  const ev3 = await ev(f => ({ owned: Save.owned(f), claimed: Events.state().claimed.length, skins: Save.data.skins.owned.length }), ev0.f);
  if (!ev3.owned || ev3.claimed !== 7 || ev3.skins !== 3) fail('event rewards: ' + JSON.stringify(ev3));
  if (await ev(() => Events.claim(0))) fail('a tier could be claimed twice');
  // a skin is worn in the next fight
  const sk = await ev(() => { const S = Skins.LIST[Events.current().skins[0]]; return S; });
  if (!(await ev(S => Skins.equipped(S.fighter) === S.id, sk))) fail('claimed skin not equipped');
  await p.click('#event [data-back]');
  await p.waitForFunction(() => UI.screen === 'home', null, { timeout: 10000 });
  console.log('event ok');

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
  if ((await p.$$('#trials .trial')).length !== 5) fail('training should list 5 trials');
  const coins0 = await ev(() => Save.data.coins);
  const tid = await ev(() => Game.fighters[0].def.id);
  await ev(async () => {
    const f = Game.fighters[0], o = Game.fighters[1];
    Game.teleport(f, o.root.x - 150, GROUND); f.facing = 1;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    Game.press(0, 'l'); await wait(120); Game.press(0, 'l'); await wait(120); Game.press(0, 'h');
  });
  try { await p.waitForFunction(id => Meta.trialsDone(id).includes('ender'), tid, { timeout: 4000 }); } catch (e) { fail('finisher trial did not clear'); }
  if ((await ev(() => Save.data.coins)) !== coins0 + 40) fail('trial payout');
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
  await ev(() => { Save.data.coins = Math.max(Save.data.coins, 1200); Save.save(); });
  await click('#btnRoster');
  await p.click('.ftile[data-id="ripper"]');
  await click('#sdBuy');
  if (!(await ev(() => Save.owned('ripper')))) fail('buy ripper');
  const c1 = await ev(() => Save.data.coins);
  await click('.sd-tabs button[data-t="upg"]'); await click('.upg-buy[data-u="pow"]');
  const up = await ev(() => ({ r: Meta.ranks('ripper').pow, c: Save.data.coins, m: Meta.modsFor('ripper', { upgrades: true }).dmg }));
  if (up.r !== 1 || up.c !== c1 - 60 || Math.abs(up.m - 1.04) > 1e-9) fail('upgrade purchase: ' + JSON.stringify(up));
  if (!(await p.textContent('.ftile[data-id="ripper"]')).includes('R1')) fail('rank badge on tile');
  await click('#sdMain');
  await shot('roster');
  console.log('roster ok');

  // ---------------- platform SDK: every integration point fired
  const calls = await ev(() => window.__sdkCalls || []);
  for (const need of ['init', 'settingsListener', 'user.authListener', 'user.getUser', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'happytime', 'data.getItem', 'data.setItem'])
    if (!calls.includes(need)) fail('SDK call missing: ' + need);
  if (calls.indexOf('loadingStop') < calls.indexOf('init')) fail('SDK loading events before init');
  // gameplay start/stop alternate, never doubled
  const gp = calls.filter(c => c === 'gameplayStart' || c === 'gameplayStop');
  if (gp.some((c, i) => i && c === gp[i - 1])) fail('gameplay events doubled');
  // a platform mute silences the game
  await ev(() => window.__sdkMute(true));
  if (calls.some(c => c.startsWith('requestAd'))) fail('the game requested an ad');
  if (!(await ev(() => Platform.user && Platform.user.name === 'TestPlayer'))) fail('SDK user not picked up');
  console.log('sdk ok', JSON.stringify({ calls: calls.length, gameplay: gp.length }));

  const all = errs.concat(await ev(() => window.__errors));
  console.log(all.length ? 'ERRORS\n' + all.join('\n') : 'ALL FLOWS PASSED');
  await b.close();
  process.exit(all.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
