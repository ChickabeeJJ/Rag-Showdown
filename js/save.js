'use strict';
/* =========================================================================
   Save data in localStorage (every access guarded): coins, unlocked
   fighters, Arcade clears, Survival best, settings and lifetime stats.
   ========================================================================= */

const Save = (() => {
  const KEY = 'ragshowdown.v1';
  const fresh = () => ({
    coins: 0,
    unlocked: ['kaze', 'ryo', 'homura', 'mugi'],
    clears: {},          // fighter id -> best arcade difficulty cleared
    wins: {},            // fighter id -> match wins
    survivalBest: 0,
    totalWins: 0, finishers: 0, blackFlashes: 0, matches: 0,
    daily: '',           // UTC date of the last first-win bonus
    seenHow: false,
    lastPick: 'kaze',
    arcadeDiff: 1,       // 0 easy, 1 normal, 2 hard
    settings: { sfx: true, music: true, shake: true, flashes: true },
  });
  const S = { data: fresh() };
  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const f = fresh();
        S.data = Object.assign(f, d, { settings: Object.assign(f.settings, d.settings || {}) });
        if (!Array.isArray(S.data.unlocked)) S.data.unlocked = f.unlocked;
        for (const id of f.unlocked) if (!S.data.unlocked.includes(id)) S.data.unlocked.push(id);
        S.data.unlocked = S.data.unlocked.filter(id => BY_ID[id]);
        if (!BY_ID[S.data.lastPick]) S.data.lastPick = 'kaze';
        if (!Number.isFinite(S.data.coins) || S.data.coins < 0) S.data.coins = 0;
      }
    } catch (e) { S.data = fresh(); }
  };
  S.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* private mode */ } };
  S.owned = id => S.data.unlocked.includes(id);
  S.unlock = function (id) { if (!S.owned(id)) { S.data.unlocked.push(id); S.save(); return true; } return false; };
  S.buy = function (id) {
    const d = BY_ID[id];
    if (!d || S.owned(id) || S.data.coins < d.price) return false;
    S.data.coins -= d.price; S.unlock(id); S.save();
    return true;
  };
  S.addCoins = function (n) { S.data.coins = Math.max(0, Math.round(S.data.coins + n)); S.save(); };
  S.today = () => new Date().toISOString().slice(0, 10);
  S.dailyReady = () => S.data.daily !== S.today();
  S.reset = function () { const st = S.data.settings; S.data = fresh(); S.data.settings = st; S.save(); };
  return S;
})();
