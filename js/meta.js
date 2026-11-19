'use strict';
/* =========================================================================
   Meta-progression: fighter upgrades, Ascent cards and training trials.
   Everything here produces one plain "mods" object per fighter, which the
   fight reads through Rag.mods. Upgrades are permanent and bought with
   coins; cards last for one Ascent run.
   ========================================================================= */

const Meta = (() => {
  /* ------------------------------------------------------------ upgrades */
  const UPGRADES = [
    { id: 'pow', name: 'POWER', icon: 'fist', desc: n => `+${n * 4}% damage`, apply: (m, n) => { m.dmg *= 1 + n * 0.04; } },
    { id: 'vit', name: 'VITALITY', icon: 'heart', desc: n => `+${n * 6}% health`, apply: (m, n) => { m.hp *= 1 + n * 0.06; } },
    { id: 'foc', name: 'FOCUS', icon: 'burst', desc: n => `+${n * 8}% super meter gain`, apply: (m, n) => { m.meter *= 1 + n * 0.08; } },
    { id: 'rec', name: 'RECOVERY', icon: 'clock', desc: n => `-${n * 6}% special cooldowns`, apply: (m, n) => { m.cd *= 1 - n * 0.06; } },
  ];
  const MAX_RANK = 5;
  const COST = [60, 140, 240, 360, 500];

  const ranks = id => {
    const u = (Save.data.upg || {})[id] || {};
    const out = {};
    for (const U of UPGRADES) out[U.id] = clamp(Math.floor(u[U.id] || 0), 0, MAX_RANK);
    return out;
  };
  const totalRank = id => Object.values(ranks(id)).reduce((a, b) => a + b, 0);
  const nextCost = (id, stat) => { const r = ranks(id)[stat]; return r >= MAX_RANK ? null : COST[r]; };
  function buyRank(id, stat) {
    const cost = nextCost(id, stat);
    if (cost == null || Save.data.coins < cost || !Save.owned(id)) return false;
    Save.data.coins -= cost;
    Save.data.upg = Save.data.upg || {};
    const u = Save.data.upg[id] = Save.data.upg[id] || {};
    u[stat] = (u[stat] || 0) + 1;
    Save.save();
    return true;
  }

  /* --------------------------------------------------------------- cards
     Ascent rewards: after every floor you pick 1 of 3 cards, run-only powers.
     Each has a rarity; rarer cards are stronger, stranger and drawn less
     often. max: how many copies can stack in one run. now(run): an instant
     effect when picked (healing). Fight effects go through the mods object. */
  const RARITY = {
    common: { name: 'COMMON', col: '#a9b3c6', pips: 1, w: 58 },
    rare: { name: 'RARE', col: '#4fa8ff', pips: 2, w: 28 },
    epic: { name: 'EPIC', col: '#c45bff', pips: 3, w: 11 },
    legendary: { name: 'LEGENDARY', col: '#ffc53d', pips: 4, w: 3 },
  };
  const CARDS = [
    // common: solid, simple numbers
    { id: 'berserk', tag: 'POWER', rar: 'common', name: 'BERSERKER', icon: 'fist', col: '#ff6b5a', max: 3, desc: '+12% damage.', apply: m => { m.dmg *= 1.12; } },
    { id: 'iron', tag: 'DEFENCE', rar: 'common', name: 'IRON SKIN', icon: 'shield', col: '#9fb3d9', max: 3, desc: 'Take 10% less damage.', apply: m => { m.taken *= 0.9; } },
    { id: 'charge', tag: 'METER', rar: 'common', name: 'OVERCHARGE', icon: 'burst', col: '#ffd34d', max: 2, desc: '+30% super meter gain.', apply: m => { m.meter *= 1.3; } },
    { id: 'quick', tag: 'SPEED', rar: 'common', name: 'QUICK HANDS', icon: 'clock', col: '#7fd4ff', max: 2, desc: 'Specials recharge 20% faster.', apply: m => { m.cd *= 0.8; } },
    { id: 'fleet', tag: 'SPEED', rar: 'common', name: 'FLEET', icon: 'haste', col: '#b4ff3d', max: 2, desc: 'Walk 12% faster.', apply: m => { m.speed *= 1.12; } },
    { id: 'aid', tag: 'HEAL', rar: 'common', name: 'FIRST AID', icon: 'heal', col: '#45e08a', max: 9, desc: 'Heal 35% of your health right now.', now: r => { r.hp = Math.min(1, r.hp + 0.35); } },
    { id: 'purse', tag: 'COINS', rar: 'common', name: 'POCKET CHANGE', icon: 'coins', col: '#ffd34d', max: 2, desc: '+40% coins from every floor.', now: r => { r.coinMul = (r.coinMul || 1) + 0.4; } },
    // rare: a twist on how you fight
    { id: 'vamp', tag: 'HEAL', rar: 'rare', name: 'VAMPIRIC', icon: 'heart', col: '#ff4f7a', max: 2, desc: 'Heal 6% of the damage you deal.', apply: m => { m.lifesteal += 0.06; } },
    { id: 'regen', tag: 'HEAL', rar: 'rare', name: 'REGENERATION', icon: 'spiritbloom', col: '#45e08a', max: 2, desc: 'Slowly regain health while you fight.', apply: m => { m.regen += 0.006; } },
    { id: 'spark', tag: 'POWER', rar: 'rare', name: 'BLACK SPARKS', icon: 'bolt', col: '#ff2c4a', max: 2, desc: '+10% Black Spark chance on heavies.', apply: m => { m.bf += 0.1; } },
    { id: 'guard', tag: 'DEFENCE', rar: 'rare', name: 'IRON GUARD', icon: 'shieldUi', col: '#8fd6ff', max: 1, desc: 'No chip damage; guard drains 40% slower.', apply: m => { m.chipImmune = true; m.guard *= 0.6; } },
    { id: 'primed', tag: 'METER', rar: 'rare', name: 'PRIMED', icon: 'star', col: '#ffb13d', max: 1, desc: 'Start every floor with half a super.', apply: m => { m.startMeter = Math.max(m.startMeter, 50); } },
    { id: 'thorns', tag: 'DEFENCE', rar: 'rare', name: 'THORNS', icon: 'thorns', col: '#a06bff', max: 1, desc: 'Foes take damage when you block them.', apply: m => { m.thorns += 20; } },
    { id: 'adren', tag: 'POWER', rar: 'rare', name: 'ADRENALINE', icon: 'flame', col: '#ff6a3d', max: 1, desc: '+35% damage while below 35% health.', apply: m => { m.adren += 0.35; } },
    { id: 'feather', tag: 'GIMMICK', rar: 'rare', name: 'FEATHERWEIGHT', icon: 'feathers', col: '#e9f4ff', max: 1, desc: 'Jump 25% higher and float back down.', apply: m => { m.jump *= 1.25; m.fall *= 0.55; } },
    // epic: changes the shape of a fight
    { id: 'wind', tag: 'SURVIVAL', rar: 'epic', name: 'SECOND WIND', icon: 'up', col: '#45e08a', max: 1, desc: 'Once per floor, survive a knockout blow.', apply: m => { m.secondWind += 1; } },
    { id: 'glass', tag: 'POWER', rar: 'epic', name: 'GLASS CANNON', icon: 'glass', col: '#9ff4ff', max: 1, desc: '+50% damage, but take 30% more.', apply: m => { m.dmg *= 1.5; m.taken *= 1.3; } },
    { id: 'momentum', tag: 'COMBO', rar: 'epic', name: 'MOMENTUM', icon: 'dash', col: '#ff9a3d', max: 1, desc: 'Every hit in a combo adds 5% damage, up to +50%.', apply: m => { m.momentum += 0.05; } },
    { id: 'after', tag: 'COMBO', rar: 'epic', name: 'AFTERSHOCK', icon: 'quake', col: '#ffcf6a', max: 1, desc: 'Heavies and finishers echo with a second shockwave.', apply: m => { m.after += 0.4; } },
    { id: 'echo', tag: 'METER', rar: 'epic', name: 'DOUBLE TAP', icon: 'rewind', col: '#7fb6ff', max: 1, desc: 'Your super refunds 40% of the meter.', apply: m => { m.superRefund = Math.max(m.superRefund, 40); } },
    // legendary: run-defining, loud
    { id: 'phoenix', tag: 'SURVIVAL', rar: 'legendary', name: 'PHOENIX', icon: 'firebird', col: '#ff8a3d', max: 1, desc: 'Once per run, rise from a knockout with 60% health in a burst of fire.', apply: m => { m.phoenix += 1; } },
    { id: 'midas', tag: 'COINS', rar: 'legendary', name: 'MIDAS TOUCH', icon: 'goldtouch', col: '#ffd34d', max: 1, desc: 'Every hit you land throws out a coin, and floor rewards double.', apply: m => { m.midas = 1; }, now: r => { r.coinMul = (r.coinMul || 1) + 1; } },
    { id: 'giant', tag: 'GIMMICK', rar: 'legendary', name: 'GIANT FORM', icon: 'crush', col: '#ffb13d', max: 1, desc: 'Grow 25% bigger: +30% health and damage, a little slower.', apply: m => { m.scale *= 1.25; m.hp *= 1.3; m.dmg *= 1.3; m.speed *= 0.92; } },
    { id: 'storm', tag: 'COMBO', rar: 'legendary', name: 'CHAIN LIGHTNING', icon: 'storm', col: '#8fe8ff', max: 1, desc: 'Every 4th hit of a combo calls down lightning.', apply: m => { m.storm = 1; } },
    { id: 'infinite', tag: 'METER', rar: 'legendary', name: 'INFINITE KI', icon: 'infinity', col: '#ff5ad6', max: 1, desc: 'Your super meter fills on its own.', apply: m => { m.kiRegen += 5; } },
  ];
  const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));
  // three different cards the run can still take, drawn by rarity weight.
  // Deeper floors and boss rewards tilt the odds toward rarer cards.
  function offer(owned, opt = {}, rnd = Math.random) {
    const fl = opt.floor || 1, boss = !!opt.boss;
    const w = c => {
      const R = RARITY[c.rar];
      let k = R.w;
      if (c.rar === 'legendary') k += fl * 0.35 + (boss ? 12 : 0);
      if (c.rar === 'epic') k += fl * 0.4 + (boss ? 10 : 0);
      if (boss && c.rar === 'common') k *= 0.25;
      return k;
    };
    const pool = CARDS.filter(c => (owned[c.id] || 0) < c.max);
    const out = [];
    while (out.length < 3 && pool.length) {
      const tot = pool.reduce((a, c) => a + w(c), 0);
      let x = rnd() * tot, i = 0;
      while (i < pool.length - 1 && (x -= w(pool[i])) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  /* ---------------------------------------------------------------- mods */
  const base = () => ({ dmg: 1, taken: 1, meter: 1, cd: 1, speed: 1, hp: 1, bf: 0, lifesteal: 0, exec: 0, guard: 1, chipImmune: false, secondWind: 0, thorns: 0, startMeter: 0,
    regen: 0, adren: 0, jump: 1, fall: 1, momentum: 0, after: 0, superRefund: 0, phoenix: 0, midas: 0, scale: 1, storm: 0, kiRegen: 0 });
  // the mods a fighter brings into a fight: upgrades (if allowed) and cards
  function modsFor(id, opt = {}) {
    const m = base();
    if (opt.upgrades) { const r = ranks(id); for (const U of UPGRADES) if (r[U.id]) U.apply(m, r[U.id]); }
    for (const [cid, n] of Object.entries(opt.cards || {})) for (let k = 0; k < n; k++) if (CARD[cid] && CARD[cid].apply) CARD[cid].apply(m);
    return m;
  }

  /* -------------------------------------------------------------- trials */
  // each check sees one landed hit: (att, def, spec, combo) and returns true when cleared
  const TRIALS = [
    { id: 'ender', name: 'FINISHER', desc: 'Land your combo finisher: light, light, heavy.', check: h => h.key === 'hEnd' },
    { id: 'cancel', name: 'CANCEL', desc: 'Cancel a light or heavy that hits into a special.', check: h => h.kind === 'special' && h.combo >= 2 && h.usedNormal },
    { id: 'air', name: 'AIR COMBO', desc: 'Launch a foe, then hit them in the air with an air heavy.', check: h => h.key === 'airH' && h.juggled },
    { id: 'five', name: '5 HITS', desc: 'Land a combo of 5 hits or more.', check: h => h.combo >= 5 },
    { id: 'super', name: 'SUPER COMBO', desc: 'Land your super as part of a combo.', check: h => h.kind === 'super' && h.combo >= 2 },
  ];
  const TRIAL_PAY = 40;
  const trialsDone = id => ((Save.data.trials || {})[id] || []);
  function clearTrial(id, tid) {
    Save.data.trials = Save.data.trials || {};
    const list = Save.data.trials[id] = Save.data.trials[id] || [];
    if (list.includes(tid)) return false;
    list.push(tid); Save.addCoins(TRIAL_PAY); Save.save();
    return true;
  }

  /* ------------------------------------------------------------ missions
     Three daily goals, fresh every day, each paying coins, plus a bonus for
     clearing all three. Events come from fights and menus through track(). */
  const MISSION_POOL = [
    { id: 'win', ev: 'win', goal: 3, pay: 80, icon: 'trophy', text: n => `Win ${n} fights` },
    { id: 'fin', ev: 'finisher', goal: 5, pay: 70, icon: 'burst', text: n => `Land ${n} combo finishers` },
    { id: 'sup', ev: 'super', goal: 3, pay: 80, icon: 'star', text: n => `Unleash ${n} supers` },
    { id: 'bf', ev: 'bf', goal: 2, pay: 90, icon: 'bolt', text: n => `Trigger ${n} Black Sparks` },
    { id: 'c6', ev: 'combo6', goal: 2, pay: 80, icon: 'swords', text: n => `Land ${n} combos of 6+ hits` },
    { id: 'floor', ev: 'floor', goal: 4, pay: 110, icon: 'up', text: n => `Clear ${n} Ascent floors` },
    { id: 'lvl', ev: 'level', goal: 3, pay: 80, icon: 'map', text: n => `Clear ${n} levels` },
    { id: 'blk', ev: 'block', goal: 15, pay: 60, icon: 'shield', text: n => `Block ${n} attacks` },
    { id: 'rare', ev: 'card', goal: 1, pay: 70, icon: 'cards', text: () => 'Pick a rare or better card in Ascent' },
    { id: 'streak', ev: 'streak', goal: 3, pay: 100, icon: 'infinity', max: true, text: n => `Reach a Survival streak of ${n}` },
    { id: 'with', ev: 'winwith', goal: 2, pay: 90, icon: 'user', text: (n, m) => `Win ${n} fights with ${(BY_ID[m.fid] || { name: 'your fighter' }).name}` },
  ];
  const MDEF = Object.fromEntries(MISSION_POOL.map(M => [M.id, M]));
  const MISSION_BONUS = 150;
  function missions() {
    const d = Save.data, today = Save.today();
    if (!d.missions || d.missions.day !== today) {
      const pool = MISSION_POOL.slice(), list = [];
      while (list.length < 3 && pool.length) {
        const M = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const m = { id: M.id, n: 0, goal: M.goal, pay: M.pay, claimed: false };
        if (M.id === 'with') m.fid = d.unlocked[Math.floor(Math.random() * d.unlocked.length)] || 'kaze';
        list.push(m);
      }
      d.missions = { day: today, list, bonus: false };
      Save.save();
    }
    return d.missions;
  }
  const missionDef = m => MDEF[m.id];
  const missionText = m => (MDEF[m.id] ? MDEF[m.id].text(m.goal, m) : '');
  // count an event toward today's missions; returns the ones it just completed
  function track(ev, amt = 1, ctx = {}) {
    const ms = missions(), done = [];
    let changed = false;
    for (const m of ms.list) {
      const M = MDEF[m.id];
      if (!M || m.n >= m.goal) continue;
      if (M.ev === 'winwith') { if (ev !== 'win' || ctx.fid !== m.fid) continue; }
      else if (M.ev !== ev) continue;
      const n0 = m.n;
      m.n = M.max ? Math.max(m.n, Math.min(m.goal, amt)) : Math.min(m.goal, m.n + amt);
      if (m.n !== n0) changed = true;
      if (m.n >= m.goal) done.push(m);
    }
    if (changed) Save.save();
    return done;
  }
  function claimMission(i) {
    const m = missions().list[i];
    if (!m || m.claimed || m.n < m.goal) return 0;
    m.claimed = true; Save.addCoins(m.pay); Save.save();
    return m.pay;
  }
  function claimBonus() {
    const ms = missions();
    if (ms.bonus || !ms.list.every(m => m.claimed)) return 0;
    ms.bonus = true; Save.addCoins(MISSION_BONUS); Save.save();
    return MISSION_BONUS;
  }
  const claimable = () => { const ms = missions(); return ms.list.filter(m => m.n >= m.goal && !m.claimed).length + (!ms.bonus && ms.list.every(m => m.claimed) ? 1 : 0); };

  /* ------------------------------------------------------------- mastery
     Every fighter levels up as you play them (1 to 20). Each level pays
     coins; every fifth level earns a title. */
  const MASTERY_MAX = 20;
  const xpNeed = L => 60 + 40 * L;
  function mastery(id) {
    let xp = (Save.data.mxp || {})[id] || 0, L = 1;
    while (L < MASTERY_MAX && xp >= xpNeed(L)) { xp -= xpNeed(L); L++; }
    return { lv: L, xp, need: L >= MASTERY_MAX ? 0 : xpNeed(L), max: L >= MASTERY_MAX };
  }
  const TITLES = [[20, 'GRANDMASTER'], [15, 'MASTER'], [10, 'EXPERT'], [5, 'ADEPT'], [1, 'NOVICE']];
  const masteryTitle = lv => TITLES.find(([l]) => lv >= l)[1];
  const levelPay = L => 25 + L * 10;
  function addXp(id, n) {
    Save.data.mxp = Save.data.mxp || {};
    const from = mastery(id).lv;
    Save.data.mxp[id] = (Save.data.mxp[id] || 0) + Math.max(0, Math.round(n));
    const m = mastery(id);
    let coins = 0;
    for (let L = from + 1; L <= m.lv; L++) coins += levelPay(L);
    if (coins) Save.addCoins(coins);
    Save.save();
    return { gain: Math.round(n), from, to: m.lv, coins, m };
  }

  return { UPGRADES, MAX_RANK, COST, ranks, totalRank, nextCost, buyRank, RARITY, CARDS, CARD, offer, base, modsFor,
    missions, missionDef, missionText, track, claimMission, claimBonus, claimable, MISSION_BONUS,
    MASTERY_MAX, mastery, masteryTitle, addXp, levelPay, TRIALS, TRIAL_PAY, trialsDone, clearTrial };
})();
