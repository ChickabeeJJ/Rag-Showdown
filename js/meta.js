'use strict';
/* =========================================================================
   Meta-progression: fighter upgrades, Ascent boons and training trials.
   Everything here produces one plain "mods" object per fighter, which the
   fight reads through Rag.mods (see DEFAULT_MODS in rag.js). Upgrades are
   permanent and bought with coins; boons last for one Ascent run.
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

  /* --------------------------------------------------------------- boons */
  // max: how many times a boon can stack in one run
  const BOONS = [
    { id: 'berserk', name: 'BERSERKER', icon: 'fist', col: '#ff6b5a', max: 3, desc: '+15% damage.', apply: m => { m.dmg *= 1.15; } },
    { id: 'iron', name: 'IRON SKIN', icon: 'shield', col: '#9fb3d9', max: 3, desc: 'Take 12% less damage.', apply: m => { m.taken *= 0.88; } },
    { id: 'vamp', name: 'VAMPIRIC', icon: 'heart', col: '#ff4f7a', max: 2, desc: 'Heal 6% of the damage you deal.', apply: m => { m.lifesteal += 0.06; } },
    { id: 'charge', name: 'OVERCHARGE', icon: 'burst', col: '#ffd34d', max: 2, desc: '+30% super meter gain.', apply: m => { m.meter *= 1.3; } },
    { id: 'quick', name: 'QUICK HANDS', icon: 'clock', col: '#7fd4ff', max: 2, desc: 'Specials recharge 25% faster.', apply: m => { m.cd *= 0.75; } },
    { id: 'wind', name: 'SECOND WIND', icon: 'up', col: '#45e08a', max: 1, desc: 'Once per floor, survive a knockout blow.', apply: m => { m.secondWind += 1; } },
    { id: 'spark', name: 'BLACK SPARKS', icon: 'bolt', col: '#ff2c4a', max: 2, desc: '+10% Black Spark chance on heavies.', apply: m => { m.bf += 0.1; } },
    { id: 'guard', name: 'IRON GUARD', icon: 'shield', col: '#8fd6ff', max: 1, desc: 'No chip damage; guard drains 40% slower.', apply: m => { m.chipImmune = true; m.guard *= 0.6; } },
    { id: 'primed', name: 'PRIMED', icon: 'star', col: '#ffb13d', max: 1, desc: 'Start every floor with half a super.', apply: m => { m.startMeter = Math.max(m.startMeter, 50); } },
    { id: 'fleet', name: 'FLEET', icon: 'haste', col: '#b4ff3d', max: 2, desc: 'Walk 12% faster.', apply: m => { m.speed *= 1.12; } },
    { id: 'exec', name: 'EXECUTIONER', icon: 'swords', col: '#e7b84c', max: 1, desc: '+30% damage to foes under 30% health.', apply: m => { m.exec += 0.3; } },
    { id: 'thorns', name: 'THORNS', icon: 'target', col: '#a06bff', max: 1, desc: 'Foes take damage when you block them.', apply: m => { m.thorns += 14; } },
  ];
  const BOON = Object.fromEntries(BOONS.map(b => [b.id, b]));
  // three different boons the run can still take
  function offer(owned, rnd = Math.random) {
    const pool = BOONS.filter(b => (owned[b.id] || 0) < b.max);
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }

  /* ---------------------------------------------------------------- mods */
  const base = () => ({ dmg: 1, taken: 1, meter: 1, cd: 1, speed: 1, hp: 1, bf: 0, lifesteal: 0, exec: 0, guard: 1, chipImmune: false, secondWind: 0, thorns: 0, startMeter: 0 });
  // the mods a fighter brings into a fight: upgrades (if allowed) and boons
  function modsFor(id, opt = {}) {
    const m = base();
    if (opt.upgrades) { const r = ranks(id); for (const U of UPGRADES) if (r[U.id]) U.apply(m, r[U.id]); }
    for (const [bid, n] of Object.entries(opt.boons || {})) for (let k = 0; k < n; k++) if (BOON[bid]) BOON[bid].apply(m);
    return m;
  }

  /* -------------------------------------------------------------- trials */
  // each check sees one landed hit: (att, def, spec, combo) and returns true when cleared
  const TRIALS = [
    { id: 'ender', name: 'FINISHER', desc: 'Land your combo finisher: light, light, heavy.', check: h => h.key === 'hEnd' },
    { id: 'cancel', name: 'CANCEL', desc: 'Cancel a light or heavy that hits into a special.', check: h => h.kind === 'special' && h.combo >= 2 && h.usedNormal },
    { id: 'air', name: 'AIR COMBO', desc: 'Hit a juggled foe with an air heavy.', check: h => h.key === 'airH' && h.juggled },
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

  return { UPGRADES, MAX_RANK, COST, ranks, totalRank, nextCost, buyRank, BOONS, BOON, offer, base, modsFor, TRIALS, TRIAL_PAY, trialsDone, clearTrial };
})();
