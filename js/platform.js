'use strict';
/* =========================================================================
   Platform layer: the CrazyGames HTML5 SDK v3, wrapped.
   - init (with a timeout, so a slow or blocked SDK never holds up boot)
   - loading start / stop, gameplay start / stop, happytime
   - data module for saves (synced to the player's account on CrazyGames;
     plain localStorage everywhere else)
   - the platform's mute setting, live
   - ads: a midgame ad only at natural breaks between fights (rate limited),
     and opt-in rewarded ads; game audio is muted while an ad plays
   Every call is guarded: off CrazyGames, offline or with the SDK blocked,
   the game runs exactly the same and simply shows no ad buttons.
   ========================================================================= */

const Platform = (() => {
  let sdk = null;
  let env = 'standalone';
  let inGameplay = false;
  let adBusy = false;
  const bootAt = Date.now();
  let lastAdAt = 0;
  const MIDGAME_GAP = 180 * 1000;     // at most one midgame ad every 3 minutes
  const MIDGAME_GRACE = 120 * 1000;   // and never in the first 2 minutes

  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };

  async function init() {
    try {
      const S = window.CrazyGames && window.CrazyGames.SDK;
      if (S) {
        await Promise.race([S.init(), new Promise((_, no) => setTimeout(() => no(new Error('sdk timeout')), 4000))]);
        sdk = S;
        env = S.environment || 'crazygames';
        if (env === 'disabled') sdk = null;
      }
    } catch (e) { sdk = null; }
    if (!sdk) return;
    // the platform's audio setting wins over the in-game toggles
    safe(() => { applySettings(sdk.game.settings); sdk.game.addSettingsChangeListener(applySettings); });
  }
  function applySettings(s) {
    if (s && typeof Sfx !== 'undefined' && Sfx.setPlatformMute) Sfx.setPlatformMute(!!s.muteAudio);
  }

  /* ----------------------------------------------------------- storage */
  // the data module has the localStorage API and syncs to the account
  const memory = {};
  function store() {
    const d = safe(() => sdk && sdk.data, null);
    if (d && typeof d.getItem === 'function') return d;
    try { return window.localStorage; } catch (e) { return null; }
  }
  function getItem(k) { const s = store(); try { return s ? s.getItem(k) : (memory[k] ?? null); } catch (e) { return memory[k] ?? null; } }
  function setItem(k, v) { const s = store(); try { if (s) s.setItem(k, v); else memory[k] = v; } catch (e) { memory[k] = v; } }

  /* ------------------------------------------------------------ events */
  function loadingStart() { safe(() => sdk && sdk.game.loadingStart()); }
  function loadingStop() { safe(() => sdk && sdk.game.loadingStop()); }
  // called every frame with "is a real fight live right now?"; only changes are sent
  function gameplay(on) {
    on = !!on && !adBusy;
    if (on === inGameplay) return;
    inGameplay = on;
    safe(() => sdk && (on ? sdk.game.gameplayStart() : sdk.game.gameplayStop()));
  }
  // a short celebration moment: a 3-star clear, a new best, a legendary card
  function happytime() { safe(() => sdk && sdk.game.happytime()); }

  /* --------------------------------------------------------------- ads */
  const adsReady = () => !!sdk && !adBusy && !!safe(() => sdk.ad, null);
  function play(type) {
    return new Promise(resolve => {
      if (!adsReady()) { resolve(false); return; }
      adBusy = true; lastAdAt = Date.now();
      gameplay(false);
      let done = false;
      const finish = ok => { if (done) return; done = true; adBusy = false; if (typeof Sfx !== 'undefined') Sfx.suspend(false); resolve(ok); };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => { if (typeof Sfx !== 'undefined') Sfx.suspend(true); },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch (e) { finish(false); }
      // never leave the game stuck if the SDK goes quiet
      setTimeout(() => finish(false), 60000);
    });
  }
  const midgameDue = () => adsReady() && Date.now() - bootAt > MIDGAME_GRACE && Date.now() - lastAdAt > MIDGAME_GAP;
  const midgame = () => play('midgame');
  const rewarded = () => play('rewarded');

  return {
    init, getItem, setItem, loadingStart, loadingStop, gameplay, happytime, adsReady, midgameDue, midgame, rewarded,
    get hasSdk() { return !!sdk; }, get env() { return env; }, get inGameplay() { return inGameplay; },
  };
})();
