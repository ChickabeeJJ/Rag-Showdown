'use strict';
/* =========================================================================
   Boot, main loop and keyboard routing. Touch lives in ui.js.
   URL flags (for testing): ?speed=N runs the simulation N times faster,
   ?autotest runs CPU-vs-CPU soak matches and reports to window.__test.
   ========================================================================= */

(async function boot() {
  const canvas = document.getElementById('stage');
  // the platform SDK first: saves may live in its data module
  await Platform.init();
  Platform.loadingStart();
  Save.load();
  // phones and tablets start with the touch controls (and touch wording in the guide)
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  try { await Promise.all([document.fonts.load('900 20px Rubik'), document.fonts.load('600 20px Rubik'), document.fonts.load('20px RSJP', 'ラ')]); } catch (e) { /* fonts are optional */ }
  const q = new URLSearchParams(location.search);
  if (q.has('speed')) UI.testSpeed = clamp(+q.get('speed') || 1, 1, 16);
  Game.init(canvas);
  UI.init();
  // one UI scale for every screen size: the layout is designed at 1280x720 and
  // zoomed to fit, with phones getting a bit more so text stays readable
  // (touch buttons are sized separately, in real thumb-sized pixels)
  const fitUi = () => {
    const w = window.innerWidth, h = window.innerHeight, touch = document.body.classList.contains('touch');
    let k = Math.min(w / 1280, h / 720);
    if (touch && Math.min(w, h) < 600) k *= 1.19;   // a touch larger on phones (was 1.32; text read too big)
    k = clamp(k, 0.6, 1.6);
    document.documentElement.style.setProperty('--ui', k.toFixed(3));
    document.body.classList.toggle('short', h < 480);
    // on touch screens the fighters stand higher, clear of the thumbs
    Game.floorPad = touch ? 200 : 110;
    if (UI.homeShift) requestAnimationFrame(UI.homeShift);
  };
  UI.fitUi = fitUi;
  fitUi();
  Platform.loadingStop();

  const inFight = () => UI.screen === null && UI.fightOn && !UI.modalOpen();
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, () => Sfx.ensure(), { capture: true, passive: true });
  // mousedown (not pointerdown) so a second button pressed while the first is held still counts
  let lastTouch = -9;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') document.body.classList.remove('touch');
    else { lastTouch = performance.now(); document.body.classList.add('touch'); }
    fitUi();
  });
  canvas.addEventListener('mousedown', e => {
    if (performance.now() - lastTouch < 900) return;   // emulated mouse after a touch
    if (e.button === 1) e.preventDefault();
    if (inFight()) { e.preventDefault(); Input.mouse(e.button); }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (UI.fightOn && UI.screen === null) {
        if (UI.modalOpen() && Game.paused) UI.resume();
        else if (!UI.modalOpen()) UI.openPause();
      }
      return;
    }
    // R retries straight from a result sheet
    if (e.code === 'KeyR' && UI.modalOpen() && !e.repeat) {
      const r = document.querySelector('#sheet #rRetry');
      if (r) { e.preventDefault(); r.click(); return; }
    }
    // Enter / Space take the main action on a result sheet (NEXT LEVEL, RETRY, RESUME...)
    if ((e.code === 'Enter' || e.code === 'Space') && UI.modalOpen() && !e.repeat) {
      const b = document.querySelector('#sheet .btn.primary');
      if (b && !b.disabled) { e.preventDefault(); b.click(); return; }
    }
    document.body.classList.remove('touch');
    if (inFight()) { if (Input.keydown(e)) e.preventDefault(); }
  });
  window.addEventListener('keyup', e => Input.keyup(e));
  window.addEventListener('blur', () => Input.clearAll());
  window.addEventListener('resize', () => { Game.resize(); fitUi(); UI.checkRotate(); });
  window.addEventListener('orientationchange', () => setTimeout(() => UI.checkRotate(), 120));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (inFight() && Game.state !== 'over') UI.openPause(); Sfx.suspend(true); }
    else Sfx.suspend(false);
  });

  /* Frame pacing. Like console games, keep the frame rate and trade
     resolution for it: watch real frame times against the display's own
     refresh interval (the best recent frame), and if frames keep running
     late, render at a slightly lower resolution; when there's plenty of
     headroom again, step back up. The canvas is always drawn at full size. */
  const pace = { ema: 0, best: 1, lateT: 0, fastT: 0 };
  // start from the resolution that ran smoothly last time on this device
  try { Game.resScale = clamp(+localStorage.getItem('ragshowdown.res') || 1, 0.55, 1); } catch (e) { Game.resScale = 1; }
  const saveRes = () => { try { localStorage.setItem('ragshowdown.res', String(Game.resScale)); } catch (e) { /* private mode */ } };
  Game.resize();
  function paceTick(dt) {
    if (!(dt > 0) || dt > 0.1) return;
    pace.ema = pace.ema ? pace.ema * 0.9 + dt * 0.1 : dt;
    // the display's refresh interval: the shortest recent frame, slowly forgotten
    pace.best = Math.max(1 / 240, Math.min(dt, pace.best * (1 + dt * 0.05)));
    const late = pace.ema > pace.best * 1.35 + 0.0015;
    pace.lateT = late ? pace.lateT + dt : 0;
    pace.fastT = !late && pace.ema < pace.best * 1.12 ? pace.fastT + dt : 0;
    if (pace.lateT > 1.2 && Game.resScale > 0.55) { Game.resScale = Math.max(0.55, Game.resScale - 0.12); pace.lateT = 0; Game.resize(); saveRes(); }
    else if (pace.fastT > 6 && Game.resScale < 1) { Game.resScale = Math.min(1, Game.resScale + 0.08); pace.fastT = 0; Game.resize(); saveRes(); }
  }

  let last = performance.now();
  window.__errors = window.__errors || [];
  function frame(now) {
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
    last = now;
    if (UI.fightOn || Game.running) paceTick(raw);
    try {
      Input.pollPads();
      Game.update(dt);
      Game.render();
      UI.tick();
      // gameplay start / stop for the platform: a real fight, live and unpaused
      Platform.gameplay(inFight() && !Game.paused && Game.state !== 'over');
    } catch (err) {
      window.__errors.push(String(err && err.stack || err));
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (q.has('autotest') && window.AutoTest) window.AutoTest.run(q);
})();
