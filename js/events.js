'use strict';
/* =========================================================================
   Events: a new limited-time event every five weeks (a month and a bit),
   rotating through three.
   Each event has its own token, a reward track (coins, three skins and an
   EXCLUSIVE fighter at the top), five challenges, a daily check-in with a
   streak bonus, and Event Battles on its stage for double tokens.
   An exclusive fighter can only be earned in its event; missed ones return
   when the rotation comes back around.
   Skins are cosmetic outfits for existing fighters, equipped in FIGHTERS.
   ========================================================================= */

const Skins = (() => {
  /* -------------------------------------------------------- skin themes
     Each event's skins share a theme: ambient effects every step (tick),
     accessories drawn over the body (draw), and their own hit sparks. */
  const sakuraFlower = (ctx, x, y, r, rot) => {
    for (let i = 0; i < 5; i++) {
      const a = rot + i * TAU / 5;
      petalShape(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.62, a + Math.PI / 2, i % 2 ? '#ffc4dd' : '#ffb3d6');
    }
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x, y, r * 0.24, 0, TAU); ctx.fill();
  };
  const crystal = (ctx, x, y, h, w, ang) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h * 0.25); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w * 0.35, -h * 0.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  const THEMES = {
    sakura: {
      hit: 'petal',
      tick(G, f, dt) {
        f.skT = (f.skT || 0) + dt;
        const rate = f.cele ? 0.025 : Math.abs(f.root.vx) > 60 || f.action ? 0.06 : 0.16;
        if (f.skT < rate) return;
        f.skT = 0;
        const n = f.pts[P.NECK], s = f.s / 2;
        G.fx.add({ kind: 'leaf', x: n.x + rand(-16, 16) * s, y: n.y + rand(-8, 14) * s, vx: -f.facing * rand(40, 150) + f.root.vx * 0.2, vy: rand(-40, 30), g: 110, vr: rand(-6, 6), life: rand(1, 1.6), size: rand(3.5, 5.5), color: Math.random() < 0.75 ? '#ffb3d6' : '#ffffff', add: false });
      },
      draw(ctx, f, time) {
        const s = f.s, hd = f.pts[P.HEAD], hr = HEAD_R * s;
        // a sakura hairpin over the ear, and two petals circling slowly
        sakuraFlower(ctx, hd.x - f.facing * hr * 0.62, hd.y - hr * 0.62, 6.5 * s, time * 0.6);
        const c = f.center();
        for (let i = 0; i < 2; i++) {
          const a = time * 1.4 + i * Math.PI;
          petalShape(ctx, c.x + Math.cos(a) * 44 * s / 2, c.y - 30 * s / 2 + Math.sin(a) * 16 * s / 2, 4.5 * s / 2 * 1.4, a * 2, '#ffd1e6');
        }
      },
    },
    frost: {
      hit: 'frost',
      tick(G, f, dt) {
        f.skT = (f.skT || 0) + dt; f.skB = (f.skB || 0) + dt;
        const hd = f.pts[P.HEAD], s = f.s / 2;
        // cold breath
        if (f.skB > 1.5) { f.skB = 0; G.fx.add({ kind: 'smoke', x: hd.x + f.facing * 16 * s, y: hd.y + 4 * s, vx: f.facing * rand(40, 80), vy: rand(-30, -10), drag: 2, life: 0.9, size: 7 * s, color: '#eef8ff', add: false }); }
        if (f.skT < (f.cele ? 0.03 : 0.09)) return;
        f.skT = 0;
        // glints off the fists, snow at the feet when moving or celebrating
        const h = f.pts[Math.random() < 0.5 ? P.FHAND : P.BHAND];
        G.fx.add({ x: h.x + rand(-6, 6), y: h.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-40, -10), life: 0.45, size: rand(2, 3.2), color: '#ffffff' });
        if (Math.abs(f.root.vx) > 60 || f.cele) { const ft = f.pts[Math.random() < 0.5 ? P.FFOOT : P.BFOOT]; G.fx.add({ x: ft.x + rand(-8, 8), y: ft.y - 2, vx: rand(-40, 40), vy: rand(-140, -40), g: 300, life: 0.6, size: rand(2, 3.5), color: '#dff6ff' }); }
      },
      draw(ctx, f, time) {
        const s = f.s, n = f.pts[P.NECK], fe = f.pts[P.FELB], be = f.pts[P.BELB];
        // ice crystals grown on both shoulders
        for (const [e, k] of [[be, 0.85], [fe, 1]]) {
          const x = lerp(n.x, e.x, 0.35), y = lerp(n.y, e.y, 0.35) - 4 * s;
          crystal(ctx, x, y, 9 * s * k, 3.4 * s * k, -0.3 * f.facing);
          crystal(ctx, x + f.facing * 5 * s, y + 1 * s, 6 * s * k, 2.6 * s * k, 0.45 * f.facing);
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const i of [P.FHAND, P.BHAND]) Glow.draw(ctx, '#7fd8ff', f.pts[i].x, f.pts[i].y, 18 * s, 0.5 + Math.sin(time * 4 + i) * 0.15);
        ctx.restore();
      },
    },
    neon: {
      hit: 'beat',
      tick(G, f, dt) {
        f.skT = (f.skT || 0) + dt;
        const fast = Math.abs(f.root.vx) > 240 || (f.action && f.action.move.kind !== 'throw') || f.cele;
        if (fast && f.skT > 0.07) { f.skT = 0; G.ghost(f, Math.random() < 0.5 ? '#ff4fd8' : '#4fd8ff', 0.22); }
        if (Math.random() < dt * 5) { const h = f.pts[P.FHAND]; G.fx.add({ x: h.x, y: h.y, vx: rand(-80, 80), vy: rand(-120, -20), life: 0.3, size: 2.2, color: Math.random() < 0.5 ? '#ff4fd8' : '#4fd8ff' }); }
      },
      draw(ctx, f, time) {
        // LED strips along the limbs, flickering on the beat
        const p = f.pts, s = f.s;
        const lines = [[P.NECK, P.PELVIS], [P.NECK, P.FELB, P.FHAND], [P.NECK, P.BELB, P.BHAND], [P.PELVIS, P.FKNEE, P.FFOOT], [P.PELVIS, P.BKNEE, P.BFOOT]];
        const beat = 0.75 + 0.25 * Math.sin(time * 9.4);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        lines.forEach((L, k) => {
          const col = k % 2 ? '#4fd8ff' : '#ff4fd8';
          ctx.strokeStyle = col; ctx.globalAlpha = 0.35 * beat; ctx.lineWidth = 7 * s / 2;
          ctx.beginPath(); L.forEach((i, j) => (j ? ctx.lineTo(p[i].x, p[i].y) : ctx.moveTo(p[i].x, p[i].y))); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.85 * beat; ctx.lineWidth = 1.6 * s / 2;
          ctx.beginPath(); L.forEach((i, j) => (j ? ctx.lineTo(p[i].x, p[i].y) : ctx.moveTo(p[i].x, p[i].y))); ctx.stroke();
        });
        // a visor light across the face
        const hd = p[P.HEAD], hr = HEAD_R * s;
        ctx.globalAlpha = beat; ctx.fillStyle = '#4fd8ff';
        ctx.fillRect(hd.x + f.facing * hr * 0.05 - (f.facing > 0 ? 0 : hr * 0.9), hd.y - hr * 0.2, hr * 0.9, 2.2 * s / 2 * 1.4);
        ctx.restore();
      },
    },
  };

  // look: wardrobe overrides (see fighters.js); color / aura: the accent; fx: the theme; cele: the victory routine
  const LIST = {
    kaze_sakura:   { fighter: 'kaze', ev: 'sakura', fx: 'sakura', name: 'BLOSSOM GI', color: '#ff6fb5', aura: '#ffd1e6', look: { top: '#ffe6f0', topKind: 'gi', sleeve: 'short', pants: '#b8406e', belt: '#ffffff', capeC: '#ff8fc8', cele: 'flip' } },
    mugi_kimono:   { fighter: 'mugi', ev: 'sakura', fx: 'sakura', name: 'FESTIVAL YUKATA', aura: '#ffd1e6', look: { top: '#fff0f6', topKind: 'robe', sleeve: 'long', wideSleeve: true, sash: true, trim: '#ff4fa3', pants: '#ff8fc8', pantsKind: 'robe', bareShoulder: false, boots: '#ffffff', cele: 'aura' } },
    homura_blossom:{ fighter: 'homura', ev: 'sakura', fx: 'sakura', name: 'BLOSSOM HAORI', color: '#ff6fb5', aura: '#ffd1e6', look: { top: '#ffc2dc', trim: '#ffffff', pants: '#5a2440', belt: '#ffd1e6', cele: 'flip' } },
    ryo_snow:      { fighter: 'ryo', ev: 'frost', fx: 'frost', name: 'SNOW SHINOBI', color: '#7fd8ff', aura: '#e6fbff', look: { top: '#e9f2fb', maskC: '#e9f2fb', pants: '#cfdcea', hairC: '#dfe9f5', shinWrap: '#7fb6ff', cape: true, capeC: '#bfe6ff', cele: 'aura' } },
    aoi_frost:     { fighter: 'aoi', ev: 'frost', fx: 'frost', name: 'GLACIER ROBE', color: '#6fd0ff', aura: '#e6fbff', look: { hoodC: '#bfe6ff', top: '#dff4ff', pants: '#9fd0f0', trim: '#ffffff', cele: 'aura' } },
    titan_yeti:    { fighter: 'titan', ev: 'frost', fx: 'frost', name: 'MOUNTAIN YETI', color: '#9fd0f0', aura: '#e6fbff', look: { hairC: '#f2f6fb', pants: '#7f9cc4', belt: '#dff4ff', wraps: '#ffffff', trim: '#bfe6ff', cele: 'roar' } },
    jin_neon:      { fighter: 'jin', ev: 'neon', fx: 'neon', name: 'NEON REAPER', color: '#ff4fd8', aura: '#4fd8ff', look: { hoodC: '#14141c', top: '#14141c', coat: '#14141c', trim: '#ff4fd8', pants: '#0d0d14', boots: '#0d0d14', cele: 'aura' } },
    kohei_synth:   { fighter: 'kohei', ev: 'neon', fx: 'neon', name: 'SYNTHWAVE', color: '#4fd8ff', aura: '#ff4fd8', look: { top: '#1a1030', pants: '#ff4fd8', hairC: '#4fd8ff', glove: '#4fd8ff', cele: 'wave' } },
    saibo_chrome:  { fighter: 'saibo', ev: 'neon', fx: 'neon', name: 'CHROME CAPE', color: '#ff4fd8', aura: '#4fd8ff', look: { top: '#2a2a36', pants: '#1c1c28', boots: '#4fd8ff', trim: '#ff4fd8', capeC: '#ff4fd8', cele: 'pump' } },
  };
  for (const id in LIST) LIST[id].id = id;
  const st = () => { const d = Save.data; if (!d.skins || typeof d.skins !== 'object') d.skins = { owned: [], equip: {} }; return d.skins; };
  const owned = id => st().owned.includes(id);
  const forFighter = fid => Object.values(LIST).filter(s => s.fighter === fid);
  function grant(id) { const s = st(); if (!LIST[id] || s.owned.includes(id)) return false; s.owned.push(id); Save.save(); return true; }
  // the equipped skin (only if owned); null = the default outfit
  function equipped(fid) { const e = st().equip[fid]; return e && owned(e) && LIST[e] && LIST[e].fighter === fid ? e : null; }
  function equip(fid, id) { const s = st(); if (id && (!owned(id) || LIST[id].fighter !== fid)) return false; if (id) s.equip[fid] = id; else delete s.equip[fid]; Save.save(); return true; }
  // a fighter definition wearing a skin: the moves and everything else come
  // from the original through the prototype; the look, accent and effects change
  const cache = {};
  function def(fid, id) {
    const base = BY_ID[fid];
    if (!base || !id || !LIST[id] || LIST[id].fighter !== fid) return base;
    if (cache[id]) return cache[id];
    const S = LIST[id], T = THEMES[S.fx];
    const d = Object.create(base);
    d.look = Object.assign({}, base.look, S.look);
    if (S.color) d.color = S.color;
    if (S.aura) d.aura = S.aura;
    if (T) { d.skinTick = T.tick; d.skinDraw = T.draw; d.skinHit = T.hit; }
    d.skin = id;
    return (cache[id] = d);
  }
  return { LIST, THEMES, owned, forFighter, grant, equipped, equip, def };
})();

const Events = (() => {
  // one event runs 35 days, a month and a bit; the name WEEK is kept for the period
  const DAY = 86400000, WEEK = 35 * DAY;
  const EPOCH = Date.UTC(2026, 10, 16);   // a Monday, 00:00 UTC: events turn over every Monday
  const LIST = [
    { id: 'sakura', name: 'SAKURA FESTIVAL', tag: 'Petals fall on the shrine. Dance through the festival all month.', stage: 'temple', fighter: 'hana',
      col: '#ff6fb5', col2: '#ffd1e6', ink: '#3a1024', token: 'PETALS', tokenIcon: 'spiritbloom', skins: ['kaze_sakura', 'mugi_kimono', 'homura_blossom'] },
    { id: 'frost', name: 'FROST MOON', tag: 'An endless winter falls on the peak. Hold out under the frozen moon all month.', stage: 'snow', fighter: 'kori',
      col: '#6fd0ff', col2: '#e6fbff', ink: '#0c2238', token: 'SNOWFLAKES', tokenIcon: 'snow', skins: ['ryo_snow', 'aoi_frost', 'titan_yeti'] },
    { id: 'neon', name: 'NEON NIGHTS', tag: 'The rooftop turns into a rave. Fight to the beat all month long.', stage: 'city', fighter: 'rave',
      col: '#ff4fd8', col2: '#4fd8ff', ink: '#220a2e', token: 'NEON CHIPS', tokenIcon: 'bolt', skins: ['jin_neon', 'kohei_synth', 'saibo_chrome'] },
  ];
  const BY = Object.fromEntries(LIST.map(E => [E.id, E]));
  // the reward track: token totals and what each tier pays
  const TRACK = [
    { at: 100, kind: 'coins', n: 200 },
    { at: 300, kind: 'skin', i: 0 },
    { at: 550, kind: 'coins', n: 350 },
    { at: 850, kind: 'skin', i: 1 },
    { at: 1200, kind: 'coins', n: 500 },
    { at: 1600, kind: 'skin', i: 2 },
    { at: 2100, kind: 'fighter' },
  ];
  const MAX = TRACK[TRACK.length - 1].at;
  let offset = 0;   // tests move the clock
  const now = () => Date.now() + offset;
  const weekAt = t => Math.floor((t - EPOCH) / WEEK);
  const evFor = wk => LIST[((wk % LIST.length) + LIST.length) % LIST.length];
  function current() {
    const wk = weekAt(now()), E = evFor(wk);
    return Object.assign({ week: wk, key: E.id + '#' + wk, start: EPOCH + wk * WEEK, end: EPOCH + (wk + 1) * WEEK }, E);
  }
  function next() {
    const wk = weekAt(now()) + 1, E = evFor(wk);
    return Object.assign({ week: wk, start: EPOCH + wk * WEEK }, E);
  }
  // when an event (by id) next runs; 0 if it is running now
  function nextStart(id) {
    const wk = weekAt(now());
    for (let k = 0; k <= LIST.length; k++) if (evFor(wk + k).id === id) return k === 0 ? 0 : EPOCH + (wk + k) * WEEK;
    return 0;
  }
  const left = t => Math.max(0, t - now());
  function fmtLeft(ms) {
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d > 0 ? `${d}D ${h}H` : h > 0 ? `${h}H ${m % 60}M` : `${Math.max(1, m % 60)}M`;
  }

  /* ------------------------------------------------------------- state */
  const CHALLENGES = E => [
    { id: 'battle', ev: 'eventwin', goal: 10, pay: 150, icon: 'trophy', text: 'Win 10 Event Battles' },
    { id: 'wins', ev: 'win', goal: 25, pay: 150, icon: 'fist', text: 'Win 25 fights in any mode' },
    { id: 'fin', ev: 'finisher', goal: 40, pay: 120, icon: 'burst', text: 'Land 40 combo finishers' },
    { id: 'sup', ev: 'super', goal: 15, pay: 120, icon: 'star', text: 'Unleash 15 supers' },
    { id: 'stage', ev: 'stagewin', goal: 10, pay: 160, icon: 'map', text: `Win 10 fights on ${(STAGES[E.stage] || { name: 'the event stage' }).name}` },
  ];
  function state() {
    const E = current(), d = Save.data;
    if (!d.event || d.event.key !== E.key) {
      // a new event: progress starts fresh (skins and fighters you earned stay yours)
      const lastCheck = d.event ? d.event.checkin : '', streak = d.event ? d.event.streak : 0;
      d.event = { key: E.key, tokens: 0, claimed: [], ch: {}, chClaimed: [], checkin: lastCheck || '', streak: streak || 0, battles: 0 };
      Save.save();
    }
    return d.event;
  }
  const today = () => new Date(now()).toISOString().slice(0, 10);
  const yesterday = () => new Date(now() - DAY).toISOString().slice(0, 10);

  function addTokens(n) {
    const s = state(), before = reachable();
    s.tokens = Math.max(0, Math.round(s.tokens + n));
    Save.save();
    return reachable() > before;   // a new reward is ready to claim
  }
  // tokens for one fight (Levels, Ascent, Survival; Event Battles pay double)
  function fightTokens(res, battle) {
    const base = (res.winner === 0 ? 12 : 4) + (res.stats.finishers || 0) * 3 + Math.min(6, Math.floor((res.stats.maxCombo || 0) / 2));
    return Math.min(30, base) * (battle ? 2 : 1);
  }
  const reachable = () => { const s = state(); return TRACK.filter((T, i) => s.tokens >= T.at && !s.claimed.includes(i)).length; };

  // what a tier gives, as data for the UI
  function reward(i) {
    const E = current(), T = TRACK[i];
    if (T.kind === 'coins') return { kind: 'coins', n: T.n, name: `${T.n} COINS` };
    if (T.kind === 'skin') { const S = Skins.LIST[E.skins[T.i]]; return { kind: 'skin', id: S.id, skin: S, name: S.name, fighter: S.fighter }; }
    const owned = Save.owned(E.fighter);
    return { kind: 'fighter', id: E.fighter, name: BY_ID[E.fighter].name, already: owned, n: owned ? 1000 : 0 };
  }
  function claim(i) {
    const s = state(), T = TRACK[i];
    if (!T || s.claimed.includes(i) || s.tokens < T.at) return null;
    const R = reward(i);
    if (R.kind === 'coins') Save.addCoins(R.n);
    else if (R.kind === 'skin') { Skins.grant(R.id); Skins.equip(R.fighter, R.id); }
    else if (R.already) Save.addCoins(R.n);
    else Save.unlock(R.id);
    s.claimed.push(i); Save.save();
    return R;
  }

  /* -------------------------------------------------------- challenges */
  function challenges() {
    const E = current(), s = state();
    return CHALLENGES(E).map(C => Object.assign({ n: Math.min(C.goal, s.ch[C.id] || 0), claimed: s.chClaimed.includes(C.id) }, C));
  }
  // count an event: returns the challenges it just completed
  function track(ev, amt = 1, ctx = {}) {
    const s = state(), done = [];
    let changed = false;
    for (const C of challenges()) {
      if (C.ev !== ev || C.n >= C.goal) continue;
      if (ev === 'stagewin' && ctx.stage !== current().stage) continue;
      s.ch[C.id] = Math.min(C.goal, (s.ch[C.id] || 0) + amt); changed = true;
      if (s.ch[C.id] >= C.goal) done.push(C);
    }
    if (changed) Save.save();
    return done;
  }
  function claimChallenge(id) {
    const s = state(), C = challenges().find(c => c.id === id);
    if (!C || C.claimed || C.n < C.goal) return 0;
    s.chClaimed.push(id); s.tokens += C.pay; Save.save();
    return C.pay;
  }

  /* ---------------------------------------------------------- check-in */
  const checkinReady = () => state().checkin !== today();
  const checkinPay = streak => 20 + 5 * Math.min(Math.max(0, streak - 1), 6);
  function checkIn() {
    const s = state();
    if (s.checkin === today()) return 0;
    s.streak = s.checkin === yesterday() ? (s.streak || 0) + 1 : 1;
    s.checkin = today();
    const pay = checkinPay(s.streak);
    s.tokens += pay; Save.save();
    return pay;
  }
  // something waiting on the event screen: a reward, a challenge or the check-in
  const pending = () => reachable() + challenges().filter(c => c.n >= c.goal && !c.claimed).length + (checkinReady() ? 1 : 0);

  /* ------------------------------------------------------ event battles */
  // the next Event Battle: every third is against the exclusive fighter
  function battle(playerId) {
    const E = current(), s = state();
    const boss = s.battles % 3 === 2;
    let foe = E.fighter, skin = null;
    if (!boss || foe === playerId) {
      const skinned = E.skins.map(id => Skins.LIST[id]).filter(S => S.fighter !== playerId);
      const pool = ROSTER.filter(f => f.id !== playerId && f.id !== E.fighter && !f.eventOnly);
      if (skinned.length && Math.random() < 0.7) { const S = skinned[Math.floor(Math.random() * skinned.length)]; foe = S.fighter; skin = S.id; }
      else foe = pool[Math.floor(Math.random() * pool.length)].id;
    }
    return { foe, skin, boss: boss && foe === E.fighter, lv: Math.min(8, 2 + s.battles), stage: E.stage };
  }
  function battleDone(won) { const s = state(); s.battles++; Save.save(); return won ? track('eventwin') : []; }

  return {
    LIST, BY, TRACK, MAX, current, next, nextStart, left, fmtLeft, state, addTokens, fightTokens, reachable, reward, claim,
    challenges, track, claimChallenge, checkinReady, checkinPay, checkIn, pending, battle, battleDone,
    set _offset(ms) { offset = ms; }, get _offset() { return offset; },
  };
})();
