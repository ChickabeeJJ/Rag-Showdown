// A stand-in for the CrazyGames SDK v3, served by tools/flow.js in place of
// https://sdk.crazygames.com/crazygames-sdk-v3.js. It records every call in
// window.__sdkCalls so the flow test can check the integration end to end.
(function () {
  const calls = window.__sdkCalls = [];
  const log = (name, arg) => calls.push(arg === undefined ? name : name + ':' + arg);
  const listeners = [];
  const store = {};
  window.CrazyGames = {
    SDK: {
      environment: 'crazygames',
      init: () => { log('init'); return Promise.resolve(); },
      game: {
        settings: { muteAudio: false },
        addSettingsChangeListener: fn => { log('settingsListener'); listeners.push(fn); },
        loadingStart: () => log('loadingStart'),
        loadingStop: () => log('loadingStop'),
        gameplayStart: () => log('gameplayStart'),
        gameplayStop: () => log('gameplayStop'),
        happytime: () => log('happytime'),
      },
      data: {
        getItem: k => { log('data.getItem'); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: (k, v) => { log('data.setItem'); store[k] = String(v); },
        removeItem: k => { delete store[k]; },
      },
      ad: {
        requestAd: (type, cb) => { log('requestAd', type); setTimeout(() => { cb.adStarted && cb.adStarted(); setTimeout(() => cb.adFinished && cb.adFinished(), 50); }, 10); },
        hasAdblock: () => Promise.resolve(false),
      },
      user: { isUserAccountAvailable: false },
    },
  };
  // lets the test flip the platform's mute setting
  window.__sdkMute = m => listeners.forEach(fn => fn({ muteAudio: m }));
})();
