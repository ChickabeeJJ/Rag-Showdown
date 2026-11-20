'use strict';
/* =========================================================================
   Platform layer: the CrazyGames HTML5 SDK v3, wrapped. Rag Showdown shows
   NO ads of any kind: this file never requests an ad or a banner.
   - init (with a timeout, so a slow or blocked SDK never holds up boot)
   - loading start / stop, gameplay start / stop, happytime
   - data module for saves (synced to the player's account on CrazyGames;
     plain localStorage everywhere else)
   - the platform's mute setting, live
   - the user module: a signed-in player's name, kept up to date
   Every call is guarded: off CrazyGames, offline or with the SDK blocked,
   the game runs exactly the same.
   ========================================================================= */

const Platform = (() => {
  let sdk = null;
  let env = 'standalone';
  let inGameplay = false;
  let loading = false;
  let user = null;
  const userListeners = [];

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
    // the player's account (optional; never needed to play)
    safe(() => sdk.user.addAuthListener(u => setUser(u)));
    if (safe(() => sdk.user.isUserAccountAvailable, false)) {
      try { setUser(await Promise.race([sdk.user.getUser(), new Promise(r => setTimeout(() => r(null), 3000))])); } catch (e) { setUser(null); }
    }
  }
  function applySettings(s) {
    if (s && typeof Sfx !== 'undefined' && Sfx.setPlatformMute) Sfx.setPlatformMute(!!s.muteAudio);
  }
  function setUser(u) {
    user = u && u.username ? { name: String(u.username).slice(0, 24), avatar: u.profilePictureUrl || '' } : null;
    for (const fn of userListeners) safe(() => fn(user));
  }
  const onUser = fn => { userListeners.push(fn); fn(user); };

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
  function loadingStart() { if (loading) return; loading = true; safe(() => sdk && sdk.game.loadingStart()); }
  function loadingStop() { if (!loading) return; loading = false; safe(() => sdk && sdk.game.loadingStop()); }
  // called every frame with "is a real fight live right now?"; only changes are sent,
  // and never while loading
  function gameplay(on) {
    on = !!on && !loading;
    if (on === inGameplay) return;
    inGameplay = on;
    safe(() => sdk && (on ? sdk.game.gameplayStart() : sdk.game.gameplayStop()));
  }
  // a short celebration moment: a 3-star clear, a new best, a legendary card,
  // an event reward
  function happytime() { safe(() => sdk && sdk.game.happytime()); }

  return {
    init, getItem, setItem, loadingStart, loadingStop, gameplay, happytime, onUser,
    get hasSdk() { return !!sdk; }, get env() { return env; }, get inGameplay() { return inGameplay; }, get user() { return user; },
  };
})();
