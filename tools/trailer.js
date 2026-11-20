// Renders the CrazyGames trailers from the real game, frame by frame.
//   NODE_PATH=$(npm root -g) node tools/trailer.js landscape|portrait [outDir] [--preview]
// Serve the repo on :8123 first. Output: trailer-landscape-1920x1080.mp4 or
// trailer-portrait-1080x1920.mp4 (H.264, 30 fps, about 17 seconds, no audio).
// The game's own loop is stopped; every frame is stepped (1/30 s) and drawn
// deterministically (seeded randomness), with text overlays set per frame.
// --preview writes a contact sheet of every 6th frame instead of a video.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');

const MODE = process.argv[2] === 'portrait' ? 'portrait' : 'landscape';
const OUT = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : path.join(__dirname, '..', 'crazygames');
const PREVIEW = process.argv.includes('--preview');
const [W, H] = MODE === 'portrait' ? [1080, 1920] : [1920, 1080];
const FPS = 30;

// --------------------------------------------------------------- page side
const DIRECTOR = () => {
  // seeded randomness: the same trailer every time
  let seed = 1234567;
  Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const portrait = innerHeight > innerWidth;
  // stop the game's own loop: frames are stepped from here
  window.requestAnimationFrame = () => 0;
  for (const id of ['home', 'select', 'levels', 'event', 'rotate', 'tut', 'toasts']) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
  document.getElementById('hud').style.display = 'none';
  Game.resScale = 1; Game.resize();
  Save.data.settings.flashes = true; Save.data.settings.shake = true;
  // portrait: frame the fight for a tall screen (tight on the action, centred on it)
  if (portrait) Game.camHook = (cam, v) => {
    const [a, b] = Game.fighters; if (!a || !b) return;
    const d = Math.abs(a.root.x - b.root.x);
    const z = v.cw / (v.kView * Math.max(520, d + 300));
    cam.z = Game.cut ? Math.max(cam.z, z * 1.15) : z;
    const top = Math.min(a.head().y, b.head().y);
    cam.y = Math.min(GROUND - 40, (top + GROUND) / 2 + 40);
    cam.x = (a.root.x + b.root.x) / 2;
  };

  // overlay: flash, title slam, caption, letterbox, end card
  const ov = document.createElement('div');
  ov.id = 'trov';
  ov.innerHTML = `
    <div class="tr-bars"><i></i><i></i></div>
    <div class="tr-cap"><span class="tr-k"></span><b></b></div>
    <div class="tr-title"><span class="t1">RAG</span><span class="t2">SHOWDOWN</span><small>ANIME RAGDOLL FIGHTER</small></div>
    <div class="tr-end"><div class="tr-title2"><span class="t1">RAG</span><span class="t2">SHOWDOWN</span></div><p>19 FIGHTERS · ANIME SUPERS · WEEKLY EVENTS</p><em>PLAY NOW</em></div>
    <div class="tr-flash"></div>`;
  const css = document.createElement('style');
  css.textContent = `
    #trov { position: fixed; inset: 0; z-index: 999; pointer-events: none; font-family: Rubik, sans-serif; color: #fff; }
    #trov .tr-flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
    #trov .tr-bars i { position: absolute; left: 0; right: 0; height: ${portrait ? 0 : 6}vh; background: #000; }
    #trov .tr-bars i:first-child { top: 0; } #trov .tr-bars i:last-child { bottom: 0; }
    #trov .tr-cap { position: absolute; ${portrait ? 'left: 0; right: 0; top: 13vh; text-align: center;' : 'left: 6vw; bottom: 13vh;'} opacity: 0; }
    #trov .tr-cap .tr-k { display: block; height: ${portrait ? 1.2 : 1}vh; width: ${portrait ? 40 : 14}vw; margin: ${portrait ? '0 auto 1.4vh' : '0 0 1.4vh'}; background: #ffc933; transform-origin: left; }
    #trov .tr-cap b { display: inline-block; font-weight: 900; font-style: italic; font-size: ${portrait ? 8.2 : 6.4}vw; line-height: 0.95; letter-spacing: 0.01em; text-shadow: 0.5vw 0.5vw 0 #000, 0 0 3vw rgba(0,0,0,0.6); white-space: pre-line; }
    #trov .tr-title, #trov .tr-title2 { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
    #trov .tr-title { top: ${portrait ? 30 : 28}%; opacity: 0; }
    #trov .t1 { font-weight: 900; font-size: ${portrait ? 26 : 13}vw; line-height: 0.85; letter-spacing: 0.02em; text-shadow: 0.6vw 0.6vw 0 #000; }
    #trov .t2 { margin-top: 0.6vw; padding: 0.4vw 2.6vw; background: #ffc933; color: #141824; font-weight: 900; font-style: italic; font-size: ${portrait ? 12.5 : 6.4}vw; letter-spacing: 0.02em; transform: skewX(-10deg); box-shadow: 0.6vw 0.6vw 0 #000; }
    #trov .tr-title small { margin-top: 1.6vw; font-weight: 900; font-size: ${portrait ? 4 : 1.9}vw; letter-spacing: 0.3em; text-shadow: 0.3vw 0.3vw 0 #000; }
    #trov .tr-end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; background: radial-gradient(circle at 50% 45%, rgba(40,30,60,0.75), rgba(5,6,12,0.96) 70%); opacity: 0; }
    #trov .tr-title2 { position: static; }
    #trov .tr-end p { font-weight: 900; font-size: ${portrait ? 3.4 : 1.6}vw; letter-spacing: 0.24em; color: #e9ecf4; text-align: center; padding: 0 4vw; }
    #trov .tr-end em { font-style: normal; padding: 1.4vh 4vw; background: #ffc933; color: #141824; font-weight: 900; font-size: ${portrait ? 6 : 2.8}vw; letter-spacing: 0.08em; box-shadow: 0.5vw 0.5vw 0 #000; clip-path: polygon(1.2vw 0, 100% 0, 100% calc(100% - 1.2vw), calc(100% - 1.2vw) 100%, 0 100%, 0 1.2vw); }
  `;
  document.head.appendChild(css); document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const overlay = o => {
    $('.tr-flash').style.opacity = o.flash || 0;
    const tt = $('.tr-title');
    if (o.title != null) { const k = ease(o.title); tt.style.opacity = Math.min(1, o.title * 3) * (o.titleOut != null ? 1 - o.titleOut : 1); tt.style.transform = `scale(${1.6 - 0.6 * k})`; } else tt.style.opacity = 0;
    const cap = $('.tr-cap');
    if (o.cap) { const k = ease(o.cap.k * 2.2); cap.querySelector('b').textContent = o.cap.text; cap.style.opacity = Math.min(1, o.cap.k * 4) * (o.cap.k > 0.85 ? (1 - o.cap.k) / 0.15 : 1); cap.style.transform = portrait ? `translateY(${(1 - k) * -4}vh)` : `translateX(${(1 - k) * -8}vw)`; cap.querySelector('.tr-k').style.transform = `scaleX(${k})`; } else cap.style.opacity = 0;
    const end = $('.tr-end');
    if (o.end != null) { const k = ease(o.end * 1.6); end.style.opacity = Math.min(1, o.end * 4); end.querySelector('.tr-title2').style.transform = `scale(${1.3 - 0.3 * k})`; end.querySelector('em').style.transform = `scale(${0.9 + 0.1 * Math.sin(o.end * 18) * (o.end > 0.5 ? 1 : 0) + 0.1 * k})`; } else end.style.opacity = 0;
  };

  // a fight between two fighters on a stage, standing `d` apart, already live
  const fight = (p1, p2, stage, d = 300, o = {}) => {
    document.getElementById('modal').classList.add('hidden');
    Game.startMatch({ p1, p2, skins: o.skins || [null, null], ctrls: [o.c0 || new DummyCtrl('stand'), o.c1 || new DummyCtrl('stand')], stage, mode: 'training', training: true, toWin: 9, quickStart: true, hpMul: [4, 4] });
    for (let i = 0; i < 80 && Game.state !== 'fight'; i++) Game.update(1 / 30);
    const [a, b] = Game.fighters;
    Game.teleport(a, 800 - d / 2, GROUND); Game.teleport(b, 800 + d / 2, GROUND); a.facing = 1; b.facing = -1;
    for (let i = 0; i < 20; i++) Game.update(1 / 30);
    Game.callouts.length = 0;
  };
  const sup = side => { Game.fighters[side].meter = 100; Game.press(side, 'sup'); };

  // shots: setup, scripted actions by frame, then which frames are kept
  // (segments: [keepFrames, skipFrames] pairs) and a caption
  const SHOTS = [
    { name: 'title', setup: () => fight('kaze', 'jin', 'dojo', 260, { c0: new CpuCtrl(9), c1: new CpuCtrl(9) }), seg: [[42, 0]], title: true },
    { name: 'combo', setup: () => fight('kaze', 'ryo', 'crater', 170), seg: [[50, 0]], cap: 'COMBO\nTHEM UP',
      at: { 1: () => Game.press(0, 'l'), 6: () => Game.press(0, 'l'), 11: () => Game.press(0, 'h'), 24: () => Game.press(0, 'up'), 29: () => Game.press(0, 'l'), 34: () => Game.press(0, 'h') } },
    { name: 'aoi', setup: () => fight('aoi', 'kohei', 'void', 620), seg: [[10, 28], [0, 22], [38, 0]], cap: 'ANIME\nSUPERS', at: { 1: () => sup(0) } },
    { name: 'kensei', setup: () => fight('kensei', 'ryo', 'city', 360), seg: [[8, 44], [14, 12], [14, 6], [28, 0]], at: { 1: () => sup(0) } },
    { name: 'jin', setup: () => fight('jin', 'titan', 'arena', 300), seg: [[8, 30], [36, 0]], at: { 1: () => sup(0) } },
    { name: 'cards', setup: () => { fight('mugi', 'blaze', 'temple', 300); const sh = document.getElementById('sheet'); sh.className = 'sheet result wide cards legend'; const run = { cards: {} }; sh.innerHTML = `<h2 class="win">FLOOR 5 CLEARED</h2><p class="sub">BOSS REWARD · PICK A CARD</p><div class="rcards">${['phoenix', 'storm', 'glass'].map((id, k) => UI._cardHtml(Meta.CARD[id], run, k)).join('')}</div>`; Icons.hydrate(sh); if (portrait) sh.style.zoom = String(innerWidth / 880); document.getElementById('modal').classList.remove('hidden'); }, seg: [[38, 0]], cap: 'CLIMB THE\nASCENT', ui: true },
    { name: 'hana', setup: () => fight('hana', 'kaze', 'temple', 420, { skins: [null, 'kaze_sakura'] }), seg: [[8, 30], [36, 0]], cap: 'WEEKLY\nEVENTS', at: { 1: () => sup(0) } },
    { name: 'rave', setup: () => fight('rave', 'jin', 'city', 300, { skins: [null, 'jin_neon'] }), seg: [[6, 32], [30, 0]], at: { 1: () => sup(0) } },
    { name: 'kori', setup: () => fight('kori', 'aoi', 'snow', 360, { skins: [null, 'aoi_frost'] }), seg: [[6, 34], [16, 22], [28, 0]], cap: 'EXCLUSIVE\nFIGHTERS', at: { 1: () => sup(0) } },
    { name: 'finish', setup: () => { fight('kaze', 'monarch', 'crater', 380); Game.fighters[1].hp = 60; }, seg: [[8, 50], [44, 0]], at: { 1: () => sup(0) } },
    { name: 'end', setup: () => { document.getElementById('sheet').style.zoom = ''; document.getElementById('modal').classList.add('hidden'); fight('kaze', 'hana', 'temple', 300, { c0: new CpuCtrl(9), c1: new CpuCtrl(9) }); }, seg: [[50, 0]], end: true },
  ];
  let shot = null, f = 0, n = 0;
  window.TR = {
    shots: SHOTS.map(s => ({ name: s.name, keep: s.seg.reduce((a, [k]) => a + k, 0), total: s.seg.reduce((a, [k, sk]) => a + k + sk, 0) })),
    begin(i) { shot = SHOTS[i]; f = 0; n = 0; shot.setup(); },
    // step one frame; returns true if this frame is kept
    step() {
      const s = shot;
      if (s.at && s.at[f]) s.at[f]();
      Game.update(1 / 30); f++;
      let acc = 0, keep = false;
      for (const [k, sk] of s.seg) { if (f > acc && f <= acc + k) { keep = true; break; } acc += k + sk; }
      if (keep) {
        Game.render();
        const len = s.seg.reduce((a, [k]) => a + k, 0), u = n / Math.max(1, len - 1);
        overlay({
          flash: (s.title || s.end) && n < 3 ? 1 - n / 3 : s.ui && n < 2 ? 0.6 : 0,
          title: s.title ? u : null, titleOut: s.title ? Math.max(0, (u - 0.85) / 0.15) : null,
          cap: s.cap ? { text: s.cap, k: u } : null,
          end: s.end ? u : null,
        });
        n++;
      }
      return keep;
    },
  };
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const mock = fs.readFileSync(path.join(__dirname, 'crazygames-mock.js'), 'utf8');
  await p.route('https://sdk.crazygames.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/?trailer=1');
  await p.waitForFunction(() => typeof Game !== 'undefined' && Game.running && UI.fightOn, null, { timeout: 15000 });
  await p.evaluate(() => { Save.data.tutorialDone = true; });
  await p.evaluate(DIRECTOR);
  const shots = await p.evaluate(() => TR.shots);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'trailer-'));
  let frame = 0;
  for (let i = 0; i < shots.length; i++) {
    await p.evaluate(i => TR.begin(i), i);
    for (let k = 0; k < shots[i].total; k++) {
      const keep = await p.evaluate(() => TR.step());
      if (!keep) continue;
      if (!PREVIEW || frame % 6 === 0) await p.screenshot({ path: path.join(dir, `f${String(frame).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
      frame++;
    }
  }
  await b.close();
  fs.mkdirSync(OUT, { recursive: true });
  const name = `trailer-${MODE}-${W}x${H}`;
  if (PREVIEW) {
    execSync(`montage ${dir}/f*.jpg -tile 10x -geometry ${MODE === 'portrait' ? '108x192' : '192x108'}+2+2 ${path.join(OUT, name + '-preview.png')}`);
  } else {
    execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${dir}/f%04d.jpg -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart ${path.join(OUT, name + '.mp4')}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name, frame, 'frames', (frame / FPS).toFixed(1) + 's', 'errors', errs);
})();
