'use strict';
/* =========================================================================
   UI: home (with a CPU demo fight behind it), the level map and campaign
   (PLAY drops you straight into your next level; a new player boots
   straight into level 1-1 with a guide that teaches as you fight, and tips
   pop up later the first time they matter), fighter select / roster shop,
   Ascent (a roguelite climb), Survival, Training (with trials), upgrades,
   result sheets, pause,
   settings, the fight HUD and the touch pad. Built on Element Rag's UI.
   ========================================================================= */

const UI = (() => {
  const $ = id => document.getElementById(id);
  const U = { screen: 'home', run: null, sel: null, fightOn: false };
  const STAGE_IDS = ['dojo', 'city', 'temple', 'forest', 'snow', 'void', 'crater', 'arena'];
  const KEYS = { sp1: 'Q', sp2: 'E', super: 'F' };
  const MOUSE = side => `<svg class="mouse-ic ${side}" viewBox="0 0 26 36" aria-hidden="true"><rect x="2" y="2" width="22" height="32" rx="11" fill="none" stroke="currentColor" stroke-width="2.4"/><path class="btnL" d="M13 2.6V15H2.6v-2A10.4 10.4 0 0 1 13 2.6z"/><path class="btnR" d="M13 2.6V15h10.4v-2A10.4 10.4 0 0 0 13 2.6z"/><path d="M13 3v12M2.5 15h21" stroke="currentColor" stroke-width="2"/></svg>`;
  const isTouch = () => document.body.classList.contains('touch');
  // the control for an action, drawn the way this device presses it: mouse
  // buttons and keys on desktop, small copies of the on-screen buttons on touch
  const TB = (icon, c, lbl) => `<span class="tb" style="--c:${c};--d:${shade(c)}" title="${lbl}">${Icons.svg(icon)}</span>`;
  function keyFor(k, def) {
    const m = def ? def.moves : null, c = def ? def.color : '#ffffff';
    if (isTouch()) {
      switch (k) {
        case 'l': return TB('fist', '#ffc933', 'LIGHT');
        case 'h': return TB('burst', '#ff8a4a', 'HEAVY');
        case 'sp1': return TB(m.sp1.icon, c, 'SP 1');
        case 'sp2': return TB(m.sp2.icon, c, 'SP 2');
        case 'super': return TB(m.super.icon, c, 'SUPER');
      }
    }
    switch (k) {
      case 'l': return MOUSE('l');
      case 'h': return MOUSE('r');
      default: return `<kbd>${KEYS[k]}</kbd>`;
    }
  }
  const seqFor = (keys, def) => keys.map(k => keyFor(k, def)).join('');

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
    $('coach').classList.add('hidden');
    // a sheet replaces the fight's banners: drop any WINS / K.O. callout still on screen
    if (typeof Game !== 'undefined' && Game.callouts && /result/.test(cls)) Game.callouts.length = 0;
    // a won fight gets the victory layout: the winner's art on a slash of their
    // colour on the left, the results on the right
    const vic = /result/.test(cls) && /<h2 class="win"/.test(html) && typeof Game !== 'undefined' && Game.cfg && BY_ID[Game.cfg.p1];
    if (vic) {
      const id = Game.cfg.p1, base = BY_ID[id], sk = typeof Skins !== 'undefined' ? Skins.equipped(id) : null, def = sk ? Skins.def(id, sk) : base;
      const perfect = Game.fighters && Game.fighters[0] && Game.fighters[0].hp >= Game.fighters[0].maxHp;
      html = `<div class="vic-art" style="--c:${base.color};--c2:${base.aura || base.color}"><span class="vic-bg"></span><span class="vic-rays"></span><span class="vic-lines"></span>
        <img alt="" src="${fullBody(def, 300, 380)}">
        <div class="vic-id"><small>${perfect ? 'PERFECT VICTORY' : 'VICTORY'}</small><b>${base.name}</b><em>${esc(base.title)}</em></div></div>
        <div class="vic-body">${html}</div>`;
      cls += ' victory';
    }
    sh.className = 'sheet ' + cls;
    sh.onclick = null;
    U.sheetDismiss = null;
    clearInterval(U.countTimer);
    sh.innerHTML = html;
    m.classList.remove('hidden');
    document.body.classList.add('modal-open');
    hydrate(sh);
    Input.enable(false);
    return sh;
  }
  // after a win the next level starts by itself, Element Rag style; touching
  // the panel (or any key but Enter) keeps you on it
  function autoNext(btn, sec) {
    if (U.noAutoNext) return;
    btn.classList.add('auto'); btn.style.setProperty('--auto', sec + 's');
    clearTimeout(U.autoT);
    U.autoT = setTimeout(() => { if (btn.isConnected && U.modalOpen()) btn.click(); }, sec * 1000);
    const stop = e => {
      if (e.type === 'keydown' && (e.code === 'Enter' || e.code === 'Space')) return;
      if (e.target && e.target.closest && e.target.closest('.btn')) return;
      clearTimeout(U.autoT); btn.classList.remove('auto');
      window.removeEventListener('keydown', stop, true); $('sheet').removeEventListener('pointerdown', stop);
    };
    window.addEventListener('keydown', stop, true); $('sheet').addEventListener('pointerdown', stop);
  }
  function closeSheet() {
    clearTimeout(U.autoT);
    $('modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    $('sheet').innerHTML = '';
    clearInterval(U.countTimer);
    if (U.fightOn && !Game.paused) Input.enable(true);
  }
  U.modalOpen = () => !$('modal').classList.contains('hidden');

  // the menu panel covers the left of the screen, so the background fight is
  // framed in the part you can actually see
  function homeShift() {
    const panel = document.querySelector('#home .home-panel');
    if (U.screen !== 'home' || !panel) { Game.viewShift = 0; Game.viewFrac = 1; return; }
    const right = panel.getBoundingClientRect().right, w = window.innerWidth;
    if (right >= w * 0.85) { Game.viewShift = 0; Game.viewFrac = 1; return; }
    Game.viewShift = (right + w) / 2 - w / 2;
    Game.viewFrac = (w - right) / w;
  }
  U.homeShift = homeShift;
  function show(name) {
    U.screen = name;
    for (const id of ['home', 'select', 'levels', 'event']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', name !== null || !U.fightOn);
    document.body.classList.toggle('playing', name === null);
    if (name === 'home') renderHome();
    requestAnimationFrame(homeShift);
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
    $('btnPlay').onclick = () => { Sfx.play('fight'); playLevel(Campaign.next(), true); };   // PLAY cuts straight in, no bars
    // a signed-in CrazyGames player sees their name on the home screen
    Platform.onUser(u => { const el = $('homeUser'); if (!el) return; el.classList.toggle('hidden', !u); el.querySelector('b').textContent = u ? u.name : ''; });
    $('btnLevels').onclick = () => { Sfx.play('ui'); openLevels(); };
    $('btnEvent').onclick = () => { Sfx.play('ui'); openEvent(); };
    // ASCENT starts at once with the fighter you already picked
    $('btnAscent').onclick = () => { Sfx.play('fight'); startAscent(Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze'); };
    $('btnSurvival').onclick = () => { Sfx.play('ui'); openSelect('survival'); };
    $('btnTraining').onclick = () => { Sfx.play('ui'); openSelect('training'); };
    $('btnRoster').onclick = () => { Sfx.play('ui'); openSelect('roster'); };
    $('btnHow').onclick = () => { Sfx.play('ui'); openHow(); };
    $('btnSettings').onclick = () => { Sfx.play('ui'); openSettings(); };
    $('btnPause').onclick = () => U.openPause();
    $('btnRotateOk').onclick = () => { U.rotateOk = true; checkRotate(); };
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => { Sfx.play('uiBack'); const wasPreview = Game.cfg && Game.cfg.preview; show('home'); if (wasPreview) { U.previewId = null; startDemo(); } }; });
    $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && U.sheetDismiss) { const f = U.sheetDismiss; U.sheetDismiss = null; f(); } });
    setupTouch();
    Sfx.setSfx(Save.data.settings.sfx); Sfx.setMusic(Save.data.settings.music);
    // wrap hits so the guide and tips can react to what happens in the fight
    const rawHit = Game.hit;
    Game.hit = function (att, def, spec, x, y, act) { const r = rawHit.apply(this, arguments); if (r) onFightHit(att, def, spec, r, act); return r; };
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
    $('ascSub').textContent = d.ascentBest ? `BEST FLOOR ${d.ascentBest}` : `AS ${(BY_ID[d.lastPick] || ROSTER[0]).name}`;
    const ms0 = Meta.mastery(def.id);
    renderEventCard();
    $('homePick').innerHTML = `${pt(Skins.def(def.id, Skins.equipped(def.id)))}<div class="hp-mid"><small>YOUR FIGHTER</small><b>${def.name}</b><span class="hp-xp"><em style="color:${def.color}">LV ${ms0.lv}</em>${xpBar(ms0, def.color)}</span></div><button class="btn small" id="homeChange"><b>CHANGE</b></button>`;
    $('homeChange').onclick = () => { Sfx.play('ui'); openSelect('roster'); };
    const canBuy = ROSTER.some(f => !Save.owned(f.id) && !f.eventOnly && d.coins >= f.price);
    $('rosterNote').classList.toggle('hidden', !canBuy);
    // daily missions: three goals and their progress, one tap to open
    const ms = Meta.missions(), cl = Meta.claimable(), doneN = ms.list.filter(m => m.n >= m.goal).length;
    $('daily').className = 'daily missions-card' + (cl ? ' ready' : '');
    $('daily').innerHTML = `${ic(cl ? 'gift' : 'scroll')}<span class="mc-t"><b>DAILY MISSIONS</b><small>${cl ? `${cl} REWARD${cl > 1 ? 'S' : ''} TO CLAIM` : `${doneN} / ${ms.list.length} DONE · ${Save.dailyReady() ? 'FIRST WIN TODAY +100' : 'NEW ONES TOMORROW'}`}</small></span><span class="mc-pips">${ms.list.map(m => `<i style="--p:${m.n / m.goal}" class="${m.claimed ? 'claimed' : m.n >= m.goal ? 'done' : ''}"></i>`).join('')}</span>${cl ? `<em>${cl}</em>` : ''}`;
    $('daily').onclick = () => { Sfx.play('ui'); openMissions(); };
    hydrate($('home'));
    coinsUI();
  }

  // a mastery XP bar
  function xpBar(m, col) {
    return `<span class="xpbar" style="--c:${col || 'var(--acc)'}"><i style="width:${m.max ? 100 : Math.round(m.xp / m.need * 100)}%"></i></span>`;
  }
  // time until the missions refresh (midnight UTC, when the date key changes)
  function untilTomorrow() {
    const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const m = Math.max(0, Math.round((next - now) / 60000));
    return `${Math.floor(m / 60)}H ${m % 60}M`;
  }
  function openMissions() {
    const ms = Meta.missions();
    const allClaimed = ms.list.every(m => m.claimed);
    openSheet(`<h2>DAILY MISSIONS</h2><p class="sub">NEW MISSIONS IN ${untilTomorrow()}</p>
      <div class="missions">${ms.list.map((m, i) => {
        const D = Meta.missionDef(m), done = m.n >= m.goal;
        return `<div class="mission ${m.claimed ? 'claimed' : done ? 'done' : ''}"><span class="mi-ic">${ic(D ? D.icon : 'star')}</span>
          <div class="mi-mid"><b>${esc(Meta.missionText(m))}</b><span class="mi-bar"><i style="width:${Math.round(m.n / m.goal * 100)}%"></i></span><small>${m.n} / ${m.goal}</small></div>
          ${m.claimed ? `<span class="mi-ok">${ic('check')}CLAIMED</span>` : `<button class="btn small ${done ? 'primary' : ''}" data-claim="${i}" ${done ? '' : 'disabled'}><b>${ic('coins', 'coin')}${m.pay}</b></button>`}</div>`;
      }).join('')}</div>
      <div class="mission-bonus ${ms.bonus ? 'claimed' : allClaimed ? 'done' : ''}">${ic('gift')}<span><b>DAILY CHEST</b><small>Claim all three missions to open it</small></span>${ms.bonus ? `<span class="mi-ok">${ic('check')}OPENED</span>` : `<button class="btn small ${allClaimed ? 'primary' : ''}" id="mBonus" ${allClaimed ? '' : 'disabled'}><b>${ic('coins', 'coin')}${Meta.MISSION_BONUS}</b></button>`}</div>
      <p class="hint">Missions count in Levels, Ascent and Survival. ${Save.dailyReady() ? 'Your first win today also pays +100 coins.' : 'First-win bonus claimed today.'}</p>
      <div class="actions"><button class="btn primary" id="mClose"><b>DONE</b></button></div>`, 'missions-sheet');
    $('sheet').querySelectorAll('[data-claim]').forEach(b => { b.onclick = () => { const c = Meta.claimMission(+b.dataset.claim); if (c) { Sfx.play('coin'); toast(`+${c} COINS`); coinsUI(); openMissions(); } }; });
    if ($('mBonus')) $('mBonus').onclick = () => { const c = Meta.claimBonus(); if (c) { Sfx.play('perfect'); Platform.happytime(); toast(`DAILY CHEST +${c} COINS`); coinsUI(); openMissions(); } };
    $('mClose').onclick = () => { Sfx.play('uiBack'); closeSheet(); renderHome(); };
  }
  // count a mission event (not in Training) and announce anything it completes
  function mission(ev, amt, ctx) {
    if (!U.run || U.run.mode === 'training' || (Game.cfg && Game.cfg.tutorial)) return;
    for (const m of Meta.track(ev, amt, ctx)) { Sfx.play('unlock'); toast(`MISSION COMPLETE · ${Meta.missionText(m).toUpperCase()}`); }
  }

  /* ------------------------------------------------------------ events
     The weekly event: a card on the home screen, the event screen (hero,
     reward track, challenges, daily check-in, Event Battles, next event),
     reward reveals, and Event Battle results. */
  // a full-body render of a fighter (optionally as a silhouette), cached
  const ART = {};
  function fullBody(def, w = 300, h = 380, mono) {
    const key = (def.skin ? def.id + ':' + def.skin : def.id) + ':' + w + 'x' + h + (mono || '');
    if (ART[key]) return ART[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const r = new Rag(def, { side: 0, x: 0, facing: 1 });
    // a hero pose rather than the crouched fight guard
    r.pose = SHOWCASE[def.look.style || def.look.stance] || SHOWCASE[def.look.stance] || SHOWCASE.karate;
    for (let k = 0; k < 240; k++) { r.update(1 / 120); r.root.x = 0; }
    let top = Infinity, l = Infinity, rt = -Infinity;
    for (const p of r.pts) { top = Math.min(top, p.y); l = Math.min(l, p.x); rt = Math.max(rt, p.x); }
    top -= HEAD_R * r.s * 1.6;
    const k = Math.min((h * 0.94) / (GROUND - top), (w * 0.86) / (rt - l + 80 * r.s / 2));
    g.save(); g.translate(w / 2, h * 0.985); g.scale(k, k); g.translate(-(l + rt) / 2, -GROUND);
    r.draw(g, 1.3, mono || null);
    g.restore();
    return (ART[key] = c.toDataURL());
  }
  const tokIc = E => ic(E.tokenIcon, 'tok');
  function renderEventCard() {
    const E = Events.current(), s = Events.state(), p = Events.pending(), def = BY_ID[E.fighter];
    const el = $('btnEvent'); if (!el) return;
    el.style.cssText = `--ec:${E.col};--ec2:${E.col2};--eink:${E.ink}`;
    el.className = `event-card ol ev-${E.id}`;
    el.innerHTML = `<span class="ec-bg"></span><img class="ec-art" alt="" src="${fullBody(def, 140, 170)}">
      <span class="ec-txt"><small><span class="evLeft">${Events.fmtLeft(Events.left(E.end))}</span> LEFT</small><b>${E.name}</b>
      <span class="ec-bar"><i style="width:${Math.min(100, s.tokens / Events.MAX * 100)}%"></i></span>
      <em>${tokIc(E)}TIER ${Events.tierOf(s.tokens).tier} / ${Events.TIERS}${Save.owned(E.fighter) ? '' : ` · EARN ${def.name}`}</em></span>
      ${p ? `<span class="ec-badge">${p}</span>` : ''}`;
    hydrate(el);
  }
  function openEvent() {
    show('event');
    renderEvent();
    clearInterval(U.evTimer);
    // the countdowns tick while the event screen or home is up
    U.evTimer = setInterval(() => { if (U.screen !== 'event' && U.screen !== 'home') return; document.querySelectorAll('.evLeft').forEach(e => { e.textContent = Events.fmtLeft(Events.left(Events.current().end)); }); }, 15000);
  }
  // where the progress line fills to: tiers sit at even spacing, tokens interpolate between them
  function trackFill(tokens) {
    const T = Events.TRACK, n = T.length, pos = i => (i + 0.5) / n;
    if (tokens <= 0) return 0;
    if (tokens < T[0].at) return pos(0) * tokens / T[0].at;
    for (let i = 0; i < n - 1; i++) if (tokens < T[i + 1].at) return pos(i) + (pos(i + 1) - pos(i)) * (tokens - T[i].at) / (T[i + 1].at - T[i].at);
    return 1;
  }
  function tierArt(R, E) {
    if (R.kind === 'coins') return `<span class="et-coins">${ic('coins', 'coin')}<b>${fmt(R.n)}</b></span>`;
    if (R.kind === 'chest') return `<span class="et-coins et-chest"><span class="et-glow"></span>${ic('gift')}<b>${fmt(R.n)}</b></span>`;
    if (R.kind === 'xp') return `<span class="et-coins et-xp">${ic('ranks')}<b>+${fmt(R.n)}</b><em>XP</em></span>`;
    if (R.kind === 'skin') return `<img alt="" src="${fullBody(Skins.def(R.fighter, R.id), 120, 150)}">`;
    return `<img alt="" src="${fullBody(BY_ID[R.id], 140, 170)}">`;
  }
  function renderEvent() {
    const E = Events.current(), s = Events.state(), N = Events.next(), def = BY_ID[E.fighter];
    $('evTok').innerHTML = `${tokIc(E)}<b>${fmt(s.tokens)}</b>`;
    $('evTitle').textContent = 'EVENTS';
    const TO = Events.tierOf(s.tokens), nReady = Events.reachable();
    const tiers = Events.TRACK.map((T, i) => {
      const R = Events.reward(i), got = s.claimed.includes(i), ready = !got && s.tokens >= T.at, fin = R.kind === 'fighter';
      const big = R.kind === 'skin' || R.kind === 'chest' || fin, cur = !got && !ready && T.tier === TO.tier + 1;
      const lbl = R.kind === 'coins' ? 'COINS' : R.kind === 'chest' ? 'COINS · MILESTONE' : R.kind === 'xp' ? `FOR ${BY_ID[R.fighter].name}` : R.kind === 'skin' ? `SKIN · ${BY_ID[R.fighter].name}` : R.already ? 'ALREADY YOURS · +1,000 COINS' : 'EXCLUSIVE FIGHTER';
      return `<div class="ev-tier ol ${got ? 'got' : ready ? 'ready' : 'locked'} ${fin ? 'final' : ''} ${big ? 'big' : ''} ${cur ? 'cur' : ''} k-${R.kind}" style="--i:${Math.min(i, 12)}" data-tier="${T.tier}">
        <span class="et-at">TIER <b>${T.tier}</b></span>
        <div class="et-art">${tierArt(R, E)}</div>
        <b class="et-name">${R.name}</b><small>${lbl}</small>
        ${got ? `<span class="et-ok">${ic('check')}CLAIMED</span>` : ready ? `<button class="btn small primary" data-claim="${i}"><b>CLAIM</b></button>` : cur ? `<span class="et-need et-cur"><span class="et-cbar"><i style="width:${Math.round(TO.into / Events.PER_TIER * 100)}%"></i></span>${TO.into} / ${Events.PER_TIER}</span>` : `<span class="et-need">${ic('lock')}${fmt(T.at - s.tokens)}</span>`}
      </div>`;
    }).join('');
    const ch = Events.challenges().map(C => `<div class="ev-chal ${C.claimed ? 'claimed' : C.n >= C.goal ? 'done' : ''}"><span class="mi-ic">${ic(C.icon)}</span>
      <div class="mi-mid"><b>${esc(C.text)}</b><span class="mi-bar"><i style="width:${Math.round(C.n / C.goal * 100)}%"></i></span><small>${C.n} / ${C.goal}</small></div>
      ${C.claimed ? `<span class="mi-ok">${ic('check')}DONE</span>` : `<button class="btn small ${C.n >= C.goal ? 'primary' : ''}" data-ch="${C.id}" ${C.n >= C.goal ? '' : 'disabled'}><b>${tokIc(E)}${C.pay}</b></button>`}</div>`).join('');
    const ready = Events.checkinReady(), streak = s.streak || 0;
    const nextStreak = ready ? (s.checkin === new Date(Date.now() + Events._offset - 86400000).toISOString().slice(0, 10) ? streak + 1 : 1) : streak;
    const dots = [1, 2, 3, 4, 5, 6, 7].map(d => `<i class="${d <= (ready ? nextStreak - 1 : streak) ? 'on' : ''} ${ready && d === nextStreak ? 'now' : ''}"><b>+${Events.checkinPay(d)}</b></i>`).join('');
    const nb = Events.battle(Save.data.lastPick);
    const me = BY_ID[Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze'];
    $('evWrap').innerHTML = `
      <div class="ev-hero ol ev-${E.id}" style="--ec:${E.col};--ec2:${E.col2};--eink:${E.ink}">
        <span class="ev-bg"></span><canvas class="ev-scene" aria-hidden="true"></canvas>
        <div class="ev-info">
          <span class="ev-live">ENDS IN <span class="evLeft">${Events.fmtLeft(Events.left(E.end))}</span></span>
          <h3>${E.name}</h3>
          <p>${esc(E.tag)}</p>
          <div class="ev-prog"><span class="ev-tierb"><small>TIER</small><b>${TO.tier}</b><small>/ ${Events.TIERS}</small></span><span class="ev-pcol"><span>${tokIc(E)}${TO.tier >= Events.TIERS ? `<b>PASS COMPLETE</b>` : `<b>${TO.into}</b> / ${Events.PER_TIER} ${E.token} TO TIER ${TO.tier + 1}`}</span><span class="ev-pbar"><i style="width:${TO.tier >= Events.TIERS ? 100 : Math.round(TO.into / Events.PER_TIER * 100)}%"></i></span></span></div>
          <p class="ev-how">Earn ${E.token} from every fight in Levels, Ascent and Survival. Event Battles pay double.</p>
        </div>
        <div class="ev-star">
          <span class="ev-halo"></span>
          <img alt="" src="${fullBody(def, 300, 380)}">
          <div class="ev-plate"><small>${Save.owned(E.fighter) ? 'EXCLUSIVE FIGHTER · UNLOCKED' : 'EXCLUSIVE FIGHTER · TOP REWARD'}</small><b>${def.name}</b><span>${def.title}</span></div>
        </div>
      </div>
      <div class="ev-track ol" style="--ec:${E.col}">
        <div class="ev-head"><b>EVENT PASS</b><small>${Events.TIERS} TIERS · ${Events.PER_TIER} ${E.token} EACH · ${s.claimed.length} / ${Events.TIERS} CLAIMED</small>${nReady > 1 ? `<button class="btn small primary ev-all" id="evAll"><b>${ic('gift')}CLAIM ALL · ${nReady}</b></button>` : ''}</div>
        <div class="ev-tiers-wrap"><div class="ev-tiers"><span class="ev-line"><i style="width:${(trackFill(s.tokens) * 100).toFixed(1)}%"></i></span>${tiers}</div></div>
      </div>
      <div class="ev-bottom" style="--ec:${E.col}">
        <div class="ev-chals ol"><div class="ev-head"><b>CHALLENGES</b><small>BONUS ${E.token}</small></div>${ch}</div>
        <div class="ev-side">
          <button class="btn primary big ev-battle" id="evBattle"><span class="bt"><b>EVENT BATTLE</b><small>${nb.boss ? `CHALLENGER: ${BY_ID[nb.foe].name}` : `${me.name} VS ???`} · 2× ${E.token}</small></span></button>
          <div class="ev-check ol ${ready ? 'ready' : ''}"><div class="ev-head"><b>DAILY CHECK-IN</b><small>${streak ? `STREAK ${ready ? nextStreak - 1 : streak} DAY${streak === 1 ? '' : 'S'}` : 'COME BACK EVERY DAY'}</small></div>
            <div class="ev-dots">${dots}</div>
            ${ready ? `<button class="btn small primary" id="evCheck"><b>${tokIc(E)}CHECK IN · +${Events.checkinPay(nextStreak)}</b></button>` : `<span class="mi-ok">${ic('check')}CHECKED IN · BACK TOMORROW</span>`}</div>
          <div class="ev-next ol" style="--nc:${N.col}"><img alt="" src="${fullBody(BY_ID[N.fighter], 90, 110, '#0b0d14')}"><div><small>NEXT EVENT · IN <span class="evNext">${Events.fmtLeft(Events.left(N.start))}</span></small><b>${N.name}</b><span>A NEW EXCLUSIVE FIGHTER</span></div></div>
        </div>
      </div>`;
    hydrate($('event'));
    const W = $('evWrap');
    EvScene.mount(W.querySelector('.ev-scene'), E.id, W.querySelector('.ev-star img'));
    W.querySelectorAll('[data-claim]').forEach(b => { b.onclick = () => claimTier(+b.dataset.claim); });
    if ($('evAll')) $('evAll').onclick = claimAllTiers;
    W.querySelectorAll('[data-ch]').forEach(b => { b.onclick = () => { const n = Events.claimChallenge(b.dataset.ch); if (n) { Sfx.play('coin'); toast(`+${n} ${E.token}`); renderEvent(); } }; });
    if ($('evCheck')) $('evCheck').onclick = () => { const n = Events.checkIn(); if (n) { Sfx.play('unlock'); toast(`CHECKED IN · +${n} ${E.token}`); renderEvent(); } };
    $('evBattle').onclick = () => { Sfx.play('fight'); startEventBattle(); };
    // keep the next unclaimed tier in view
    const firstOpen = Math.max(0, Events.TRACK.findIndex((T, i) => !s.claimed.includes(i)) - 1);
    const tw = W.querySelector('.ev-tiers-wrap'), tile = W.querySelectorAll('.ev-tier')[firstOpen];
    if (tw && tile && tw.scrollWidth > tw.clientWidth) tw.scrollLeft = Math.max(0, tile.offsetLeft - 24);
    dragScroll(tw);
  }
  /* Drag to scroll (mouse): grab the pass and throw it. The strip follows the
     cursor 1:1, keeps the release velocity and glides to a stop with an
     exponential decay, stretches like a rubber band past either end and
     springs back, and a drag never counts as a click on a tier. The mouse
     wheel scrolls it sideways (and hands back to the page at the ends).
     Touch keeps the browser's own native scrolling. */
  function dragScroll(el) {
    if (!el || el.dataset.drag) return;
    el.dataset.drag = '1';
    const inner = el.firstElementChild;
    let down = false, sx = 0, s0 = 0, lastX = 0, lastT = 0, v = 0, moved = 0, raf = 0, over = 0, pid = null;
    const max = () => Math.max(0, el.scrollWidth - el.clientWidth);
    const band = x => Math.sign(x) * Math.min(90, Math.pow(Math.abs(x), 0.82) * 0.55);   // rubber-band resistance
    const setOver = o => { over = o; inner.style.transform = o ? `translate3d(${-o}px,0,0)` : ''; };
    const edges = () => { const m = max(); el.classList.toggle('at-start', el.scrollLeft <= 1); el.classList.toggle('at-end', el.scrollLeft >= m - 1); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    function glide() {
      stop();
      let prev = performance.now();
      const step = now => {
        const dt = Math.min(40, now - prev); prev = now;
        if (Math.abs(over) > 0.4) {
          // spring back from the stretch
          setOver(over * Math.exp(-dt / 90)); v = 0;
        } else {
          if (over) setOver(0);
          const m = max(), next = el.scrollLeft - v * dt;
          if (next <= 0 || next >= m) {
            // hit an end while moving: a small bounce in the same direction
            el.scrollLeft = next <= 0 ? 0 : m;
            if (Math.abs(v) > 0.25) setOver(band((next <= 0 ? -1 : 1) * Math.min(160, Math.abs(v) * 70)));
            v = 0;
          } else el.scrollLeft = next;
          v *= Math.exp(-dt / 325);
        }
        edges();
        if (Math.abs(v) > 0.015 || Math.abs(over) > 0.4) raf = requestAnimationFrame(step); else { setOver(0); raf = 0; }
      };
      raf = requestAnimationFrame(step);
    }
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      stop(); down = true; moved = 0; pid = e.pointerId;
      sx = lastX = e.clientX; s0 = el.scrollLeft + over; lastT = performance.now(); v = 0;
    });
    el.addEventListener('pointermove', e => {
      if (!down || e.pointerId !== pid) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved < 5) return;
      if (!el.classList.contains('dragging')) { el.classList.add('dragging'); try { el.setPointerCapture(pid); } catch (_) {} }
      const m = max(), want = s0 - dx;
      if (want < 0) { el.scrollLeft = 0; setOver(band(want)); }
      else if (want > m) { el.scrollLeft = m; setOver(band(want - m)); }
      else { el.scrollLeft = want; setOver(0); }
      const now = performance.now(), dt = now - lastT;
      if (dt > 0) { const inst = (e.clientX - lastX) / dt; v = v * 0.55 + inst * 0.45; }
      lastX = e.clientX; lastT = now;
      edges();
    });
    const up = e => {
      if (!down || (e && e.pointerId !== pid)) return;
      down = false;
      el.classList.remove('dragging');
      if (performance.now() - lastT > 90) v = 0;   // held still before letting go: no throw
      v = clamp(v, -4.5, 4.5);
      glide();
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    // a drag is not a click on whatever tier it ended over
    el.addEventListener('click', e => { if (moved >= 5) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
    el.addEventListener('dragstart', e => e.preventDefault());
    // the wheel scrolls the strip sideways, eased; at either end it hands back to the page
    let wheelTo = null;
    el.addEventListener('wheel', e => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const m = max();
      if (!m || (d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= m)) return;
      e.preventDefault(); stop();
      wheelTo = clamp((wheelTo == null || Math.abs(wheelTo - el.scrollLeft) > 600 ? el.scrollLeft : wheelTo) + d * (e.deltaMode === 1 ? 40 : 1.1), 0, m);
      const ease = () => { const diff = wheelTo - el.scrollLeft; if (Math.abs(diff) < 0.6) { el.scrollLeft = wheelTo; wheelTo = null; edges(); return; } el.scrollLeft += diff * 0.22; edges(); raf = requestAnimationFrame(ease); };
      raf = requestAnimationFrame(ease);
    }, { passive: false });
    el.addEventListener('scroll', edges, { passive: true });
    edges();
  }
  // claiming a tier: coins quietly, skins and the fighter with a reveal
  function claimTier(i) {
    const E = Events.current(), R = Events.claim(i);
    if (!R) return;
    coinsUI();
    if (R.kind === 'coins' || R.kind === 'chest' || R.already) { Sfx.play('coin'); toast(`+${fmt(R.n)} COINS`); renderEvent(); return; }
    if (R.kind === 'xp') { Sfx.play('coin'); toast(`+${fmt(R.n)} MASTERY XP · ${BY_ID[R.fighter].name}`); renderEvent(); return; }
    reveal(R);
  }
  // CLAIM ALL: coins and XP add up into one toast, a skin or the fighter still gets its reveal
  function claimAllTiers() {
    const got = Events.claimAll();
    if (!got.length) return;
    coinsUI();
    const coins = got.filter(R => R.kind === 'coins' || R.kind === 'chest' || R.already).reduce((a, R) => a + R.n, 0);
    const xp = got.filter(R => R.kind === 'xp').reduce((a, R) => a + R.n, 0);
    const big = got.filter(R => (R.kind === 'skin' || R.kind === 'fighter') && !R.already);
    toast(`CLAIMED ${got.length} REWARDS${coins ? ` · +${fmt(coins)} COINS` : ''}${xp ? ` · +${fmt(xp)} XP` : ''}`);
    if (big.length) reveal(big[big.length - 1]); else { Sfx.play('coin'); renderEvent(); }
  }
  function reveal(R) {
    const E = Events.current();
    Sfx.play('perfect'); Platform.happytime();
    const def = R.kind === 'skin' ? Skins.def(R.fighter, R.id) : BY_ID[R.id];
    openSheet(`<div class="reveal ev-${E.id}" style="--ec:${E.col};--ec2:${E.col2}">
        <span class="rv-rays"></span>
        <small>${R.kind === 'skin' ? 'NEW SKIN UNLOCKED' : 'EXCLUSIVE FIGHTER UNLOCKED'}</small>
        <img alt="" src="${fullBody(def, 300, 380)}">
        <h2>${R.kind === 'skin' ? R.name : def.name}</h2>
        <p class="sub">${R.kind === 'skin' ? `FOR ${BY_ID[R.fighter].name} · EQUIPPED` : `${def.title} · ${E.name} EXCLUSIVE`}</p>
      </div>
      <div class="actions"><button class="btn" id="rvOk"><b>NICE!</b></button><button class="btn primary" id="rvGo"><b>${R.kind === 'skin' ? 'VIEW IN FIGHTERS' : `TRY ${def.name}`}</b></button></div>`, 'result reveal-sheet');
    $('rvOk').onclick = () => { Sfx.play('ui'); closeSheet(); renderEvent(); };
    $('rvGo').onclick = () => {
      Sfx.play('ui'); closeSheet();
      if (R.kind === 'skin') { openSelect('roster'); U.sel.view = R.fighter; U.sel.tab = 'skins'; U.previewId = null; renderSelect(); }
      else { openSelect('training'); U.sel.p1 = U.sel.view = R.id; confirmSelect(); }
    };
  }
  function startEventBattle() {
    const E = Events.current(), p1 = Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze';
    const B = Events.battle(p1), n = Events.state().battles + 1;
    U.run = { mode: 'event', p1, cur: { id: B.foe, lv: B.lv, boss: B.boss, skin: B.skin, label: B.boss ? 'CHALLENGER' : 'EVENT CPU' } };
    versusSheet(p1, B.foe, `${E.name} · BATTLE ${n}${B.boss ? ' · CHALLENGER' : ''}`, () => beginFight({ p1, p2: B.foe, skins: [Skins.equipped(p1), B.skin], ctrls: [human(0), cpu(B.lv)], stage: B.stage, mode: 'event', toWin: 1,
      fastIntro: true, roundSub: B.boss ? `CHALLENGER: ${BY_ID[B.foe].name}` : E.name, chip: `${E.name} · EVENT BATTLE ${n} · 2× ${E.token}`, onEnd: res => setTimeout(() => eventEnd(res), 700) }, true), null, 1.6);
  }
  function eventEnd(res) {
    const E = Events.current(), r = U.run, won = res.winner === 0;
    recordMatch(res, r.p1);
    const n = Events.fightTokens(res, true), ready = Events.addTokens(n);
    for (const C of Events.battleDone(won)) toast(`EVENT CHALLENGE DONE · ${C.text.toUpperCase()}`);
    const s = Events.state(), nextT = Events.TRACK.findIndex(T => s.tokens < T.at);
    const nextR = nextT >= 0 ? Events.reward(nextT) : null;
    if (won && ready) Platform.happytime();
    openSheet(`<h2 class="${won ? 'win' : 'lose'}">${won ? 'EVENT BATTLE WON' : 'DEFEATED'}</h2><p class="sub">${E.name} · ${BY_ID[r.p1].name} VS ${BY_ID[r.cur.id].name}</p>
      <div class="ev-gain" style="--ec:${E.col}">${tokIc(E)}<b>+${n}</b><small>${E.token} · 2× EVENT BATTLE</small></div>
      <div class="ev-mini" style="--ec:${E.col}"><span class="ev-pbar"><i style="width:${Events.tierOf(s.tokens).tier >= Events.TIERS ? 100 : Math.round(Events.tierOf(s.tokens).into / Events.PER_TIER * 100)}%"></i></span>
        <small>EVENT PASS TIER ${Events.tierOf(s.tokens).tier} / ${Events.TIERS}${nextR ? ` · NEXT: ${nextR.name} AT TIER ${Events.TRACK[nextT].tier}` : ' · PASS COMPLETE'}</small></div>
      ${Events.reachable() ? `<p class="tip ev-ready">${ic('gift')} A REWARD IS READY TO CLAIM</p>` : ''}
      ${statTiles(res.stats)}${xpLine()}
      <div class="actions"><button class="btn" id="rMenu"><b>MENU</b></button><button class="btn" id="rEvent"><b>EVENT</b></button><button class="btn primary" id="rRetry"><b>NEXT BATTLE</b></button></div>`, 'result');
    $('rRetry').onclick = () => { Sfx.play('fight'); startEventBattle(); };
    $('rEvent').onclick = () => { Sfx.play('ui'); closeSheet(); endFight(); startDemo(); openEvent(); };
    $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
  }
  // tokens and challenge progress from a finished fight in any mode but Training
  function eventFight(res) {
    if (!U.run || U.run.mode === 'training' || (Game.cfg && Game.cfg.tutorial)) return;
    const E = Events.current(), won = res.winner === 0;
    const done = [];
    if (won) done.push(...Events.track('win'), ...Events.track('stagewin', 1, { stage: Game.stageId }));
    if (res.stats.supers) done.push(...Events.track('super', res.stats.supers));
    for (const C of done) toast(`EVENT CHALLENGE DONE · ${C.text.toUpperCase()}`);
    if (U.run.mode === 'event') return;   // Event Battles add their own (double) tokens
    const n = Events.fightTokens(res, false), ready = Events.addTokens(n);
    toast(`+${n} ${E.token}${ready ? ' · EVENT REWARD READY' : ''}`);
  }

  /* ------------------------------------------------------------ select */
  function openSelect(mode) {
    const last = Save.owned(Save.data.lastPick) ? Save.data.lastPick : 'kaze';
    const others = ROSTER.filter(f => f.id !== last && !f.boss);
    U.sel = { mode, p1: last, p2: mode === 'training' ? 'kaze' : pick(others).id, view: last, dummy: 'stand', tab: 'moves' };
    $('selTitle').textContent = { ascent: 'ASCENT · CHOOSE YOUR FIGHTER', survival: 'SURVIVAL · CHOOSE YOUR FIGHTER', training: 'TRAINING · CHOOSE YOUR FIGHTER', roster: 'FIGHTERS' }[mode];
    show('select');
    renderSelect();
  }

  // the roster in colour order, so the grid reads as a spectrum
  const hueOf = hex => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };
  let BY_COLOUR = null;
  const byColour = () => BY_COLOUR || (BY_COLOUR = ROSTER.slice().sort((a, b) => ((hueOf(a.color) + 15) % 360) - ((hueOf(b.color) + 15) % 360)));
  function renderSelect() {
    const s = U.sel;
    const grid = $('selGrid');
    grid.innerHTML = byColour().map(f => {
      const own = Save.owned(f.id);
      const tags = [];
      if (s.p1 === f.id && s.mode !== 'roster') tags.push('<span>P1</span>');
      const right = !own && f.eventOnly ? `<span class="price event" style="--ec:${Events.BY[f.eventOnly].col}">${ic('star')}EVENT</span>` : !own ? `<span class="price${f.coinOnly ? ' excl' : ''}">${ic('coins', 'coin') + fmt(f.price)}</span>` : Save.data.clears[f.id] != null ? `<span class="clear ic" data-icon="trophy"></span>` : '';
      const rk = own ? Meta.totalRank(f.id) : 0;
      return `<button class="ftile ${s.view === f.id ? 'on' : ''} ${own ? '' : 'lock'}" data-id="${f.id}" style="--c:${f.color}">${pt(own ? Skins.def(f.id, Skins.equipped(f.id)) : f, own ? '' : 'locked')}<span class="tagc">${tags.join('')}</span>${right}${rk ? `<span class="rank">R${rk}</span>` : ''}${own ? '' : '<span class="lk ic" data-icon="lock"></span>'}<b>${f.name}</b><small>${ROLE[f.ai.style] || 'ALL-ROUNDER'}</small></button>`;
    }).join('');
    grid.querySelectorAll('.ftile').forEach(b => {
      b.onclick = () => {
        Sfx.play('ui');
        const id = b.dataset.id;
        s.view = id;
        if (Save.owned(id) && s.mode !== 'roster') {
          s.p1 = id;
        }
        renderSelect();
      };
      b.ondblclick = () => { if (Save.owned(b.dataset.id) && s.mode !== 'roster') confirmSelect(); };
    });
    renderDetail();
    hydrate(grid);
  }

  function moveRows(def) {
    const pk = { sp1: 's1', sp2: 's2', super: 'sup', hEnd: 'combo' };
    const row = (k, mv, keys, sub, cls = '') => `<div class="mv ${cls}" data-k="${pk[k]}" style="--c:${def.color};--d:${shade(def.color)}"><span class="move-ic">${Icons.svg(mv.icon || 'fist')}</span><div><b>${esc(mv.name)}</b><small>${sub}</small></div><span class="keys2">${keys}</span></div>`;
    const m = def.moves;
    const reach = m.hEnd.far ? '<em class="tag far">RANGED</em>' : '<em class="tag close">CLOSE</em>';
    return row('hEnd', m.hEnd, seqFor(['l', 'l', 'h'], def), `${reach} COMBO FINISHER · LIGHT, LIGHT, HEAVY`) +
      row('sp1', m.sp1, keyFor('sp1', def), `SPECIAL · ${m.sp1.cd || 2}S COOLDOWN`) +
      row('sp2', m.sp2, keyFor('sp2', def), `SPECIAL · ${m.sp2.cd || 2}S COOLDOWN`) +
      row('super', m.super, keyFor('super', def), 'SUPER · FULL METER · FINISHER', 'super');
  }

  // outfits for a fighter: the default and any event skins (earned in events)
  function skinRows(def, own) {
    const list = Skins.forFighter(def.id), eq = Skins.equipped(def.id);
    if (!list.length) return `<div class="sd-note">${ic('star')}<span>${def.name} has no event skins yet. Skins come from the weekly events.</span></div>`;
    const card = (id, d, name, sub, state) => `<button class="skin-card ol ${state}" data-skin="${id || ''}" style="--c:${d.color}"><img alt="" src="${fullBody(d, 110, 140)}"><b>${name}</b><small>${sub}</small></button>`;
    return `<div class="skins">${card('', def, 'DEFAULT', eq ? 'TAP TO WEAR' : 'WEARING', eq ? 'own' : 'on')}${list.map(S => {
      const has = Skins.owned(S.id), EV = Events.BY[S.ev], at = Events.nextStart(S.ev);
      const sub = has ? (eq === S.id ? 'WEARING' : 'TAP TO WEAR') : at ? `${EV.name} · IN ${Events.fmtLeft(Events.left(at))}` : `${EV.name} · LIVE NOW`;
      return card(S.id, Skins.def(def.id, S.id), S.name, sub, has ? (eq === S.id ? 'on' : 'own') : 'locked');
    }).join('')}</div>${own ? '' : `<p class="hint">Unlock ${def.name} to wear skins.</p>`}`;
  }
  // buying a rank updates the panel in place: the rows, the rank badges and the
  // coins change, nothing else is rebuilt (so the preview never flickers)
  function bindUpgrades(def) {
    const D = $('selDetail');
    D.querySelectorAll('.upg-buy').forEach(b => {
      b.onclick = () => {
        const u = b.dataset.u;
        if (!Meta.buyRank(def.id, u)) { Sfx.play('uiBack'); toast('NOT ENOUGH COINS'); return; }
        Sfx.play('unlock'); coinsUI();
        const old = D.querySelector('.upg');
        if (old) { const tmp = document.createElement('div'); tmp.innerHTML = upgradeRows(def); const fresh = tmp.firstElementChild; old.replaceWith(fresh); hydrate(fresh); }
        const rk = Meta.totalRank(def.id), mst = Meta.mastery(def.id);
        const badge = D.querySelector('.sd-tabs button[data-t="upg"] i'); if (badge) badge.textContent = rk;
        const chip = D.querySelector('.sd-rank'); if (chip) { chip.innerHTML = `${ic('ranks')}MASTERY ${mst.lv} · RANK ${rk}`; hydrate(chip); }
        const tile = document.querySelector(`#selGrid .ftile[data-id="${def.id}"]`);
        if (tile) { let rb = tile.querySelector('.rank'); if (!rb) { rb = document.createElement('span'); rb.className = 'rank'; tile.appendChild(rb); } rb.textContent = 'R' + rk; }
        const el = D.querySelector(`.upg-row[data-u="${u}"]`);
        if (el) { el.classList.add('flash'); const on = el.querySelectorAll('.pips i.on'); if (on.length) on[on.length - 1].classList.add('pop'); }
        bindUpgrades(def);
      };
    });
  }
  // the upgrade panel: four tracks, five ranks each, bought with coins
  function upgradeRows(def) {
    const r = Meta.ranks(def.id);
    return `<div class="upg"><div class="upg-head"><b>RANK ${Meta.totalRank(def.id)} / ${Meta.UPGRADES.length * Meta.MAX_RANK}</b><small>APPLIES IN LEVELS, SURVIVAL AND ASCENT</small></div>${Meta.UPGRADES.map(U => {
      const n = r[U.id], cost = Meta.nextCost(def.id, U.id);
      return `<div class="upg-row" data-u="${U.id}" style="--c:${def.color}"><span class="upg-ic">${ic(U.icon)}</span><div class="upg-mid"><b>${U.name}</b><small>${n ? U.desc(n) : 'No bonus yet'}</small></div><span class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>${cost == null ? '<span class="upg-max">MAX</span>' : `<button class="btn small upg-buy" data-u="${U.id}" ${Save.data.coins < cost ? 'disabled' : ''}><b>${ic('coins', 'coin')}${fmt(cost)}</b></button>`}</div>`;
    }).join('')}</div>`;
  }

  // how each fighter plays, in two words
  const ROLE = { rush: 'RUSHDOWN', zoner: 'ZONER', balanced: 'ALL-ROUNDER' };
  const STYLE = { karate: 'KARATE', ninja: 'NINJUTSU', mystic: 'SORCERY', sword: 'IAIDO', reaper: 'SCYTHE', loose: 'RUBBER BRAWL', boxer: 'BOXING', monk: 'SPIRIT ARTS',
    casual: 'STREET', feral: 'CHAINSAW', regal: 'SHADOW ARTS', giant: 'TITAN', kungfu: 'KUNG FU', soldier: 'FIRE KICKS', dual: 'THREE SWORDS', calm: 'PSYCHIC',
    dancer: 'FAN DANCE', frost: 'FROST FISTS', beat: 'BEAT BOXING' };

  function renderDetail() {
    const s = U.sel, def = BY_ID[s.view];
    const own = Save.owned(def.id);
    const st = def.stats;
    const tab = s.tab || 'moves';
    const bar = (lbl, n) => `<div class="st"><small>${lbl}</small><span class="meter">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span></div>`;
    let foot = '';
    if (!own && def.eventOnly) {
      const EV = Events.BY[def.eventOnly], at = Events.nextStart(def.eventOnly);
      foot = `<div class="lock-note">${ic('star', 'coin')}<span><b>EVENT EXCLUSIVE.</b> ${def.name} is the top reward of <b>${EV.name}</b>${at ? `, which returns in ${Events.fmtLeft(Events.left(at))}` : ': <b>live now!</b>'}</span></div>
        <div class="sd-foot"><button class="btn primary" id="sdEvent" ${at ? 'disabled' : ''}><b>${at ? `RETURNS IN ${Events.fmtLeft(Events.left(at))}` : 'OPEN THE EVENT'}</b></button></div>`;
    } else if (!own) {
      const can = Save.data.coins >= def.price;
      const rec = Campaign.levels.find(L => L.recruit === def.id);
      foot = `<div class="lock-note">${ic(def.coinOnly ? 'coins' : 'lock', 'coin')}${def.coinOnly ? `<span><b>COIN EXCLUSIVE.</b> ${def.name} never joins through levels: unlock for ${fmt(def.price)} coins.</span>` : rec ? `<span>Beat ${def.name} in <b>LEVEL ${rec.label}</b> to recruit them, or unlock now.</span>` : `<span>Unlock for ${fmt(def.price)} coins. Win fights to earn coins.</span>`}</div>
        <div class="sd-foot"><button class="btn primary" id="sdBuy" ${can ? '' : 'disabled'}><b>${ic('coins', 'coin')} UNLOCK · ${fmt(def.price)}</b></button></div>`;
    } else if (s.mode === 'roster') {
      foot = `<div class="sd-foot"><button class="btn primary" id="sdMain" ${Save.data.lastPick === def.id ? 'disabled' : ''}><b>${Save.data.lastPick === def.id ? 'YOUR FIGHTER' : 'SET AS YOUR FIGHTER'}</b></button><button class="btn" id="sdTry"><b>TRY IN TRAINING</b></button></div>`;
    } else {
      let opts = '';
      if (s.mode === 'ascent') {
        opts = `<div class="sd-note">${ic('up')}<span>Climb floor after floor. After each win, pick <b>1 of 3 cards</b>: common, rare, epic or legendary. Every fifth floor is a <b>boss</b>. Best: <b>FLOOR ${Save.data.ascentBest}</b>.</span></div>`;
      } else if (s.mode === 'training') {
        opts = `<div class="sd-opts"><div class="row"><small>DUMMY</small><nav class="seg" id="optDummy">${['kaze', 'ryo', 'homura', 'mugi'].map(id => `<button data-v="${id}" class="${s.p2 === id ? 'active' : ''}">${BY_ID[id].name}</button>`).join('')}</nav></div></div>`;
      }
      const label = { ascent: 'START ASCENT', survival: 'START SURVIVAL', training: 'ENTER TRAINING' }[s.mode];
      foot = `${opts}<div class="sd-foot"><button class="btn primary big" id="sdGo"><b>${label}</b></button></div>`;
    }
    const rk = own ? Meta.totalRank(def.id) : 0, maxRk = Meta.UPGRADES.length * Meta.MAX_RANK, mst = Meta.mastery(def.id);
    const body = {
      moves: `<div class="sd-moves">${moveRows(def)}</div>`,
      skins: skinRows(def, own),
      upg: own ? upgradeRows(def) : `<div class="sd-note">${ic('lock')}<span>Unlock <b>${def.name}</b> to buy upgrades: Power, Vitality, Focus and Recovery, five ranks each.</span></div>`,
      info: `<p class="sd-blurb">${esc(def.blurb)}</p>
        <div class="sd-facts">
          <div><small>ROLE</small><b>${ROLE[def.ai.style] || 'ALL-ROUNDER'}</b></div>
          <div><small>STYLE</small><b>${STYLE[def.look.style || def.look.stance] || '—'}</b></div>
          <div><small>FINISHER</small><b>${def.moves.hEnd.far ? 'RANGED' : 'CLOSE'}</b></div>
          <div><small>HOME STAGE</small><b>${(STAGES[def.stage] || STAGES.dojo).name}</b></div>
          <div><small>HEALTH</small><b>${fmt(Math.round(def.hp * HP_SCALE))}</b></div>
          <div><small>RANK</small><b>${rk} / ${maxRk}</b></div>
        </div>
        <div class="sd-mastery" style="--c:${def.color}"><div><small>MASTERY</small><b>LV ${mst.lv} · ${Meta.masteryTitle(mst.lv)}</b></div>${xpBar(mst, def.color)}<small>${mst.max ? 'MAXED' : `${mst.xp} / ${mst.need} XP · NEXT LEVEL +${Meta.levelPay(mst.lv + 1)} COINS`}</small></div>`,
    }[tab];
    $('selDetail').innerHTML = `
      <div class="sd-hero" style="--c:${def.color}">
        <div class="sd-prev" style="--c:${def.color}"><canvas id="sdPrev"></canvas>
          <span class="prev-tag">${ic('play')} PREVIEW</span><span class="prev-hint">TAP A MOVE TO SEE IT</span>
          <div class="sd-id"><span class="role">${ROLE[def.ai.style] || 'ALL-ROUNDER'} · ${STYLE[def.look.style || def.look.stance] || ''}</span><h3>${def.name}</h3><small>${def.title}</small></div>
          ${own ? `<span class="sd-rank">${ic('ranks')}MASTERY ${mst.lv}${rk ? ` · RANK ${rk}` : ''}</span>` : `<span class="sd-rank lock">${ic('lock')}LOCKED</span>`}
        </div>
        <div class="sd-stats" style="--c:${def.color}">${bar('POWER', st[0])}${bar('SPEED', st[1])}${bar('RANGE', st[2])}</div>
      </div>
      <nav class="sd-tabs" style="--c:${def.color}">${[['moves', 'MOVES', 'fist'], ['upg', 'UPGRADES', 'up'], ['skins', 'SKINS', 'star'], ['info', 'PROFILE', 'user']].map(([k, l, icn]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${ic(icn)}<b>${l}</b>${k === 'upg' && own ? `<i>${rk}</i>` : ''}</button>`).join('')}</nav>
      <div class="sd-body${s.tabAnim ? ' anim' : ''}">${body}</div>
      <div class="sd-dock">${foot}</div>`;
    const D = $('selDetail');
    hydrate(D);
    startPreview(def.id);
    s.tabAnim = false;
    D.querySelectorAll('.sd-tabs button').forEach(b => { b.onclick = () => { if (s.tab === b.dataset.t) return; Sfx.play('ui'); s.tab = b.dataset.t; s.tabAnim = true; renderDetail(); }; });
    D.querySelectorAll('.mv[data-k]').forEach(r => { r.onclick = () => { Sfx.play('ui'); const k = r.dataset.k; if (U.previewCtrl) U.previewCtrl.play(k === 'combo' ? ['l', 'l', 'h'] : [k]); }; });
    const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    on('sdBuy', () => {
      if (Save.buy(def.id)) { Sfx.play('unlock'); toast(`${def.name} UNLOCKED`); if (s.mode !== 'roster') s.p1 = def.id; coinsUI(); renderSelect(); }
    });
    on('sdMain', () => { Save.data.lastPick = def.id; Save.save(); Sfx.play('ui'); renderSelect(); });
    on('sdEvent', () => { Sfx.play('ui'); openEvent(); });
    D.querySelectorAll('.skin-card[data-skin]').forEach(b => { b.onclick = () => {
      const id = b.dataset.skin || null;
      if (id && !Skins.owned(id)) return;
      Sfx.play('ui'); Skins.equip(def.id, id); U.previewId = null; renderSelect();
    }; });
    on('sdTry', () => { U.sel.mode = 'training'; U.sel.p1 = def.id; U.sel.p2 = 'kaze'; confirmSelect(); });
    on('sdGo', () => { Sfx.play('fight'); confirmSelect(); });
    const segs = (id, f) => { const e = $(id); if (e) e.querySelectorAll('button').forEach(b => { b.onclick = () => { Sfx.play('ui'); f(b.dataset.v); renderSelect(); }; }); };
    segs('optDummy', v => { s.p2 = v; });
    bindUpgrades(def);
  }

  // the live preview: the main canvas runs a showcase for the viewed fighter,
  // and the panel shows a crop of it
  function startPreview(id) {
    if (U.previewId === id && Game.cfg && Game.cfg.preview) return;
    U.previewId = id;
    U.previewCtrl = new PreviewCtrl();
    const def = BY_ID[id];
    Game.speed = U.testSpeed || 1;
    Game.startMatch({ p1: id, p2: id === 'kaze' ? 'ryo' : 'kaze', skins: [Skins.equipped(id), null], ctrls: [U.previewCtrl, new DummyCtrl('stand')], stage: def.stage && STAGES[def.stage] ? def.stage : 'dojo', mode: 'demo', training: true, preview: true, toWin: 99, hpMul: [1, 3] });
  }
  function previewTick() {
    const pc = $('sdPrev');
    if (U.screen !== 'select' || !pc || !Game.cfg || !Game.cfg.preview) return;
    const src = $('stage'), w = pc.clientWidth, h = pc.clientHeight;
    if (!w || !h) return;
    const k = Math.min(2, window.devicePixelRatio || 1);
    if (pc.width !== Math.round(w * k)) { pc.width = Math.round(w * k); pc.height = Math.round(h * k); }
    // frame the two fighters: crop the middle of the full-screen render
    const [a, b] = Game.fighters, m = Game.toScreen((a.root.x + b.root.x) / 2, GROUND - 120);
    const sw = src.width * 0.62, sh = sw * pc.height / pc.width, sc = src.width / window.innerWidth;
    const sx = clamp(m.x * sc - sw / 2, 0, src.width - sw), sy = clamp(m.y * sc - sh / 2, 0, src.height - sh);
    pc.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, pc.width, pc.height);
  }
  U.previewTick = previewTick;

  function confirmSelect() {
    const s = U.sel;
    if (!Save.owned(s.p1)) return;
    Save.data.lastPick = s.p1; Save.save();
    if (s.mode === 'ascent') startAscent(s.p1);
    else if (s.mode === 'survival') startSurvival(s.p1);
    else if (s.mode === 'training') startTraining(s.p1, s.p2);
  }

  /* ------------------------------------------------------------ fights */
  function beginFight(cfg, instant, fast) {
    U.lastCfg = cfg;
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
  // campaign CPUs play about 25% softer than their listed level
  const lvEase = (lv, minus = 0) => Math.max(1, Math.round(lv * 0.75) - minus);
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
    eventFight(res);
    // missions: wins (and wins with a given fighter) and supers
    if (res.winner === 0) mission('win', 1, { fid: id });
    if (res.stats.supers) mission('super', res.stats.supers);
    // mastery: a win is worth more, and style is rewarded
    const xp = (res.winner === 0 ? 40 : 14) + res.stats.finishers * 10 + Math.min(20, res.stats.maxCombo * 2) + res.stats.bf * 6;
    const x = Meta.addXp(id, xp);
    U.lastXp = Object.assign({ id }, x);
    if (x.to > x.from) {
      Sfx.play('perfect'); Platform.happytime();
      toast(`${BY_ID[id].name} · MASTERY ${x.to}${x.to % 5 === 0 ? ' · ' + Meta.masteryTitle(x.to) : ''} · +${x.coins} COINS`);
      coinsUI();
    }
  }
  // the mastery XP a fight just earned, as a line on the result sheet
  function xpLine() {
    const x = U.lastXp; if (!x) return '';
    const def = BY_ID[x.id];
    return `<div class="xp-line" style="--c:${def.color}"><small>${def.name} · MASTERY ${x.m.lv}${x.to > x.from ? ' · LEVEL UP!' : ''}</small>${xpBar(x.m, def.color)}<b>+${x.gain} XP</b></div>`;
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
    $('chapterHead').innerHTML = `<h3>${c + 1}. ${ch.name}</h3><span class="tag">${ic('star', 'star')} ${got}/18</span><p>${CHAPTERS[c].recruit[2] || CHAPTERS[c].recruit[5] ? 'Beat the fighters marked RECRUIT to add them to your roster.' : 'Six quick fights. The last one is a boss.'}</p>`;
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
    const cfg = { p1: me, p2: waves[0], waves, waveHp: L.waveHp, fastIntro: true, mods: tut ? null : [Meta.modsFor(me, { upgrades: true }), null], waveCtrl: k => cpu(lvEase(L.lv - (k < waves.length - 1 ? 1 : 0))), onWave: k => onWave(k), ctrls: [human(0), tut ? new DummyCtrl('stand') : cpu(lvEase(L.lv - (waves.length > 1 ? 1 : 0)))], stage: L.stage, mode: 'level', toWin: L.toWin,
      chip: `LEVEL ${L.label} · ${CHAPTERS[L.c].name}${tw !== 'classic' ? ' · ' + TWISTS[tw].name : ''}`, roundSub: `LEVEL ${L.label}${tw !== 'classic' ? ' · ' + TWISTS[tw].name : ''}`,
      tutorial: tut, hpMul, onEnd: res => setTimeout(() => levelEnd(L, res), 900) };
    if (tw === 'giant') { cfg.scale = [1, 1.25]; hpMul[1] *= 1.25; cfg.waveHp *= 1.25; }
    if (tw === 'lowgrav') cfg.grav = 0.6;
    if (tw === 'supers') { cfg.meter0 = 100; cfg.meter1 = 100; }
    if (tw === 'tough') { hpMul[1] *= 1.5; cfg.waveHp *= 1.5; }
    if (tw === 'frenzy') cfg.speedMul = 1.2;
    if (tw === 'glass') cfg.dmgMul = 2;
    if (tw === 'clock') { cfg.timeLimit = 60 + 22 * waves.length; cfg.koBonus = 8; cfg.loseOnTime = true; }   // the clock scales with the foes, and each knockout adds 8 seconds
    U.run = { mode: 'level', L };
    beginFight(cfg, instant, U.fastNext);
    U.fastNext = false;
    U.levelIntro = { L, foe, t: 0, tut };
  }

  const chDone0 = L => Campaign.chapterDone(L.c) && L.l === 5;
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
      mission('level');
      if (stars === 3 || chDone0(L)) Platform.happytime();
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
        ${rec}${statTiles(res.stats)}${xpLine()}${payoutHtml({ total: coins, parts })}
        <div class="actions"><button class="btn" id="rMenu"><b>MENU</b></button><button class="btn" id="rRetry"><b>RETRY</b></button>${next ? `<button class="btn primary" id="rNext"><b>NEXT LEVEL</b></button>` : ''}</div>`, 'result');
      if (next) { $('rNext').onclick = () => { Sfx.play('fight'); U.fastNext = true; playLevel(next); }; autoNext($('rNext'), rec ? 8 : 5); }
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
        <p class="tip">${esc(pick(tips))}</p>${statTiles(res.stats)}${xpLine()}
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
    { label: 'LIGHT ATTACK', hint: 'Left click. Quick, and hard to punish.', key: () => MOUSE('l'), touch: 'LIGHT ATTACK', thint: 'Tap LIGHT.', tkey: () => keyFor('l'), focus: '.orb-l', done: t => t.light >= 1 },
    { label: 'HEAVY ATTACK', hint: 'Right click. Slower, but hits harder.', key: () => MOUSE('r'), touch: 'HEAVY ATTACK', thint: 'Tap HEAVY.', tkey: () => keyFor('h'), focus: '.orb-h', done: t => t.heavy >= 1 },
    { label: 'COMBO', hint: 'Left, left, right. It ends in your fighter\'s own finisher.', key: () => MOUSE('l') + MOUSE('l') + MOUSE('r'), touch: 'COMBO', thint: 'LIGHT, LIGHT, then HEAVY.', tkey: () => seqFor(['l', 'l', 'h']), focus: '.orb-l, .orb-h', done: t => t.ender >= 1 },
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
  function onFightHit(att, def, spec, r, act) {
    if (!U.fightOn) return;
    // mission events from the player's own hits and blocks
    if (att.side === 0 && r === 'hit') {
      const fin = act ? act.key === 'hEnd' && !act.mFin && (act.mFin = true) : spec.name && spec.name === att.def.moves.hEnd.name;
      if (fin) { mission('finisher'); if (U.run && U.run.mode !== 'training') for (const C of Events.track('finisher')) toast(`EVENT CHALLENGE DONE · ${C.text.toUpperCase()}`); }
      if (def.lastHit && def.lastHit.bf) mission('bf');
      const c = Game.combo[0];
      if (c && c.n === 6) mission('combo6');
    }
    if (def.side === 0 && r === 'block') mission('block');
    if (U.run && U.run.mode === 'training' && att.side === 0 && r === 'hit') trialHit(att, def, spec, act);
    const t = U.tut;
    if (t && def.side === 0 && r === 'block') t.blocked++;
    // tips the first time something matters
    if (att.side === 0 && r === 'hit' && att.action && att.action.key === 'hEnd' && !att.action.move.far && def.mode === 'tumble') tip('air', isTouch() ? '<b>LAUNCHED!</b> Tap JUMP right away to chase them and keep the combo going.' : '<b>LAUNCHED!</b> Press <kbd>W</kbd> right away to jump after them, then click, click, right-click in the air.');
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
  /* ------------------------------------------------------------ ascent
     A roguelite climb: one-round floors against the CPU, health and meter
     carry over, a card choice after every win, a boss every fifth floor.
     Healing: 25% after each floor, 50% after a boss, plus the healing cards. */
  const isBossFloor = fl => fl % 5 === 0;
  function startAscent(id) {
    U.run = { mode: 'ascent', p1: id, floor: 1, hp: 1, meter: 0, coins: 0, cards: {}, coinMul: 1, phoenixSpent: false };
    Save.data.ascentRuns = (Save.data.ascentRuns || 0) + 1; Save.save();
    ascentFloor();
  }
  function cardCount(r) { return Object.values(r.cards).reduce((a, b) => a + b, 0); }
  // the cards that still act in a fight (a spent Phoenix stays in the deck, burnt)
  function liveCards(r) { const c = Object.assign({}, r.cards); if (r.phoenixSpent) delete c.phoenix; return c; }
  function ascentFloor() {
    const r = U.run, fl = r.floor, boss = isBossFloor(fl);
    const pool = ROSTER.filter(f => f.id !== r.p1).map(f => f.id);
    const oid = pick(pool);
    const lv = Math.min(8, 1 + Math.floor((fl - 1) / 2));
    const foe = Meta.base();
    foe.hp = boss ? 1.45 + fl * 0.02 : 1 + Math.min(0.4, fl * 0.025);
    foe.dmg = 1 + Math.min(0.3, fl * 0.015);
    r.cur = { id: oid, lv, boss };
    const mods = Meta.modsFor(r.p1, { upgrades: true, cards: liveCards(r) });
    versusSheet(r.p1, oid, `${boss ? 'BOSS · ' : ''}FLOOR ${fl}`, () => beginFight({ p1: r.p1, p2: oid, ctrls: [human(0), cpu(lv)], stage: pick(STAGE_IDS), mode: 'ascent', toWin: 1,
      hpStart: [r.hp, 1], healFrom: r.healFrom != null ? [r.healFrom, null] : null, meter0: r.meter, mods: [mods, foe], scale: boss ? [1, 1.1] : null, fastIntro: fl > 1, roundSub: boss ? 'BOSS FLOOR' : 'FLOOR ' + fl,
      chip: `ASCENT · FLOOR ${fl}${boss ? ' · BOSS' : ''} · ${cardCount(r)} ${cardCount(r) === 1 ? 'CARD' : 'CARDS'}`, onEnd: res => setTimeout(() => ascentEnd(res), 700) }), null, 1.4);
  }
  // the run's deck as small chips, edged in each card's rarity colour
  function cardChips(r) {
    const list = Object.entries(r.cards).filter(([, n]) => n > 0);
    return list.length ? `<div class="card-chips">${list.map(([id, n]) => { const C = Meta.CARD[id], R = Meta.RARITY[C.rar]; return `<span class="r-${C.rar}${id === 'phoenix' && r.phoenixSpent ? ' spent' : ''}" style="--c:${C.col};--rc:${R.col}">${ic(C.icon)}${C.name}${n > 1 ? ' ×' + n : ''}</span>`; }).join('')}</div>` : '';
  }
  // one card: rarity banner with pips, art, name, rules text, stack note, key
  // health after the fight, and the heal on top of it, as one bar
  function healBar(from, to) {
    return `<div class="heal-bar"><span>${ic('heal')}HEALTH</span><div class="hb"><i class="was" style="width:${Math.round(from * 100)}%"></i><i class="gain" style="left:${Math.round(from * 100)}%;width:${Math.max(0, Math.round((to - from) * 100))}%"></i></div><b>${Math.round(to * 100)}%</b></div>`;
  }
  function cardHtml(C, r, k) {
    const R = Meta.RARITY[C.rar], have = r.cards[C.id] || 0;
    const note = C.now && !C.apply ? 'INSTANT' : have ? `STACK ${have + 1} / ${C.max}` : C.max > 1 ? `STACKS ×${C.max}` : 'UNIQUE';
    return `<button class="rcard r-${C.rar}" data-b="${C.id}" style="--c:${C.col};--rc:${R.col};--i:${k}">
      <span class="rc-edge"></span><span class="rc-frame"></span>
      <span class="rc-rar">${'<i></i>'.repeat(R.pips)}<b>${R.name}</b>${'<i></i>'.repeat(R.pips)}</span>
      <span class="rc-art"><span class="rc-pattern"></span><span class="rc-rays"></span><span class="rc-ic">${ic(C.icon)}</span><span class="rc-tag">${C.tag || ''}</span></span>
      <span class="rc-plate"><b class="rc-name">${C.name}</b></span>
      <small class="rc-desc">${C.desc}</small>
      <em class="rc-note">${note}</em><kbd>${k + 1}</kbd>
      <span class="rc-foil"></span><span class="rc-shine"></span><span class="rc-spark"></span><span class="rc-glare"></span>
    </button>`;
  }
  // cards tilt toward the pointer and a glare follows it, like a real foil card
  function cardTilt(root) {
    root.querySelectorAll('.rcard').forEach(el => {
      el.addEventListener('pointermove', e => {
        const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        el.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }
  function ascentEnd(res) {
    const r = U.run;
    const me = Game.fighters[0];
    if (me && me.phoenixUsed) r.phoenixSpent = true;
    // Midas Touch: the coins knocked out of the foe this floor
    const midas = me && me.midasCoins ? me.midasCoins : 0;
    if (midas) { Save.addCoins(midas); r.coins += midas; }
    if (res.winner === 0) {
      const fl = r.floor, boss = isBossFloor(fl);
      const c = Math.round((15 + fl * 4 + (boss ? 60 : 0) + res.stats.finishers * 15) * (r.coinMul || 1));
      Save.addCoins(c); r.coins += c;
      if (fl > Save.data.ascentBest) { Save.data.ascentBest = fl; Save.save(); if (fl > 1) Platform.happytime(); }
      mission('floor');
      if (Save.dailyReady()) { Save.data.daily = Save.today(); Save.addCoins(100); r.coins += 100; toast('FIRST WIN TODAY +100 COINS'); }
      recordMatch(res, r.p1);
      const heal = boss ? 0.5 : 0.25;
      r.healFrom = res.hp[0];
      mission('streak', r.streak);
      r.hp = Math.min(1, res.hp[0] + heal);
      r.meter = me ? me.meter : 0;
      r.floor++;
      Sfx.play(boss ? 'perfect' : 'coin');
      // the decision: one of three cards, rarer after a boss
      const offer = Meta.offer(r.cards, { floor: fl, boss });
      if (!offer.length) { ascentFloor(); return; }
      const legend = offer.some(C => C.rar === 'legendary');
      openSheet(`<h2 class="win">FLOOR ${fl} CLEARED</h2><p class="sub">+${c + midas} COINS${boss ? ' · BOSS BONUS' : ''} · ${ic('heal')} HEALTH +${Math.round(heal * 100)}%</p>
        ${healBar(r.healFrom, r.hp)}
        <p class="tip">${boss ? 'Boss reward: rarer cards. ' : ''}Pick a card for the rest of the run</p>
        <div class="rcards">${offer.map((C, k) => cardHtml(C, r, k)).join('')}</div>
        ${cardChips(r)}`, 'result wide cards' + (legend ? ' legend' : ''));
      if (legend) setTimeout(() => Sfx.play('perfect'), 350);
      let picked = false;
      const choose = id => {
        if (picked) return; picked = true;
        const C = Meta.CARD[id];
        Sfx.play(C.rar === 'legendary' || C.rar === 'epic' ? 'unlock' : 'ui');
        r.cards[id] = (r.cards[id] || 0) + 1;
        if (C.rar !== 'common') mission('card');
        if (C.rar === 'legendary') Platform.happytime();
        if (C.now) { C.now(r); const hb = $('sheet').querySelector('.heal-bar'); if (hb) hb.outerHTML = healBar(r.healFrom, r.hp); hydrate($('sheet')); }
        window.removeEventListener('keydown', keys, true);
        const el = $('sheet').querySelector(`.rcard[data-b="${id}"]`);
        if (el) { el.classList.add('chosen'); $('sheet').classList.add('picking'); }
        setTimeout(ascentFloor, 420);
      };
      const keys = e => { const k = +e.key; if (k >= 1 && k <= offer.length) { e.preventDefault(); choose(offer[k - 1].id); } };
      window.addEventListener('keydown', keys, true);
      $('sheet').querySelectorAll('.rcard').forEach(b => { b.onclick = () => choose(b.dataset.b); });
      cardTilt($('sheet'));
    } else {
      recordMatch(res, r.p1);
      const cleared = r.floor - 1, best = cleared >= Save.data.ascentBest && cleared > 0;
      openSheet(`<h2 class="lose">RUN OVER</h2><p class="sub">${BY_ID[r.p1].name} · ASCENT</p>
        <div class="big-count">${cleared}</div><p class="sub">${cleared === 1 ? 'FLOOR' : 'FLOORS'} CLEARED · ${best ? 'NEW BEST!' : 'BEST ' + Save.data.ascentBest}</p>
        ${cardChips(r)}
        ${xpLine()}
        <div class="payout">${ic('coins', 'coin')}${fmt(r.coins)}<small>COINS THIS RUN</small></div>
        <p class="hint">Spend coins on upgrades in FIGHTERS to climb higher.</p>
        <div class="actions"><button class="btn" id="rMenu"><b>MENU</b></button><button class="btn" id="rUpg"><b>UPGRADES</b></button><button class="btn primary" id="rRetry"><b>CLIMB AGAIN</b></button></div>`, 'result');
      $('rRetry').onclick = () => { Sfx.play('fight'); startAscent(r.p1); };
      $('rUpg').onclick = () => { Sfx.play('ui'); closeSheet(); endFight(); openSelect('roster'); U.sel.view = r.p1; renderSelect(); };
      $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
    }
  }

  function startSurvival(id) {
    U.run = { mode: 'survival', p1: id, streak: 0, hp: 1, coins: 0, meter: 0 };
    survivalFight();
  }
  function survivalFight() {
    const r = U.run;
    const pool = ROSTER.filter(f => f.id !== r.p1).map(f => f.id);
    const oid = r.streak > 0 && r.streak % 5 === 4 ? (r.p1 === 'saibo' ? pick(pool) : 'saibo') : pick(pool.filter(x => x !== 'saibo'));
    const lv = Math.min(8, 1 + Math.floor(r.streak / 2));
    r.cur = { id: oid, lv };
    versusSheet(r.p1, oid, `STREAK ${r.streak} · CPU LV ${lv}`, () => beginFight({ p1: r.p1, p2: oid, ctrls: [human(0), cpu(lv)], stage: pick(STAGE_IDS), mode: 'survival', toWin: 1, mods: [Meta.modsFor(r.p1, { upgrades: true }), null],
      hpStart: [r.hp, 1], healFrom: r.healFrom != null ? [r.healFrom, null] : null, meter0: r.meter, fastIntro: r.streak > 0, chip: `SURVIVAL · STREAK ${r.streak} · CPU LV ${lv}`, onEnd: res => setTimeout(() => survivalEnd(res), 700) }), null, 1.6);
  }
  function survivalEnd(res) {
    const r = U.run;
    if (res.winner === 0) {
      r.streak++;
      // healing between fights: 35%, +10% for a super finish, and a full
      // breather every fifth win
      const breather = r.streak % 5 === 0;
      r.healFrom = res.hp[0];
      r.hp = breather ? 1 : Math.min(1, res.hp[0] + 0.35 + (res.stats.finishers ? 0.1 : 0));
      r.meter = Game.fighters[0] ? Game.fighters[0].meter : 0;
      const c = 20 + Math.min(40, r.streak * 4) + res.stats.finishers * 15;
      Save.addCoins(c); r.coins += c;
      if (Save.dailyReady()) { Save.data.daily = Save.today(); Save.addCoins(100); r.coins += 100; toast('FIRST WIN TODAY +100 COINS'); }
      recordMatch(res, r.p1);
      toast(`STREAK ${r.streak} · +${c} COINS · ${breather ? 'BREATHER: FULL HEALTH' : 'HEALTH +' + (res.stats.finishers ? 45 : 35) + '%'}`);
      Sfx.play('coin');
      survivalFight();
    } else {
      recordMatch(res, r.p1);
      const best = r.streak > Save.data.survivalBest;
      if (best) { Save.data.survivalBest = r.streak; Save.save(); Platform.happytime(); }
      openSheet(`<h2 class="lose">KNOCKED OUT</h2><p class="sub">${BY_ID[r.p1].name} · SURVIVAL</p>
        <div class="big-count">${r.streak}</div><p class="sub">${best ? 'NEW BEST STREAK!' : 'BEST ' + Save.data.survivalBest}</p>
        ${xpLine()}
        <div class="payout">${ic('coins', 'coin')}<span id="rCoins">${fmt(r.coins)}</span><small>COINS THIS RUN</small></div>
        <div class="actions"><button class="btn primary" id="rAgain"><b>AGAIN</b></button><button class="btn" id="rMenu"><b>MENU</b></button></div>`, 'result');
      $('rAgain').onclick = () => { Sfx.play('ui'); startSurvival(r.p1); };
      $('rMenu').onclick = () => { Sfx.play('uiBack'); quitToMenu(); };
    }
  }

  function startTraining(id, dummy) {
    U.run = { mode: 'training', p1: id, dummy: dummy || 'kaze', dmode: 'stand', meter: true };
    beginFight(trainingCfg());
  }
  /* --------------------------------------------------------------- trials
     Five combo challenges per fighter, shown as a checklist in Training.
     Each one pays coins the first time it's cleared. */
  function renderTrials() {
    const el = $('trials'), r = U.run;
    if (!r || r.mode !== 'training') { el.classList.add('hidden'); return; }
    const done = Meta.trialsDone(r.p1);
    el.classList.remove('hidden');
    el.innerHTML = `<b>TRIALS ${done.length}/${Meta.TRIALS.length}</b>${Meta.TRIALS.map(T => `<div class="trial ${done.includes(T.id) ? 'done' : ''}">${ic(done.includes(T.id) ? 'check' : 'target')}<span><em>${T.name}</em>${T.desc}</span></div>`).join('')}`;
    hydrate(el);
  }
  function trialHit(att, def, spec, act) {
    const cm = Game.combo[att.side] || { n: 1, uses: {} };
    const uses = cm.uses || {};
    // a ranged finisher lands through its projectile (no action): match it by name
    const key = act ? act.key : (spec.name && spec.name === att.def.moves.hEnd.name ? 'hEnd' : null);
    const h = { key, kind: spec.kind || 'light', combo: cm.n || 1, juggled: def.mode === 'tumble', usedNormal: ['l1', 'l2', 'h', 'hEnd'].some(k => uses[k]) };
    for (const T of Meta.TRIALS) {
      if (Meta.trialsDone(att.def.id).includes(T.id) || !T.check(h)) continue;
      if (Meta.clearTrial(att.def.id, T.id)) {
        Sfx.play('unlock'); toast(`TRIAL CLEARED · ${T.name} · +${Meta.TRIAL_PAY} COINS`); coinsUI();
        renderTrials();
      }
    }
  }

  function trainingCfg() {
    const r = U.run;
    return { p1: r.p1, p2: r.dummy, ctrls: [human(0), new DummyCtrl(r.dmode)], stage: 'lab', mode: 'training', toWin: 99, training: true, trainingMeter: r.meter,
      chip: 'TRAINING · PRESS P FOR DUMMY OPTIONS', onEnd: () => {} };
  }

  function versusSheet(a, b, label, go, run, dur = 2.4) {
    const cur = U.run && U.run.cur;
    const A = Skins.def(a, Skins.equipped(a)), B = Skins.def(b, cur && cur.id === b ? cur.skin : null);
    const side = (def, cls, who) => `<div class="vs-side ${cls}" style="--c:${def.color}"><small>${who}</small>${pt(def, 'vs-pt')}<b>${def.name}</b><span>${def.title}</span></div>`;
    const sh = openSheet(`<div class="vs">${side(A, 'you', 'PLAYER 1')}<div class="vs-mid"><b>VS</b><small>${esc(label)}</small></div>${side(B, 'rival', cur && cur.label ? cur.label : cur && cur.boss ? 'BOSS' : 'CPU')}</div>
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
    for (let i = 0; i < 2; i++) $('combo' + i).classList.add('hidden');
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
    // the bar only shows what needs tracking: the two specials and their cooldowns
    // (the super has its own meter in the corner)
    $('skillbar').innerHTML = sk('sp1', m.sp1) + sk('sp2', m.sp2);
    const orb = (cls, k, icon, lbl, c) => `<button class="orb ${cls}" data-k="${k}" style="--c:${c || def.color};--d:${shade(c || def.color)}"><span class="ring"></span><span class="orb-icon">${Icons.svg(icon)}</span><span class="lbl">${lbl}</span></button>`;
    $('orbs').innerHTML = orb('orb-l', 'l', 'jab', 'LIGHT', '#ffc933') + orb('orb-h', 'h', 'burst', 'HEAVY', '#ff8a4a') + orb('orb-s1', 's1', m.sp1.icon, 'SP 1') + orb('orb-s2', 's2', m.sp2.icon, 'SP 2') + orb('orb-sup', 'sup', m.super.icon, 'SUPER') + orb('orb-j', 'jump', 'up', 'JUMP', '#e9ecf4');
    $('orbs').querySelectorAll('.orb').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); Sfx.ensure(); document.body.classList.add('touch'); b.classList.add('down'); Input.touchPress(b.dataset.k); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    U.hudCache = {};
    renderTrials();
  }

  U.tick = function () {
    if (!U.fightOn && Game.running && Game.fighters.length === 2) previewTick();
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
        if (H['c' + i] !== n) { H['c' + i] = n; cp.querySelector('b').textContent = n; cp.querySelector('span').textContent = n >= 16 ? 'SHOWDOWN!' : n >= 12 ? 'AMAZING!' : n >= 8 ? 'GREAT!' : n >= 5 ? 'NICE!' : 'HITS'; cp.querySelector('em').textContent = (c.dmg || 0) + ' DMG'; cp.classList.remove('hidden', 'pop'); void cp.offsetWidth; cp.classList.add('pop'); }
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
        ${r.mode === 'ascent' ? cardChips(r) : ''}
        <button class="btn primary" id="pRes"><b>RESUME</b></button>
        <button class="btn" id="pMoves"><b>MOVE LIST</b></button>
        ${r.mode === 'survival' || r.mode === 'ascent' ? '' : `<button class="btn" id="pRestart"><b>${r.mode === 'level' ? 'RETRY LEVEL' : 'RESTART'}</b></button>`}
        <button class="btn" id="pSet"><b>SETTINGS</b></button>
        <button class="btn danger" id="pQuit"><b>${r.mode === 'survival' || r.mode === 'ascent' ? 'QUIT RUN' : 'QUIT'}</b></button>
      </div>`, 'pause');
    U.sheetDismiss = () => U.resume();
    $('pRes').onclick = () => U.resume();
    $('pMoves').onclick = () => openMoves(BY_ID[Game.cfg.p1], () => U.openPauseAgain());
    $('pSet').onclick = () => openSettings(() => U.openPauseAgain());
    $('pQuit').onclick = () => { Game.paused = false; quitToMenu(); };
    const rs = $('pRestart');
    if (rs) rs.onclick = () => {
      Game.paused = false;
      if (training) beginFight(trainingCfg(), true);
      else if (r.mode === 'level') playLevel(r.L, true);
      else if (U.lastCfg) beginFight(Object.assign({}, U.lastCfg, { healFrom: null }), true);
      else U.resume();
    };
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
        ${['l1', 'l2', 'hEnd'].map((k, i) => `<div class="mv"><span class="move-ic" style="--c:#ffc933;--d:#8a6a10">${Icons.svg(i < 2 ? 'jab' : m.hEnd.icon)}</span><div><b>${esc(m[k].name)}</b><small>${i === 0 ? 'LIGHT' : i === 1 ? 'LIGHT, LIGHT' : 'LIGHT, LIGHT, HEAVY: LAUNCHER'}</small></div><span class="keys2">${seqFor([['l'], ['l', 'l'], ['l', 'l', 'h']][i], def)}</span></div>`).join('')}
        <div class="mv"><span class="move-ic" style="--c:#ff8a4a;--d:#7a3a1a">${Icons.svg('burst')}</span><div><b>${esc(m.h.name)}</b><small>HEAVY · CAN BLACK SPARK</small></div><span class="keys2">${keyFor('h', def)}</span></div>
        <div class="mv"><span class="move-ic" style="--c:#8fd6ff;--d:#2a5a7a">${Icons.svg('swords')}</span><div><b>Throw</b><small>CLOSE · BEATS GUARD</small></div><span class="keys2">${keyFor('l', def)}+${keyFor('h', def)}</span></div>
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

  // How to Play: four short tabs, each a handful of cards with the real
  // buttons drawn in. The controls tab follows the device you're on.
  function openHow(first, tab = 0) {
    const touch = isTouch();
    const K = k => `<kbd>${k}</kbd>`, M = side => `<span class="mk">${MOUSE(side)}</span>`;
    const T = name => `<span class="tk">${name}</span>`;
    const B = { l: touch ? T('LIGHT') : M('l'), h: touch ? T('HEAVY') : M('r'), j: touch ? T('JUMP') : K('W'), s: touch ? T('SP 1') + T('SP 2') : K('Q') + K('E'), sup: touch ? T('SUPER') : K('F'), away: touch ? 'stick away' : 'hold ' + K('A') + ' / ' + K('D') + ' away' };
    const arrow = '<span class="seq-ar">›</span>';
    const card = (icon, title, body, seq) => `<div class="how-card"><span class="how-ic">${ic(icon)}</span><div><h4>${title}</h4>${seq ? `<div class="seq">${seq}</div>` : ''}<p>${body}</p></div></div>`;
    const tabs = [
      ['CONTROLS', touch ? `
        ${card('haste', 'MOVE, DASH, JUMP', 'Slide the stick to walk. Flick it twice to dash. Flick it up, or tap JUMP, to jump.')}
        ${card('fist', 'ATTACK', 'LIGHT is fast and safe to start with. HEAVY hits harder but is slower.', B.l + B.h)}
        ${card('burst', 'SPECIALS & SUPER', 'Each special recharges after use; the ring shows when. SUPER glows when your meter is full.', B.s + B.sup)}
        ${card('shield', 'GUARD', 'Hold the stick away from your opponent to block.')}` : `
        <div class="ctrl-grid">
          <span class="hd">ACTION</span><span class="hd">MOUSE + KEYBOARD</span><span class="hd">GAMEPAD</span>
          <span>Move · dash</span><span>${K('A')}${K('D')} <small>tap twice</small></span><span>Stick</span>
          <span>Jump</span><span>${K('W')} / ${K('SPACE')}</span><span>A</span>
          <span>Guard</span><span>Hold away</span><span>Hold away</span>
          <span>Light · Heavy</span><span>${M('l')} ${M('r')}</span><span>X · Y</span>
          <span>Specials</span><span>${K('Q')} ${K('E')}</span><span>B · RB</span>
          <span>Super</span><span>${K('F')} <small>or middle click</small></span><span>RT</span>
          <span>Throw</span><span>${M('l')}+${M('r')}</span><span>LB</span>
          <span>Pause · retry</span><span>${K('P')} · ${K('R')}</span><span>START</span>
        </div>
`],
      ['COMBOS', `
        ${card('swords', 'THE STRING', 'Light, light, then heavy chains into your fighter\'s own finisher. Press each button while the last one is still landing.', B.l + arrow + B.l + arrow + B.h)}
        ${card('up', 'TAKE IT TO THE AIR', 'After the finisher launches them, jump straight away and chain light, light, heavy in the air. They bounce once per combo.', B.h + arrow + B.j + arrow + B.l + arrow + B.h)}
        ${card('burst', 'CANCEL INTO SPECIALS', 'A light or heavy that hits can be cancelled into a special, and anything into your super.', B.l + arrow + B.s + arrow + B.sup)}
        ${card('timestop', "DON'T MASH", 'Mashing light only gives two hits, and the second leaves you open. Long combos also deal less damage as they go.')}`],
      ['DEFENCE', `
        ${card('shield', 'GUARD', `Block by holding away (${B.away}). Normals do no chip damage; specials and supers chip a little.`)}
        ${card('heart', 'GUARD GAUGE', 'Each block drains the gauge under your health. If it empties, your guard breaks and you are stunned. It refills when you stop blocking.')}
        ${card('fist', 'THROWS', touch ? 'Up close, tap LIGHT and HEAVY together. Throws go straight through a guard.' : 'Up close, click both mouse buttons together. Throws go straight through a guard.')}
        ${card('target', 'AFTER A STRING', 'When their combo ends, guard or jab first. Pressing buttons after a blocked string gets you hit.')}`],
      ['MODES & COINS', `
        ${card('map', 'LEVELS', 'Eight chapters of quick fights. Win with more health for more stars. Some fighters join you when you beat them on a RECRUIT level.')}
        ${card('coins', 'COINS', 'Earned from wins, stars, finishers, Black Sparks and the first win each day. Spend them on fighters, and some fighters can <b>only</b> be bought with coins.')}
        ${card('infinity', 'SURVIVAL', 'One fighter, endless opponents. A little health returns after each win.')}
        ${card('target', 'TRAINING & VERSUS', 'Practise combos on a dummy, or pick any fighter and stage and take on the CPU at the level you choose.')}`],
    ];
    const sh = openSheet(`<h2>${first ? 'WELCOME TO RAG SHOWDOWN' : 'HOW TO PLAY'}</h2>
      <nav class="seg how-tabs">${tabs.map((t, k) => `<button data-k="${k}" class="${k === tab ? 'active' : ''}">${t[0]}</button>`).join('')}</nav>
      <div class="how-body ${tab === 0 && !touch ? '' : 'cards'}">${tabs[tab][1]}</div>
      <div class="actions"><button class="btn primary" id="hOk"><b>${first ? "LET'S FIGHT" : 'GOT IT'}</b></button></div>`, 'wide how-sheet');
    sh.querySelectorAll('.how-tabs button').forEach(b => { b.onclick = () => { Sfx.play('ui'); openHow(first, +b.dataset.k); }; });
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
  U._cardHtml = cardHtml;   // tests render a chosen hand
  U._openEvent = openEvent;
  U._renderEvent = () => { if (U.screen === 'event') renderEvent(); renderHome(); };
  U._cardTilt = cardTilt;
  U._fullBody = fullBody;
  U._start = { level: i => playLevel(Campaign.levels[i]), levels: () => openLevels(), ascent: startAscent, survival: startSurvival, training: startTraining, select: openSelect };
  return U;
})();

/* training dummy behaviours */
/* The fighter preview: runs the viewed fighter through their kit against a
   training dummy, on loop. Clicking a move in the list plays that move next. */
const PREVIEW_SEQ = [['walk', 0.7], [['l', 'l', 'h'], 1.5], [['s1'], 1.7], [['s2'], 1.9], [['sup'], 3.6]];
class PreviewCtrl {
  constructor() { this.human = false; this.i = 0; this.wait = 0.5; this.q = []; this.walkT = 0; }
  reset() {}
  play(keys) { this.q = []; this.forced = keys; this.wait = 0; }
  update(G, f, dt) {
    const o = G.opp(f);
    f.input.x = 0;
    // feed queued presses of a string, a beat apart
    if (this.q.length) { this.q[0].t -= dt; if (this.q[0].t <= 0) G.press(f.side, this.q.shift().k); return; }
    if (this.walkT > 0) { this.walkT -= dt; f.input.x = f.facing; if ((o.root.x - f.root.x) * f.facing < 170) this.walkT = 0; return; }
    this.wait -= dt;
    if (this.wait > 0 || f.action || !f.canAct || o.mode === 'tumble') return;
    // set the pair back to a good distance before each move
    const d = (o.root.x - f.root.x) * f.facing;
    if (d < 120 || d > 360 || f.root.x < WALL_L + 200 || o.root.x > WALL_R - 200) {
      G.teleport(f, 640, GROUND); G.teleport(o, 900, GROUND); f.facing = 1; o.facing = -1; this.wait = 0.25; return;
    }
    let step;
    if (this.forced) { step = [this.forced, 2.6]; this.forced = null; }
    else { step = PREVIEW_SEQ[this.i % PREVIEW_SEQ.length]; this.i++; }
    const [keys, after] = step;
    this.wait = after;
    if (keys === 'walk') { this.walkT = 0.6; return; }
    if (keys.includes('sup')) f.meter = 100;
    f.cds.sp1 = 0; f.cds.sp2 = 0;
    keys.forEach((k, n) => this.q.push({ k, t: n ? 0.13 : 0 }));
  }
}

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
