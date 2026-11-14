'use strict';
/* =========================================================================
   Boot, main loop and keyboard routing. Touch lives in ui.js.
   URL flags (for testing): ?speed=N runs the simulation N times faster,
   ?autotest runs CPU-vs-CPU soak matches and reports to window.__test.
   ========================================================================= */

(async function boot() {
  const canvas = document.getElementById('stage');
  Save.load();
  // phones and tablets start with the touch controls (and touch wording in the guide)
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  try { await Promise.all([document.fonts.load('900 20px Rubik'), document.fonts.load('600 20px Rubik')]); } catch (e) { /* fonts are optional */ }
  const q = new URLSearchParams(location.search);
  if (q.has('speed')) UI.testSpeed = clamp(+q.get('speed') || 1, 1, 16);
  Game.init(canvas);
  UI.init();

  const inFight = () => UI.screen === null && UI.fightOn && !UI.modalOpen();
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, () => Sfx.ensure(), { capture: true, passive: true });
  // mousedown (not pointerdown) so a second button pressed while the first is held still counts
  let lastTouch = -9;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') document.body.classList.remove('touch');
    else { lastTouch = performance.now(); document.body.classList.add('touch'); }
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
  window.addEventListener('resize', () => { Game.resize(); UI.checkRotate(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (inFight() && Game.state !== 'over') UI.openPause(); Sfx.suspend(true); }
    else Sfx.suspend(false);
  });

  let last = performance.now();
  window.__errors = window.__errors || [];
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      Input.pollPads();
      Game.update(dt);
      Game.render();
      UI.tick();
    } catch (err) {
      window.__errors.push(String(err && err.stack || err));
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (q.has('autotest') && window.AutoTest) window.AutoTest.run(q);
})();
