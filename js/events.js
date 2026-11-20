'use strict';
/* =========================================================================
   Events: a new limited-time event every week, rotating through three.
   Each event has its own token, a reward track (coins, three skins and an
   EXCLUSIVE fighter at the top), five challenges, a daily check-in with a
   streak bonus, and Event Battles on its stage for double tokens.
   An exclusive fighter can only be earned in its event; missed ones return
   when the rotation comes back around (every three weeks).
   Skins are cosmetic outfits for existing fighters, equipped in FIGHTERS.
   ========================================================================= */

const Skins = (() => {
  // look: wardrobe overrides (see fighters.js); color / aura: the accent
  const LIST = {
    kaze_sakura:   { fighter: 'kaze', ev: 'sakura', name: 'BLOSSOM GI', color: '#ff6fb5', look: { top: '#ffd9ea', topKind: 'gi', sleeve: 'short', pants: '#b8406e' } },
    mugi_kimono:   { fighter: 'mugi', ev: 'sakura', name: 'FESTIVAL YUKATA', look: { top: '#fff0f6', topKind: 'robe', sleeve: 'long', wideSleeve: true, sash: true, trim: '#ff4fa3', pants: '#ff8fc8', pantsKind: 'robe', bareShoulder: false } },
    homura_blossom:{ fighter: 'homura', ev: 'sakura', name: 'BLOSSOM HAORI', color: '#ff6fb5', look: { top: '#ffc2dc', trim: '#ffffff', pants: '#5a2440' } },
    ryo_snow:      { fighter: 'ryo', ev: 'frost', name: 'SNOW SHINOBI', color: '#7fd8ff', look: { top: '#e9f2fb', maskC: '#e9f2fb', pants: '#cfdcea', hairC: '#dfe9f5', shinWrap: '#7fb6ff' } },
    aoi_frost:     { fighter: 'aoi', ev: 'frost', name: 'GLACIER ROBE', color: '#6fd0ff', aura: '#e6fbff', look: { hoodC: '#bfe6ff', top: '#dff4ff', pants: '#9fd0f0', trim: '#ffffff' } },
    titan_yeti:    { fighter: 'titan', ev: 'frost', name: 'MOUNTAIN YETI', color: '#9fd0f0', look: { hairC: '#f2f6fb', pants: '#7f9cc4', belt: '#dff4ff', wraps: '#ffffff', trim: '#bfe6ff' } },
    jin_neon:      { fighter: 'jin', ev: 'neon', name: 'NEON REAPER', color: '#ff4fd8', aura: '#4fd8ff', look: { hoodC: '#14141c', top: '#14141c', coat: '#14141c', trim: '#ff4fd8', pants: '#0d0d14' } },
    kohei_synth:   { fighter: 'kohei', ev: 'neon', name: 'SYNTHWAVE', color: '#4fd8ff', look: { top: '#1a1030', pants: '#ff4fd8', hairC: '#4fd8ff', glove: '#4fd8ff' } },
    saibo_chrome:  { fighter: 'saibo', ev: 'neon', name: 'CHROME CAPE', color: '#ff4fd8', look: { top: '#2a2a36', pants: '#1c1c28', boots: '#4fd8ff', trim: '#ff4fd8' } },
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
  // from the original through the prototype; only the look and accent change
  const cache = {};
  function def(fid, id) {
    const base = BY_ID[fid];
    if (!base || !id || !LIST[id] || LIST[id].fighter !== fid) return base;
    if (cache[id]) return cache[id];
    const S = LIST[id];
    const d = Object.create(base);
    d.look = Object.assign({}, base.look, S.look);
    if (S.color) d.color = S.color;
    if (S.aura) d.aura = S.aura;
    d.skin = id;
    return (cache[id] = d);
  }
  return { LIST, owned, forFighter, grant, equipped, equip, def };
})();

const Events = (() => {
  const DAY = 86400000, WEEK = 7 * DAY;
  const EPOCH = Date.UTC(2026, 10, 16);   // a Monday, 00:00 UTC: events turn over every Monday
  const LIST = [
    { id: 'sakura', name: 'SAKURA FESTIVAL', tag: 'Petals fall on the shrine. Dance through the festival for a week.', stage: 'temple', fighter: 'hana',
      col: '#ff6fb5', col2: '#ffd1e6', ink: '#3a1024', token: 'PETALS', tokenIcon: 'spiritbloom', skins: ['kaze_sakura', 'mugi_kimono', 'homura_blossom'] },
    { id: 'frost', name: 'FROST MOON', tag: 'An endless winter falls on the peak. Hold out under the frozen moon.', stage: 'snow', fighter: 'kori',
      col: '#6fd0ff', col2: '#e6fbff', ink: '#0c2238', token: 'SNOWFLAKES', tokenIcon: 'snow', skins: ['ryo_snow', 'aoi_frost', 'titan_yeti'] },
    { id: 'neon', name: 'NEON NIGHTS', tag: 'The rooftop turns into a rave. Fight to the beat until sunrise.', stage: 'city', fighter: 'rave',
      col: '#ff4fd8', col2: '#4fd8ff', ink: '#220a2e', token: 'NEON CHIPS', tokenIcon: 'bolt', skins: ['jin_neon', 'kohei_synth', 'saibo_chrome'] },
  ];
  const BY = Object.fromEntries(LIST.map(E => [E.id, E]));
  // the reward track: token totals and what each tier pays
  const TRACK = [
    { at: 40, kind: 'coins', n: 150 },
    { at: 100, kind: 'skin', i: 0 },
    { at: 180, kind: 'coins', n: 250 },
    { at: 280, kind: 'skin', i: 1 },
    { at: 400, kind: 'coins', n: 400 },
    { at: 540, kind: 'skin', i: 2 },
    { at: 700, kind: 'fighter' },
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
    { id: 'battle', ev: 'eventwin', goal: 3, pay: 60, icon: 'trophy', text: 'Win 3 Event Battles' },
    { id: 'wins', ev: 'win', goal: 8, pay: 60, icon: 'fist', text: 'Win 8 fights in any mode' },
    { id: 'fin', ev: 'finisher', goal: 15, pay: 50, icon: 'burst', text: 'Land 15 combo finishers' },
    { id: 'sup', ev: 'super', goal: 5, pay: 50, icon: 'star', text: 'Unleash 5 supers' },
    { id: 'stage', ev: 'stagewin', goal: 3, pay: 70, icon: 'map', text: `Win 3 fights on ${(STAGES[E.stage] || { name: 'the event stage' }).name}` },
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
