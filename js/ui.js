'use strict';
/* =========================================================================
   UI: home (with a CPU demo fight behind it), fighter select / roster shop,
   the Arcade ladder with continues, Versus (CPU or two players), Survival,
   Training, result sheets, pause, settings, how-to-play, the fight HUD and
   the touch pad. Built on Element Rag's panels and buttons.
   ========================================================================= */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const U = { screen: 'home', run: null, sel: null, fightOn: false };
  const DIFFS = [
    { name: 'EASY', lv: [1, 2, 2, 3, 3, 4], mul: 0.6 },
    { name: 'NORMAL', lv: [2, 3, 4, 5, 6, 7], mul: 1 },
    { name: 'HARD', lv: [5, 6, 7, 8, 8, 9], mul: 1.6 },
  ];
  const STAGE_IDS = ['dojo', 'city', 'temple', 'void', 'crater'];
  const KEYS = { sp1: 'U', sp2: 'I', super: 'L' };

  /* ------------------------------------------------------------ helpers */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = (name, cls = '') => `<span class="ic ${cls}" data-icon="${name}"></span>`;
  const pt = (def, cls = '') => `<span class="pt ${cls}" style="--c:${def.color}"><img alt="" src="${Portraits.url(def)}"></span>`;
  const shade = c => mixHex(c, '#000000', 0.45);
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  function coinsUI() { document.querySelectorAll('.coin-val').forEach(e => { e.textContent = fmt(Save.data.coins); }); }
  function hydrate(root) { Icons.hydrate(root || document); }

  function openSheet(html, cls = '') {
    const m = $('modal'), sh = $('sheet');
    sh.className = 'sheet ' + cls;
    sh.onclick = null;
    U.sheetDismiss = null;
    clearInterval(U.countTimer);
    sh.innerHTML = html;
    m.classList.remove('hidden');
    hydrate(sh);
    Input.enable(false);
    return sh;
  }
  function closeSheet() {
    $('modal').classList.add('hidden');
    $('sheet').innerHTML = '';
    clearInterval(U.countTimer);
    if (U.fightOn && !Game.paused) Input.enable(true);
  }
  U.modalOpen = () => !$('modal').classList.contains('hidden');

  function show(name) {
    U.screen = name;
    for (const id of ['home', 'select']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', name !== null || !U.fightOn);
    document.body.classList.toggle('playing', name === null);
    if (name === 'home') renderHome();
    coinsUI();
    checkRotate();
  }

  function transition(mid) {
    const bars = $('bars');
    bars.className = 'in';
    clearTimeout(U.trT1); clearTimeout(U.trT2);
    U.trT1 = setTimeout(() => {
      try { mid(); } catch (e) { console.error(e); }
      bars.className = 'out';
      U.trT2 = setTimeout(() => { bars.className = ''; }, 1400);
    }, 1280);
  }

  /* --------------------------------------------------------------- init */
  U.init = function () {
    hydrate();
    $('btnArcade').onclick = () => { Sfx.play('ui'); openSelect('arcade'); };
    $('btnVersus').onclick = () => { Sfx.play('ui'); openSelect('versus'); };
    $('btnSurvival').onclick = () => { Sfx.play('ui'); openSelect('survival'); };
    $('btnTraining').onclick = () => { Sfx.play('ui'); openSelect('training'); };
    $('btnRoster').onclick = () => { Sfx.play('ui'); openSelect('roster'); };
    $('btnHow').onclick = () => { Sfx.play('ui'); openHow(); };
    $('btnSettings').onclick = () => { Sfx.play('ui'); openSettings(); };
    $('btnPause').onclick = () => U.openPause();
    $('btnRotateOk').onclick = () => { U.rotateOk = true; checkRotate(); };
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => { Sfx.play('uiBack'); show('home'); }; });
    $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && U.sheetDismiss) { const f = U.sheetDismiss; U.sheetDismiss = null; f(); } });
    setupTouch();
    Sfx.setSfx(Save.data.settings.sfx); Sfx.setMusic(Save.data.settings.music);
    show('home');
    startDemo();
    if (!Save.data.seenHow) { Save.data.seenHow = true; Save.save(); setTimeout(() => { if (U.screen === 'home' && !U.modalOpen()) openHow(true); }, 700); }
  };

  /* -------------------------------------------------------------- demo */
  function startDemo() {
    U.fightOn = false;
    Input.enable(false);
    $('hud').classList.add('hidden');
    const ids = ROSTER.map(d => d.id);
    const a = pick(ids); let b = pick(ids); if (b === a) b = ids[(ids.indexOf(a) + 3) % ids.length];
    Game.speed = U.testSpeed || 1;
    Game.startMatch({ p1: a, p2: b, ctrls: [new CpuCtrl(randi(4, 7)), new CpuCtrl(randi(4, 7))], stage: pick(STAGE_IDS), mode: 'demo', toWin: 2,
      onEnd: () => setTimeout(() => { if (!U.fightOn) startDemo(); }, 1200) });
    Sfx.music('menu');
  }

  /* -------------------------------------------------------------- home */
  function renderHome() {
    const d = Save.data;
    const def = BY_ID[d.lastPick] || ROSTER[0];
    $('arcadeSub').textContent = `6 FIGHTS · ${DIFFS[d.arcadeDiff].name}`;
    $('survSub').textContent = `BEST ${d.survivalBest}`;
    $('homePick').innerHTML = `${pt(def)}<div><small>YOUR FIGHTER</small><b>${def.name}</b><small style="color:${def.color}">${def.title}</small></div><button class="btn small" id="homeChange"><b>CHANGE</b></button>`;
    $('homeChange').onclick = () => { Sfx.play('ui'); openSelect('roster'); };
    const canBuy = ROSTER.some(f => !Save.owned(f.id) && !f.unlockByClear && d.coins >= f.price);
    $('rosterNote').classList.toggle('hidden', !canBuy);
    const ready = Save.dailyReady();
    $('daily').className = 'daily' + (ready ? '' : ' done');
    $('daily').innerHTML = `${ic(ready ? 'gift' : 'check')}<span>${ready ? 'FIRST WIN OF THE DAY: +100 COINS' : 'DAILY BONUS CLAIMED · BACK TOMORROW'}</span>`;
    hydrate($('home'));
    coinsUI();
  }

  /* ------------------------------------------------------------ select */
  function openSelect(mode) {
    const last = Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze';
    const others = ROSTER.filter(f => f.id !== last && !f.boss);
    U.sel = { mode, p1: last, p2: mode === 'training' ? 'kaze' : pick(others).id, view: last, picking: 0, p2human: false, cpuLv: 4, stage: 'random', dummy: 'stand' };
    $('selTitle').textContent = { arcade: 'ARCADE · CHOOSE YOUR FIGHTER', versus: 'VERSUS', survival: 'SURVIVAL · CHOOSE YOUR FIGHTER', training: 'TRAINING · CHOOSE YOUR FIGHTER', roster: 'FIGHTERS' }[mode];
    show('select');
    renderSelect();
  }

  function renderSelect() {
    const s = U.sel;
    const grid = $('selGrid');
    grid.innerHTML = ROSTER.map(f => {
      const own = Save.owned(f.id);
      const tags = [];
      if (s.p1 === f.id && s.mode !== 'roster') tags.push('<span>P1</span>');
      if (s.mode === 'versus' && s.p2 === f.id) tags.push(`<span class="p2">${s.p2human ? 'P2' : 'CPU'}</span>`);
      const right = !own ? `<span class="price">${f.unlockByClear && Save.data.coins < f.price ? ic('lock') : ic('coins', 'coin') + fmt(f.price)}</span>` : Save.data.clears[f.id] != null ? `<span class="clear ic" data-icon="trophy"></span>` : '';
      return `<button class="ftile ${s.view === f.id ? 'on' : ''}" data-id="${f.id}" style="--c:${f.color}">${pt(f, own ? '' : 'locked')}<span class="tagc">${tags.join('')}</span>${right}<b>${f.name}</b><small>${f.title}</small></button>`;
    }).join('');
    grid.querySelectorAll('.ftile').forEach(b => {
      b.onclick = () => {
        Sfx.play('ui');
        const id = b.dataset.id;
        s.view = id;
        if (Save.owned(id) && s.mode !== 'roster') {
          if (s.mode === 'versus' && s.picking === 1) s.p2 = id; else s.p1 = id;
        }
        renderSelect();
      };
      b.ondblclick = () => { if (Save.owned(b.dataset.id) && s.mode !== 'roster' && s.mode !== 'versus') confirmSelect(); };
    });
    renderDetail();
    hydrate(grid);
  }

  function moveRows(def) {
    const row = (k, mv, keys, sub, cls = '') => `<div class="mv ${cls}" style="--c:${def.color};--d:${shade(def.color)}"><span class="move-ic">${Icons.svg(mv.icon || 'fist')}</span><div><b>${esc(mv.name)}</b><small>${sub}</small></div><span class="keys2">${keys}</span></div>`;
    const m = def.moves;
    return row('sp1', m.sp1, '<kbd>U</kbd>', `SPECIAL · ${m.sp1.cd || 2}S COOLDOWN`) +
      row('sp2', m.sp2, '<kbd>I</kbd>', `SPECIAL · ${m.sp2.cd || 2}S COOLDOWN`) +
      row('super', m.super, '<kbd>L</kbd>', 'SUPER · FULL METER · FINISHER', 'super');
  }

  function renderDetail() {
    const s = U.sel, def = BY_ID[s.view];
    const own = Save.owned(def.id);
    const st = def.stats;
    const meter = (n) => `<span class="meter">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    let foot = '';
    if (!own) {
      const can = Save.data.coins >= def.price;
      foot = `<div class="lock-note">${ic('lock')}${def.unlockByClear ? `Clear Arcade with any fighter to unlock, or buy for ${fmt(def.price)} coins.` : `Unlock for ${fmt(def.price)} coins. Win fights to earn coins.`}</div>
        <div class="sd-foot"><button class="btn primary" id="sdBuy" ${can ? '' : 'disabled'}><b>UNLOCK · ${fmt(def.price)}</b></button></div>`;
    } else if (s.mode === 'roster') {
      foot = `<div class="sd-foot"><button class="btn primary" id="sdMain" ${Save.data.lastPick === def.id ? 'disabled' : ''}><b>${Save.data.lastPick === def.id ? 'YOUR FIGHTER' : 'SET AS YOUR FIGHTER'}</b></button><button class="btn" id="sdTry"><b>TRY IN TRAINING</b></button></div>`;
    } else {
      let opts = '';
      if (s.mode === 'arcade') {
        opts = `<div class="sd-opts"><div class="row"><small>DIFFICULTY</small><nav class="seg" id="optDiff">${DIFFS.map((d, i) => `<button data-v="${i}" class="${Save.data.arcadeDiff === i ? 'active' : ''}">${d.name}</button>`).join('')}</nav></div></div>`;
      } else if (s.mode === 'versus') {
        opts = `<div class="sd-opts">
          <div class="row"><small>PICKING</small><nav class="seg" id="optPick"><button data-v="0" class="${s.picking === 0 ? 'active' : ''}">P1 · ${BY_ID[s.p1].name}</button><button data-v="1" class="${s.picking === 1 ? 'active' : ''}">${s.p2human ? 'P2' : 'CPU'} · ${BY_ID[s.p2].name}</button></nav></div>
          <div class="row"><small>PLAYER 2</small><nav class="seg" id="optP2"><button data-v="0" class="${!s.p2human ? 'active' : ''}">CPU</button><button data-v="1" class="${s.p2human ? 'active' : ''}">HUMAN (SAME KEYBOARD / PAD)</button></nav></div>
          ${s.p2human ? '' : `<div class="row"><small>CPU LEVEL</small><nav class="seg" id="optLv">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button data-v="${n}" class="${s.cpuLv === n ? 'active' : ''}">${n}</button>`).join('')}</nav></div>`}
          <div class="row"><small>STAGE</small><nav class="seg" id="optStage"><button data-v="random" class="${s.stage === 'random' ? 'active' : ''}">RANDOM</button>${STAGE_IDS.map(id => `<button data-v="${id}" class="${s.stage === id ? 'active' : ''}">${STAGES[id].name.split(' ')[0]}</button>`).join('')}</nav></div></div>`;
      } else if (s.mode === 'training') {
        opts = `<div class="sd-opts"><div class="row"><small>DUMMY</small><nav class="seg" id="optDummy">${['kaze', 'ryo', 'homura', 'mugi'].map(id => `<button data-v="${id}" class="${s.p2 === id ? 'active' : ''}">${BY_ID[id].name}</button>`).join('')}</nav></div></div>`;
      }
      const label = { arcade: 'START ARCADE', versus: 'FIGHT!', survival: 'START SURVIVAL', training: 'ENTER TRAINING' }[s.mode];
      foot = `${opts}<div class="sd-foot"><button class="btn primary big" id="sdGo"><b>${label}</b></button></div>`;
    }
    $('selDetail').innerHTML = `
      <div class="sd-head" style="--c:${def.color}">${pt(def, own ? '' : 'locked')}<div><h3>${def.name}</h3><small>${def.title}</small></div></div>
      <p class="sd-blurb">${esc(def.blurb)}</p>
      <div class="sd-stats" style="--c:${def.color}"><div><small>POWER</small>${meter(st[0])}</div><div><small>SPEED</small>${meter(st[1])}</div><div><small>RANGE</small>${meter(st[2])}</div></div>
      <div class="sd-moves">${moveRows(def)}</div>
      ${foot}`;
    const D = $('selDetail');
    hydrate(D);
    const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    on('sdBuy', () => {
      if (Save.buy(def.id)) { Sfx.play('unlock'); toast(`${def.name} UNLOCKED`); if (s.mode !== 'roster') s.p1 = def.id; coinsUI(); renderSelect(); }
    });
    on('sdMain', () => { Save.data.lastPick = def.id; Save.save(); Sfx.play('ui'); renderSelect(); });
    on('sdTry', () => { U.sel.mode = 'training'; U.sel.p1 = def.id; U.sel.p2 = 'kaze'; confirmSelect(); });
    on('sdGo', () => { Sfx.play('fight'); confirmSelect(); });
    const segs = (id, f) => { const e = $(id); if (e) e.querySelectorAll('button').forEach(b => { b.onclick = () => { Sfx.play('ui'); f(b.dataset.v); renderSelect(); }; }); };
    segs('optDiff', v => { Save.data.arcadeDiff = +v; Save.save(); });
    segs('optPick', v => { s.picking = +v; s.view = +v ? s.p2 : s.p1; });
    segs('optP2', v => { s.p2human = v === '1'; });
    segs('optLv', v => { s.cpuLv = +v; });
    segs('optStage', v => { s.stage = v; });
    segs('optDummy', v => { s.p2 = v; });
  }

  function confirmSelect() {
    const s = U.sel;
    if (!Save.owned(s.p1)) return;
    Save.data.lastPick = s.p1; Save.save();
    if (s.mode === 'arcade') startArcade(s.p1);
    else if (s.mode === 'versus') startVersus();
    else if (s.mode === 'survival') startSurvival(s.p1);
    else if (s.mode === 'training') startTraining(s.p1, s.p2);
  }

  /* ------------------------------------------------------------ fights */
  function beginFight(cfg) {
    closeSheet();
    transition(() => {
      U.fightOn = true;
      show(null);
      Input.setTwoPlayer(!!cfg.twoP);
      document.body.classList.toggle('vs2', !!cfg.twoP);
      Input.clearAll();
      Input.enable(true);
      Game.paused = false;
      Game.speed = U.testSpeed || 1;
      Game.startMatch(cfg);
      buildHud(cfg);
      $('hud').classList.remove('hidden');
      checkRotate();
    });
  }

  function cpu(lv) { return new CpuCtrl(lv); }
  function human(side) { return new HumanCtrl(side); }

  function stageFor(def, i) { return i === 5 ? 'crater' : def.stage || pick(STAGE_IDS); }

  function startArcade(id) {
    const dset = DIFFS[Save.data.arcadeDiff];
    const pool = ROSTER.filter(f => f.id !== id && !f.boss).map(f => f.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = randi(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const ladder = pool.slice(0, 5).map((oid, i) => ({ id: oid, lv: dset.lv[i], stage: BY_ID[oid].stage }));
    const bossId = id === 'saibo' ? pool[5] || 'kaze' : 'saibo';
    ladder.push({ id: bossId, lv: dset.lv[5], stage: 'crater', boss: true });
    U.run = { mode: 'arcade', p1: id, ladder, idx: 0, coins: 0, conts: 0, diff: Save.data.arcadeDiff };
    arcadeFight();
  }

  function arcadeFight() {
    const r = U.run, step = r.ladder[r.idx];
    versusSheet(r.p1, step.id, step.boss ? 'FINAL BOSS' : `FIGHT ${r.idx + 1} / ${r.ladder.length}`, () => {
      beginFight({ p1: r.p1, p2: step.id, ctrls: [human(0), cpu(step.lv)], stage: step.stage, mode: 'arcade', toWin: 2,
        hpMul: [1, step.boss ? 1.15 : 1], chip: `ARCADE · ${step.boss ? 'FINAL BOSS' : 'FIGHT ' + (r.idx + 1) + '/6'} · CPU LV ${step.lv}`,
        onEnd: res => setTimeout(() => arcadeEnd(res), 900) });
    }, r);
  }

  function rewardFor(res, base) {
    const st = res.stats, parts = [];
    let total = 0;
    const add = (label, n) => { if (n > 0) { parts.push([label, n]); total += n; } };
    if (res.winner === 0) {
      add('WIN', base);
      add('FINISHERS', st.finishers * 20);
      add('PERFECTS', st.perfects * 25);
      add('BLACK SPARK', st.bf * 10);
      if (Save.dailyReady()) { add('FIRST WIN TODAY', 100); Save.data.daily = Save.today(); }
    } else {
      add('ROUNDS WON', st.roundsWon * 10);
    }
    add('MAX COMBO', st.maxCombo >= 8 ? 15 : 0);
    return { total: Math.round(total), parts };
  }

  function recordMatch(res, id) {
    const d = Save.data;
    d.matches++;
    if (res.winner === 0) { d.totalWins++; d.wins[id] = (d.wins[id] || 0) + 1; }
    d.finishers += res.stats.finishers; d.blackFlashes += res.stats.bf;
    Save.save();
  }

  function statTiles(st) {
    return `<div class="stat-tiles"><div><b>${st.maxCombo}</b><small>MAX COMBO</small></div><div><b>${fmt(st.dmg)}</b><small>DAMAGE</small></div><div><b>${st.finishers}</b><small>FINISHERS</small></div></div>`;
  }
  function payoutHtml(rw) {
    if (!rw.total) return '';
    return `<div class="payout">${ic('coins', 'coin')}+${fmt(rw.total)}<small>COINS</small></div><div class="coins-row">${rw.parts.map(([l, n]) => `<span>${ic('coins')}${l} +${n}</span>`).join('')}</div>`;
  }

  function arcadeEnd(res) {
    const r = U.run;
    if (!r) return;
    const step = r.ladder[r.idx];
    recordMatch(res, r.p1);
    const mul = DIFFS[r.diff].mul;
    const rw = rewardFor(res, Math.round((40 + r.idx * 15) * mul));
    Save.addCoins(rw.total); r.coins += rw.total;
    if (res.winner === 0) {
      r.idx++;
      if (r.idx >= r.ladder.length) return arcadeClear(res, rw);
      const next = BY_ID[r.ladder[r.idx].id];
      const sh = openSheet(`<h2 class="win">YOU WIN</h2><p class="sub">${BY_ID[r.p1].name} DEFEATS ${BY_ID[step.id].name} · ${res.wins[0]}-${res.wins[1]}</p>
        ${ladderHtml(r)}${statTiles(res.stats)}${payoutHtml(rw)}
        <div class="actions"><button class="btn primary" id="rNext"><b>NEXT: ${next.name}</b></button><button class="btn" id="rQuit"><b>QUIT RUN</b></button></div>`, 'result');
      $('rNext').onclick = () => { Sfx.play('ui'); arcadeFight(); };
      $('rQuit').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
      Sfx.play('coin');
    } else {
      let n = 10;
      const sh = openSheet(`<h2 class="lose">CONTINUE?</h2><p class="sub">${BY_ID[step.id].name} WINS · ${res.wins[1]}-${res.wins[0]}</p>
        <div class="big-count" id="contN">${n}</div>${ladderHtml(r)}${payoutHtml(rw)}
        <div class="actions"><button class="btn primary" id="rCont"><b>CONTINUE</b><small>RETRY THIS FIGHT</small></button><button class="btn" id="rGive"><b>GIVE UP</b></button></div>`, 'result');
      const give = () => { clearInterval(U.countTimer); arcadeOver(); };
      U.countTimer = setInterval(() => { n--; const e = $('contN'); if (e) { e.textContent = n; Sfx.play('ui'); } if (n <= 0) give(); }, 1000);
      $('rCont').onclick = () => { clearInterval(U.countTimer); r.conts++; Sfx.play('ui'); arcadeFight(); };
      $('rGive').onclick = () => { Sfx.play('uiBack'); give(); };
    }
  }

  function ladderHtml(r) {
    return `<div class="ladder">${r.ladder.map((s, i) => pt(BY_ID[s.id], i < r.idx ? 'done' : i === r.idx ? 'now' : '')).join('')}</div>`;
  }

  function arcadeOver() {
    const r = U.run;
    openSheet(`<h2 class="lose">GAME OVER</h2><p class="sub">${BY_ID[r.p1].name} REACHED FIGHT ${r.idx + 1} OF 6</p>${ladderHtml(r)}
      <div class="payout">${ic('coins', 'coin')}${fmt(r.coins)}<small>COINS THIS RUN</small></div>
      <div class="actions"><button class="btn primary" id="rAgain"><b>TRY AGAIN</b></button><button class="btn" id="rMenu"><b>MENU</b></button></div>`, 'result');
    $('rAgain').onclick = () => { Sfx.play('ui'); startArcade(r.p1); };
    $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
  }

  function arcadeClear(res, rw) {
    const r = U.run, d = Save.data;
    const first = d.clears[r.p1] == null;
    const bonus = Math.round((first ? 500 : 250) * DIFFS[r.diff].mul) + (r.conts === 0 ? 150 : 0);
    Save.addCoins(bonus); r.coins += bonus;
    d.clears[r.p1] = Math.max(d.clears[r.p1] != null ? d.clears[r.p1] : -1, r.diff);
    let unlockMsg = '';
    if (!Save.owned('saibo')) { Save.unlock('saibo'); unlockMsg = `<div class="unlock" style="--c:${BY_ID.saibo.color}">${pt(BY_ID.saibo)}<div><small>NEW FIGHTER UNLOCKED</small><b>SAIBO</b><p>The Caped Baldy joins your roster.</p></div></div>`; }
    Save.save();
    openSheet(`<h2 class="win">ARCADE CLEAR!</h2><p class="sub">${BY_ID[r.p1].name} · ${DIFFS[r.diff].name}${r.conts ? ` · ${r.conts} CONTINUE${r.conts > 1 ? 'S' : ''}` : ' · NO CONTINUES'}</p>
      <div class="big-stars">${ic('trophy', 'on')}</div>${unlockMsg}${statTiles(res.stats)}
      <div class="coins-row"><span>${ic('coins')}CLEAR BONUS +${bonus}</span>${rw.total ? `<span>${ic('coins')}LAST FIGHT +${rw.total}</span>` : ''}</div>
      <div class="payout">${ic('coins', 'coin')}${fmt(r.coins)}<small>COINS THIS RUN</small></div>
      <div class="actions"><button class="btn primary" id="rMenu"><b>MENU</b></button><button class="btn" id="rAgain"><b>PLAY AGAIN</b></button></div>`, 'result');
    Sfx.play('unlock'); Sfx.music('win');
    $('rAgain').onclick = () => { Sfx.play('ui'); startArcade(r.p1); };
    $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
  }

  function startVersus() {
    const s = U.sel;
    const stage = s.stage === 'random' ? pick(STAGE_IDS) : s.stage;
    U.run = { mode: 'versus', p1: s.p1, p2: s.p2, p2human: s.p2human, lv: s.cpuLv, stage };
    const go = () => beginFight({ p1: s.p1, p2: s.p2, ctrls: [human(0), s.p2human ? human(1) : cpu(s.cpuLv)], stage, mode: 'versus', toWin: 2, twoP: s.p2human,
      chip: s.p2human ? 'VERSUS · PLAYER 1 vs PLAYER 2' : `VERSUS · CPU LV ${s.cpuLv}`, onEnd: res => setTimeout(() => versusEnd(res), 900) });
    versusSheet(s.p1, s.p2, s.p2human ? 'PLAYER 1 vs PLAYER 2' : `CPU LEVEL ${s.cpuLv}`, go);
  }

  function versusEnd(res) {
    const r = U.run;
    let rw = { total: 0, parts: [] };
    if (!r.p2human) { recordMatch(res, r.p1); rw = rewardFor(res, 20 + r.lv * 6); Save.addCoins(rw.total); }
    const title = r.p2human ? (res.winner === 0 ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS') : res.winner === 0 ? 'YOU WIN' : 'YOU LOSE';
    const w = res.winner === 0 ? r.p1 : r.p2, l = res.winner === 0 ? r.p2 : r.p1;
    openSheet(`<h2 class="${res.winner === 0 || r.p2human ? 'win' : 'lose'}">${title}</h2><p class="sub">${BY_ID[w].name} DEFEATS ${BY_ID[l].name} · ${Math.max(...res.wins)}-${Math.min(...res.wins)}</p>
      ${statTiles(res.stats)}${payoutHtml(rw)}
      <div class="actions"><button class="btn primary" id="rRe"><b>REMATCH</b></button><button class="btn" id="rSel"><b>CHANGE FIGHTERS</b></button><button class="btn" id="rMenu"><b>MENU</b></button></div>`, 'result');
    $('rRe').onclick = () => { Sfx.play('ui'); U.sel = Object.assign(U.sel || {}, { p1: r.p1, p2: r.p2, p2human: r.p2human, cpuLv: r.lv, stage: 'random' }); startVersus(); };
    $('rSel').onclick = () => { Sfx.play('ui'); closeSheet(); endFight(); openSelect('versus'); };
    $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
  }

  function startSurvival(id) {
    U.run = { mode: 'survival', p1: id, streak: 0, hp: 1, coins: 0, meter: 0 };
    survivalFight();
  }
  function survivalFight() {
    const r = U.run;
    const pool = ROSTER.filter(f => f.id !== r.p1).map(f => f.id);
    const oid = r.streak > 0 && r.streak % 5 === 4 ? (r.p1 === 'saibo' ? pick(pool) : 'saibo') : pick(pool.filter(x => x !== 'saibo'));
    const lv = Math.min(9, 2 + Math.floor(r.streak / 2));
    r.cur = { id: oid, lv };
    versusSheet(r.p1, oid, `STREAK ${r.streak} · CPU LV ${lv}`, () => beginFight({ p1: r.p1, p2: oid, ctrls: [human(0), cpu(lv)], stage: pick(STAGE_IDS), mode: 'survival', toWin: 1,
      hpStart: [r.hp, 1], meter0: r.meter, chip: `SURVIVAL · STREAK ${r.streak} · CPU LV ${lv}`, onEnd: res => setTimeout(() => survivalEnd(res), 700) }), null, 1.6);
  }
  function survivalEnd(res) {
    const r = U.run;
    if (res.winner === 0) {
      r.streak++;
      r.hp = Math.min(1, res.hp[0] + 0.35);
      r.meter = Game.fighters[0] ? Game.fighters[0].meter : 0;
      const c = 20 + Math.min(40, r.streak * 4) + res.stats.finishers * 15;
      Save.addCoins(c); r.coins += c;
      if (Save.dailyReady()) { Save.data.daily = Save.today(); Save.addCoins(100); r.coins += 100; toast('FIRST WIN TODAY +100 COINS'); }
      recordMatch(res, r.p1);
      toast(`STREAK ${r.streak} · +${c} COINS · HEALTH RESTORED`);
      Sfx.play('coin');
      survivalFight();
    } else {
      const best = r.streak > Save.data.survivalBest;
      if (best) { Save.data.survivalBest = r.streak; Save.save(); }
      openSheet(`<h2 class="lose">KNOCKED OUT</h2><p class="sub">${BY_ID[r.p1].name} · SURVIVAL</p>
        <div class="big-count">${r.streak}</div><p class="sub">${best ? 'NEW BEST STREAK!' : 'BEST ' + Save.data.survivalBest}</p>
        <div class="payout">${ic('coins', 'coin')}${fmt(r.coins)}<small>COINS THIS RUN</small></div>
        <div class="actions"><button class="btn primary" id="rAgain"><b>AGAIN</b></button><button class="btn" id="rMenu"><b>MENU</b></button></div>`, 'result');
      $('rAgain').onclick = () => { Sfx.play('ui'); startSurvival(r.p1); };
      $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
    }
  }

  function startTraining(id, dummy) {
    U.run = { mode: 'training', p1: id, dummy: dummy || 'kaze', dmode: 'stand', meter: true };
    beginFight(trainingCfg());
  }
  function trainingCfg() {
    const r = U.run;
    return { p1: r.p1, p2: r.dummy, ctrls: [human(0), new DummyCtrl(r.dmode)], stage: 'lab', mode: 'training', toWin: 99, training: true, trainingMeter: r.meter,
      chip: 'TRAINING · P PAUSE FOR OPTIONS · J K U I L', onEnd: () => {} };
  }

  function versusSheet(a, b, label, go, run, dur = 2.4) {
    const A = BY_ID[a], B = BY_ID[b];
    const side = (def, cls, who) => `<div class="vs-side ${cls}" style="--c:${def.color}"><small>${who}</small>${pt(def, 'vs-pt')}<b>${def.name}</b><span>${def.title}</span></div>`;
    const sh = openSheet(`<div class="vs">${side(A, 'you', 'PLAYER 1')}<div class="vs-mid"><b>VS</b><small>${esc(label)}</small></div>${side(B, 'rival', U.sel && U.sel.p2human && U.run && U.run.mode === 'versus' ? 'PLAYER 2' : 'CPU')}</div>
      ${run && run.ladder ? ladderHtml(run) : ''}<p class="hint">${('ontouchstart' in window) ? 'TAP' : 'CLICK'} TO START</p>`, 'versus');
    let started = false;
    const start = () => { if (started) return; started = true; clearTimeout(U.vsT); go(); };
    // attach after this event finishes, so the click that opened the sheet doesn't also skip it
    setTimeout(() => { if (!started && $('sheet') === sh) { sh.onclick = start; U.sheetDismiss = start; } }, 0);
    clearTimeout(U.vsT);
    U.vsT = setTimeout(start, dur * 1000);
  }

  function endFight() {
    U.fightOn = false;
    Input.enable(false);
    Input.setTwoPlayer(false);
    document.body.classList.remove('vs2');
    Game.paused = false;
    $('hud').classList.add('hidden');
  }
  function quitToMenu() {
    closeSheet();
    U.run = null;
    transition(() => { endFight(); show('home'); startDemo(); });
  }

  /* --------------------------------------------------------------- HUD */
  function buildHud(cfg) {
    for (let i = 0; i < 2; i++) {
      const def = BY_ID[i ? cfg.p2 : cfg.p1];
      const el = $('hs' + i);
      el.style.setProperty('--c', def.color);
      el.querySelector('.pt').style.setProperty('--c', def.color);
      el.querySelector('img').src = Portraits.url(def);
      el.querySelector('.nm b').textContent = def.name;
      el.querySelector('.nm small').textContent = cfg.training && i === 1 ? 'DUMMY' : def.title;
      const tw = cfg.training ? 0 : cfg.toWin || 2;
      el.querySelector('.wins').innerHTML = Array.from({ length: tw }, () => '<i></i>').join('');
      $('sm' + i).style.setProperty('--c', def.color);
    }
    $('hudChip').textContent = cfg.chip || '';
    $('hudChip').classList.toggle('hidden', !cfg.chip);
    clearTimeout(U.chipT); U.chipT = setTimeout(() => $('hudChip').classList.add('hidden'), 4000);
    const def = BY_ID[cfg.p1], m = def.moves;
    const sk = (k, mv) => `<div class="skill" data-k="${k}" style="--c:${def.color};--d:${shade(def.color)}"><span class="sk-icon move-ic">${Icons.svg(mv.icon || 'fist')}</span><b class="sk-name">${esc(mv.name)}</b><kbd>${KEYS[k]}</kbd><span class="sk-cd"></span></div>`;
    $('skillbar').innerHTML = sk('sp1', m.sp1) + sk('sp2', m.sp2) + sk('super', m.super);
    const orb = (cls, k, icon, lbl, c) => `<button class="orb ${cls}" data-k="${k}" style="--c:${c || def.color};--d:${shade(c || def.color)}"><span class="ring"></span><span class="orb-icon">${Icons.svg(icon)}</span><span class="lbl">${lbl}</span></button>`;
    $('orbs').innerHTML = orb('orb-l', 'l', 'fist', 'LIGHT', '#ffc933') + orb('orb-h', 'h', 'burst', 'HEAVY', '#ff8a4a') + orb('orb-s1', 's1', m.sp1.icon, 'SPECIAL') + orb('orb-s2', 's2', m.sp2.icon, 'SPECIAL') + orb('orb-sup', 'sup', m.super.icon, 'SUPER') + orb('orb-j', 'jump', 'up', 'JUMP', '#e9ecf4');
    $('orbs').querySelectorAll('.orb').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); Sfx.ensure(); document.body.classList.add('touch'); b.classList.add('down'); Input.touchPress(b.dataset.k); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    U.hudCache = {};
  }

  U.tick = function () {
    if (!U.fightOn || !Game.running || Game.fighters.length < 2) return;
    const H = U.hudCache || (U.hudCache = {});
    for (let i = 0; i < 2; i++) {
      const f = Game.fighters[i], el = $('hs' + i);
      const hp = clamp(f.hp / f.maxHp, 0, 1), lag = clamp((Game.hpShown ? Game.hpShown[i] : f.hp) / f.maxHp, 0, 1);
      const key = `${hp.toFixed(3)}|${lag.toFixed(3)}|${Math.round(f.guard)}|${Math.round(f.meter)}|${Game.wins[i]}`;
      if (H['h' + i] !== key) {
        H['h' + i] = key;
        el.querySelector('.fill').style.transform = `scaleX(${hp})`;
        el.querySelector('.lag').style.transform = `scaleX(${lag})`;
        el.querySelector('.hp').classList.toggle('low', hp < 0.25);
        el.querySelector('.gd i').style.transform = `scaleX(${clamp(f.guard / 100, 0, 1)})`;
        el.querySelector('.gd').classList.toggle('low', f.guard < 35);
        el.querySelectorAll('.wins i').forEach((p, k) => p.classList.toggle('on', k < Game.wins[i]));
        const sm = $('sm' + i);
        sm.querySelector('i').style.transform = `scaleX(${clamp(f.meter / 100, 0, 1)})`;
        const full = f.meter >= 100;
        if (sm.classList.contains('full') !== full) { sm.classList.toggle('full', full); sm.querySelector('b').textContent = full ? 'READY!' : 'SUPER'; if (full && i === 0) Sfx.play('ui'); }
      }
      const c = Game.combo[i];
      const cp = $('combo' + i);
      const n = c && c.n >= 2 ? c.n : 0;
      if (n) {
        if (H['c' + i] !== n) { H['c' + i] = n; cp.querySelector('b').textContent = n; cp.classList.remove('hidden', 'pop'); void cp.offsetWidth; cp.classList.add('pop'); }
        H['ct' + i] = performance.now();
      } else if (H['c' + i] && performance.now() - (H['ct' + i] || 0) > 900) { H['c' + i] = 0; cp.classList.add('hidden'); }
    }
    const tm = Game.timer === Infinity ? '∞' : String(Math.ceil(Game.timer));
    const tk = tm + '|' + Game.round;
    if (H.t !== tk) { H.t = tk; $('timer').querySelector('b').textContent = tm; $('timer').querySelector('small').textContent = Game.cfg && Game.cfg.training ? 'TRAINING' : 'ROUND ' + Game.round; $('timer').classList.toggle('hurry', Game.timer < 10); }
    // skills (player 1)
    const f = Game.fighters[0];
    document.querySelectorAll('#skillbar .skill, #orbs .orb').forEach(el => {
      const k = el.dataset.k;
      let p = 0, txt = '';
      if (k === 'sp1' || k === 's1' || k === 'sp2' || k === 's2') {
        const key = k.length === 2 ? 'sp' + k[1] : k;
        const cd = f.def.moves[key].cd || 2;
        p = clamp(f.cds[key] / cd, 0, 1);
        txt = f.cds[key] > 0 ? Math.ceil(f.cds[key]) : '';
      } else if (k === 'super' || k === 'sup') {
        p = 1 - clamp(f.meter / 100, 0, 1);
        el.classList.toggle('ready', f.meter >= 100);
        txt = f.meter >= 100 ? '' : Math.floor(f.meter) + '%';
      } else return;
      const cooling = p > 0;
      if (el.classList.contains('cooling') && !cooling) { el.classList.remove('ready-flash'); void el.offsetWidth; el.classList.add('ready-flash'); }
      el.classList.toggle('cooling', cooling);
      el.style.setProperty('--p', p.toFixed(3));
      const cdn = el.querySelector('.sk-cd');
      if (cdn && cdn.textContent !== String(txt)) cdn.textContent = txt;
    });
  };

  /* -------------------------------------------------------------- pause */
  U.openPause = function () {
    if (!U.fightOn || U.modalOpen() || Game.state === 'over') return;
    Game.paused = true;
    Input.enable(false);
    Sfx.play('ui');
    const r = U.run || {};
    const training = r.mode === 'training';
    const sh = openSheet(`<h2>PAUSED</h2><p class="sub">${esc(($('hudChip').textContent || '').split(' · ').slice(0, 2).join(' · '))}</p>
      ${training ? `<div class="sd-opts"><div class="row"><small>DUMMY</small><nav class="seg" id="pDummy">${[['stand', 'STAND'], ['guard', 'GUARD'], ['jump', 'JUMP'], ['cpu', 'CPU']].map(([v, l]) => `<button data-v="${v}" class="${r.dmode === v ? 'active' : ''}">${l}</button>`).join('')}</nav></div>
      <div class="row"><small>METER</small><nav class="seg" id="pMeter"><button data-v="1" class="${r.meter ? 'active' : ''}">INFINITE</button><button data-v="0" class="${!r.meter ? 'active' : ''}">NORMAL</button></nav></div></div>` : ''}
      <div class="pause-stack">
        <button class="btn primary" id="pRes"><b>RESUME</b></button>
        <button class="btn" id="pMoves"><b>MOVE LIST</b></button>
        ${r.mode === 'arcade' || r.mode === 'survival' ? '' : `<button class="btn" id="pRestart"><b>RESTART</b></button>`}
        <button class="btn" id="pSet"><b>SETTINGS</b></button>
        <button class="btn danger" id="pQuit"><b>${r.mode === 'arcade' || r.mode === 'survival' ? 'QUIT RUN' : 'QUIT'}</b></button>
      </div>`, 'pause');
    U.sheetDismiss = () => U.resume();
    $('pRes').onclick = () => U.resume();
    $('pMoves').onclick = () => openMoves(BY_ID[Game.cfg.p1], () => U.openPauseAgain());
    $('pSet').onclick = () => openSettings(() => U.openPauseAgain());
    $('pQuit').onclick = () => { Game.paused = false; quitToMenu(); };
    const rs = $('pRestart');
    if (rs) rs.onclick = () => { Game.paused = false; if (training) beginFight(trainingCfg()); else if (r.mode === 'versus') startVersus(); };
    if (training) {
      sh.querySelectorAll('#pDummy button').forEach(b => { b.onclick = () => { r.dmode = b.dataset.v; Game.ctrls[1] = new DummyCtrl(r.dmode); Game.ctrls[1].reset(Game.fighters[1]); U.openPauseAgain(); }; });
      sh.querySelectorAll('#pMeter button').forEach(b => { b.onclick = () => { r.meter = b.dataset.v === '1'; Game.cfg.trainingMeter = r.meter; U.openPauseAgain(); }; });
    }
  };
  U.openPauseAgain = function () { closeSheet(); Game.paused = false; U.openPause(); };
  U.resume = function () {
    U.sheetDismiss = null;
    closeSheet();
    Game.paused = false;
    Input.clearAll();
    if (U.fightOn) Input.enable(true);
  };
  U.padStart = function () { if (U.fightOn) { if (U.modalOpen() && Game.paused) U.resume(); else U.openPause(); } };

  function openMoves(def, back) {
    const m = def.moves;
    openSheet(`<h2 style="color:${def.color}">${def.name} · MOVES</h2>
      <div class="sd-moves">
        ${['l1', 'l2', 'hEnd'].map((k, i) => `<div class="mv"><span class="move-ic" style="--c:#ffc933;--d:#8a6a10">${Icons.svg(i < 2 ? 'fist' : 'up')}</span><div><b>${esc(m[k].name)}</b><small>${i === 0 ? 'LIGHT' : i === 1 ? 'LIGHT, LIGHT' : 'LIGHT, LIGHT, HEAVY: LAUNCHER'}</small></div><span class="keys2">${['<kbd>J</kbd>', '<kbd>J</kbd><kbd>J</kbd>', '<kbd>J</kbd><kbd>J</kbd><kbd>K</kbd>'][i]}</span></div>`).join('')}
        <div class="mv"><span class="move-ic" style="--c:#ff8a4a;--d:#7a3a1a">${Icons.svg('burst')}</span><div><b>${esc(m.h.name)}</b><small>HEAVY · CAN BLACK SPARK</small></div><span class="keys2"><kbd>K</kbd></span></div>
        <div class="mv"><span class="move-ic" style="--c:#8fd6ff;--d:#2a5a7a">${Icons.svg('swords')}</span><div><b>Throw</b><small>CLOSE · BEATS GUARD</small></div><span class="keys2"><kbd>J</kbd>+<kbd>K</kbd> or <kbd>O</kbd></span></div>
        ${moveRows(def)}
      </div>
      <p class="hint">Cancel any light or heavy that connects into a special, and any of them into the super.</p>
      <div class="actions"><button class="btn primary" id="mBack"><b>BACK</b></button></div>`, 'wide');
    $('mBack').onclick = () => { Sfx.play('uiBack'); if (back) back(); else closeSheet(); };
    U.sheetDismiss = () => { if (back) back(); else closeSheet(); };
  }

  /* ----------------------------------------------------------- settings */
  function openSettings(back) {
    const st = Save.data.settings;
    const tg = (k, label) => `<button class="toggle ${st[k] ? 'on' : ''}" data-k="${k}"><span>${label}</span><span class="sw"></span></button>`;
    const sh = openSheet(`<h2>SETTINGS</h2>
      <div class="toggles">${tg('sfx', 'SOUND')}${tg('music', 'MUSIC')}${tg('shake', 'SCREEN SHAKE')}${tg('flashes', 'IMPACT FRAMES')}</div>
      <p class="hint">Impact frames are the black, white and red flash frames on big hits. Turn them off to reduce flashing.</p>
      <div class="actions"><button class="btn primary" id="sBack"><b>DONE</b></button></div>
      <button class="link-btn" id="sReset">Reset all progress</button>`);
    sh.querySelectorAll('.toggle').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k; st[k] = !st[k]; Save.save();
        b.classList.toggle('on', st[k]);
        if (k === 'sfx') Sfx.setSfx(st[k]);
        if (k === 'music') Sfx.setMusic(st[k]);
        Sfx.play('ui');
      };
    });
    const done = () => { Sfx.play('uiBack'); if (back) back(); else closeSheet(); };
    $('sBack').onclick = done;
    U.sheetDismiss = done;
    $('sReset').onclick = () => {
      const s2 = openSheet(`<h2 class="lose">RESET PROGRESS?</h2><p class="tip">Coins, unlocked fighters, Arcade clears and records will be erased. Settings are kept.</p>
        <div class="actions"><button class="btn danger" id="rYes"><b>ERASE</b></button><button class="btn" id="rNo"><b>CANCEL</b></button></div>`);
      $('rYes').onclick = () => { Save.reset(); toast('PROGRESS RESET'); closeSheet(); if (U.screen === 'home') renderHome(); coinsUI(); };
      $('rNo').onclick = () => openSettings(back);
    };
  }

  function openHow(first) {
    openSheet(`<h2>${first ? 'WELCOME TO RAG SHOWDOWN' : 'HOW TO PLAY'}</h2>
      <div class="keys two">
        <span class="hd">ACTION</span><span class="hd">KEYBOARD</span><span class="hd">GAMEPAD</span>
        <span>Move · dash</span><span><kbd>A</kbd><kbd>D</kbd> · tap twice</span><span>Stick / D-pad</span>
        <span>Jump</span><span><kbd>W</kbd> / <kbd>SPACE</kbd></span><span>A</span>
        <span>Guard</span><span>Hold away</span><span>Hold away</span>
        <span>Light · Heavy</span><span><kbd>J</kbd> · <kbd>K</kbd></span><span>X · Y</span>
        <span>Specials</span><span><kbd>U</kbd> · <kbd>I</kbd></span><span>B · RB</span>
        <span>Super (full meter)</span><span><kbd>L</kbd></span><span>RT</span>
        <span>Throw</span><span><kbd>J</kbd>+<kbd>K</kbd> / <kbd>O</kbd></span><span>LB</span>
        <span>Pause</span><span><kbd>P</kbd></span><span>START</span>
      </div>
      <div class="how">
        <div><h4>COMBOS</h4><p><b>Light, light, heavy</b> chains into a launcher. Any light or heavy that connects can be cancelled into a <b>special</b>, and anything into your <b>super</b>.</p></div>
        <div><h4>SUPERS &amp; FINISHERS</h4><p>Deal and take damage to fill the meter. A super that lands the knockout plays a <b>FINISHER</b> with impact frames and slow motion.</p></div>
        <div><h4>BLACK SPARK</h4><p>Heavy hits have a small chance to strike with a <b>Black Spark</b>: double damage and a burst of meter. Longer combos raise the odds.</p></div>
        <div><h4>DEFENCE</h4><p>Hold away to <b>guard</b>. Guarding drains the guard gauge under your health; when it empties, your guard breaks. <b>Throws</b> beat guard.</p></div>
      </div>
      <p class="hint">Two players: P2 uses the arrow keys with <kbd>,</kbd> <kbd>.</kbd> <kbd>;</kbd> <kbd>'</kbd> <kbd>/</kbd> (or Numpad 1 2 4 5 3), or a second gamepad. On touch screens, use the stick and the buttons.</p>
      <div class="actions"><button class="btn primary" id="hOk"><b>${first ? "LET'S FIGHT" : 'GOT IT'}</b></button></div>`, 'wide');
    $('hOk').onclick = () => { Sfx.play('ui'); closeSheet(); };
    U.sheetDismiss = closeSheet;
  }

  /* -------------------------------------------------------------- touch */
  function setupTouch() {
    const joy = $('joy'), knob = $('joyKnob'), base = joy.querySelector('.joy-base');
    let id = null, ox = 0, oy = 0, jumped = false;
    const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
    joy.addEventListener('pointerdown', e => {
      e.preventDefault(); Sfx.ensure(); document.body.classList.add('touch');
      id = e.pointerId; joy.setPointerCapture(id);
      const r = joy.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top; jumped = false;
      joy.classList.add('on'); place(base, ox, oy); place(knob, ox, oy);
    });
    joy.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const m = Math.hypot(dx, dy), max = 50;
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      place(knob, ox + dx, oy + dy);
      Input.setTouchX(Math.abs(dx) > 16 ? Math.sign(dx) : 0);
      if (dy < -34 && !jumped) { jumped = true; Input.touchPress('jump'); }
      if (dy > -14) jumped = false;
    });
    const end = e => { if (e.pointerId !== id) return; id = null; joy.classList.remove('on'); base.style.left = base.style.top = knob.style.left = knob.style.top = ''; Input.setTouchX(0); };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  }

  function checkRotate() {
    const portrait = window.innerHeight > window.innerWidth && document.body.classList.contains('touch');
    $('rotate').classList.toggle('hidden', !(portrait && U.fightOn && !U.rotateOk));
  }
  U.checkRotate = checkRotate;

  // exposed for tests
  U._start = { arcade: startArcade, versus: () => startVersus(), survival: startSurvival, training: startTraining, select: openSelect };
  return U;
})();

/* training dummy behaviours */
class DummyCtrl {
  constructor(mode) { this.mode = mode; this.human = false; if (mode === 'cpu') this.cpu = new CpuCtrl(4); }
  reset(f) { this.t = 0; if (this.cpu) this.cpu.reset(f); }
  update(G, f, dt) {
    if (this.cpu) return this.cpu.update(G, f, dt);
    const o = G.opp(f);
    f.input.x = 0;
    if (this.mode === 'guard') f.input.x = -(Math.sign(o.root.x - f.root.x) || f.facing);
    if (this.mode === 'jump') { this.t -= dt; if (this.t <= 0 && f.root.grounded) { this.t = 1.2; G.press(f.side, 'jump'); } }
  }
}
