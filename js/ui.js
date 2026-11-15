'use strict';
/* =========================================================================
   UI: home (with a CPU demo fight behind it), the level map and campaign
   (PLAY drops you straight into your next level; a new player boots
   straight into level 1-1 with a guide that teaches as you fight, and tips
   pop up later the first time they matter), fighter select / roster shop,
   Versus (CPU or two players), Survival, Training, result sheets, pause,
   settings, the fight HUD and the touch pad. Built on Element Rag's UI.
   ========================================================================= */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const U = { screen: 'home', run: null, sel: null, fightOn: false };
  const STAGE_IDS = ['dojo', 'city', 'temple', 'forest', 'snow', 'void', 'crater', 'arena'];
  const KEYS = { sp1: 'Q', sp2: 'E', super: 'F' };
  const MOUSE = side => `<svg class="mouse-ic ${side}" viewBox="0 0 26 36" aria-hidden="true"><rect x="2" y="2" width="22" height="32" rx="11" fill="none" stroke="currentColor" stroke-width="2.4"/><path class="btnL" d="M13 2.6V15H2.6v-2A10.4 10.4 0 0 1 13 2.6z"/><path class="btnR" d="M13 2.6V15h10.4v-2A10.4 10.4 0 0 0 13 2.6z"/><path d="M13 3v12M2.5 15h21" stroke="currentColor" stroke-width="2"/></svg>`;
  const isTouch = () => document.body.classList.contains('touch');

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
    for (const id of ['home', 'select', 'levels']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', name !== null || !U.fightOn);
    document.body.classList.toggle('playing', name === null);
    if (name === 'home') renderHome();
    coinsUI();
    checkRotate();
  }

  function transition(mid, fast) {
    const bars = $('bars');
    bars.className = 'in' + (fast ? ' fast' : '');
    clearTimeout(U.trT1); clearTimeout(U.trT2);
    U.trT1 = setTimeout(() => {
      try { mid(); } catch (e) { console.error(e); }
      bars.className = 'out' + (fast ? ' fast' : '');
      U.trT2 = setTimeout(() => { bars.className = ''; }, fast ? 700 : 1400);
    }, fast ? 560 : 1280);
  }

  /* --------------------------------------------------------------- init */
  U.init = function () {
    hydrate();
    $('btnPlay').onclick = () => { Sfx.play('fight'); playLevel(Campaign.next()); };
    $('btnLevels').onclick = () => { Sfx.play('ui'); openLevels(); };
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
    // wrap hits so the guide and tips can react to what happens in the fight
    const rawHit = Game.hit;
    Game.hit = function (att, def, spec, x, y, act) { const r = rawHit.apply(this, arguments); if (r) onFightHit(att, def, spec, r); return r; };
    if (!Save.data.tutorialDone && !U.noAutoStart) {
      // a brand-new player goes straight into the first level; the guide teaches as they fight
      playLevel(Campaign.levels[0], true);
    } else {
      show('home');
      startDemo();
    }
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
    const nx = Campaign.next();
    $('playSub').textContent = `LEVEL ${nx.label} · ${CHAPTERS[nx.c].name}`;
    $('homeStars').textContent = Campaign.stars();
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
    $('selTitle').textContent = { versus: 'VERSUS', survival: 'SURVIVAL · CHOOSE YOUR FIGHTER', training: 'TRAINING · CHOOSE YOUR FIGHTER', roster: 'FIGHTERS' }[mode];
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
    return row('sp1', m.sp1, '<kbd>Q</kbd>', `SPECIAL · ${m.sp1.cd || 2}S COOLDOWN`) +
      row('sp2', m.sp2, '<kbd>E</kbd>', `SPECIAL · ${m.sp2.cd || 2}S COOLDOWN`) +
      row('super', m.super, '<kbd>F</kbd>', 'SUPER · FULL METER · FINISHER', 'super');
  }

  function renderDetail() {
    const s = U.sel, def = BY_ID[s.view];
    const own = Save.owned(def.id);
    const st = def.stats;
    const meter = (n) => `<span class="meter">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    let foot = '';
    if (!own) {
      const can = Save.data.coins >= def.price;
      const rec = Campaign.levels.find(L => L.recruit === def.id);
      foot = `<div class="lock-note">${ic('lock')}${rec ? `Beat ${def.name} in LEVEL ${rec.label} to recruit them, or unlock now for ${fmt(def.price)} coins.` : `Unlock for ${fmt(def.price)} coins. Win fights to earn coins.`}</div>
        <div class="sd-foot"><button class="btn primary" id="sdBuy" ${can ? '' : 'disabled'}><b>UNLOCK · ${fmt(def.price)}</b></button></div>`;
    } else if (s.mode === 'roster') {
      foot = `<div class="sd-foot"><button class="btn primary" id="sdMain" ${Save.data.lastPick === def.id ? 'disabled' : ''}><b>${Save.data.lastPick === def.id ? 'YOUR FIGHTER' : 'SET AS YOUR FIGHTER'}</b></button><button class="btn" id="sdTry"><b>TRY IN TRAINING</b></button></div>`;
    } else {
      let opts = '';
      if (s.mode === 'versus') {
        opts = `<div class="sd-opts">
          <div class="row"><small>PICKING</small><nav class="seg" id="optPick"><button data-v="0" class="${s.picking === 0 ? 'active' : ''}">P1 · ${BY_ID[s.p1].name}</button><button data-v="1" class="${s.picking === 1 ? 'active' : ''}">${s.p2human ? 'P2' : 'CPU'} · ${BY_ID[s.p2].name}</button></nav></div>
          <div class="row"><small>PLAYER 2</small><nav class="seg" id="optP2"><button data-v="0" class="${!s.p2human ? 'active' : ''}">CPU</button><button data-v="1" class="${s.p2human ? 'active' : ''}">HUMAN (SAME KEYBOARD / PAD)</button></nav></div>
          ${s.p2human ? '' : `<div class="row"><small>CPU LEVEL</small><nav class="seg" id="optLv">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button data-v="${n}" class="${s.cpuLv === n ? 'active' : ''}">${n}</button>`).join('')}</nav></div>`}
          <div class="row"><small>STAGE</small><nav class="seg" id="optStage"><button data-v="random" class="${s.stage === 'random' ? 'active' : ''}">RANDOM</button>${STAGE_IDS.map(id => `<button data-v="${id}" class="${s.stage === id ? 'active' : ''}">${STAGES[id].name.split(' ')[0]}</button>`).join('')}</nav></div></div>`;
      } else if (s.mode === 'training') {
        opts = `<div class="sd-opts"><div class="row"><small>DUMMY</small><nav class="seg" id="optDummy">${['kaze', 'ryo', 'homura', 'mugi'].map(id => `<button data-v="${id}" class="${s.p2 === id ? 'active' : ''}">${BY_ID[id].name}</button>`).join('')}</nav></div></div>`;
      }
      const label = { versus: 'FIGHT!', survival: 'START SURVIVAL', training: 'ENTER TRAINING' }[s.mode];
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
    if (s.mode === 'versus') startVersus();
    else if (s.mode === 'survival') startSurvival(s.p1);
    else if (s.mode === 'training') startTraining(s.p1, s.p2);
  }

  /* ------------------------------------------------------------ fights */
  function beginFight(cfg, instant, fast) {
    closeSheet();
    if (U.tut) { U.tut = null; $('tut').classList.add('hidden'); }
    $('coach').classList.add('hidden');
    const go = instant ? f => f() : fast ? f => transition(f, true) : transition;
    go(() => {
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
      renderWaveDots();
      $('hud').classList.remove('hidden');
      checkRotate();
    });
  }

  function cpu(lv) { return new CpuCtrl(lv); }
  function human(side) { return new HumanCtrl(side); }

  function stageFor(def, i) { return i === 5 ? 'crater' : def.stage || pick(STAGE_IDS); }

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

  /* ----------------------------------------------------------- levels */
  function openLevels(c) {
    if (c == null) c = Campaign.next().c;
    U.chapter = c;
    show('levels');
    renderLevels();
  }
  function renderLevels() {
    const c = U.chapter, ch = CHAPTERS[c];
    $('levelStars').textContent = `${Campaign.stars()}/${Campaign.levels.length * 3}`;
    $('chapterTabs').innerHTML = CHAPTERS.map((C, i) => {
      const open = Campaign.unlocked(i * 6);
      return `<button data-c="${i}" class="${i === c ? 'active' : ''} ${open ? '' : 'locked'}" style="--c:${STAGE_COL[C.stage]}">${i + 1}${open ? '' : ' ' + ic('lock')}</button>`;
    }).join('');
    $('chapterTabs').querySelectorAll('button').forEach(b => { b.onclick = () => { Sfx.play('ui'); U.chapter = +b.dataset.c; renderLevels(); }; });
    const lv = Campaign.levels.filter(L => L.c === c);
    const got = lv.reduce((a, L) => a + Campaign.cleared(L.i), 0);
    $('chapterHead').innerHTML = `<h3>${c + 1}. ${ch.name}</h3><span class="tag">${ic('star', 'star')} ${got}/18</span><p>${CHAPTERS[c].recruit[2] || CHAPTERS[c].recruit[5] ? 'Beat the fighters marked RECRUIT to add them to your roster.' : 'Six fights. The last one is a best-of-three boss.'}</p>`;
    const me = Save.data.lastPick;
    $('levelGrid').innerHTML = lv.map(L => {
      const open = Campaign.unlocked(L.i), stars = Campaign.cleared(L.i);
      const foe = BY_ID[Campaign.foeFor(L, me)];
      const cur = open && !stars && L.i === Campaign.next().i;
      const tw = TWISTS[L.twist];
      return `<button class="stage-card ${open ? '' : 'locked'} ${cur ? 'current' : ''} ${L.boss ? 'boss' : ''}" data-i="${L.i}" style="--c:${foe.color}">
        ${L.recruit && !Save.owned(L.recruit) ? '<span class="rec">RECRUIT</span>' : ''}
        <span class="n">${L.label}</span>${pt(foe)}
        <span class="stars">${[0, 1, 2].map(k => ic('star', k < stars ? 'on' : '')).join('')}</span>
        <small>${L.boss ? 'BOSS · ' : ''}${foe.name}</small>
        ${L.twist !== 'classic' ? `<span class="tw">${ic(tw.icon)}${tw.name}</span>` : L.tutorial ? '<span class="tw">TUTORIAL</span>' : ''}
      </button>`;
    }).join('');
    $('levelGrid').querySelectorAll('.stage-card').forEach(b => {
      b.onclick = () => {
        const L = Campaign.levels[+b.dataset.i];
        if (!Campaign.unlocked(L.i)) { toast('CLEAR THE LEVEL BEFORE IT FIRST'); Sfx.play('uiBack'); return; }
        Sfx.play('fight'); playLevel(L);
      };
    });
    const nx = Campaign.next();
    $('levelFoot').innerHTML = `<button class="btn primary" id="lvPlay"><b>PLAY ${nx.label}</b></button>`;
    $('lvPlay').onclick = () => { Sfx.play('fight'); playLevel(nx); };
    hydrate($('levels'));
  }
  const STAGE_COL = { dojo: '#ff9b5a', temple: '#ff9fbf', forest: '#7fcf7a', city: '#c94aff', snow: '#9fc4ee', void: '#8a6bff', crater: '#ff5a2a', arena: '#ffc933' };

  // straight into the fight: no select, no versus screen
  function playLevel(L, instant) {
    const me = Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze';
    const foe = Campaign.foeFor(L, me);
    const tw = L.twist;
    const tut = L.tutorial && !Save.data.tutorialDone;
    const waves = L.waves.map((id, k) => (k === L.waves.length - 1 ? foe : id === me && !L.recruit ? Campaign.foeFor({ ...L, foe: id }, me) : id));
    const hpMul = [1, tut ? 1 : L.waveHp];
    const cfg = { p1: me, p2: waves[0], waves, waveHp: L.waveHp, fastIntro: true, waveCtrl: k => cpu(Math.max(1, L.lv - (k < waves.length - 1 ? 1 : 0))), onWave: k => onWave(k), ctrls: [human(0), tut ? new DummyCtrl('stand') : cpu(Math.max(1, L.lv - (waves.length > 1 ? 1 : 0)))], stage: L.stage, mode: 'level', toWin: L.toWin,
      chip: `LEVEL ${L.label} · ${CHAPTERS[L.c].name}${tw !== 'classic' ? ' · ' + TWISTS[tw].name : ''}`, roundSub: `LEVEL ${L.label}${tw !== 'classic' ? ' · ' + TWISTS[tw].name : ''}`,
      tutorial: tut, hpMul, onEnd: res => setTimeout(() => levelEnd(L, res), 900) };
    if (tw === 'giant') { cfg.scale = [1, 1.25]; hpMul[1] *= 1.25; cfg.waveHp *= 1.25; }
    if (tw === 'lowgrav') cfg.grav = 0.6;
    if (tw === 'supers') { cfg.meter0 = 100; cfg.meter1 = 100; }
    if (tw === 'tough') { hpMul[1] *= 1.5; cfg.waveHp *= 1.5; }
    if (tw === 'frenzy') cfg.speedMul = 1.2;
    if (tw === 'glass') cfg.dmgMul = 2;
    if (tw === 'clock') { cfg.timeLimit = 40; cfg.loseOnTime = true; }
    if (L.boss && !tut) { cfg.introPan = true; cfg.bossIntro = true; cfg.fastIntro = false; }
    U.run = { mode: 'level', L };
    beginFight(cfg, instant, U.fastNext);
    U.fastNext = false;
    U.levelIntro = { L, foe, t: 0, tut };
  }

  function levelEnd(L, res) {
    const d = Save.data;
    const foe = BY_ID[Game.cfg.p2];
    recordMatch(res, Game.cfg.p1);
    if (L.tutorial) { d.tutorialDone = true; Save.save(); }
    if (res.winner === 0) {
      const stars = Campaign.starsFor(res.hp[0]);
      const prev = Campaign.cleared(L.i);
      let coins = 0;
      const parts = [];
      if (!prev) { coins += 40 + L.c * 10 + (L.boss ? 60 : 0); parts.push(['FIRST CLEAR', 40 + L.c * 10 + (L.boss ? 60 : 0)]); }
      if (stars > prev) { coins += (stars - prev) * 15; parts.push(['NEW STARS', (stars - prev) * 15]); d.levels[L.i] = stars; }
      if (res.stats.finishers) { coins += res.stats.finishers * 20; parts.push(['FINISHERS', res.stats.finishers * 20]); }
      if (res.stats.bf) { coins += res.stats.bf * 10; parts.push(['BLACK SPARK', res.stats.bf * 10]); }
      if (Save.dailyReady()) { coins += 100; parts.push(['FIRST WIN TODAY', 100]); d.daily = Save.today(); }
      Save.addCoins(coins);
      let rec = '';
      if (L.recruit && !Save.owned(L.recruit)) {
        Save.unlock(L.recruit);
        const R = BY_ID[L.recruit];
        rec = `<div class="unlock" style="--c:${R.color}">${pt(R)}<div><small>NEW FIGHTER RECRUITED</small><b>${R.name}</b><p>${esc(R.title)} joins your roster. Pick them in Fighters.</p></div></div>`;
        Sfx.play('unlock');
      }
      Save.save();
      const next = Campaign.levels[L.i + 1];
      const chDone = Campaign.chapterDone(L.c) && L.l === 5;
      openSheet(`<h2 class="win">${chDone ? 'CHAPTER CLEAR!' : 'LEVEL CLEAR!'}</h2><p class="sub">LEVEL ${L.label} · ${BY_ID[Game.cfg.p1].name} DEFEATS ${foe.name}</p>
        <div class="big-stars">${[0, 1, 2].map(k => ic('star', k < stars ? 'on' : '')).join('')}</div>
        <p class="hint">${stars < 3 ? 'Win with more health left to earn more stars.' : 'Flawless. Three stars.'}</p>
        ${rec}${statTiles(res.stats)}${payoutHtml({ total: coins, parts })}
        <div class="actions"><button class="btn" id="rMenu"><b>MENU</b></button><button class="btn" id="rRetry"><b>RETRY</b></button>${next ? `<button class="btn primary" id="rNext"><b>NEXT LEVEL</b></button>` : ''}</div>`, 'result');
      if (next) $('rNext').onclick = () => { Sfx.play('fight'); U.fastNext = true; playLevel(next); };
      if (stars < 3) Sfx.play('coin'); else Sfx.play('perfect');
    } else {
      const tips = [
        'Hold away from your opponent to guard.',
        'Click, click, right-click is a launcher. Follow it with a special.',
        'Specials cancel out of a hit that connects: click, then Q.',
        'Guarding opponent? Click both mouse buttons together to throw.',
        'Save your super for when a hit connects; it cancels out of anything.',
        'Tap A or D twice to dash in or out.',
      ];
      openSheet(`<h2 class="lose">DEFEATED</h2><p class="sub">LEVEL ${L.label} · ${foe.name} WINS</p>
        <p class="tip">${esc(pick(tips))}</p>${statTiles(res.stats)}
        <div class="actions"><button class="btn" id="rMenu"><b>MENU</b></button><button class="btn" id="rLevels"><b>LEVELS</b></button><button class="btn primary" id="rRetry"><b>RETRY</b></button></div>`, 'result');
      $('rLevels').onclick = () => { Sfx.play('ui'); closeSheet(); endFight(); openLevels(L.c); startDemo(); };
    }
    $('rRetry').onclick = () => { Sfx.play('fight'); U.fastNext = true; playLevel(L); };
    $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
  }

  /* ------------------------------------------------- the guided first fight */
  const cap = k => `<span class="cap${k.length > 2 ? ' wide' : ''}">${k}</span>`;
  // the key that points away from the opponent: that's how you guard
  const awayKey = () => { const f = Game.fighters[0], o = Game.fighters[1]; return (o && f && o.root.x >= f.root.x) ? 'A' : 'D'; };
  const awayArrow = () => (awayKey() === 'A' ? '◀' : '▶');
  const TUT = [
    { label: 'MOVE', hint: 'Walk left and right.', key: () => cap('A') + cap('D'), touch: 'MOVE', thint: 'Slide the stick left or right.', focus: '.joy', done: t => t.moved },
    { label: 'JUMP', hint: 'Hop over attacks and projectiles.', key: () => cap('W'), touch: 'JUMP', thint: 'Flick the stick up, or tap JUMP.', focus: '.orb-j', done: t => t.jumped },
    { label: 'LIGHT ATTACK', hint: 'Left click. Quick, and hard to punish.', key: () => MOUSE('l'), touch: 'LIGHT ATTACK', thint: 'Tap LIGHT.', focus: '.orb-l', done: t => t.light >= 1 },
    { label: 'HEAVY ATTACK', hint: 'Right click. Slower, but hits harder.', key: () => MOUSE('r'), touch: 'HEAVY ATTACK', thint: 'Tap HEAVY.', focus: '.orb-h', done: t => t.heavy >= 1 },
    { label: 'COMBO', hint: 'Left, left, right. It ends in your fighter\'s own finisher.', key: () => MOUSE('l') + MOUSE('l') + MOUSE('r'), touch: 'COMBO', thint: 'LIGHT, LIGHT, then HEAVY.', focus: '.orb-l, .orb-h', done: t => t.ender >= 1 },
    { label: 'SPECIAL MOVE', hint: 'Q or E. Each one recharges after use.', key: () => cap('Q') + '<span class="plus">/</span>' + cap('E'), touch: 'SPECIAL MOVE', thint: 'Tap one of the SPECIAL buttons.', focus: '.orb-s1, .orb-s2', done: t => t.special >= 1 },
    { label: 'GUARD', hint: 'They\'re attacking! Hold the key pointing away from them to block.', key: () => cap(awayKey()), dynamic: () => awayKey(), touch: 'GUARD', thint: 'Hold the stick away from them to block.', tkey: () => cap(awayArrow()), focus: '.joy', done: t => t.blocked >= 1 || t.guardHeld > 1.2, start: () => { Game.ctrls[1] = new TutAttacker(); } },
    { label: 'SUPER', hint: 'Your super meter is full. Press F to unleash it.', key: () => cap('F'), touch: 'SUPER', thint: 'Your meter is full. Tap SUPER.', focus: '.orb-sup', done: t => t.superUsed, start: () => { Game.ctrls[1] = new DummyCtrl('stand'); Game.fighters[0].meter = 100; } },
  ];
  function startTut() {
    $('hudChip').classList.add('hidden');
    U.tut = { i: 0, moved: false, jumped: false, light: 0, heavy: 0, ender: 0, special: 0, blocked: 0, guardHeld: 0, superUsed: false, wait: 0, lastAct: null };
    $('tutDots').innerHTML = TUT.map(() => '<i></i>').join('');
    $('tut').classList.remove('hidden', 'done', 'ok');
    $('tutSkip').onclick = () => { Sfx.play('ui'); endTut(); };
    renderTut();
  }
  function renderTut() {
    const step = TUT[Math.min(U.tut.i, TUT.length - 1)];
    const touch = isTouch();
    showTutKey(touch ? (step.tkey ? step.tkey() : `<span class="tut-btn">${Icons.svg('play')}</span>`) : step.key());
    U.tut.dynKey = step.dynamic ? step.dynamic() : null;
    $('tutText').textContent = touch ? step.touch : step.label;
    $('tutHint').textContent = touch ? step.thint : step.hint;
    $('tutCount').textContent = '';
    $('tutDots').querySelectorAll('i').forEach((d, i) => { d.className = i < U.tut.i ? 'on' : i === U.tut.i ? 'cur' : ''; });
    document.querySelectorAll('.tut-focus').forEach(el => el.classList.remove('tut-focus'));
    if (touch && step.focus) document.querySelectorAll(step.focus).forEach(el => el.classList.add('tut-focus'));
    if (step.start) step.start();
  }
  // the key picture fades in each time it changes
  function showTutKey(html) { $('tutVis').innerHTML = `<span class="tv-in">${html}</span>`; }
  function tutTick(dt) {
    const t = U.tut;
    if (!t || !Game.cfg || !Game.cfg.tutorial || Game.state !== 'fight') return;
    const f = Game.fighters[0];
    // lenient: any press counts, and attacks count whether or not they land
    if (f.input.x !== 0 || f.dashT > 0) t.moved = true;
    if (!f.root.grounded) t.jumped = true;
    if (f.action && f.action !== t.lastAct) {
      t.lastAct = f.action;
      const k = f.action.key;
      if (k === 'l1' || k === 'l2' || k === 'airL') t.light++;
      if (k === 'h' || k === 'airH' || k === 'hEnd') t.heavy++;
      if (k === 'hEnd') t.ender++;
      if ((k === 'sp1' || k === 'sp2') && t.i >= 5) t.special++;
      if (k === 'super' && t.i >= 7) t.superUsed = true;
    }
    if (t.i === 6) { const o = Game.fighters[1]; if (f.input.x === -(Math.sign(o.root.x - f.root.x) || f.facing)) t.guardHeld += dt; }
    if (t.wait > 0) { t.wait -= dt; if (t.wait <= 0) { $('tut').classList.remove('ok'); renderTut(); } return; }
    const step = TUT[t.i];
    if (!step) return;
    // the guard key follows the opponent: if they cross over, the key flips
    if (step.dynamic) { const k = step.dynamic(); if (k !== t.dynKey) { t.dynKey = k; showTutKey(isTouch() ? step.tkey() : step.key()); } }
    if (step.count) $('tutCount').textContent = step.count(t);
    if (step.done(t)) {
      t.i++; Sfx.play('coin');
      $('tut').classList.add('ok');
      if (t.i >= TUT.length) {
        $('tut').classList.add('done');
        showTutKey(`<span class="tut-btn go">${Icons.svg('check')}</span>`);
        $('tutText').textContent = 'READY! NOW WIN THE FIGHT';
        $('tutHint').textContent = 'Everything you just learned, for real this time.';
        $('tutCount').textContent = '';
        setTimeout(endTut, 1500);
        return;
      }
      t.wait = 0.6;
    }
  }
  function endTut() {
    if (!U.tut) return;
    U.tut = null;
    $('tut').classList.add('hidden');
    document.querySelectorAll('.tut-focus').forEach(el => el.classList.remove('tut-focus'));
    if (Game.cfg && Game.cfg.tutorial) {
      Game.ctrls[1] = cpu(1); Game.ctrls[1].reset(Game.fighters[1]);
      Game.endTutorial();
    }
  }
  function onFightHit(att, def, spec, r) {
    if (!U.fightOn) return;
    const t = U.tut;
    if (t && def.side === 0 && r === 'block') t.blocked++;
    // tips the first time something matters
    if (att.side === 0 && r === 'hit' && att.action && att.action.key === 'hEnd' && def.mode === 'tumble') tip('air', isTouch() ? '<b>LAUNCHED!</b> Tap JUMP right away to chase them and keep the combo going.' : '<b>LAUNCHED!</b> Press <kbd>W</kbd> right away to jump after them, then click, click, right-click in the air.');
    if (att.side === 0 && r === 'hit' && def.lastHit && def.lastHit.bf) tip('bf', '<b>BLACK SPARK!</b> Heavy hits can crit for double damage.');
    if (att.side === 0 && r === 'block') { U.blocks = (U.blocks || []).filter(x => performance.now() - x < 4000); U.blocks.push(performance.now()); if (U.blocks.length >= 3) tip('throw', isTouch() ? 'They keep guarding. <b>Throws</b> beat guard: get close and tap LIGHT + HEAVY.' : 'They keep guarding. <b>Throw</b> them: click <b>both mouse buttons</b> together up close.'); }
  }

  /* ------------------------------------------------------------ tips */
  function coach(html, dur = 4.5) {
    const c = $('coach');
    $('coachText').innerHTML = html;
    c.classList.remove('hidden', 'show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(U.coachT); U.coachT = setTimeout(() => c.classList.add('hidden'), dur * 1000);
  }
  function tip(id, html) {
    if (Save.data.tips[id] || U.tut) return;
    Save.data.tips[id] = 1; Save.save();
    coach(html, 5);
  }
  function tipsTick() {
    if (!U.fightOn || Game.state !== 'fight' || (Game.cfg && (Game.cfg.tutorial || Game.cfg.training)) || U.tut) return;
    const f = Game.fighters[0];
    const touch = isTouch();
    if (f.meter >= 100) tip('super', touch ? '<b>SUPER READY!</b> Tap the glowing SUPER button.' : '<b>SUPER READY!</b> Press <kbd>F</kbd>. Land it as the knockout for a FINISHER.');
    if (f.guard < 40) tip('guard', 'Your <b>guard gauge</b> is cracking. Stop blocking: attack, jump or dash out!');
    if (f.mode === 'tumble') tip('down', "Knocked down! You're safe on the ground, but they can hit you again <b>as soon as you're up</b>. Guard or jump away.");
    if (Game.combo[0] && Game.combo[0].n >= 2 && Save.data.tips.dash) tip('cancel', touch ? 'Combo tip: LIGHT, LIGHT, then a <b>SPECIAL</b> cancels straight into it.' : 'Combo tip: click, click, then <b>Q or E</b>. Specials cancel out of hits that connect.');
    if (Game.stateT > 3 && !Save.data.tips.dash && U.run && U.run.mode === 'level' && U.run.L.i >= 1) tip('dash', touch ? 'Flick the stick twice to <b>DASH</b>.' : 'Tap <kbd>A</kbd> or <kbd>D</kbd> twice to <b>DASH</b>.');
  }
  function onWave(k) {
    const f = Game.fighters[1], el = $('hs1');
    el.style.setProperty('--c', f.def.color);
    el.querySelector('.pt').style.setProperty('--c', f.def.color);
    el.querySelector('img').src = Portraits.url(f.def);
    el.querySelector('.nm b').textContent = f.def.name;
    el.querySelector('.nm small').textContent = f.def.title;
    $('sm1').style.setProperty('--c', f.def.color);
    U.hudCache = {};
    renderWaveDots();
  }
  function renderWaveDots() {
    const w = Game.cfg && Game.cfg.waves;
    const el = $('waveDots');
    if (!w || w.length < 2) { el.innerHTML = ''; return; }
    el.innerHTML = w.map((_, i) => `<i class="${i < Game.wave ? 'done' : i === Game.wave ? 'now' : ''}"></i>`).join('');
  }
  function levelIntroTick() {
    const li = U.levelIntro;
    if (!li || !U.fightOn || Game.state !== 'fight') return;
    U.levelIntro = null;
    const L = li.L, tw = TWISTS[L.twist];
    if (li.tut) { startTut(); return; }
    const bits = [];
    if (L.twist !== 'classic') bits.push(`<b>${tw.name}:</b> ${tw.desc}`);
    if (L.recruit && !Save.owned(L.recruit)) bits.push(`Beat <b>${BY_ID[L.recruit].name}</b> to recruit them!`);
    if (L.boss) bits.push('<b>BOSS:</b> best of three rounds.');
    if (bits.length) coach(bits.join('<br>'), 4);
  }
  function startVersus() {
    const s = U.sel;
    const stage = s.stage === 'random' ? pick(STAGE_IDS) : s.stage;
    U.run = { mode: 'versus', p1: s.p1, p2: s.p2, p2human: s.p2human, lv: s.cpuLv, stage };
    const go = () => beginFight({ p1: s.p1, p2: s.p2, ctrls: [human(0), s.p2human ? human(1) : cpu(s.cpuLv)], stage, mode: 'versus', toWin: 2, twoP: s.p2human, introPan: true,
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
      hpStart: [r.hp, 1], meter0: r.meter, introPan: r.streak === 0, fastIntro: r.streak > 0, chip: `SURVIVAL · STREAK ${r.streak} · CPU LV ${lv}`, onEnd: res => setTimeout(() => survivalEnd(res), 700) }), null, 1.6);
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
      chip: 'TRAINING · PRESS P FOR DUMMY OPTIONS', onEnd: () => {} };
  }

  function versusSheet(a, b, label, go, run, dur = 2.4) {
    const A = BY_ID[a], B = BY_ID[b];
    const side = (def, cls, who) => `<div class="vs-side ${cls}" style="--c:${def.color}"><small>${who}</small>${pt(def, 'vs-pt')}<b>${def.name}</b><span>${def.title}</span></div>`;
    const sh = openSheet(`<div class="vs">${side(A, 'you', 'PLAYER 1')}<div class="vs-mid"><b>VS</b><small>${esc(label)}</small></div>${side(B, 'rival', U.sel && U.sel.p2human && U.run && U.run.mode === 'versus' ? 'PLAYER 2' : 'CPU')}</div>
      <p class="hint">${('ontouchstart' in window) ? 'TAP' : 'CLICK'} TO START</p>`, 'versus');
    let started = false;
    const start = () => { if (started) return; started = true; clearTimeout(U.vsT); go(); };
    // attach after this event finishes, so the click that opened the sheet doesn't also skip it
    setTimeout(() => { if (!started && $('sheet') === sh) { sh.onclick = start; U.sheetDismiss = start; } }, 0);
    clearTimeout(U.vsT);
    U.vsT = setTimeout(start, dur * 1000);
  }

  function endFight() {
    U.fightOn = false;
    if (U.tut) { U.tut = null; }
    $('tut').classList.add('hidden'); $('coach').classList.add('hidden');
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
    const ms = (side, lbl) => `<div class="skill mouse"><span class="sk-icon">${MOUSE(side)}</span><b>${lbl}</b></div>`;
    $('skillbar').innerHTML = ms('l', 'LIGHT') + ms('r', 'HEAVY') + sk('sp1', m.sp1) + sk('sp2', m.sp2) + sk('super', m.super);
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
    const now = performance.now(), dt = Math.min(0.05, (now - (U.lastTick || now)) / 1000); U.lastTick = now;
    if (!Game.paused && !U.modalOpen()) { levelIntroTick(); tutTick(dt); tipsTick(); }
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
        if (H['c' + i] !== n) { H['c' + i] = n; cp.querySelector('b').textContent = n; cp.querySelector('span').textContent = n >= 16 ? 'SHOWDOWN!' : n >= 12 ? 'AMAZING!' : n >= 8 ? 'GREAT!' : n >= 5 ? 'NICE!' : 'HITS'; cp.classList.remove('hidden', 'pop'); void cp.offsetWidth; cp.classList.add('pop'); }
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
        ${r.mode === 'survival' ? '' : `<button class="btn" id="pRestart"><b>${r.mode === 'level' ? 'RETRY LEVEL' : 'RESTART'}</b></button>`}
        <button class="btn" id="pSet"><b>SETTINGS</b></button>
        <button class="btn danger" id="pQuit"><b>${r.mode === 'survival' ? 'QUIT RUN' : 'QUIT'}</b></button>
      </div>`, 'pause');
    U.sheetDismiss = () => U.resume();
    $('pRes').onclick = () => U.resume();
    $('pMoves').onclick = () => openMoves(BY_ID[Game.cfg.p1], () => U.openPauseAgain());
    $('pSet').onclick = () => openSettings(() => U.openPauseAgain());
    $('pQuit').onclick = () => { Game.paused = false; quitToMenu(); };
    const rs = $('pRestart');
    if (rs) rs.onclick = () => { Game.paused = false; if (training) beginFight(trainingCfg()); else if (r.mode === 'versus') startVersus(); else if (r.mode === 'level') playLevel(r.L); };
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
        ${['l1', 'l2', 'hEnd'].map((k, i) => `<div class="mv"><span class="move-ic" style="--c:#ffc933;--d:#8a6a10">${Icons.svg(i < 2 ? 'fist' : 'up')}</span><div><b>${esc(m[k].name)}</b><small>${i === 0 ? 'LIGHT' : i === 1 ? 'LIGHT, LIGHT' : 'LIGHT, LIGHT, HEAVY: LAUNCHER'}</small></div><span class="keys2">${[MOUSE('l'), MOUSE('l') + MOUSE('l'), MOUSE('l') + MOUSE('l') + MOUSE('r')][i]}</span></div>`).join('')}
        <div class="mv"><span class="move-ic" style="--c:#ff8a4a;--d:#7a3a1a">${Icons.svg('burst')}</span><div><b>${esc(m.h.name)}</b><small>HEAVY · CAN BLACK SPARK</small></div><span class="keys2">${MOUSE('r')}</span></div>
        <div class="mv"><span class="move-ic" style="--c:#8fd6ff;--d:#2a5a7a">${Icons.svg('swords')}</span><div><b>Throw</b><small>CLOSE · BEATS GUARD</small></div><span class="keys2">${MOUSE('l')}+${MOUSE('r')}</span></div>
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
      const s2 = openSheet(`<h2 class="lose">RESET PROGRESS?</h2><p class="tip">Coins, unlocked fighters, level stars and records will be erased. Settings are kept.</p>
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
        <span>Light · Heavy</span><span>Left click · Right click</span><span>X · Y</span>
        <span>Specials</span><span><kbd>Q</kbd> · <kbd>E</kbd></span><span>B · RB</span>
        <span>Super (full meter)</span><span><kbd>F</kbd> / middle click</span><span>RT</span>
        <span>Throw</span><span>Both clicks together</span><span>LB</span>
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
  U._tutStep = () => (U.tut ? U.tut.i : 99);
  U._start = { level: i => playLevel(Campaign.levels[i]), levels: () => openLevels(), versus: () => startVersus(), survival: startSurvival, training: startTraining, select: openSelect };
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

/* the guide's sparring partner: walks in and swings so the player can practise guarding */
class TutAttacker {
  constructor() { this.human = false; this.t = 0.8; }
  reset() { this.t = 0.8; }
  update(G, f, dt) {
    const o = G.opp(f);
    const d = Math.abs(o.root.x - f.root.x), toward = Math.sign(o.root.x - f.root.x) || f.facing;
    f.input.x = d > 170 ? toward : 0;
    this.t -= dt;
    if (this.t <= 0 && d < 200 && !f.action) { this.t = 1.1; G.press(f.side, Math.random() < 0.5 ? 'l' : 'h'); }
  }
}
