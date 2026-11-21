'use strict';
/* =========================================================================
   Game: the fight. Rounds and timer, the move runtime, hits / blocks /
   juggles / Black Spark, projectiles, beams and fields, summons (clones and
   stands), cinematic supers (cut-ins, impact frames, slow motion, finishers)
   and rendering with a fighting-game camera.
   ========================================================================= */

const KB = 1.6;              // knockback scale (spec units -> px/s)
const JUGGLE_MAX = 9;
const BF_CHANCE = 0.13;      // Black Spark chance on eligible heavy hits

const Game = (() => {
  let canvas, ctx, cw = 1, ch = 1, dpr = 1, kView = 1;
  const G = {
    running: false, paused: false, state: 'idle', mode: 'demo', cfg: null,
    fighters: [], corpses: [], ctrls: [], projs: [], beams: [], fields: [], summons: [], ghosts: [],
    fx: new FX(), t: 0, realT: 0, acc: 0, speed: 1,
    hitstop: 0, slowK: 1, slowT: 0, shakeA: 0,
    flashC: null, impactQ: [], impactPos: { x: 800, y: 600 }, impactT: 0,
    cut: null, tintS: null, windS: null, callouts: [], focusS: null,
    cam: { x: 800, y: 450, z: 1 }, viewShift: 0, viewFrac: 1,
    round: 1, wins: [0, 0], timer: 99, stateT: 0, winner: -1, combo: [null, null],
    stats: null, stage: STAGES.dojo, stageId: 'dojo',
  };

  /* ---------------------------------------------------------------- setup */
  // an opaque canvas: every frame paints the whole screen, and the browser can
  // composite an opaque layer more cheaply
  G.init = function (cv) { canvas = cv; ctx = cv.getContext('2d', { alpha: false }); G.resize(); };
  G.resize = function () {
    // dynamic resolution: resScale drops a little when frames run late and
    // climbs back when there's headroom (see main.js)
    dpr = Math.min(2, window.devicePixelRatio || 1) * (G.resScale || 1);
    cw = Math.max(1, Math.floor(window.innerWidth * dpr));
    ch = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width = cw; canvas.height = ch;
    canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
    kView = Math.min(cw / W, ch / H);
  };

  G.opp = f => G.fighters[1 - f.side] || null;

  /* cfg: { p1, p2, ctrls:[ctrl, ctrl], stage, mode, toWin, hpMul:[a,b], training, onEnd, intro } */
  G.startMatch = function (cfg) {
    G.cfg = cfg;
    G.mode = cfg.mode || 'versus';
    G.stageId = cfg.stage || 'dojo';
    G.stage = STAGES[G.stageId] || STAGES.dojo;
    G.wins = [0, 0];
    G.round = 1;
    G.meters = [cfg.meter0 || 0, cfg.meter1 || 0];
    G.stats = { dmg: 0, taken: 0, maxCombo: 0, finishers: 0, bf: 0, perfects: 0, supers: 0, roundsWon: 0, time: 0, splats: 0 };
    G.ctrls = cfg.ctrls;
    G.running = true; G.paused = false;
    Stage.prepare(G.stageId);
    G.startRound();
  };

  G.startRound = function () {
    const c = G.cfg;
    G.projs.length = 0; G.beams.length = 0; G.fields.length = 0; G.summons.length = 0; G.ghosts.length = 0; G.callouts.length = 0; G.corpses.length = 0;
    G.timers.length = 0;
    G.border.length = 0;
    G.fx.clear();
    G.hitstop = 0; G.slowK = 1; G.slowT = 0; G.cut = null; G.tintS = null; G.windS = null; G.impactQ.length = 0; G.focusS = null; G.flashC = null;
    const hp0 = c.hpStart || [1, 1];
    // in levels and Survival the player gets a sturdier body than the CPU
    const pBonus = c.mode === 'level' || c.mode === 'survival' || c.mode === 'ascent' || c.mode === 'event' ? 1.3 : 1;
    // outfits: the player's equipped skin unless the fight says otherwise
    const sk = c.skins || [Skins.equipped(c.p1), null];
    G.fighters = [
      new Rag(Skins.def(c.p1, sk[0]), { side: 0, x: 560, facing: 1, hpMul: (c.hpMul || [1, 1])[0] * pBonus }),
      new Rag(Skins.def(c.p2, sk[1]), { side: 1, x: 1040, facing: -1, hpMul: (c.hpMul || [1, 1])[1] }),
    ];
    if (c.scale) G.fighters.forEach((f, i) => { f.s *= c.scale[i] || 1; });
    WORLD_G = c.grav || 1;
    if (c.p1 === c.p2) G.fighters[1].alt = true;   // mirror match: player 2 is a shade darker
    // upgrades and cards (meta.js) arrive as one mods object per side
    G.fighters.forEach((f, i) => {
      const m = (c.mods || [])[i];
      if (!m) return;
      Object.assign(f.mods, m);
      f.maxHp = Math.round(f.maxHp * (m.hp || 1));
      f.walk *= m.speed || 1;
      if (m.scale && m.scale !== 1) f.s *= m.scale;
      if (m.jump && m.jump !== 1) f.jumpV *= m.jump;
    });
    G.fighters.forEach(f => { f.baseS = f.s; });
    G.fighters.forEach((f, i) => {
      f.hp = Math.max(1, Math.round(f.maxHp * hp0[i]));
      f.meter = Math.max(G.meters[i] || 0, f.mods.startMeter || 0);
      f.buf = [];
      f.onLand = () => onLand(f);
      if (G.ctrls[i] && G.ctrls[i].reset) G.ctrls[i].reset(f);
    });
    // healing carried in from the last floor (Ascent, Survival) plays out on
    // screen: the bar starts where the last fight left it and fills up
    const hf = c.healFrom; c.healFrom = null;
    G.fighters.forEach((f, i) => {
      f.healLeft = 0; f.breakPending = null; f.burstCd = 0; f.breakAt = 0;
      if (hf && hf[i] != null && hf[i] < hp0[i] - 0.004) {
        const from = Math.max(1, Math.round(f.maxHp * hf[i]));
        f.healLeft = f.hp - from; f.hp = from; f.healT = 0.5; f.healSaid = false;
      }
    });
    G.combo = [null, null];
    G.timer = c.training || c.tutorial ? Infinity : c.timeLimit || 99;
    G.state = 'intro'; G.stateT = 0; G.winner = -1; G.winCam = false;
    if (typeof document !== 'undefined') document.body.classList.remove('vcam');
    G.cam.x = 800; G.cam.z = 1.05;
    G.hpShown = G.fighters.map(f => f.hp);
    if (c.training || c.quickStart) { G.stateT = 1.5; }
    else if (c.fastIntro) G.stateT = 0.8;   // levels get going fast
    else if (c.introPan) G.stateT = -0.7;    // let the transition clear before the intro pan
    G.wave = 0;
    Sfx.music(G.round >= 3 || (G.wins[0] && G.wins[1]) ? 'final' : 'fight');
  };

  G.endTutorial = function () {
    if (!G.cfg) return;
    G.cfg.tutorial = false;
    G.timer = G.cfg.timeLimit || 99;
    for (const f of G.fighters) { f.hp = f.maxHp; f.meter = 0; f.marks = 0; }
    G.combo = [null, null];
    G.callout('FIGHT!', '', 'fight', 0.8); Sfx.play('fight');
  };
  G.stop = function () { G.running = false; G.state = 'idle'; Sfx.music('menu'); };

  /* -------------------------------------------------------------- effects api */
  G.shake = a => { if (Save.data.settings.shake) G.shakeA = Math.max(G.shakeA, a); };
  G.flash = (color, a) => { if (Save.data.settings.flashes) G.flashC = { color, a }; else G.flashC = { color, a: a * 0.35 }; };
  G.slow = (k, d) => { G.slowK = k; G.slowT = d; };
  G.focus = (x, y, z, d) => { G.focusS = { x, y, z, t: 0, d }; };
  G.say = (x, y, str, color = '#fff', size = 30) => G.fx.text(x, y, str, color, size, { dur: 0.9 });
  G.tint = (type, d) => { G.tintS = { type, t: 0, d, x: 0, y: 0 }; };
  G.wind = (f, d, serious) => { G.windS = { dir: f.facing, t: 0, d, serious, x: f.root.x }; };
  G.callout = (text, sub, style, d = 1.4, o) => { G.callouts.push(Object.assign({ text, sub, style, t: 0, d }, o)); };
  G.cutin = function (f, title, sub) {
    G.cut = { f, title, sub, t: 0, d: 1.25 };
    G.flash(f.def.color, 0.5);
    Sfx.play('cutin');
    if (f.side === 0 && G.stats) G.stats.supers++;
  };
  // impact frames: a run of stylised, high-contrast frames played in real time
  const SEQS = {
    heavy: ['inv', 'inv'],
    bf: ['red', 'red', 'mono', 'mono', 'red', 'inv'],
    super: ['white', 'mono', 'mono', 'inv', 'inv', 'red', 'red'],
    finish: ['white', 'white', 'mono', 'mono', 'red', 'red', 'inv', 'inv', 'mono', 'mono', 'white', 'red', 'red', 'inv'],
  };
  G.impact = function (kind, x, y) {
    const seq = SEQS[kind] || SEQS.heavy;
    G.impactQ = seq.slice();
    G.impactT = 0;
    G.impactPos = { x, y };
  };

  /* -------------------------------------------------------------- spawners */
  // run fn after a delay of fight time (cleared when a round starts)
  G.timers = [];
  G.border = [];   // ripples on the arena's force-field edges
  G.later = (d, fn) => { G.timers.push({ t: d, fn }); };
  /* ----------------------------------------------------- card effects
     Run-only powers from Ascent cards (meta.js). Each one is visible: a
     coin, a lightning bolt, a shockwave, a burst of fire. */
  function cardEffects(att, def, spec, kind, dmg, n, x, y, dir, stopped) {
    const m = att.mods;
    // Midas Touch: every hit throws out a coin
    if (m.midas && att.side === 0) {
      att.midasCoins = (att.midasCoins || 0) + 1;
      G.fx.add({ kind: 'coin', x, y, vx: -dir * rand(80, 260), vy: rand(-620, -420), g: 1500, life: 0.8, size: 7, color: '#ffd34d', add: false });
      Sfx.play('coin');
    }
    // Chain Lightning: every 4th hit of a combo calls a bolt down on them
    if (m.storm && n % 4 === 0 && !stopped && def.alive) {
      const c = def.center(), bolt = Math.round(40 * m.dmg);
      def.hp -= bolt; def.flash = 1;
      let px = c.x + rand(-30, 30), py = c.y - 620;
      for (let i = 0; i < 7; i++) { const nx = c.x + rand(-40, 40) * (1 - i / 7), ny = py + (c.y - py) / (7 - i); G.fx.arc(px, py, nx, ny, '#e8fbff', 0.22); G.fx.arc(px, py, nx, ny, '#8fe8ff', 0.3); px = nx; py = ny; }
      G.fx.ring(c.x, c.y, '#8fe8ff', 140, 0.3, 8); G.flash('#cff6ff', 0.25); G.shake(7); Sfx.play('thunder');
      G.fx.text(c.x, c.y - 200, `${bolt}`, '#8fe8ff', 30, { dur: 0.7 });
    }
    // Aftershock: heavies echo with a second shockwave a beat later
    if (m.after && (kind === 'heavy') && !spec.echo && !stopped) {
      const echo = Math.max(1, Math.round(dmg * m.after));
      G.later(0.26, () => {
        if (!def.alive || G.state !== 'fight') return;
        const c = def.center();
        def.hp -= echo; def.flash = 0.8;
        G.fx.ring(c.x, c.y, '#ffcf6a', 150, 0.35, 10); G.fx.ring(c.x, c.y, '#ffffff', 90, 0.25, 6);
        G.shake(6); Sfx.play('boom');
        G.fx.text(c.x, c.y - 200, `${echo}`, '#ffcf6a', 28, { dur: 0.7 });
      });
    }
  }
  // a combo break: the CPU recovers in the air, jumps clear and blows the
  // attacker back a step. It can't break again for a while.
  function comboBreak(f, att) {
    f.burstCd = 9; f.breakAt = 0;
    const away = Math.sign(f.root.x - att.root.x) || -att.facing;
    const pv = f.pelvis;
    f.clearAction();
    f.stunT = 0; f.juggle = 0; f.bounce = 0;
    if (f.mode === 'tumble' || f.mode === 'hit' || f.mode === 'block') {
      f.root.x = clamp(pv.x, WALL_L + 24 * f.s, WALL_R - 24 * f.s);
      f.root.y = Math.min(GROUND, pv.y + 50 * f.s);
      f.mode = 'rising'; f.riseT = 0; f.m = Math.max(f.m, 0.55);
    }
    f.root.grounded = false; f.root.hover = false; f.root.jumps = 1;
    f.root.vy = -f.jumpV * f.s * 0.8;
    f.root.vx = away * f.walk * f.s * 1.3;
    f.invuln = Math.max(f.invuln, 0.7);
    f.facing = -away;
    if (att.alive && att.mode !== 'dead') att.stagger(-away * 620 * att.s / 2, -60, P.NECK, 0.24, false);
    G.combo[att.side] = null;
    const c = f.center();
    G.fx.ring(c.x, c.y, '#ffffff', 230, 0.35, 12); G.fx.ring(c.x, c.y, f.def.color, 160, 0.3, 8);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; G.fx.add({ x: c.x, y: c.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, drag: 4, life: 0.3, size: 4, color: '#e6fbff' }); }
    G.flash('#ffffff', 0.18); G.shake(9); G.slow(0.5, 0.18);
    G.say(c.x, c.y - 240, 'BREAK!', '#9ff4ff', 42);
    Sfx.play('counter');
  }

  /* ------------------------------------------------- the arena border
     The edges of the arena are not walls but a force: a sheet of light with
     scrolling bands, like the edge of a world. It is faint from afar, grows
     as a fighter nears it, and ripples where anything touches it. */
  const BORDER_TINT = { dojo: '#ffcf7a', city: '#4fd8ff', temple: '#ff9ac6', void: '#b07bff', crater: '#ff8a4a', forest: '#9dffb0', snow: '#bfe6ff', arena: '#ffd34d', lab: '#7fe8ff' };
  function borderHit(side, y, k = 1) {
    if (G.border.length > 24) G.border.shift();
    G.border.push({ side, y, t: 0, k });
    const x = side < 0 ? WALL_L : WALL_R, col = BORDER_TINT[G.stageId] || '#7fe8ff';
    for (let i = 0; i < 6 + k * 6; i++) G.fx.add({ x, y: y + rand(-30, 30), vx: -side * rand(80, 420) * k, vy: rand(-300, 300) * k, drag: 3, life: rand(0.25, 0.5), size: rand(2, 4), color: Math.random() < 0.5 ? '#ffffff' : col });
  }
  let stripeCanvas = null;
  function stripePattern() {
    if (!stripeCanvas) {
      stripeCanvas = document.createElement('canvas'); stripeCanvas.width = stripeCanvas.height = 64;
      const g = stripeCanvas.getContext('2d');
      g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'square';
      for (let i = -1; i <= 2; i++) { g.beginPath(); g.moveTo(i * 32 - 32, 64); g.lineTo(i * 32 + 32, 0); g.stroke(); }
    }
    return stripeCanvas;
  }
  let sheetC = null;
  function borderSheet(h, col, off, side) {
    const W = 84, H = Math.max(8, Math.ceil(h));
    if (!sheetC) sheetC = document.createElement('canvas');
    if (sheetC.width !== W || sheetC.height !== H) { sheetC.width = W; sheetC.height = H; }
    const g = sheetC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    g.globalAlpha = 0.5; g.fillStyle = col; g.fillRect(0, 0, W, H);
    const pat = g.createPattern(stripePattern(), 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(side * off, -off));
    g.globalAlpha = 0.55; g.fillStyle = pat; g.fillRect(0, 0, W, H);
    // the mask: fade up into the sky, and soften both sides of the sheet
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.55, 'rgba(0,0,0,0.6)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    const hz = g.createLinearGradient(0, 0, W, 0); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.3, 'rgba(0,0,0,1)'); hz.addColorStop(0.7, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    return sheetC;
  }
  function drawBorders(vr, time) {
    const col = BORDER_TINT[G.stageId] || '#7fe8ff';
    const top = vr.y0 - 40, bot = GROUND + 10;
    for (const side of [-1, 1]) {
      const x = side < 0 ? WALL_L : WALL_R;
      if (x < vr.x0 - 200 || x > vr.x1 + 200) continue;
      // how close the nearest fighter is: the border wakes up as you approach
      let near = 0;
      for (const f of G.fighters) near = Math.max(near, clamp(1 - Math.abs(f.root.x - x) / 420, 0, 1));
      const ripple = G.border.some(b => b.side === side);
      const a = 0.22 + near * 0.55 + (ripple ? 0.15 : 0);
      // beyond the border the world is held back: a deep tinted haze
      const out0 = side < 0 ? vr.x0 - 50 : x, out1 = side < 0 ? x : vr.x1 + 50;
      const hg = ctx.createLinearGradient(x, 0, x + side * 260, 0);
      hg.addColorStop(0, rgba(col, 0.22 * a)); hg.addColorStop(1, rgba('#05060c', 0.55));
      ctx.fillStyle = hg; ctx.fillRect(out0, top, out1 - out0, bot - top + 60);
      // the sheet: scrolling diagonal bands, fading toward the sky and at its
      // sides (built on a small offscreen canvas with a smooth mask)
      const W = 84;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, a * 1.1);
      ctx.drawImage(borderSheet(bot - top, col, (time * 70) % 64, side), x - W / 2, top, W, bot - top);
      ctx.restore();
      // a soft glow where the sheet meets the floor
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, col, x, GROUND - 40, 120, 0.35 * a);
      // runes drifting up the sheet
      const rnd = mulberry32(side < 0 ? 7 : 11);
      for (let i = 0; i < 9; i++) {
        const sp = 30 + rnd() * 50, y = bot - ((time * sp + rnd() * 900) % (bot - top)), dx = (rnd() - 0.5) * 40;
        const k = clamp((y - top) / (bot - top), 0, 1);
        ctx.globalAlpha = a * k * (0.5 + 0.5 * Math.sin(time * 4 + i));
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        const s = 6 + rnd() * 4;
        ctx.beginPath(); ctx.moveTo(x + dx, y - s); ctx.lineTo(x + dx + s * 0.6, y); ctx.lineTo(x + dx, y + s); ctx.lineTo(x + dx - s * 0.6, y); ctx.closePath(); ctx.stroke();
      }
      // ripples where something touched it: rings on the sheet, seen edge-on
      for (const b of G.border) {
        if (b.side !== side) continue;
        const u = b.t / 0.6, r = 30 + u * 150 * b.k;
        ctx.globalAlpha = (1 - u) * 0.9;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - u) + 1;
        ctx.beginPath(); ctx.ellipse(x, b.y, r * 0.28, r, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 6 * (1 - u) + 1;
        ctx.beginPath(); ctx.ellipse(x, b.y, r * 0.2, r * 0.7, 0, 0, TAU); ctx.stroke();
        Glow.draw(ctx, col, x, b.y, 90 * b.k, (1 - u) * 0.8);
      }
      ctx.restore();
    }
  }

  function phoenixRise(f, att) {
    f.mods.phoenix--;
    f.phoenixUsed = true;
    f.hp = Math.round(f.maxHp * 0.6);
    f.invuln = Math.max(f.invuln, 1.6);
    const c = f.center();
    G.flash('#ffb13d', 0.6); G.shake(16); G.slow(0.3, 0.7);
    G.fx.ring(c.x, c.y, '#ffd34d', 320, 0.6, 16); G.fx.ring(c.x, c.y, '#ff5a1c', 220, 0.45, 12);
    for (let i = 0; i < 40; i++) { const a = rand(0, TAU), v = rand(300, 900); G.fx.add({ kind: 'flame', x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, life: rand(0.4, 0.8), size: rand(10, 18), color: i % 3 ? '#ff7a2a' : '#ffd34d' }); }
    // the blast throws the attacker clear
    if (att && att.alive) { att.root.vx = Math.sign(att.root.x - f.root.x || 1) * 1100; att.root.vy = -500; att.root.grounded = false; }
    G.callout('REBORN', 'PHOENIX', 'perfect', 1.3);
    Sfx.play('flame'); Sfx.play('rise');
  }

  // Ranged attacks fly at torso height, not head height: a shot fired from a
  // raised hand or the shoulder by a grounded fighter leaves the hand, then
  // settles onto the torso line within a few frames (low shots are untouched).
  const TORSO = 62;
  G.proj = o => {
    const p = Object.assign({ t: 0, hits: 0, tk: 0, every: 0.1, multi: 1, strength: 1, life: 1.5 }, o);
    const f = p.owner;
    if (f && f.action && f.action.move && f.action.move.kind !== 'super') {
      f.action.move.ranged = true;
      // projectile specials hit a little softer than a committed close-range special
      if (f.action.move.kind === 'special') { if (p.spec) p.spec = Object.assign({}, p.spec, { dmg: Math.round(p.spec.dmg * 0.8) }); if (p.final) p.final = Object.assign({}, p.final, { dmg: Math.round(p.final.dmg * 0.8) }); }
    }
    if (f && f.root && f.root.grounded && !p.keepY && Math.abs(p.vx) > Math.abs(p.vy || 0)) {
      const dy = f.root.y - TORSO * f.s - p.y;
      // a combo finisher's shot comes out at torso height at once so it keeps the combo; others glide down from the hand
      if (dy > 4) { if (f.action && f.action.key === 'hEnd') p.y += dy; else p.settleY = dy; }
    }
    G.projs.push(p); return p;
  };
  G.beam = o => { const b = Object.assign({ t: 0, len: 0, tk: 1, lastHit: -9 }, o); G.beams.push(b); return b; };
  G.field = o => { const fl = Object.assign({ t: 0, tk: 0, dead: false }, o); G.fields.push(fl); return fl; };
  G.teleport = function (f, x, y) {
    G.ghost(f, f.def.aura || f.def.color);
    const dx = x - f.root.x, dy = y - f.root.y;
    f.root.x = x; f.root.y = y; f.root.vx = 0; f.root.vy = 0;
    f.root.grounded = y >= GROUND - 1;
    for (const p of f.pts) { p.x += dx; p.y += dy; p.px += dx; p.py += dy; }
    f.shiftCloth(dx, dy);
    f.snap();   // no blend across a teleport
    G.fx.add({ kind: 'smoke', x: x, y: y - 100 * f.s, size: 40, life: 0.3, color: '#ffffff', add: false });
  };
  G.ghost = function (f, color, life = 0.35) {
    const g = Object.create(f);
    g.pts = f.pts.map(p => ({ x: p.x, y: p.y, px: p.x, py: p.y }));
    g.chains = f.chains.map(c => Object.assign({}, c, { pts: c.pts.map(p => ({ x: p.x, y: p.y })) }));
    g.shake = 0; g.alpha = 1; g.surge = 0; g.auraT = 0; g.eyeGlint = 0; g.stopT = 0; g.hidden = false; g.invuln = 0; g.mode = 'active';
    G.ghosts.push({ g, color, t: 0, life });
    if (G.ghosts.length > 24) G.ghosts.shift();
  };
  // a summoned body that runs at the foe and strikes once: clones and shadow soldiers
  G.minion = function (owner, o) {
    const r = new Rag(o.def || owner.def, { side: owner.side, x: o.x, facing: owner.facing });
    if (o.scale) r.s *= o.scale;
    r.baseS = r.s;
    r.hidden = true;
    if (o.hover) { r.root.y = GROUND - 30; r.root.hover = true; r.root.grounded = false; }
    const m = Object.assign({ rag: r, owner, kind: 'minion', life: 0.8, speed: 1000, box: [56, -40, 36], pose: POSES.airK.strike }, o);
    m.t = -(o.delay || 0);
    G.summons.push(m);
    return m;
  };
  G.cloneOf = function (owner, x, facing, delay) {
    G.minion(owner, { x, delay, hover: true, life: 0.62, speed: 1150, box: [56, -40, 36], pose: POSES.airK.strike, smoke: true,
      spec: { dmg: 52, kb: [380, -420], stun: 0.6, bstun: 0.2, hs: 0.06, chip: 0.2, launch: true, color: '#ffe27a', kind: 'special', sfx: 'hitH', name: 'Mirror Clones' } });
  };
  // pressure points: marks that go off after a short fuse
  G.mark = function (att, def, n) {
    if (!def || !def.alive) return;
    def.marks = Math.min(8, (def.marks || 0) + n);
    def.markT = 2.2; def.markBy = att;
    G.fx.add({ kind: 'star', x: def.center().x, y: def.center().y, size: 26, life: 0.4, color: '#e2ff9a', rot: 0 });
  };
  G.stand = function (owner, life) {
    const ex = G.summons.find(s => s.kind === 'stand' && s.owner === owner);
    if (ex) { ex.life = Math.max(ex.life, ex.t + life); return ex; }
    const r = new Rag(STAND_DEF, { side: owner.side, x: owner.root.x + owner.facing * 60, facing: owner.facing });
    r.root.hover = true;
    const s = { rag: r, owner, t: 0, kind: 'stand', life };
    G.summons.push(s);
    G.fx.ring(owner.root.x, owner.root.y - 120 * owner.s, '#b39bff', 140, 0.35, 8);
    return s;
  };
  G.timeStop = function (f, d) {
    const o = G.opp(f);
    if (o.alive) { o.stopT = d; o.clearAction(); }
    G.stopOwner = f; G.stopT = d;
  };

  /* --------------------------------------------------------------------- hits */
  function canBlock(def, att) {
    if (def.mode === 'block') return true;
    if (!def.canAct || def.action || !def.root.grounded || def.dashT > 0) return false;
    const toward = Math.sign(att.root.x - def.root.x) || def.facing;
    return def.input.x === -toward;
  }

  G.hit = function (att, def, spec, x, y, act) {
    if (!def || G.state === 'intro' || G.state === 'idle' || G.state === 'over') return null;
    if (def.mode === 'dead') return null;
    if (def.invuln > 0) return null;
    // a counter stance (Hana's Blossom Veil): struck inside it, she answers instead
    const ca = def.action;
    if (ca && ca.move.counter && !ca.countered && att !== def && spec.kind !== 'super' && !spec.unblockable && ca.t >= ca.w && ca.t < ca.w + ca.a) {
      ca.countered = true; ca.move.counter(G, def, att, ca); return 'block';
    }
    if (def.barrierT > 0 && !spec.unblockable) { G.fx.ring(x, y, '#9ff4ff', 70, 0.25, 6); Sfx.play('block'); return 'block'; }
    if (def.mode === 'tumble') {
      const low = def.pelvis.y > GROUND - 50 * def.s && Math.hypot(def.pelvis.x - def.pelvis.px, def.pelvis.y - def.pelvis.py) < 3;
      if (low && !spec.otg) return null;
      if (def.juggle >= JUGGLE_MAX && spec.kind !== 'super') return null;
    }
    if (act) { act.connected = true; act.connT = act.t; att.touchT = G.t; }
    const dir = spec.dir || Math.sign(def.root.x - att.root.x) || att.facing;
    const kind = spec.kind || 'light';
    const stopped = def.stopT > 0;

    /* ---------------------------------------------------------- blocked */
    if (!spec.unblockable && !stopped && canBlock(def, att)) {
      const chip = def.mods.chipImmune ? 0 : Math.round((spec.chip != null ? spec.chip : 0) * spec.dmg * att.def.power * att.mods.dmg * def.mods.taken * (G.cfg.dmgMul || 1));
      def.hp = Math.max(kind === 'super' ? 0 : 1, def.hp - chip);
      def.lastHit = Object.assign({ att }, spec);
      def.guard -= spec.dmg * (kind === 'light' ? 0.22 : 0.4) * def.mods.guard;
      def.guardT = 0;
      att.meter = Math.min(100, att.meter + spec.dmg * 0.05 * att.mods.meter);
      def.meter = Math.min(100, def.meter + spec.dmg * 0.08 * def.mods.meter);
      // Thorns: blocking stings the attacker
      if (def.mods.thorns && kind !== 'super') { att.hp = Math.max(1, att.hp - def.mods.thorns); att.flash = 0.6; G.fx.ring(x, y, '#a06bff', 70, 0.25, 5); }
      G.fx.add({ kind: 'impact', x, y, size: 50, life: 0.12, color: '#8fd6ff', rot: rand(0, TAU) });
      G.fx.ring(x, y, '#8fd6ff', 60, 0.2, 4);
      Sfx.play('block');
      if (def.guard <= 0) {
        def.guard = 55;
        def.stagger(dir * 260, 0, P.NECK, 0.95, false);
        G.say(def.root.x, def.root.y - 300, 'GUARD BREAK', '#ff8a94', 40);
        G.fx.burst(x, y, '#8fd6ff', 26, 700);
        Sfx.play('break'); G.shake(10);
        G.hitstop = Math.max(G.hitstop, 0.12);
        return 'hit';
      }
      def.stagger(dir * (spec.kb ? Math.abs(spec.kb[0]) : 200) * KB * 0.55, 0, P.FHAND, spec.bstun || 0.2, true);
      // pushback on the attacker when the defender is pinned to a wall
      if (def.root.x < WALL_L + 70 * def.s || def.root.x > WALL_R - 70 * def.s) if (att.root.grounded && !att.action?.ghost) att.root.vx = -dir * 380;
      G.hitstop = Math.max(G.hitstop, 0.04);
      return 'block';
    }

    /* -------------------------------------------------------------- hit */
    const cm = G.combo[att.side];
    const inCombo = def.mode === 'hit' || def.mode === 'tumble' || stopped;
    const n = cm && inCombo ? cm.n + 1 : 1;
    // each move may only start a hit twice in one combo; a third use and the victim breaks free
    const uses = cm && inCombo ? Object.assign({}, cm.uses) : {};
    const seen = cm && inCombo ? cm.seen : new Set();
    const mk = act && act.key && kind !== 'super' && !stopped ? act.key : null;
    if (mk && !seen.has(act)) {
      seen.add(act);
      uses[mk] = (uses[mk] || 0) + 1;
      if (uses[mk] > 2) { breakFree(att, def, x, y, dir); return 'block'; }
    }
    const bounced = !!(cm && inCombo && cm.bounced);
    G.combo[att.side] = { n, t: 0, def, uses, seen, bounced: bounced || !!spec.bounce };
    // the longer the combo, the less hitstun each hit adds and the further it pushes
    const decay = Math.max(0.45, 1 - 0.06 * (n - 1));
    let scale = Math.max(kind === 'super' ? 0.55 : 0.3, 1 - 0.09 * (n - 1));
    let tag = null;
    const counter = def.action && def.action.t < def.action.w && def.action.move.kind !== 'super' && kind !== 'super';
    if (counter) { scale *= 1.25; tag = 'COUNTER'; }
    let bf = false;
    if (spec.bf && !stopped && Math.random() < BF_CHANCE + (n >= 3 ? 0.06 : 0) + att.mods.bf) { bf = true; scale *= 2.0; }
    // in levels and Survival the CPU hits a little softer than the player
    const easy = att.side === 1 && (G.cfg.mode === 'level' || G.cfg.mode === 'survival' || G.cfg.mode === 'event') ? 0.8 : 1;
    const exec = att.mods.exec && def.hp < def.maxHp * 0.3 ? 1 + att.mods.exec : 1;
    // cards: Adrenaline (low health) and Momentum (long combos)
    const adren = att.mods.adren && att.hp < att.maxHp * 0.35 ? 1 + att.mods.adren : 1;
    const mom = att.mods.momentum ? 1 + Math.min(0.5, att.mods.momentum * (n - 1)) : 1;
    const dmg = Math.max(1, Math.round(spec.dmg * att.def.power * scale * (G.cfg.dmgMul || 1) * easy * att.mods.dmg * def.mods.taken * exec * adren * mom));
    def.hp -= dmg;
    G.combo[att.side].dmg = (cm && inCombo ? cm.dmg || 0 : 0) + dmg;
    def.lastHit = Object.assign({ att }, spec, { bf });
    if (spec.bounce && !bounced) def.bounce = 1;   // one ground bounce per combo, as in the Vs. games
    def.flash = 0.75;
    att.meter = Math.min(100, att.meter + (dmg * (kind === 'super' ? 0 : 0.085) + (bf ? 25 : 0)) * att.mods.meter);
    def.meter = Math.min(100, def.meter + dmg * 0.06 * def.mods.meter);
    if (att.mods.lifesteal && att.alive) att.hp = Math.min(att.maxHp, att.hp + dmg * att.mods.lifesteal);
    cardEffects(att, def, spec, kind, dmg, n, x, y, dir, stopped);
    // CPUs don't stay trapped: a long enough combo and they burst out
    // (stronger CPUs sooner). Supers and stopped time can't be broken.
    const ctl = G.ctrls[def.side];
    if (ctl instanceof CpuCtrl && kind !== 'super' && !stopped && def.hp > 0 && !(def.burstCd > 0)) {
      if (n === 1 || !def.breakAt) def.breakAt = Math.round(9 - ctl.lv * 0.45) + (Math.random() < 0.5 ? 1 : 0);
      if (n >= def.breakAt) def.breakPending = att;
    }
    // Second Wind: the first knockout blow of a floor leaves them standing
    if (def.hp <= 0 && def.mods.secondWind > 0 && !stopped) {
      def.mods.secondWind--;
      def.hp = Math.round(def.maxHp * 0.2);
      def.invuln = Math.max(def.invuln, 1.0);
      G.say(def.root.x, def.root.y - 320, 'SECOND WIND', '#45e08a', 44);
      G.fx.ring(def.center().x, def.center().y, '#45e08a', 200, 0.5, 10);
      Sfx.play('rise');
    }
    // Phoenix: once per run, rise from the knockout in a burst of fire
    if (def.hp <= 0 && def.mods.phoenix > 0 && !stopped) phoenixRise(def, att);
    if (G.stats && G.mode !== 'demo') {
      if (att.side === 0) { G.stats.dmg += dmg; G.stats.maxCombo = Math.max(G.stats.maxCombo, n); if (bf) G.stats.bf++; }
      else G.stats.taken += dmg;
    }
    const kx = dir * (spec.kb ? spec.kb[0] : 200) * KB, ky = (spec.kb ? spec.kb[1] : 0) * KB;
    // the force goes in where the blow lands: a jab to the face snaps the head back
    const at = def.nearestIdx(x, y);
    const willDie = def.hp <= 0;
    let hs = spec.hs != null ? spec.hs : 0.06;

    if (stopped) {
      // time is stopped: the hits pile up and all land when it resumes
      def.stored = def.stored || { kx: 0, ky: 0 };
      def.stored.kx += kx * 0.5; def.stored.ky += ky * 0.5;
      def.stored.kx = clamp(def.stored.kx, -3200, 3200); def.stored.ky = clamp(def.stored.ky, -2400, 1000);
      if (willDie) def.hp = 0;
    } else {
      const air = !def.root.grounded || def.mode === 'tumble';
      const launch = !spec.noLaunch && (spec.launch || air || willDie);
      if (def.mode === 'tumble' && spec.noLaunch) {
        def.stunT = Math.max(def.stunT, spec.stun || 0.4);
        def.impulse(P.PELVIS, kx * 0.4, ky * 0.6 - 300, 0.8);
        def.juggle++;
      } else if (launch) {
        def.juggle++;
        const lift = air && !spec.launch ? -520 : 0;
        def.tumble((spec.stun || 0.6) * (counter ? 1.2 : 1) * (willDie ? 1 : decay), kx * (willDie ? 1.25 : 1), (ky + lift) * (willDie ? 1.15 : 1) - (willDie ? 500 : 0), spec.launch || at === P.HEAD ? P.NECK : at);
      } else {
        def.stagger(kx * Math.min(2.2, 1 + 0.1 * (n - 1)), ky, at, (spec.stun || 0.3) * (counter ? 1.3 : 1) * decay, false);
        // pinned in the corner: the push goes back onto the attacker instead
        if ((def.root.x < WALL_L + 90 * def.s || def.root.x > WALL_R - 90 * def.s) && att.root.grounded && kind !== 'super') att.root.vx = -dir * (260 + 40 * Math.min(n, 6));
      }
    }

    // presentation
    const k = clamp(dmg / 120, 0.15, 1);
    G.fx.hit(x, y, spec.color || att.def.color, k, dir > 0 ? 0 : Math.PI);
    // each fighter's normals carry their own signature spark
    const hitStyle = att.def.skinHit || (typeof HIT_STYLE !== 'undefined' && HIT_STYLE[att.def.id]);
    if ((kind === 'light' || kind === 'heavy') && hitStyle && HIT_FX[hitStyle]) HIT_FX[hitStyle](G, x, y, dir);
    if (spec.slash || (act && act.move && act.move.slash)) G.fx.slash(x - dir * 30, y, 60, dir > 0 ? -1.2 : 1.9, dir > 0 ? 1.2 : 4.3, '#ffffff', 10, 0.14);
    Sfx.play(spec.sfx || (kind === 'light' ? 'hitL' : 'hitH'), k);
    if (bf) {
      hs = Math.max(hs, 0.22);
      G.fx.crackle(x, y, 9, 200);
      G.fx.ring(x, y, '#ff1838', 220, 0.4, 12);
      G.say(x, y - 120, 'BLACK SPARK', '#ff2c4a', 54);
      G.impact('bf', x, y); G.shake(16);
      Sfx.play('blackflash');
      att.surge = Math.max(att.surge, 1.5);
    } else if (spec.big) {
      G.impact('super', x, y); G.shake(18);
      hs = Math.max(hs, 0.18);
    } else if (counter) {
      G.say(x, y - 90, 'COUNTER', '#ffd34d', 34);
      if (kind !== 'light') G.impact('heavy', x, y);
      hs += 0.04;
    } else if (kind === 'heavy' && dmg >= 60) {
      G.shake(6);
    }
    if (tag === 'COUNTER') Sfx.play('counter');
    // camera: zoom punch and a touch of tilt, scaled to the hit
    if (bf) { G.punch(0.12); G.tilt(0.035); }
    else if (spec.big) { G.punch(0.1); G.tilt(0.025); }
    else if (counter) G.punch(0.05);
    else if (spec.launch && kind === 'heavy') { G.punch(0.06); if (!willDie) G.slow(0.45, 0.16); }
    else if (kind === 'heavy' && dmg >= 50) G.punch(0.03);
    if (!willDie) G.hitstop = Math.max(G.hitstop, hs);
    else G.hitstop = Math.max(G.hitstop, 0.12);
    def.shake = 6;
    return 'hit';
  };

  // the victim of a looping combo shakes it off
  function breakFree(att, def, x, y, dir) {
    G.combo[att.side] = null;
    def.invuln = Math.max(def.invuln, 0.55);
    if (def.mode === 'tumble') def.juggle = JUGGLE_MAX;
    else { def.mode = 'active'; def.stunT = 0; def.m = 1; def.root.vx = dir * 760; }
    att.root.vx = -dir * 320;
    if (att.action && att.action.move.kind !== 'super') endAction(att);
    G.fx.ring(x, y, '#ffffff', 150, 0.3, 8); G.fx.burst(x, y, '#ffffff', 16, 600);
    G.say(def.root.x, def.root.y - 300, 'BREAK!', '#8fd6ff', 40);
    Sfx.play('break'); G.shake(8);
    G.hitstop = Math.max(G.hitstop, 0.08);
  }

  // two normals that strike each other on the same frame clash instead of trading
  function tryClash(f, o, dt) {
    const live = (q, extra) => q.action && q.mode === 'active' && q.action.move.box && !q.action.hitDone && (q.action.move.kind === 'light' || q.action.move.kind === 'heavy') && q.action.t + extra >= q.action.w && q.action.t < q.action.w + q.action.a;
    if (G.state !== 'fight' || !live(o, dt)) return false;
    const mo = o.action.move, pb = o.local(mo.box[0], mo.box[1]);
    if (!f.hitTest(pb.x, pb.y, mo.box[2] * o.s)) return false;
    const pa = f.local(f.action.move.box[0], f.action.move.box[1]);
    const x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2, dir = Math.sign(o.root.x - f.root.x) || 1;
    endAction(f); endAction(o);
    f.root.vx = -dir * 620; o.root.vx = dir * 620;
    G.fx.hit(x, y, '#ffffff', 0.9); G.fx.ring(x, y, '#ffd34d', 200, 0.35, 10);
    G.say(x, y - 110, 'CLASH!', '#ffd34d', 44);
    G.hitstop = Math.max(G.hitstop, 0.16); G.punch(0.06); G.shake(10);
    Sfx.play('clash');
    return true;
  }

  /* --------------------------------------------------------------- actions */
  function startAction(f, key, opt) {
    const mv = f.def.moves[key];
    if (!mv) return false;
    const act = Object.assign({ move: mv, key, t: 0, w: mv.w, a: mv.a, r: mv.r, connected: false, vx: null, vy: null }, opt || {});
    if (f.action && f.action.move.end) f.action.move.end(G, f, f.action);
    f.action = act;
    f.blocking = false;
    f.dashT = 0;
    if (!f.root.grounded && (mv.kind === 'special' || mv.kind === 'super')) { f.root.hover = true; f.root.vy = 0; }
    if (mv.kind === 'special') f.cds[key] = (mv.cd || 2) * f.mods.cd;
    if (mv.kind === 'super') { f.meter = f.mods.superRefund || 0; G.ghost(f, f.def.color, 0.5); }
    if (mv.kind === 'light' || mv.kind === 'heavy' || mv.kind === 'throw') Sfx.play(mv.kind === 'light' ? 'swish' : 'swishH');
    if (mv.kind === 'special') {
      // anime-style move callout over the fighter's head
      const hd = f.head();
      G.fx.text(hd.x, hd.y - 70, mv.name.toUpperCase(), f.def.color, 24, { dur: 0.75, vy: -40 });
      Sfx.play('special');
    }
    if (mv.start) mv.start(G, f, act);
    return true;
  }
  function endAction(f) {
    const act = f.action;
    if (!act) return;
    // remember a jab that just finished, for the chain grace window
    f.lastChain = (act.key === 'l1' || act.key === 'l2') && f.mode === 'active' ? { key: act.key, t: G.t, hit: act.connected } : null;
    if (act.move.end) act.move.end(G, f, act);
    f.action = null;
    f.root.hover = false;
    f.hideArm = false;
    f.alpha = 1;
  }
  G.endAction = endAction;

  function onLand(f) {
    G.fx.dust(f.root.x, GROUND, 4);
    f.airCombo = 0;
    const act = f.action;
    if (!act) return;
    if (act.move.onLand) act.move.onLand(G, f, act);
    if (f.action === act && (act.move.air || act.move.endOnLand)) endAction(f);
  }

  // Street Fighter's fireball rule: one projectile of your own on screen at a
  // time, so a ranged move can't be fired again until the last one is gone
  function ownShot(f) { return G.projs.some(p => p.owner === f && !p.dead && p.strength < 9 && p.t < p.life); }
  G.ownShot = ownShot;
  // a string keeps going if the next button comes a moment after the swing
  // finished, not only while it is still out: players press on rhythm, and a
  // press a few frames late should still read as the combo (a fresh jab
  // otherwise restarts it)
  const CHAIN_GRACE = 0.14;
  function chainGrace(f, key) {
    const c = f.lastChain;
    if (!c || c.key !== key || G.t - c.t > CHAIN_GRACE || f.mode !== 'active') return false;
    f.lastChain = null;
    return true;
  }
  function tryAction(f, k) {
    if (!(G.state === 'fight')) return false;
    if (!f.canAct) return false;
    const act = f.action;
    const g = f.root.grounded;
    const cancel = act && act.connected && act.t >= act.w;
    // chains run on a hit, a block or a whiff: the next button just has to come once the swing is out
    const chainOk = act && (act.connected || act.t >= act.w + act.a * 0.5);
    const kindNow = act ? act.move.kind : null;
    switch (k) {
      case 'jump':
        // launcher jump-cancel: after the combo ender connects, jump chases the foe into the air
        if (act && act.key === 'hEnd' && act.connected && act.t >= act.w + act.a * 0.5 && G.opp(f).mode === 'tumble') {
          endAction(f);
          const o = G.opp(f), r = f.root;
          r.vy = -f.jumpV * f.s * 1.2; r.vx = clamp((o.root.x - r.x) * 2.2, -900, 900); r.grounded = false; r.jumps = f.maxJumps;
          f.airCombo = 0; G.fx.dust(r.x, GROUND, 6); G.fx.ring(r.x, GROUND, '#ffffff', 80, 0.3, 4);
          return true;
        }
        if (act) return false; return f.jump();
      case 'dashF': case 'dashB': {
        if (act) return false;
        const toward = Math.sign(G.opp(f).root.x - f.root.x) || f.facing;
        return f.dash(k === 'dashF' ? toward : -toward);
      }
      case 'l':
        if (!act && g && chainGrace(f, 'l1')) return startAction(f, 'l2', { chained: true });
        if (!act) { if (!g) f.airCombo = (f.airCombo || 0); return startAction(f, g ? 'l1' : 'airL', { chained: false }); }
        if (chainOk && act.key === 'l1') return startAction(f, 'l2', { chained: true });
        // air chain: two air jabs, then an air heavy
        if (chainOk && act.key === 'airL' && !g && (f.airCombo || 0) < 2) { f.airCombo = (f.airCombo || 0) + 1; return startAction(f, 'airL', { chained: true, alt: true }); }
        return false;
      case 'h':
        const lc = f.lastChain;
        if (!act && g && chainGrace(f, 'l2')) {
          if (f.def.moves.hEnd.far && (ownShot(f) || !(lc.hit || Math.abs(G.opp(f).root.x - f.root.x) < 300 * f.s / 2))) return startAction(f, 'h', { chained: true });
          return startAction(f, 'hEnd', { chained: true });
        }
        if (!act) return startAction(f, g ? 'h' : 'airH');
        // light, light, heavy is the finisher; light, heavy is just a heavy
        if (chainOk && act.key === 'l2' && g) {
          // a ranged finisher needs the chain to touch: whiffing light, light, heavy from full screen is just a heavy
          if (f.def.moves.hEnd.far && (ownShot(f) || !(act.connected || G.t - (f.touchT ?? -9) < 0.6 || Math.abs(G.opp(f).root.x - f.root.x) < 300 * f.s / 2))) return startAction(f, 'h', { chained: true });
          return startAction(f, 'hEnd', { chained: true });
        }
        if (chainOk && act.key === 'l1' && g) return startAction(f, 'h', { chained: true });
        if (chainOk && act.key === 'airL' && !g) return startAction(f, 'airH', { chained: true, spike: true });
        return false;
      case 's1': case 's2': {
        const key = k === 's1' ? 'sp1' : 'sp2';
        const mv = f.def.moves[key];
        if (f.cds[key] > 0) return false;
        if ((mv.ranged || (mv.ai && mv.ai.zone)) && ownShot(f)) return false;
        if (!g && !mv.air) return false;
        if (!act || (cancel && (kindNow === 'light' || kindNow === 'heavy'))) return startAction(f, key);
        return false;
      }
      case 'sup': {
        if (f.meter < 100) return false;
        if (!act || (cancel && kindNow !== 'super')) return startAction(f, 'super');
        return false;
      }
      case 'throw':
        if (act || !g) return false;
        return startAction(f, 'throw');
      default: return false;
    }
  }

  function handleInput(f) {
    if (!f.buf || !f.buf.length) return;
    const now = G.t;
    // presses wait up to 0.3 s for the current swing, and attacks come out in
    // the order they were pressed: a later button never jumps the queue ahead of
    // an earlier attack (that turned a fast light, light, heavy into light, heavy)
    f.buf = f.buf.filter(p => now - p.t < 0.3);
    for (let i = 0; i < f.buf.length; i++) {
      const k = f.buf[i].k;
      if (tryAction(f, k)) { f.buf.splice(0, i + 1); break; }
      if (k === 'l' || k === 'h') break;
    }
  }
  // any button during the round intro skips straight to FIGHT!
  G.skipIntro = function () {
    if (G.state !== 'intro' || G.stateT < 0.3) return false;
    G.callouts.length = 0;
    G.state = 'fight'; G.stateT = 0; G.introSaid = G.nameA = G.nameB = false;
    G.callout('FIGHT!', '', 'fight', 0.6); Sfx.play('fight');
    for (const f of G.fighters) { f.pose = null; if (f.buf) f.buf.length = 0; }
    return true;
  };
  G.press = function (side, k) {
    const f = G.fighters[side];
    if (!f || !f.buf) return;
    if (G.state === 'intro' && G.ctrls[side] && G.ctrls[side].human && G.mode !== 'demo') { G.skipIntro(); return; }
    f.buf.push({ k, t: G.t });
    if (f.buf.length > 8) f.buf.shift();
  };

  /* Frame data, the way Street Fighter does it: a grounded normal's hitstun
     is whatever is left of the attacker's swing plus a fixed advantage.
     A jab leaves you a hair ahead (+), so it can be CHAINED into the next
     button while it's still out, but not re-pressed from neutral; the second
     light leaves you slightly behind (-), so mashing after a string gets
     you jabbed. Blocked normals leave the attacker minus, heavies most. */
  const ADV = {
    l1: { hit: 0.03, block: -0.01 },
    l2: { hit: -0.03, block: -0.05 },
    h: { hit: 0.02, block: -0.08 },
  };
  function frameData(f, o, act, mv, spec) {
    const fd = mv.adv || ADV[act.key];
    if (!fd || spec.launch || !f.root.grounded || !o.root.grounded || o.mode === 'tumble') return;
    const left = Math.max(0, act.w + act.a + act.r - act.t);
    spec.stun = Math.max(0.08, left + fd.hit);
    spec.bstun = Math.max(0.06, left + fd.block);
  }
  G.ADV = ADV;

  function runAction(f, dt) {
    const act = f.action;
    if (!act) return;
    if (f.mode !== 'active') { endAction(f); return; }
    act.t += dt;
    const mv = act.move;
    const w = act.w, a = act.a;
    // combo tracking: a chained normal steps in toward a foe still reeling from the last hit
    const airJuggle = !f.root.grounded && (act.key === 'airL' || act.key === 'airH') && G.opp(f).mode === 'tumble';
    if ((act.chained || airJuggle) && mv.box && act.t < w + a && act.vx == null) {
      const o = G.opp(f);
      const reeling = o.mode === 'hit' || o.mode === 'tumble' || o.mode === 'block';
      const gap = (o.root.x - f.root.x) * f.facing - (mv.box[0] - mv.box[2] * 0.5) * f.s;
      if (reeling && gap > 0 && gap < 110) { f.root.x += f.facing * Math.min(gap, 700 * dt); }
      if (!f.root.grounded && reeling && o.mode === 'tumble') {
        // in the air, drift toward the juggled foe so air strings connect
        const c = o.center(), me = f.center();
        const dx = c.x - (me.x + f.facing * mv.box[0] * f.s * 0.7);
        if (Math.abs(dx) < 300) f.root.x += clamp(dx, -700 * dt, 700 * dt);
        f.root.vy = lerp(f.root.vy, clamp((c.y - me.y) * 6, -500, 400), 0.25);
      }
    }
    if (mv.box && act.t >= w && act.t < w + a && !act.hitDone) {
      const o = G.opp(f);
      const p = f.local(mv.box[0], mv.box[1]);
      const res = o.hitTest(p.x, p.y, mv.box[2] * f.s);
      // two normals landing on the same frame clash instead of trading
      if (res && (mv.kind === 'light' || mv.kind === 'heavy') && tryClash(f, o, dt)) return;
      if (res) {
        const spec = Object.assign({ kind: mv.kind, name: mv.name }, mv.hit);
        if (act.spike) Object.assign(spec, { kb: [160, 900], launch: true, bounce: true, stun: 0.8 });
        frameData(f, o, act, mv, spec);
        const out = G.hit(f, o, spec, res.x, res.y, act);
        if (out) act.hitDone = true;
        if (out === 'hit' && mv.onHit) mv.onHit(G, f, o, act);
      }
    }
    if (mv.slash && act.t >= w && once(act, 'slfx')) {
      const n = f.pts[P.NECK];
      const red = f.def.form && f.surge > 0;   // a transformed fighter's swings carry their colour
      G.fx.slash(n.x + f.facing * 10, n.y + 30, 80 + (f.def.reach || 0), f.facing > 0 ? -1.3 : -1.85, f.facing > 0 ? 1.3 : -4.45 + 0.01, red ? '#ff5a6a' : '#e8f4ff', 14, 0.16);
    }
    if (mv.rubber) { const ph = phaseOf(act).ph; f.hideArm = ph === 1; }
    if (mv.kind === 'special' || mv.kind === 'super') {
      const h = f.pts[P.FHAND];
      if (act.t < act.w && Math.floor(act.t * 60) % 2 === 0) {
        // energy gathers at the hand during the wind-up
        const ang = rand(0, TAU), d = rand(50, 110);
        G.fx.add({ x: h.x + Math.cos(ang) * d, y: h.y + Math.sin(ang) * d, vx: -Math.cos(ang) * d * 5, vy: -Math.sin(ang) * d * 5, life: 0.18, size: rand(4, 7), color: f.def.aura || f.def.color });
      }
      if (act.t >= act.w && once(act, 'rel')) { G.fx.ring(h.x, h.y, f.def.color, 70, 0.25, 6); G.fx.burst(h.x, h.y, f.def.aura || f.def.color, 8, 360); }
      if (act.vx && Math.abs(act.vx) > 600 && Math.floor(act.t / 0.04) !== act.lastG) { act.lastG = Math.floor(act.t / 0.04); G.ghost(f, f.def.color, 0.2); }
    }
    if (mv.tick) mv.tick(G, f, act, dt);
    if (f.action === act && act.t >= act.w + act.a + act.r && !act.hold) endAction(f);
  }

  /* ----------------------------------------------------------- simulation */
  function separate() {
    const [a, b] = G.fighters;
    if (!a || !b) return;
    if (a.mode === 'dead' || b.mode === 'dead' || a.mode === 'tumble' || b.mode === 'tumble') return;
    if ((a.action && a.action.ghost) || (b.action && b.action.ghost)) return;
    if (a.stopT > 0 || b.stopT > 0) return;
    const dy = Math.abs(a.root.y - b.root.y);
    if (dy > 130 * a.s) return;
    const minD = 58 * (a.s + b.s) / 2;
    const dx = b.root.x - a.root.x;
    const d = Math.abs(dx);
    if (d >= minD) return;
    const push = (minD - d) / 2;
    const sgn = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
    let pa = push, pb = push;
    const lo = WALL_L + 24 * a.s, hi = WALL_R - 24 * a.s;
    if (a.root.x - sgn * pa < lo || a.root.x - sgn * pa > hi) { pb += pa; pa = 0; }
    if (b.root.x + sgn * pb < lo || b.root.x + sgn * pb > hi) { pa += pb; pb = 0; }
    a.root.x = clamp(a.root.x - sgn * pa, lo, hi);
    b.root.x = clamp(b.root.x + sgn * pb, lo, hi);
  }

  // the screen is the leash: like Street Fighter, two grounded fighters can
  // never be further apart than the camera can frame, so the one walking away
  // stops at the edge of the screen instead of the edge of the stage
  function leash() {
    const [a, b] = G.fighters;
    if (!a || !b || !a.alive || !b.alive) return;
    const d = b.root.x - a.root.x;
    if (Math.abs(d) <= MAX_SEP) return;
    const over = Math.abs(d) - MAX_SEP, sg = Math.sign(d);
    const free = f => f.mode !== 'tumble' && !(f.action && f.action.ghost) && f.stopT <= 0;
    // move whoever is moving away (or both, if both are)
    const va = a.root.vx * -sg, vb = b.root.vx * sg;
    let ka = va > vb ? 1 : va < vb ? 0 : 0.5;
    if (!free(a)) ka = 0; if (!free(b)) ka = 1;
    if (!free(a) && !free(b)) return;
    a.root.x += sg * over * ka; b.root.x -= sg * over * (1 - ka);
    if (ka > 0 && a.root.vx * -sg > 0) a.root.vx = 0;
    if (ka < 1 && b.root.vx * sg > 0) b.root.vx = 0;
  }

  function faceEachOther() {
    for (const f of G.fighters) {
      const o = G.opp(f);
      if (!o) continue;
      if ((f.mode === 'active' && !f.action && f.root.grounded && f.dashT <= 0) || f.mode === 'rising') {
        const want = Math.sign(o.root.x - f.root.x);
        if (want && want !== f.facing && Math.abs(o.root.x - f.root.x) > 8) f.facing = want;
      }
      // hold back to guard: show the guard pose when something is coming
      f.blocking = false;
      if (f.canAct && !f.action && f.root.grounded && f.dashT <= 0) {
        const toward = Math.sign(o.root.x - f.root.x) || f.facing;
        if (f.input.x === -toward) {
          const threat = (o.action && Math.abs(o.root.x - f.root.x) < 420) || G.projs.some(p => p.owner === o && Math.abs(p.x - f.root.x) < 460) || G.beams.some(b => b.owner === o);
          f.blocking = threat;
        }
      }
    }
  }

  function updateProjs(dt) {
    for (const p of G.projs) {
      if (p.owner.stopT > 0) continue;
      if (G.stopT > 0 && G.stopOwner !== p.owner) continue;
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.settleY) { const m = p.settleY * Math.min(1, dt * 22); p.y += m; p.settleY -= m; if (p.settleY < 0.3) { p.y += p.settleY; p.settleY = 0; } }
      if (p.t > p.life) { p.dead = true; continue; }
      if (p.x < WALL_L - 10 || p.x > WALL_R + 10) { p.dead = true; borderHit(p.x < 800 ? -1 : 1, p.y, 0.8); continue; }
      const o = G.opp(p.owner);
      if (o && o.barrierT > 0 && p.strength < 9 && dist(p.x, p.y, o.center().x, o.center().y) < 120 * o.s / 2 + p.r) {
        p.owner = o; p.vx = -p.vx * 1.15; p.t = 0; p.spent = false; p.hits = 0;
        G.say(p.x, p.y - 60, 'REFLECT', '#9ff4ff', 30); Sfx.play('clash');
        continue;
      }
      // clashes: projectiles of opposing fighters cancel; the stronger survives
      for (const q of G.projs) {
        if (q === p || q.dead || p.dead || q.owner === p.owner) continue;
        if (dist(p.x, p.y, q.x, q.y) < p.r + q.r) {
          G.fx.burst((p.x + q.x) / 2, (p.y + q.y) / 2, '#ffffff', 16, 500);
          G.fx.ring((p.x + q.x) / 2, (p.y + q.y) / 2, '#ffffff', 90, 0.3, 6);
          Sfx.play('clash');
          if (p.strength > q.strength) { q.dead = true; p.strength -= q.strength; }
          else if (q.strength > p.strength) { p.dead = true; q.strength -= p.strength; }
          else { p.dead = q.dead = true; }
        }
      }
      if (p.dead || !o || !o.alive) continue;
      p.tk += dt;
      const res = o.hitTest(p.x, p.y, p.r);
      if (!res) continue;
      if (p.multi > 1) {
        if (p.grind && !p.slowed) { p.slowed = true; p.vx *= p.grind; }
        if (p.tk >= p.every) {
          p.tk = 0; p.hits++;
          const last = p.hits >= p.multi && p.final;
          const r = G.hit(p.owner, o, last ? p.final : p.spec, res.x, res.y, null);
          if (last && r) { if (p.wash) { p.multi = 1; p.spent = true; } else p.dead = true; }   // a wave washes on through after its last hit
          if (r === 'block' && !p.pierce) p.dead = true;
        }
      } else {
        if (p.spent) continue;
        const r = G.hit(p.owner, o, p.spec, res.x, res.y, null);
        if (r) {
          if (r === 'hit' && p.onHit) p.onHit(G, p, o);
          if (!p.pierce || r === 'block') p.dead = true; else p.spent = true;
        }
      }
    }
    for (let i = G.projs.length - 1; i >= 0; i--) if (G.projs[i].dead) { const p = G.projs[i]; G.fx.burst(p.x, p.y, p.color || '#fff', 8, 260); G.projs.splice(i, 1); }
  }

  function beamHitsOpp(b, o) {
    const step = 34, n = Math.ceil(b.len / step);
    for (let i = 0; i <= n; i++) {
      const x = b.x + b.dir * Math.min(b.len, i * step);
      const r = o.hitTest(x, b.y, b.width * 0.42);
      if (r) return r;
    }
    return null;
  }
  function updateBeams(dt) {
    for (const b of G.beams) {
      if (b.owner.stopT > 0) continue;
      b.t += dt;
      const maxLen = b.dir > 0 ? WALL_R + 300 - b.x : b.x - (WALL_L - 300);
      b.len = Math.min(maxLen, b.len + b.grow * dt);
      const o = G.opp(b.owner);
      // the beam swallows weaker projectiles in its path
      for (const p of G.projs) if (p.owner !== b.owner && p.strength < 9 && Math.abs(p.y - b.y) < b.width && (p.x - b.x) * b.dir > 0 && (p.x - b.x) * b.dir < b.len) p.dead = true;
      if (b.t < b.dur && o && o.alive) {
        b.tk += dt;
        const res = beamHitsOpp(b, o);
        if (res && b.tk >= b.every) { b.tk = 0; if (G.hit(b.owner, o, b.spec, res.x, res.y, null)) b.lastHit = b.t; }
      }
      if (b.t >= b.dur && !b.finished) {
        b.finished = true;
        if (b.final && o && o.alive && b.t - b.lastHit < 0.35) {
          const res = beamHitsOpp(b, o) || { x: o.center().x, y: o.center().y };
          G.hit(b.owner, o, b.final, res.x, res.y, null);
        }
      }
      if (b.t > b.dur + 0.25) b.dead = true;
    }
    G.beams = G.beams.filter(b => !b.dead);
  }

  function updateFields(dt) {
    for (const fl of G.fields) {
      if (fl.owner.stopT > 0) continue;
      fl.t += dt;
      const o = G.opp(fl.owner);
      if (o && o.alive && fl.t < fl.life) {
        const c = o.center();
        const dx = fl.x - c.x, dy = fl.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (fl.pull && d < 600 && o.stopT <= 0 && o.invuln <= 0) {
          const k = fl.pull * dt * (1 - d / 700);
          if (o.mode === 'tumble') { for (const p of o.pts) { p.x += dx / d * k * dt * 60; p.y += dy / d * k * dt * 30; } }
          else if (o.mode !== 'dead') { o.root.vx += dx / d * k; }
        }
        if (fl.hold && fl.hold === o && o.mode === 'tumble') {
          for (const p of o.pts) { p.x += (fl.x - c.x) * 0.08; p.y += (fl.y - c.y) * 0.08; p.px = lerp(p.px, p.x, 0.3); p.py = lerp(p.py, p.y, 0.3); }
          o.stunT = Math.max(o.stunT, 0.3);
        }
        fl.tk += dt;
        if (fl.tk >= fl.every) {
          fl.tk = 0;
          const res = o.hitTest(fl.x, fl.y, fl.r);
          if (res) G.hit(fl.owner, o, fl.spec, res.x, res.y, null);
        }
      }
      if (fl.t >= fl.life && !fl.dead) {
        fl.dead = true;
        G.fx.ring(fl.x, fl.y, fl.color, fl.r * 2, 0.4, 10);
        G.fx.burst(fl.x, fl.y, fl.color, 24, 600);
        Sfx.play('pop');
        if (fl.final && o && o.alive) {
          const res = o.hitTest(fl.x, fl.y, fl.r * 1.4);
          if (res) G.hit(fl.owner, o, fl.final, res.x, res.y, null);
        }
      }
    }
    G.fields = G.fields.filter(fl => !fl.dead);
  }

  function updateSummons(dt) {
    for (const s of G.summons) {
      s.t += dt;
      const r = s.rag, own = s.owner, o = G.opp(own);
      if (s.kind === 'minion') {
        if (s.t < 0) continue;
        if (r.hidden) {
          r.hidden = false;
          r.facing = Math.sign(o.root.x - r.root.x) || r.facing;
          if (s.smoke) G.fx.add({ kind: 'smoke', x: r.root.x, y: r.root.y - 100 * r.s, size: 60, life: 0.4, color: '#ffffff', add: false });
          if (s.rise) { G.fx.ring(r.root.x, GROUND, s.glow || '#8a6bff', 80, 0.4, 6); for (let i = 0; i < 8; i++) G.fx.add({ kind: 'smoke', x: r.root.x + rand(-40, 40), y: GROUND - rand(0, 30), vx: rand(-60, 60), vy: rand(-200, -60), size: rand(16, 30), life: 0.6, color: '#1a0f33', add: false }); }
        }
        const rising = s.rise && s.t < 0.22;
        r.pose = rising ? POSES.block : s.pose;
        r.root.vx = rising ? 0 : r.facing * s.speed;
        if (s.hover) r.root.y = GROUND - 40;
        r.update(dt);
        if (!s.hit && !rising && o.alive) {
          const p = r.local(s.box[0], s.box[1]);
          const res = o.hitTest(p.x, p.y, s.box[2] * (s.scale || 1));
          if (res) { s.hit = true; G.hit(own, o, Object.assign({ dir: r.facing }, s.spec), res.x, res.y, null); s.t = Math.max(s.t, s.life - 0.1); if (s.rise) G.fx.slash(res.x, res.y, 70, -1.2, 1.4, s.glow || '#8a6bff', 14, 0.25); }
        }
        if (s.t >= s.life || r.root.x <= WALL_L + 50 || r.root.x >= WALL_R - 50) {
          s.dead = true;
          G.fx.add({ kind: 'smoke', x: r.root.x, y: r.root.y - 100 * r.s, size: 60, life: 0.4, color: s.mono ? '#1a0f33' : '#ffffff', add: false });
        }
      } else if (s.kind === 'stand') {
        const act = own.action;
        const barrage = act && (act.key === 'sp1' || (act.key === 'super' && act.t > act.w)) && act.t > act.w * 0.5;
        const point = act && act.key === 'sp2';
        r.facing = own.facing;
        const tx = own.root.x + own.facing * (barrage ? 70 : point ? 30 : -40) * own.s / 2 * 1.2;
        r.root.x = lerp(r.root.x, tx, 0.25); r.root.y = GROUND - 26; r.root.vx = 0; r.root.vy = 0;
        r.action = barrage ? { move: { poseFn: barragePose(18) }, t: s.t, w: 0, a: 99, r: 0 } : point ? { move: { pose: 'point' }, t: 1, w: 0.01, a: 99, r: 0, hold: true } : null;
        r.mode = 'active';
        if (own.stopT <= 0) r.update(dt);
        if (s.t >= s.life || !own.alive) s.dead = true;
      }
    }
    G.summons = G.summons.filter(s => !s.dead);
  }

  function updateCombo(dt) {
    for (let i = 0; i < 2; i++) {
      const c = G.combo[i];
      if (!c) continue;
      const d = c.def;
      if (d.mode === 'active' || d.mode === 'rising') { c.t += dt; if (c.t > 0.3) G.combo[i] = null; }
    }
  }

  function step(dt) {
    G.t += dt;
    G.stateT += dt;
    // transformation effects (e.g. Jin's red form) run while the fighter is surging
    for (const f of G.fighters) if (f.def.form && f.surge > 0 && f.alive && f.stopT <= 0) f.def.form.tick(G, f, dt);
    if (G.stopT > 0) { G.stopT -= dt; if (G.stopT <= 0) { G.stopOwner = null; G.impact('heavy', G.impactPos.x, G.impactPos.y); Sfx.play('resume'); } }
    const fighting = G.state === 'fight';
    for (let i = 0; i < 2; i++) {
      const f = G.fighters[i], c = G.ctrls[i];
      if (c && f) {
        if (fighting && f.stopT <= 0) c.update(G, f, dt);
        else { f.input.x = 0; }
      }
    }
    for (const f of G.fighters) { if (fighting && f.stopT <= 0) handleInput(f); }
    for (const f of G.fighters) if (f.stopT <= 0) runAction(f, dt);
    for (const f of G.fighters) {
      f.wallHit = 0;
      f.update(dt);
      if (f.eyeGlint > 0) f.eyeGlint -= dt;
      if (f.auraT > 0) f.auraT -= dt;
      if (f.shake > 0) f.shake = Math.max(0, f.shake - dt * 40);
    }
    for (const c of G.corpses) c.update(dt);
    G.corpses = G.corpses.filter(c => c.deadT < 3.6);
    separate();
    leash();
    faceEachOther();
    updateProjs(dt);
    updateBeams(dt);
    updateFields(dt);
    for (let i = G.timers.length - 1; i >= 0; i--) { const t = G.timers[i]; t.t -= dt; if (t.t <= 0) { G.timers.splice(i, 1); t.fn(); } }
    for (const b of G.border) b.t += dt;
    G.border = G.border.filter(b => b.t < 0.6);
    for (const f of G.fighters) {
      // skins breathe their own effects: petals, frost, neon trails
      if (f.def.skinTick && f.alive && f.stopT <= 0) f.def.skinTick(G, f, dt);
      f.borderT = Math.max(0, (f.borderT || 0) - dt);
      const lo = WALL_L + 24 * f.s, hi = WALL_R - 24 * f.s;
      if (f.borderT <= 0 && ((f.root.x <= lo + 2 && f.root.vx < -140) || (f.root.x >= hi - 2 && f.root.vx > 140))) { f.borderT = 0.3; borderHit(f.root.x < 800 ? -1 : 1, f.center().y, 0.6); }
      if (f.burstCd > 0) f.burstCd -= dt;
      if (f.frostT > 0) f.frostT = f.stopT > 0 ? Math.max(f.frostT - dt, 0.01) : 0;
      if (f.breakPending) { const a = f.breakPending; f.breakPending = null; if (fighting && f.alive && f.hp > 0 && f.stopT <= 0 && G.hitstop <= 0.2) comboBreak(f, a); }
      // the floor heal: a short beat, then the bar fills with a green shimmer
      if (f.healLeft > 0 && f.alive) {
        // waits for the FIGHT! banner to clear, then fills while you fight
        if (G.state !== 'fight' || G.stateT < 0.85) continue;
        const c = f.center();
        if (!f.healSaid) { f.healSaid = true; G.fx.text(c.x, c.y - 230, `+${Math.round(f.healLeft / f.maxHp * 100)}% HEALTH`, '#45e08a', 32, { dur: 1.4, vy: -30 }); G.fx.ring(c.x, c.y, '#45e08a', 170, 0.45, 8); Sfx.play('rise'); }
        const k = Math.min(f.healLeft, f.maxHp * 0.5 * dt);
        f.hp = Math.min(f.maxHp, f.hp + k); f.healLeft -= k;
        if (Math.random() < 0.7) G.fx.add({ x: c.x + rand(-34, 34), y: c.y + rand(-50, 50), vx: 0, vy: rand(-160, -80), life: 0.6, size: rand(3, 5), color: Math.random() < 0.5 ? '#45e08a' : '#b8ffd0' });
      }
    }
    if (fighting) for (const f of G.fighters) {
      if (!f.alive || f.stopT > 0) continue;
      // Regeneration heals while you are on your feet; Infinite Ki fills the meter
      if (f.mods.regen && f.mode === 'active' && f.hp < f.maxHp) {
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * f.mods.regen * dt);
        if (Math.random() < dt * 6) { const c = f.center(); G.fx.add({ x: c.x + rand(-26, 26), y: c.y + rand(-40, 30), vx: 0, vy: -90, life: 0.6, size: 4, color: '#45e08a' }); }
      }
      if (f.mods.kiRegen && f.meter < 100) f.meter = Math.min(100, f.meter + f.mods.kiRegen * dt);
    }
    updateSummons(dt);
    updateCombo(dt);
    // wall splats
    for (const f of G.fighters) {
      if (f.mode === 'tumble' && f.wallHit > 11 && !f.splat) {
        f.splat = true;
        const c = f.center();
        G.fx.ring(c.x, c.y, '#ffffff', 160, 0.35, 10);
        borderHit(f.root.x < 800 ? -1 : 1, c.y, 1.6);
        G.shake(12); Sfx.play('splat'); Sfx.play('zap');
        if (f.alive) { G.say(c.x, c.y - 140, 'WALL SPLAT', '#ffffff', 34); f.hp -= 15; f.juggle = Math.max(0, f.juggle - 2); f.lastHit = f.lastHit || { att: G.opp(f), kind: 'heavy' }; if (G.stats && f.side === 1 && G.mode !== 'demo') G.stats.splats++; }
      }
      if (f.mode !== 'tumble') { f.splat = false; f.bounce = 0; }
      // ground bounce from an air spike: one free bounce to keep the combo going
      if (f.bounce && f.mode === 'tumble' && f.pelvis.y > GROUND - 60 * f.s && f.pelvis.y - f.pelvis.py > 2) {
        f.bounce = 0;
        f.impulse(P.PELVIS, 0, -1500, 0.9);
        f.stunT = Math.max(f.stunT, 0.7);
        G.fx.ring(f.pelvis.x, GROUND, '#ffffff', 140, 0.3, 8); G.fx.dust(f.pelvis.x, GROUND, 10); G.shake(8); Sfx.play('splat');
      }
      // speed afterimages on dashes and supers
      if ((f.dashT > 0 || (f.action && f.action.move.kind === 'super' && f.action.t > f.action.w)) && Math.floor(G.t / 0.05) !== f.lastGhost) { f.lastGhost = Math.floor(G.t / 0.05); G.ghost(f, f.def.aura || f.def.color, 0.22); }
    }
    for (const f of G.fighters) {
      if (f.barrierT > 0) f.barrierT -= dt;
      if (f.marks > 0 && f.stopT <= 0 && f.alive) {
        f.markT -= dt;
        if (f.markT <= 0) {
          const n = f.marks; f.marks = 0;
          const c = f.center();
          G.fx.burst(c.x, c.y, '#e2ff9a', 10 + n * 4, 500); G.fx.ring(c.x, c.y, '#e2ff9a', 80 + n * 30, 0.35, 8);
          G.hit(f.markBy || G.opp(f), f, { dmg: 25 * n, kb: [150, n >= 4 ? -900 : -150], stun: 0.6, launch: n >= 4, hs: 0.08, unblockable: true, color: '#e2ff9a', kind: 'special', sfx: 'hitH', name: 'Pressure Point' }, c.x, c.y, null);
        }
      }
    }
    for (const g of G.ghosts) g.t += dt;
    G.ghosts = G.ghosts.filter(g => g.t < g.life);
    G.fx.update(dt);
    if (G.tintS) { G.tintS.t += dt; if (G.tintS.t > G.tintS.d) G.tintS = null; }
    if (G.windS) { G.windS.t += dt; if (G.windS.t > G.windS.d) G.windS = null; }
    roundLogic(dt);
  }

  /* -------------------------------------------------------------- rounds */
  function roundLogic(dt) {
    const [a, b] = G.fighters;
    if (G.state === 'intro' && G.cfg.introPan) {
      // a cinematic intro: each fighter gets the camera and their name, then the round is called
      const t = G.stateT;
      for (const f of G.fighters) f.pose = t < 2.0 ? 'winCross' : null;
      if (t > 0.1 && !G.nameA) { G.nameA = true; const d = G.fighters[0].def; G.callout(d.name, d.title, 'name', 0.75); G.calloutSide = 0; }
      if (t > 0.9 && !G.nameB) { G.nameB = true; const d = G.fighters[1].def; G.callout(d.name, G.cfg.bossIntro ? 'BOSS · ' + d.title : d.title, 'name', 0.75); }
      if (t > 1.7 && !G.introSaid) { G.introSaid = true; G.callout(isFinal() ? 'FINAL ROUND' : (G.cfg.toWin || 2) === 1 ? 'ONE ROUND' : 'ROUND ' + G.round, G.cfg.roundSub || G.stage.name, 'round', 0.9); Sfx.play('round'); }
      if (t > 2.5) { G.state = 'fight'; G.stateT = 0; G.introSaid = G.nameA = G.nameB = false; G.callout('FIGHT!', '', 'fight', 0.8); Sfx.play('fight'); for (const f of G.fighters) f.pose = null; }
      return;
    }
    if (G.state === 'intro') {
      for (const f of G.fighters) f.pose = G.stateT < 1.1 ? 'winCross' : null;
      if (G.stateT > 0.25 && !G.introSaid) { G.introSaid = true; G.callout((G.cfg.toWin || 2) === 1 ? (G.cfg.tutorial ? 'LESSON' : 'ONE ROUND') : isFinal() ? 'FINAL ROUND' : 'ROUND ' + G.round, G.cfg.roundSub || G.stage.name, 'round', 1.2); Sfx.play('round'); }
      if (G.stateT > 1.6) { G.state = 'fight'; G.stateT = 0; G.introSaid = false; G.callout('FIGHT!', '', 'fight', 0.8); Sfx.play('fight'); for (const f of G.fighters) f.pose = null; }
      return;
    }
    if (G.state === 'wave') {
      if (G.stateT > 1.15) spawnWave();
      return;
    }
    if (G.state === 'fight') {
      if (G.cfg.tutorial) {
        // the guided first fight: nobody can be knocked out until the lesson is over
        for (const f of G.fighters) if (f.hp < f.maxHp * 0.3) f.hp = f.maxHp * 0.3;
        return;
      }
      if (G.cfg.training) {
        // the dummy refills once a combo ends
        const d = G.fighters[1];
        if (d.hp < d.maxHp && !G.combo[0]) { d.hp = Math.min(d.maxHp, d.hp + dt * 900); }
        if (d.hp <= 0) d.hp = 1;
        if (G.cfg.trainingMeter) G.fighters[0].meter = 100;
        if (G.fighters[0].hp < G.fighters[0].maxHp * 0.5) G.fighters[0].hp = G.fighters[0].maxHp;
        return;
      }
      G.timer -= dt;
      if (G.stats && G.mode !== 'demo') G.stats.time += dt;
      for (const f of G.fighters) if (f.hp <= 0 && f.alive && f.stopT <= 0) ko(f);
      if (G.state === 'fight' && G.timer <= 0) {
        G.timer = 0;
        const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
        G.winner = G.cfg.loseOnTime ? 1 : ra > rb ? 0 : rb > ra ? 1 : -1;
        G.state = 'ko'; G.stateT = 0; G.koKind = 'time';
        G.callout('TIME', G.winner < 0 ? 'DRAW' : '', 'ko', 1.6);
        Sfx.play('ko');
      }
      return;
    }
    if (G.state === 'ko') {
      for (const f of G.fighters) if (f.hp <= 0 && f.alive && f.stopT <= 0 && G.winner >= 0 && f.side !== G.winner) f.die();
      const w = G.fighters[G.winner];
      if (G.stateT > 1.5 && w && w.alive && w.mode === 'active' && !w.action) {
        if (!w.cele) {
          w.celebrate();
          const perfect = w.hp >= w.maxHp && G.koKind !== 'time';
          G.callout(w.def.name, perfect ? 'PERFECT VICTORY' : 'VICTORY', 'win', 3.2, { color: w.def.color, title: w.def.title });
          // the victory camera: letterbox in, HUD out
          G.winCam = true;
          if (G.mode !== 'demo' && typeof document !== 'undefined') document.body.classList.add('vcam');
          if (perfect) { G.perfectSaid = true; Sfx.play('perfect'); if (G.winner === 0 && G.stats && G.mode !== 'demo') G.stats.perfects++; }
        }
        if (!G.winFocus) { G.winFocus = true; const c = w.center(); G.focus(c.x - (G.mode === 'demo' ? 0 : 140), c.y - 40, 1.3, 3.2); }
      }
      if (G.stateT > 2.1 && !G.perfectSaid && w && w.hp >= w.maxHp && G.koKind !== 'time') { G.perfectSaid = true; G.callout('PERFECT', '', 'perfect', 1.4); Sfx.play('perfect'); if (G.winner === 0 && G.stats && G.mode !== 'demo') G.stats.perfects++; }
      if (G.stateT > 4.6) endRound();
    }
  }
  function isFinal() { return G.wins[0] === (G.cfg.toWin || 2) - 1 && G.wins[1] === (G.cfg.toWin || 2) - 1; }

  function ko(def) {
    const att = G.opp(def);
    const lh = def.lastHit || {};
    // waves: the next foe drops in right away; the level only ends after the last one
    const waves = G.cfg.waves;
    if (def.side === 1 && waves && G.wave < waves.length - 1) {
      def.die();
      def.fadeOut = true;
      G.state = 'wave'; G.stateT = 0;
      const c = def.center();
      if (lh.kind === 'super') { G.impact('super', c.x, c.y); G.slow(0.25, 0.9); G.callout('FINISH', (lh.name || '').toUpperCase(), 'finish', 1.3); if (att.side === 0 && G.stats) G.stats.finishers++; }
      else { G.slow(0.35, 0.6); G.callout('K.O.', '', 'ko', 0.9); }
      G.shake(14); Sfx.play('ko');
      // BEAT THE CLOCK: every knockout before the last buys time back
      if (G.cfg.koBonus && Number.isFinite(G.timer)) { G.timer += G.cfg.koBonus; G.say(c.x, c.y - 200, `+${G.cfg.koBonus} SEC`, '#ffd34d', 40); Sfx.play('clock'); }
      for (const f of G.fighters) if (f.action && f.action.move.kind !== 'super') endAction(f);
      return;
    }
    def.die();
    G.state = 'ko'; G.stateT = 0; G.winner = att.side; G.koKind = 'ko'; G.winFocus = false;
    G.perfectSaid = false;
    const c = def.center();
    const finisher = lh.kind === 'super';
    if (finisher) {
      G.impact('finish', c.x, c.y);
      G.slow(0.2, 1.7);
      G.focus(c.x, c.y - 30, 1.45, 1.9);
      G.callout('FINISH', (lh.name || '').toUpperCase(), 'finish', 2.4);
      G.shake(26);
      Sfx.play('finish');
      if (att.side === 0 && G.stats && G.mode !== 'demo') G.stats.finishers++;
      att.eyeGlint = 1.5;
    } else {
      if (Save.data.settings.flashes) G.impact(lh.bf ? 'bf' : 'heavy', c.x, c.y);
      G.slow(0.3, 1.1);
      G.focus(c.x, c.y - 20, 1.25, 1.2);
      G.callout('K.O.', '', 'ko', 1.8);
      G.shake(16);
      Sfx.play('ko');
    }
    for (const f of G.fighters) { if (f.action && f.action.move.kind !== 'super') endAction(f); }
  }

  function spawnWave() {
    const c = G.cfg, p = G.fighters[0];
    G.wave++;
    const id = c.waves[G.wave];
    const x = clamp(p.root.x < 800 ? p.root.x + 520 : p.root.x - 520, WALL_L + 120, WALL_R - 120);
    const f = new Rag(BY_ID[id], { side: 1, x, facing: x > p.root.x ? -1 : 1, hpMul: (c.waveHp || 1) });
    if (c.scale) f.s *= c.scale[1] || 1;
    f.baseS = f.s;
    f.buf = []; f.onLand = () => { onLand(f); if (!f.landedIn) { f.landedIn = true; G.fx.ring(f.root.x, GROUND, f.def.color, 160, 0.4, 10); G.fx.dust(f.root.x, GROUND, 14); G.shake(10); Sfx.play('splat'); } };
    // drop in from above
    for (const q of f.pts) { q.y -= 520; q.py = q.y; }
    f.root.y = GROUND - 520; f.root.grounded = false; f.root.vy = 300;
    f.shiftCloth(0, -520);
    f.invuln = 0.6;
    G.corpses.push(G.fighters[1]);
    G.fighters[1] = f;
    G.ctrls[1] = c.waveCtrl ? c.waveCtrl(G.wave) : new CpuCtrl(4);
    if (G.ctrls[1].reset) G.ctrls[1].reset(f);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
    G.projs.length = 0; G.beams.length = 0; G.fields.length = 0;
    G.combo = [null, null];
    G.hpShown[1] = f.hp;
    G.timer = c.timeLimit ? G.timer : Math.max(G.timer, 80);
    G.state = 'fight'; G.stateT = 0;
    G.callout('NEXT!', f.def.name, 'round', 0.9);
    G.focus(f.root.x, GROUND - 220, 1.22, 0.9);
    Sfx.play('round');
    if (c.onWave) c.onWave(G.wave);
  }

  function endRound() {
    G.meters = G.fighters.map(f => f.meter);
    if (G.winner >= 0) G.wins[G.winner]++;
    if (G.winner === 0 && G.stats && G.mode !== 'demo') G.stats.roundsWon++;
    const toWin = G.cfg.toWin || 2;
    const done = G.wins[0] >= toWin || G.wins[1] >= toWin;
    if (done) {
      G.state = 'over'; G.stateT = 0;
      const res = { winner: G.wins[0] >= toWin ? 0 : 1, wins: G.wins.slice(), stats: G.stats, hp: G.fighters.map(f => clamp(f.hp / f.maxHp, 0, 1)) };
      if (G.cfg.onEnd) G.cfg.onEnd(res);
      return;
    }
    G.round++;
    if (G.cfg.onRound) G.cfg.onRound();
    G.startRound();
  }

  /* ----------------------------------------------------------------- loop */
  G.update = function (realDt) {
    G.realT += realDt;
    // impact frames run in real time and hold the world still
    if (G.impactQ.length) {
      G.impactT += realDt;
      const fdur = 1 / 30;
      while (G.impactT >= fdur && G.impactQ.length) { G.impactT -= fdur; G.impactQ.shift(); }
    }
    if (G.flashC) { G.flashC.a -= realDt * 3; if (G.flashC.a <= 0) G.flashC = null; }
    for (const c of G.callouts) c.t += realDt;
    G.callouts = G.callouts.filter(c => c.t < c.d);
    if (!G.running) { updateCamera(realDt); return; }
    if (G.paused) return;
    if (G.cut) {
      G.cut.t += realDt;
      if (G.cut.t >= G.cut.d) G.cut = null;
      updateCamera(realDt);
      return;
    }
    if (G.impactQ.length) { updateCamera(realDt); return; }
    if (G.slowT > 0) { G.slowT -= realDt; if (G.slowT <= 0) G.slowK = 1; }
    G.shakeA = Math.max(0, G.shakeA - realDt * 60);
    G.acc += realDt * (G.slowT > 0 ? G.slowK : 1) * G.speed * (G.cfg && G.cfg.speedMul || 1);
    let n = 0;
    while (G.acc >= STEP && n < 12 * G.speed) {
      G.acc -= STEP; n++;
      if (G.hitstop > 0) {
        snapAll();
        G.hitstop -= STEP;
        for (const f of G.fighters) if (f.shake > 0) f.shake = Math.max(2, f.shake);
        continue;
      }
      snapAll();
      step(STEP);
    }
    if (n >= 12 * G.speed) G.acc = 0;
    updateCamera(realDt);
    if (G.hpShown) G.fighters.forEach((f, i) => { G.hpShown[i] = Math.max(f.hp, G.hpShown[i] - f.maxHp * 0.35 * realDt * (G.combo[1 - i] ? 0.1 : 1)); if (G.hpShown[i] < f.hp) G.hpShown[i] = f.hp; });
  };

  function updateCamera(dt) {
    const cam = G.cam;
    let tx = 800, tz = 1, top = GROUND;
    if (G.fighters.length === 2) {
      const [a, b] = G.fighters;
      tx = (a.root.x + b.root.x) / 2;
      const d = Math.abs(a.root.x - b.root.x);
      // frame both fighters with room either side; a launched body can pull it wider
      tz = clamp(W / (d + 560), 0.82, 1.12);
      // behind the menu only part of the screen shows, so frame them in that part
      if (G.mode === 'demo' && G.viewFrac < 1) tz = clamp(W * G.viewFrac / (d + 520), 0.6, 1.05);
      top = Math.min(a.head().y, b.head().y, a.pelvis.y - 60, b.pelvis.y - 60);
      if (top < 380) tz = Math.min(tz, 1.06);
      // the intro pans across the fighters
      if (G.state === 'intro' && G.cfg && G.cfg.introPan) {
        const t = G.stateT;
        if (t < 0.85) { tx = a.root.x; tz = 1.45; top = a.head().y; }
        else if (t < 1.65) { tx = b.root.x; tz = 1.45; top = b.head().y; }
      }
    }
    if (G.cut) { const c = G.cut.f.center(); tx = c.x; tz = 1.5; }
    if (G.focusS) {
      const fs = G.focusS; fs.t += dt;
      const k = Math.sin(clamp(fs.t / fs.d, 0, 1) * Math.PI);
      tx = lerp(tx, fs.x, k); tz = lerp(tz, fs.z, k);
      if (fs.t >= fs.d) G.focusS = null;
    }
    const lerpK = 1 - Math.exp(-dt * (G.cut ? 10 : G.state === 'intro' ? 6 : 5));
    cam.z = lerp(cam.z, tz, lerpK);
    const halfW = W / (2 * cam.z);
    const visW = cw / (kView * cam.z);
    const half = Math.min(halfW, visW / 2);
    // the camera may look a little past the border, so its sheet of light
    // and the haze beyond it read as the edge of the world
    tx = clamp(tx, WALL_L - 140 + half, WALL_R + 140 - half);
    if (WALL_R + 140 - half < WALL_L - 140 + half) tx = 800;
    if (G.mode === 'demo' && G.viewShift) tx -= G.viewShift * dpr / (kView * cam.z);
    cam.x = lerp(cam.x, tx, lerpK);
    // keep the floor near the bottom, but rise to follow a juggle into the air
    const visH = ch / (kView * cam.z);
    const floorY = GROUND + (G.floorPad || 110) - visH * 0.5;
    const follow = Math.max(floorY - 240, Math.min(floorY, top - 110 + visH * 0.5));
    cam.y = cam.y == null || !Number.isFinite(cam.y) ? floorY : lerp(cam.y, follow, 1 - Math.exp(-dt * 4));
    // an outside director (tools/trailer.js) may frame the shot itself
    if (G.camHook) G.camHook(cam, { cw, ch, kView, W, dt });
    // zoom punches and tilt on big hits ease back out
    G.punchA = (G.punchA || 0) * Math.exp(-dt * 7);
    G.tiltA = (G.tiltA || 0) * Math.exp(-dt * 6);
  }
  // cinematic camera kicks
  G.punch = a => { G.punchA = Math.min(0.2, (G.punchA || 0) + a); };
  G.tilt = a => { if (Save.data.settings.shake) G.tiltA = (Math.random() < 0.5 ? -1 : 1) * a; };

  /* --------------------------------------------------------------- render */
  const zoomNow = () => G.cam.z * kView * (1 + (G.punchA || 0));
  function worldTransform(shake = true) {
    const z = zoomNow();
    let sx = 0, sy = 0;
    if (shake && G.shakeA > 0) { sx = rand(-1, 1) * G.shakeA * dpr; sy = rand(-1, 1) * G.shakeA * dpr; }
    const t = G.tiltA || 0;
    const c = Math.cos(t) * z, sn = Math.sin(t) * z;
    // rotate and scale about the screen centre, looking at the camera point
    ctx.setTransform(c, sn, -sn, c, cw / 2 + sx - (c * G.cam.x - sn * G.cam.y), ch / 2 + sy - (sn * G.cam.x + c * G.cam.y));
  }
  function viewRect() {
    const z = zoomNow() * (1 - Math.abs(G.tiltA || 0) * 2.5);
    return { x0: G.cam.x - cw / 2 / z, x1: G.cam.x + cw / 2 / z, y0: G.cam.y - ch / 2 / z, y1: G.cam.y + ch / 2 / z };
  }
  G.toScreen = function (x, y) {
    const z = zoomNow();
    return { x: (cw / 2 + (x - G.cam.x) * z) / dpr, y: (ch / 2 + (y - G.cam.y) * z) / dpr };
  };

  function drawFighters(time, mono) {
    for (const c of G.corpses) c.draw(ctx, time, mono);
    const order = G.fighters.slice().sort((a, b) => (a.action ? 1 : 0) - (b.action ? 1 : 0));
    for (const s of G.summons) if (s.kind === 'stand' && !mono) { ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter'; s.rag.draw(ctx, time, '#7d5cff'); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    for (const f of order) {
      const savedHide = f.hideArm;
      const form = !mono && f.def.form && f.surge > 0 && f.alive && !f.hidden;
      if (form) f.def.form.drawBack(G, ctx, f, time);
      f.draw(ctx, time, mono);
      if (form) f.def.form.drawFront(G, ctx, f, time);
      if (!mono && f.action && f.action.move.rubber && savedHide) {
        const n = f.pts[P.NECK];
        const p = f.local(f.action.move.box[0], f.action.move.box[1]);
        drawRubberArm(ctx, f, p.x, p.y);
      }
    }
    for (const s of G.summons) {
      if (s.kind !== 'minion' || s.rag.hidden) continue;
      const rise = s.rise ? clamp(1 - s.t / 0.22, 0, 1) : 0;
      ctx.save();
      if (rise > 0) { ctx.beginPath(); ctx.rect(-5000, -5000, 12000, 5000 + GROUND); ctx.clip(); ctx.translate(0, rise * 260 * s.rag.s / 2); }
      if (s.mono && !mono) {
        const c = s.rag.center();
        ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, s.glow, c.x, c.y, 120 * s.rag.s / 2, 0.5); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.9; s.rag.draw(ctx, time, s.mono);
        const hd = s.rag.head(); ctx.fillStyle = s.glow; ctx.fillRect(hd.x + s.rag.facing * 4, hd.y - 4, 10 * s.rag.facing, 4);
      } else { ctx.globalAlpha = mono ? 1 : 0.92; s.rag.draw(ctx, time, mono); }
      ctx.restore();
    }
  }

  // every body that's drawn: fighters, KO'd foes from earlier waves, summons
  function rags() {
    const out = G.fighters.concat(G.corpses);
    for (const s of G.summons) if (s.rag) out.push(s.rag);
    return out;
  }
  function snapAll() {
    for (const r of rags()) r.snap();
    for (const p of G.projs) { p.lx = p.x; p.ly = p.y; }
  }
  G.snapAll = snapAll;
  // draw the world blended between the last two simulation ticks (see Rag.snap)
  G.render = function () {
    const a = G.running && !G.paused && G.hitstop <= 0 ? clamp(G.acc / STEP, 0, 1) : 1;
    const R = rags(), P = [];
    if (a < 1) {
      for (const r of R) r.lerpIn(a);
      for (const p of G.projs) if (p.lx != null) { P.push([p, p.x, p.y]); p.x = p.lx + (p.x - p.lx) * a; p.y = p.ly + (p.y - p.ly) * a; }
    }
    try { renderFrame(); } finally {
      for (const r of R) r.lerpOut();
      for (const [p, x, y] of P) { p.x = x; p.y = y; }
    }
  };
  function renderFrame() {
    const time = G.realT;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fr = G.impactQ.length ? G.impactQ[0] : null;
    const flashes = Save.data.settings.flashes;
    if (fr && fr !== 'inv' && flashes) { renderImpactFrame(fr, time); drawCallouts(); return; }
    worldTransform();
    const vr = viewRect();
    Stage.draw(ctx, G.stageId, vr, time, G.cam);
    drawTint(vr, time, 'back');
    // shadows
    for (const f of G.fighters) {
      const pv = f.pelvis, h = clamp((GROUND - pv.y) / 300, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(pv.x, GROUND + 4, 60 * f.s / 2 * (1 - h * 0.5), 12 * (1 - h * 0.5), 0, 0, TAU); ctx.fill();
    }
    for (const fl of G.fields) drawField(fl, time);
    for (const g of G.ghosts) { ctx.globalAlpha = 0.45 * (1 - g.t / g.life); g.g.draw(ctx, time, g.color); ctx.globalAlpha = 1; }
    drawFighters(time);
    for (const f of G.fighters) if (f.action && f.action.move.draw) f.action.move.draw(G, ctx, f, f.action, time);
    for (const f of G.fighters) {
      if (f.marks > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.6 + Math.sin(time * (8 + (2.2 - f.markT) * 10)) * 0.4;
        for (let i = 0; i < f.marks; i++) { const q = f.pts[[P.HEAD, P.NECK, P.PELVIS, P.FELB, P.BELB, P.FKNEE, P.BKNEE, P.FHAND][i]]; Glow.draw(ctx, '#e2ff9a', q.x, q.y, 22, pulse); ctx.fillStyle = '#ffffff'; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (f.barrierT > 0) {
        const c = f.center(), R = 120 * f.s / 2, k = Math.min(1, f.barrierT * 4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#00d9ff'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = time * 3 + i * TAU / 6; ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.85, a, a + 0.5); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    // fighters held in ice (Kori)
    for (const f of G.fighters) if (f.frostT > 0 && typeof iceBlock === 'function') iceBlock(ctx, f, Math.min(1, f.frostT * 5));
    for (const b of G.beams) drawBeam(b, time);
    for (const p of G.projs) { if (p.draw) p.draw(ctx, p, time); else orbDraw(ctx, p, time); }
    G.fx.draw(ctx);
    G.fx.drawSlashes(ctx);
    drawBorders(vr, time);
    Stage.drawFront(ctx, G.stageId, vr, time, G.cam);
    G.fx.drawTexts(ctx);
    drawTint(vr, time, 'front');
    // screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    Stage.grade(ctx, G.stageId, cw, ch);
    drawWind(time);
    if (G.cut) drawCutin(time);
    if (fr === 'inv' && flashes) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
    else if (fr && !flashes) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, cw, ch); speedLines(G.toScreen(G.impactPos.x, G.impactPos.y), time, 'rgba(255,255,255,0.5)'); }
    if (G.flashC) { ctx.globalAlpha = clamp(G.flashC.a, 0, 1); ctx.fillStyle = G.flashC.color; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
    const superOn = G.fighters.some(f => f.action && f.action.move.kind === 'super' && f.action.t > f.action.w);
    G.boxK = lerp(G.boxK || 0, superOn ? 0.75 : G.slowT > 0 && G.slowK < 0.5 ? 1 : G.winCam && G.mode !== 'demo' ? 0.85 : 0, G.winCam ? 0.06 : 0.15);
    if (G.boxK > 0.01) letterbox(G.boxK);
    drawCallouts();
  };

  function letterbox(k) {
    const h = ch * 0.09 * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, h); ctx.fillRect(0, ch - h, cw, h);
  }

  function renderImpactFrame(type, time) {
    const bg = type === 'red' ? '#d10f2c' : type === 'white' ? '#ffffff' : '#000000';
    const fg = type === 'white' ? '#000000' : type === 'red' ? '#000000' : '#ffffff';
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    worldTransform();
    const ip = G.impactPos;
    // jagged burst behind the bodies
    ctx.fillStyle = type === 'mono' ? '#ffffff' : type === 'red' ? '#ffffff' : '#000000';
    const seed = Math.floor(G.realT * 30);
    const rnd = mulberry32(seed * 7919);
    ctx.beginPath();
    const N = 26;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, r = (i % 2 ? 60 : 260 + rnd() * 900);
      ctx.lineTo(ip.x + Math.cos(a) * r, ip.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.globalAlpha = type === 'mono' ? 0.22 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    drawFighters(time, fg);
    if (type === 'mono') { for (const f of G.fighters) f.draw(ctx, time, '#ffffff'); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    speedLines(G.toScreen(ip.x, ip.y), time, type === 'white' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)', rnd);
  }

  function speedLines(c, time, color, rnd) {
    rnd = rnd || mulberry32(Math.floor(time * 30));
    const cx = c.x * dpr, cy = c.y * dpr, R = Math.hypot(cw, ch);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, w = 0.004 + rnd() * 0.012, r0 = R * (0.22 + rnd() * 0.25);
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R);
      ctx.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R);
      ctx.closePath();
    }
    ctx.fill();
  }

  function drawField(fl, time) {
    const k = clamp(Math.min(fl.t * 6, (fl.life - fl.t) * 6 + 0.3), 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (typeof fl.draw === 'function') { fl.draw(ctx, fl, time, k); ctx.restore(); return; }
    if (fl.draw === 'hands') {
      // shadow hands burst up through the floor at the end
      const u = fl.t / fl.life;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a0f33'; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(fl.x, GROUND, 90, 14, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      const up = easeOut(clamp((u - 0.55) / 0.45, 0, 1));
      for (let i = 0; i < 4; i++) {
        const x = fl.x + (i - 1.5) * 34, h = up * (120 + (i % 2) * 50);
        ctx.strokeStyle = '#1a0f33'; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.quadraticCurveTo(x + Math.sin(time * 6 + i) * 20, GROUND - h * 0.6, x + (i - 1.5) * 8, GROUND - h); ctx.stroke();
        ctx.fillStyle = '#8a6bff'; ctx.beginPath(); ctx.arc(x + (i - 1.5) * 8, GROUND - h, 9, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (fl.draw === 'blue') {
      Glow.draw(ctx, '#3a6dff', fl.x, fl.y, fl.r * 3, 0.8 * k);
      ctx.fillStyle = '#0a1240'; ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r * 0.45 * k, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#8fb4ff'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = -time * 8 + i * 1.25, r = fl.r * (0.5 + ((time * 2 + i * 0.2) % 1) * 0.8); ctx.globalAlpha = k * 0.8; ctx.beginPath(); ctx.arc(fl.x, fl.y, r, a, a + 1.4); ctx.stroke(); }
      if (Math.random() < 0.8) { const a = rand(0, TAU), d = rand(140, 260); G.fx.add({ x: fl.x + Math.cos(a) * d, y: fl.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 3, vy: -Math.sin(a) * d * 3, life: 0.3, size: 6, color: '#8fb4ff' }); }
    } else {
      Glow.draw(ctx, fl.color, fl.x, fl.y, fl.r * 2.4, 0.5 * k);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = time * 20 + i * 0.8, r = fl.r * (0.4 + (i % 3) * 0.25);
        ctx.globalAlpha = 0.8 * k;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, r, a, a + 0.9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBeam(b, time) {
    const k = b.t > b.dur ? clamp(1 - (b.t - b.dur) / 0.25, 0, 1) : 1;
    const wob = 1 + Math.sin(time * 60) * 0.06;
    const w = b.width * k * wob;
    const x0 = b.x, x1 = b.x + b.dir * b.len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, b.color, x0, b.y, w * 1.8, 0.9 * k);
    for (const [ww, col, al] of [[1.5, b.color, 0.35], [1, b.color, 0.75], [0.55, '#ffffff', 1]]) {
      ctx.globalAlpha = al * k; ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x0, b.y - w * ww / 2);
      ctx.lineTo(x1, b.y - w * ww / 2);
      ctx.arc(x1, b.y, w * ww / 2, -Math.PI / 2, Math.PI / 2, b.dir < 0);
      ctx.lineTo(x0, b.y + w * ww / 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = k;
    for (let i = 0; i < 4; i++) { const u = (time * 3 + i / 4) % 1; G.fx.add({ x: lerp(x0, x1, u), y: b.y + rand(-w, w) * 0.6, vx: b.dir * 900, vy: rand(-200, 200), life: 0.2, size: rand(6, 14), color: b.color }); }
    ctx.restore();
  }

  function drawTint(vr, time, layer) {
    const t = G.tintS;
    if (!t) return;
    const k = clamp(Math.min(t.t / 0.25, (t.d - t.t) / 0.35), 0, 1);
    const w = vr.x1 - vr.x0, h = vr.y1 - vr.y0;
    if (t.type === 'void' && layer === 'back') {
      ctx.globalAlpha = 0.92 * k; ctx.fillStyle = '#020108'; ctx.fillRect(vr.x0, vr.y0, w, h);
      // an endless field of light pouring past
      const rnd = mulberry32(99);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 140; i++) {
        const x = vr.x0 + rnd() * w, y = vr.y0 + rnd() * h, z = rnd();
        const dx = x - G.cam.x, dy = y - G.cam.y, sp = (time * (0.6 + z) + rnd()) % 1;
        const px = G.cam.x + dx * (0.3 + sp * 1.4), py = G.cam.y + dy * (0.3 + sp * 1.4);
        ctx.globalAlpha = k * sp * 0.9; ctx.strokeStyle = z > 0.6 ? '#d9e4ff' : '#8f7bff'; ctx.lineWidth = 1 + z * 2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx * 0.06 * sp, py + dy * 0.06 * sp); ctx.stroke();
      }
      ctx.globalAlpha = k * 0.5;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const r = ((time * 300 + i * 220) % 900); ctx.beginPath(); ctx.ellipse(G.cam.x, GROUND - 180, r, r * 0.35, 0, 0, TAU); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (t.type === 'sun' && layer === 'back') {
      ctx.globalAlpha = 0.6 * k; ctx.fillStyle = '#2a0800'; ctx.fillRect(vr.x0, vr.y0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ff7a1a', G.cam.x, GROUND - 300, 900, 0.7 * k);
      ctx.globalAlpha = k; ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(G.cam.x, GROUND - 300, 260 + Math.sin(time * 6) * 8, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (t.type === 'blood' && layer === 'back') {
      ctx.globalAlpha = 0.75 * k; ctx.fillStyle = '#12000a'; ctx.fillRect(vr.x0, vr.y0, w, h);
      ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ff1838', G.cam.x, GROUND - 200, 800, 0.5 * k);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    /* ---- each ultimate's own world: the void is Aoi's alone */
    // Monarch: the shadow realm. A rift opens in the floor, tendrils of
    // shadow writhe up out of it, and eyes blink open in the dark.
    if (t.type === 'shadow') {
      if (layer === 'back') {
        ctx.globalAlpha = 0.9 * k; ctx.fillStyle = '#06020e'; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, '#5a2bd6', G.cam.x, GROUND, w * 0.5, 0.6 * k);
        ctx.globalCompositeOperation = 'source-over';
        const open = easeOut(clamp(t.t / 0.5, 0, 1));
        ctx.globalAlpha = k; ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.ellipse(G.cam.x, GROUND + 6, w * 0.42 * open, 34 * open, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8a6bff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.8 * k; ctx.stroke();
        const rnd = mulberry32(7);
        for (let i = 0; i < 16; i++) {
          const bx = G.cam.x + (i - 7.5) / 8 * w * 0.4 * open, ph = rnd() * 6, H = (180 + rnd() * 380) * open * (0.75 + 0.25 * Math.sin(time * 2.4 + ph));
          ctx.strokeStyle = i % 3 ? '#1a0b33' : '#2c1460'; ctx.globalAlpha = 0.95 * k; ctx.lineCap = 'round';
          let px = bx, py = GROUND;
          for (let s = 1; s <= 10; s++) {
            const u = s / 10, nx = bx + Math.sin(time * 3 + ph + u * 5) * 26 * u, ny = GROUND - H * u;
            ctx.lineWidth = 20 * (1 - u) + 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
            px = nx; py = ny;
          }
        }
        // eyes in the dark, opening one pair at a time
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const ex = vr.x0 + (0.06 + rnd() * 0.88) * w, ey = GROUND - 140 - rnd() * 380, on = clamp((t.t - i * 0.08) / 0.15, 0, 1) * (Math.sin(time * 3 + i * 1.7) > -0.85 ? 1 : 0.1);
          ctx.globalAlpha = k * on;
          Glow.draw(ctx, '#a58bff', ex, ey, 26, 0.9);
          ctx.fillStyle = '#e6dcff'; ctx.fillRect(ex - 9, ey - 2, 6, 3); ctx.fillRect(ex + 3, ey - 2, 6, 3);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    // Hana: a crimson sakura night. A huge moon, blossom branches framing
    // the screen, and rivers of petals pouring across it.
    if (t.type === 'sakura') {
      if (layer === 'back') {
        const g = ctx.createLinearGradient(0, vr.y0, 0, vr.y1);
        g.addColorStop(0, '#1c0612'); g.addColorStop(0.6, '#6e1c44'); g.addColorStop(1, '#ff6fb5');
        ctx.globalAlpha = 0.9 * k; ctx.fillStyle = g; ctx.fillRect(vr.x0, vr.y0, w, h);
        const mx = G.cam.x + w * 0.2, my = vr.y0 + h * 0.3, mr = h * 0.2 * (0.9 + 0.1 * easeOut(clamp(t.t / 0.6, 0, 1)));
        ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ff9cc8', mx, my, mr * 3, 0.7 * k); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fff0f6'; ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        // branches reaching in from the top corners, heavy with blossom
        for (const side of [-1, 1]) {
          const x0 = side < 0 ? vr.x0 - 20 : vr.x1 + 20, y0 = vr.y0 + h * 0.08;
          ctx.strokeStyle = '#1a0710'; ctx.lineCap = 'round';
          const tip = [x0 - side * w * 0.3, y0 + h * 0.16];
          ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 - side * w * 0.15, y0 + h * 0.02, tip[0], tip[1]); ctx.stroke();
          ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0 - side * w * 0.12, y0 + h * 0.02); ctx.quadraticCurveTo(x0 - side * w * 0.18, y0 + h * 0.12, x0 - side * w * 0.2, y0 + h * 0.22); ctx.stroke();
          const rnd = mulberry32(side < 0 ? 31 : 37);
          for (let i = 0; i < 26; i++) {
            const u = rnd(), bx = lerp(x0, tip[0], u) + (rnd() - 0.5) * 60, by = lerp(y0, tip[1], u) + (rnd() - 0.5) * 50;
            ctx.fillStyle = rnd() < 0.5 ? '#ffb3d6' : '#ff8fc8'; ctx.beginPath(); ctx.arc(bx, by, 8 + rnd() * 10, 0, TAU); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else {
        // rivers of petals sweeping across in front of everything
        for (let r = 0; r < 3; r++) {
          const yb = vr.y0 + h * (0.3 + r * 0.22);
          for (let i = 0; i < 26; i++) {
            const u = ((time * (0.55 + r * 0.15) + i / 26) % 1), x = vr.x0 + u * (w + 200) - 100;
            const y = yb + Math.sin(u * 7 + r * 2 + time * 2) * 46;
            ctx.globalAlpha = k * Math.sin(u * Math.PI);
            petalShape(ctx, x, y, 9 + (i % 3) * 2, u * 18 + i, i % 4 ? '#ffb3d6' : '#ffffff');
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    // Kori: a blizzard. Aurora overhead, snow driven sideways, and frost
    // creeping in from the edges of the screen.
    if (t.type === 'blizzard') {
      if (layer === 'back') {
        const g = ctx.createLinearGradient(0, vr.y0, 0, vr.y1);
        g.addColorStop(0, '#0a1c34'); g.addColorStop(1, '#5f8fbf');
        ctx.globalAlpha = 0.88 * k; ctx.fillStyle = g; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          ctx.globalAlpha = 0.28 * k; ctx.fillStyle = ['#4fffc8', '#7fd8ff', '#b07bff'][b];
          ctx.beginPath(); ctx.moveTo(vr.x0, vr.y0 + h * (0.12 + b * 0.06));
          for (let i = 0; i <= 24; i++) { const x = vr.x0 + i / 24 * w; ctx.lineTo(x, vr.y0 + h * (0.12 + b * 0.06) + Math.sin(i * 0.6 + time * (1 + b * 0.3) + b) * h * 0.05); }
          for (let i = 24; i >= 0; i--) { const x = vr.x0 + i / 24 * w; ctx.lineTo(x, vr.y0 + h * (0.2 + b * 0.06) + Math.sin(i * 0.6 + time * (1 + b * 0.3) + b + 0.6) * h * 0.05); }
          ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else {
        // snow driven sideways, fast
        const rnd = mulberry32(53);
        ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
        for (let i = 0; i < 150; i++) {
          const z = rnd(), sp = 900 + z * 1500, y0 = rnd() * h, x = vr.x1 - ((time * sp + rnd() * w * 2) % (w + 200)) + 100, y = vr.y0 + (y0 + (time * sp * 0.25) % h) % h;
          ctx.globalAlpha = k * (0.35 + z * 0.6); ctx.lineWidth = 1 + z * 2.5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30 + z * 50, y - 8 - z * 12); ctx.stroke();
        }
        // frost shards growing in from the four edges
        const grow = easeOut(clamp(t.t / 0.8, 0, 1)) * k;
        const shard = (x, y, ang, len) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = 'rgba(223,246,255,0.85)'; ctx.beginPath(); ctx.moveTo(0, -len * 0.18); ctx.lineTo(len, 0); ctx.lineTo(0, len * 0.18); ctx.closePath(); ctx.fill(); ctx.restore(); };
        const rs = mulberry32(61);
        for (let i = 0; i < 18; i++) {
          const u = rs(), len = (60 + rs() * 140) * grow;
          shard(vr.x0 + u * w, vr.y0, Math.PI / 2 + (rs() - 0.5) * 0.8, len);
          shard(vr.x0 + rs() * w, vr.y1, -Math.PI / 2 + (rs() - 0.5) * 0.8, len * 0.8);
          shard(vr.x0, vr.y0 + rs() * h, (rs() - 0.5) * 0.8, len);
          shard(vr.x1, vr.y0 + rs() * h, Math.PI + (rs() - 0.5) * 0.8, len);
        }
        ctx.globalAlpha = 1;
      }
    }
    // Blaze: an inferno. A molten sky, meteors raining down, embers rising.
    if (t.type === 'inferno') {
      if (layer === 'back') {
        const g = ctx.createLinearGradient(0, vr.y0, 0, vr.y1);
        g.addColorStop(0, '#1a0300'); g.addColorStop(0.55, '#5a1004'); g.addColorStop(1, '#c43c0c');
        ctx.globalAlpha = 0.88 * k; ctx.fillStyle = g; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const rnd = mulberry32(71);
        for (let i = 0; i < 9; i++) {
          const sp = 0.6 + rnd() * 0.6, u = (time * sp + rnd()) % 1, x = vr.x1 + 100 - u * (w + 400) + rnd() * 300, y = vr.y0 - 100 + u * (h + 200);
          const g2 = ctx.createLinearGradient(x, y, x + 260, y - 260);
          g2.addColorStop(0, 'rgba(255,240,180,0.95)'); g2.addColorStop(0.2, 'rgba(255,120,30,0.7)'); g2.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.globalAlpha = k; ctx.strokeStyle = g2; ctx.lineWidth = 10 + rnd() * 12; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 260, y - 260); ctx.stroke();
          Glow.draw(ctx, '#ff7a1a', x, y, 70, 0.8 * k);
        }
        for (let i = 0; i < 60; i++) {
          const u = (time * (0.2 + rnd() * 0.3) + rnd()) % 1, x = vr.x0 + rnd() * w + Math.sin(time * 2 + i) * 20, y = vr.y1 - u * h;
          ctx.globalAlpha = k * (1 - u); ctx.fillStyle = i % 3 ? '#ff9a3d' : '#ffe08a'; ctx.fillRect(x, y, 3, 3);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    // Rave: the club. Lasers sweep the dark and the room strobes on the beat.
    if (t.type === 'rave') {
      if (layer === 'back') {
        ctx.globalAlpha = 0.9 * k; ctx.fillStyle = '#05020c'; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const beat = Math.max(0, 1 - ((t.t % 0.3) / 0.3));
        for (let i = 0; i < 8; i++) {
          const ox = vr.x0 + (i + 0.5) / 8 * w, oy = vr.y0 + 10, ang = Math.PI / 2 + Math.sin(time * 1.8 + i * 1.3) * 0.7;
          const col = i % 2 ? '#4fd8ff' : '#ff4fd8', L = h * 1.4;
          ctx.globalAlpha = k * (0.5 + beat * 0.5); ctx.strokeStyle = col; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang) * L, oy + Math.sin(ang) * L); ctx.stroke();
          ctx.globalAlpha = k * 0.25; ctx.lineWidth = 16;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang) * L, oy + Math.sin(ang) * L); ctx.stroke();
          Glow.draw(ctx, col, ox, oy, 60, k);
        }
        ctx.globalAlpha = k * beat * 0.18; ctx.fillStyle = '#ffffff'; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    if (t.type === 'stop') {
      if (layer === 'back') {
        ctx.globalAlpha = 0.85 * k; ctx.fillStyle = '#6b6478'; ctx.globalCompositeOperation = 'saturation'; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#b4a8d8'; ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (t.t < 0.6) {
        // the stopped-time sphere sweeps out from the user
        const o = G.stopOwner || G.fighters[0];
        const r = easeOut(t.t / 0.6) * 2400;
        ctx.save();
        ctx.beginPath(); ctx.arc(o.root.x, o.root.y - 120, r, 0, TAU); ctx.clip();
        ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9 * (1 - t.t / 0.6);
        ctx.fillRect(vr.x0, vr.y0, w, h);
        ctx.restore();
      }
    }
  }

  function drawWind(time) {
    const s = G.windS;
    if (!s) return;
    const k = clamp(Math.min(s.t * 8, (s.d - s.t) * 3), 0, 1);
    const rnd = mulberry32(Math.floor(time * 40));
    ctx.fillStyle = s.serious ? 'rgba(255,255,255,0.85)' : 'rgba(220,255,230,0.75)';
    ctx.globalAlpha = k;
    for (let i = 0; i < 46; i++) {
      const y = rnd() * ch, len = cw * (0.2 + rnd() * 0.5), x = rnd() * cw, th = (1 + rnd() * 5) * dpr;
      ctx.fillRect(x - len / 2, y, len, th);
    }
    if (s.serious) {
      // the sky splits along a single line
      const y = ch * 0.38;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y - 4 * dpr * k, cw, 8 * dpr * k);
    }
    ctx.globalAlpha = 1;
  }

  // halftone dots for the super panel
  let halftone = null;
  function halftonePattern() {
    if (halftone) return halftone;
    const c = document.createElement('canvas'); c.width = c.height = 14;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(4, 4, 2.6, 0, TAU); g.arc(11, 11, 2.6, 0, TAU); g.fill();
    halftone = ctx.createPattern(c, 'repeat');
    return halftone;
  }

  /* the ultimate banner: cinematic bars, a skewed comic panel with a close-up of the
     fighter, racing streaks, and the move name slammed in letter by letter */
  function drawCutin(time) {
    const c = G.cut, f = c.f, col = f.def.color;
    const t = c.t, d = c.d;
    const side = f.side ? -1 : 1;
    const inK = clamp(t / 0.2, 0, 1), outK = clamp((t - (d - 0.2)) / 0.2, 0, 1);
    const live = 1 - outK;
    const u = dpr;
    // dim the frozen world
    ctx.fillStyle = `rgba(3,4,8,${0.66 * live})`;
    ctx.fillRect(0, 0, cw, ch);
    // speed lines in the fighter's colour, radiating from the portrait
    const px = cw * (side > 0 ? 0.3 : 0.7), cy = ch * 0.5;
    ctx.globalAlpha = 0.35 * live;
    speedLines({ x: px / dpr, y: cy / dpr }, time, col);
    ctx.globalAlpha = 1;
    // cinematic bars
    const bar = ch * 0.11 * easeOut(inK) * live;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, bar); ctx.fillRect(0, ch - bar, cw, bar);
    ctx.fillStyle = col; ctx.fillRect(0, bar - 3 * u, cw, 3 * u * live); ctx.fillRect(0, ch - bar, cw, 3 * u * live);

    // the panel slides in with an overshoot, then out the other way
    const H2 = ch * 0.44;
    const slide = (1 - easeOutBack(inK)) * -side * cw * 1.1 + easeInOut(outK) * side * cw * 1.2;
    const skew = 0.22 * side;
    ctx.save();
    ctx.translate(slide, 0);
    ctx.beginPath();
    const top = cy - H2 / 2, bot = cy + H2 / 2;
    ctx.moveTo(-cw * 0.2 + skew * H2 / 2, top); ctx.lineTo(cw * 1.2 + skew * H2 / 2, top);
    ctx.lineTo(cw * 1.2 - skew * H2 / 2, bot); ctx.lineTo(-cw * 0.2 - skew * H2 / 2, bot); ctx.closePath();
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(side > 0 ? 0 : cw, 0, side > 0 ? cw : 0, 0);
    g.addColorStop(0, mixHex(col, '#ffffff', 0.15)); g.addColorStop(0.42, mixHex(col, '#000000', 0.35)); g.addColorStop(1, '#07080d');
    ctx.fillStyle = g; ctx.fillRect(-cw * 0.3, top, cw * 1.6, H2);
    // halftone wash and racing streaks
    ctx.globalAlpha = 0.16; ctx.fillStyle = halftonePattern();
    ctx.save(); ctx.translate((time * 60 * side) % 14, 0); ctx.fillRect(-cw * 0.3, top, cw * 1.6, H2); ctx.restore();
    ctx.globalAlpha = 1;
    const rnd = mulberry32(Math.floor(time * 24));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 18; i++) {
      const y = top + rnd() * H2, len = cw * (0.15 + rnd() * 0.35), x = rnd() * cw * 1.4 - cw * 0.2;
      ctx.fillRect(x, y, len, (1 + rnd() * 3) * u);
    }
    // close-up of the fighter, pushing in slowly
    const zoom = 1 + t * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, col, px, cy, H2 * 0.9, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    // the fighter's own body, mid-pose, blown up with a glowing outline
    {
      const c0 = f.center();
      const k = H2 * 0.82 / (130 * f.s) * zoom;
      ctx.save();
      ctx.translate(px, cy + H2 * 0.08);
      ctx.scale(k * (f.facing === side ? 1 : -1), k);
      ctx.translate(-c0.x, -c0.y);
      const o = 5 / k;
      for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o]]) { ctx.save(); ctx.translate(dx, dy); f.draw(ctx, time, '#07080d'); ctx.restore(); }
      f.draw(ctx, time);
      ctx.restore();
    }
    // eye glint sweeps across
    if (t > 0.28 && t < 0.5) {
      const k = (t - 0.28) / 0.22;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 * u; ctx.lineCap = 'round';
      const hd = f.head(), c0 = f.center(), kz = H2 * 0.82 / (130 * f.s) * zoom;
      const ex = px + (hd.x - c0.x) * kz * (f.facing === side ? 1 : -1), ey = cy + H2 * 0.08 + (hd.y - c0.y) * kz;
      ctx.beginPath(); ctx.moveTo(ex - side * H2 * 0.06, ey + 2 * u); ctx.lineTo(ex + side * H2 * 0.16, ey - 6 * u); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // panel edges
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * u; ctx.stroke();
    ctx.restore();

    // move name: subtitle chip, then the title slammed in letter by letter
    const tx = side > 0 ? cw * 0.64 : cw * 0.36;
    ctx.save();
    ctx.translate(slide * 0.6, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const subSize = Math.round(Math.min(H2 * 0.09, cw * 0.022));
    ctx.font = `900 ${subSize}px Rubik, sans-serif`;
    const sw = ctx.measureText(c.sub).width + subSize * 1.6;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(tx - sw / 2 + subSize * 0.4, cy - H2 * 0.3 - subSize * 0.8); ctx.lineTo(tx + sw / 2 + subSize * 0.4, cy - H2 * 0.3 - subSize * 0.8); ctx.lineTo(tx + sw / 2 - subSize * 0.4, cy - H2 * 0.3 + subSize * 0.8); ctx.lineTo(tx - sw / 2 - subSize * 0.4, cy - H2 * 0.3 + subSize * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0d1018'; ctx.fillText(c.sub, tx, cy - H2 * 0.3 + 1);
    const size = Math.round(Math.min(H2 * 0.3, cw * 0.62 / Math.max(6, c.title.length) * 1.55));
    ctx.font = `italic 900 ${size}px Rubik, sans-serif`;
    const widths = [...c.title].map(ch2 => ctx.measureText(ch2).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = tx - total / 2;
    [...c.title].forEach((ch2, i) => {
      const lt = t - 0.12 - i * 0.03;
      const w = widths[i];
      if (lt > 0) {
        const k = clamp(lt / 0.12, 0, 1);
        const sc = lerp(2.4, 1, easeOut(k));
        ctx.save();
        ctx.translate(x + w / 2, cy + H2 * 0.02);
        ctx.scale(sc, sc);
        ctx.globalAlpha = k;
        ctx.lineJoin = 'round';
        ctx.fillStyle = col; ctx.fillText(ch2, size * 0.06, size * 0.08);
        ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#000'; ctx.strokeText(ch2, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillText(ch2, 0, 0);
        ctx.restore();
      }
      x += w;
    });
    // fighter name and an underline that sweeps across
    const ul = clamp((t - 0.3) / 0.25, 0, 1);
    ctx.fillStyle = col; ctx.fillRect(tx - total / 2, cy + H2 * 0.02 + size * 0.62, total * easeOut(ul), 5 * u);
    ctx.font = `800 ${subSize}px Rubik, sans-serif`;
    ctx.globalAlpha = ul; ctx.fillStyle = '#ffffff';
    ctx.fillText(f.def.name + ' · ' + f.def.title, tx, cy + H2 * 0.02 + size * 0.62 + subSize * 1.5);
    ctx.globalAlpha = 1;
    ctx.restore();
    // white flash on entry and exit
    const fl = Math.max(1 - t / 0.08, t > d - 0.2 ? 1 - Math.abs(t - (d - 0.12)) / 0.08 : 0);
    if (fl > 0 && Save.data.settings.flashes) { ctx.globalAlpha = clamp(fl, 0, 1) * 0.8; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1; }
  }

  function drawCallouts() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const c of G.callouts) {
      const u = c.t / c.d;
      const a = clamp(Math.min(c.t / 0.08, (c.d - c.t) / 0.25), 0, 1);
      const pop = c.t < 0.18 ? easeOutBack(c.t / 0.18) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      const shift = G.mode === 'demo' ? (G.viewShift || 0) * dpr : 0, vis = G.mode === 'demo' ? G.viewFrac || 1 : 1;
      ctx.translate(cw / 2 + shift, ch * (c.style === 'round' ? 0.42 : 0.42));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const base = Math.min(cw * vis, ch * 1.7);
      if (c.style === 'win') {
        // A victory title in the style of the genre: a slash of the winner's colour
        // sweeps in across the left of the frame, a tracked VICTORY label, the
        // name in clean italic caps with a glint passing through, and the title
        // under a thin rule. It sits left of the winner, never on top of them.
        ctx.restore(); ctx.save(); ctx.globalAlpha = a;
        const vw = cw * vis, left = cw / 2 + shift - vw / 2;
        const sz = Math.min(vw * 0.1, ch * 0.15), x0 = left + vw * 0.06, yC = ch * 0.55;
        const ein = k => 1 - Math.pow(1 - clamp(k, 0, 1), 4);
        const sweep = ein(c.t / 0.45), col = c.color || '#ffc933';
        // the slash: one solid dark core that holds every line of type (label,
        // name, rule, title) with even margins, and thin bands of the winner's
        // colour above and below it, so no text ever straddles two zones
        const top = yC - sz * 1.02, bot = yC + sz * 1.08, edge = sz * 0.1, sk = (bot - top) * 0.32;
        const bw = vw * 0.48 * sweep, L0 = left;
        const slab = (y0, y1, w, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(L0, y0); ctx.lineTo(L0 + w + sk * (bot - y0) / (bot - top), y0); ctx.lineTo(L0 + w + sk * (bot - y1) / (bot - top), y1); ctx.lineTo(L0, y1); ctx.closePath(); ctx.fill(); };
        const cg = ctx.createLinearGradient(L0, 0, L0 + vw * 0.48, 0);
        cg.addColorStop(0, 'rgba(8,10,16,0.86)'); cg.addColorStop(0.7, 'rgba(8,10,16,0.7)'); cg.addColorStop(1, 'rgba(8,10,16,0)');
        slab(top, bot, bw, cg);
        const bg = ctx.createLinearGradient(L0, 0, L0 + vw * 0.48, 0);
        bg.addColorStop(0, rgba(col, 1)); bg.addColorStop(0.6, rgba(col, 0.7)); bg.addColorStop(1, rgba(col, 0));
        slab(top - edge, top, bw * 1.02, bg); slab(bot, bot + edge, bw * 0.9, bg);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(L0, top - edge - 3 * dpr, bw * 0.6, 2 * dpr); ctx.fillRect(L0, bot + edge + 1 * dpr, bw * 0.4, 2 * dpr);
        ctx.textAlign = 'left';
        // the tracked label
        const lt = ein((c.t - 0.12) / 0.3);
        ctx.globalAlpha = a * lt;
        ctx.font = `900 ${Math.round(sz * 0.26)}px Rubik, sans-serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(sz * 0.12)}px`;
        ctx.fillStyle = '#ffd34d'; ctx.fillText(c.sub, x0 + (1 - lt) * -30 * dpr, yC - sz * 0.68);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        // the name: clean italic caps with a hard drop shadow, sliding in behind the band
        const nt = ein((c.t - 0.06) / 0.4), nx = x0 + (1 - nt) * -60 * dpr;
        ctx.globalAlpha = a * nt;
        ctx.font = `italic 900 ${Math.round(sz)}px Rubik, sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(c.text, nx + sz * 0.04, yC + sz * 0.15 + sz * 0.05);
        ctx.fillStyle = '#ffffff'; ctx.fillText(c.text, nx, yC + sz * 0.15);
        // a glint sweeping through the letters once
        const gt = (c.t - 0.55) / 0.5;
        if (gt > 0 && gt < 1) {
          const tw = ctx.measureText(c.text).width, gx = nx - sz + (tw + sz * 2) * gt;
          const gg = ctx.createLinearGradient(gx - sz * 0.5, 0, gx + sz * 0.5, 0);
          gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.save(); ctx.beginPath(); ctx.rect(nx, yC - sz * 0.6, tw + sz * 0.2, sz * 1.1); ctx.clip();
          ctx.fillStyle = gg; ctx.globalCompositeOperation = 'overlay'; ctx.fillText(c.text, nx, yC + sz * 0.15);
          ctx.restore();
        }
        // the title under a thin rule
        const tt = ein((c.t - 0.3) / 0.35);
        if (c.title) {
          ctx.globalAlpha = a * tt;
          ctx.fillStyle = col; ctx.fillRect(x0, yC + sz * 0.66, sz * 1.4 * tt, Math.max(2, sz * 0.03));
          ctx.font = `800 ${Math.round(sz * 0.2)}px Rubik, sans-serif`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(sz * 0.05)}px`;
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(c.title, x0, yC + sz * 0.88);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }
      } else if (c.style === 'name') {
        // a name card that sweeps in, big and slanted
        const sz = base * 0.085;
        ctx.translate((1 - pop) * -120 * dpr + u * 40 * dpr, ch * 0.18);
        ctx.font = `italic 900 ${Math.round(sz)}px Rubik, sans-serif`;
        ctx.lineJoin = 'round'; ctx.lineWidth = sz * 0.16; ctx.strokeStyle = '#000'; ctx.strokeText(c.text, 0, 0);
        ctx.fillStyle = '#ffffff'; ctx.fillText(c.text, 0, 0);
        ctx.font = `900 ${Math.round(sz * 0.3)}px Rubik, sans-serif`;
        const sw = ctx.measureText(c.sub).width + sz * 0.6;
        ctx.fillStyle = '#ffc933'; ctx.fillRect(-sw / 2, sz * 0.62, sw, sz * 0.42);
        ctx.fillStyle = '#1a1404'; ctx.fillText(c.sub, 0, sz * 0.84);
      } else if (c.style === 'round') {
        const sz = base * 0.06;
        ctx.font = `900 ${Math.round(sz)}px Rubik, sans-serif`;
        const tw = ctx.measureText(c.text).width + sz * 2;
        ctx.translate((1 - pop) * -60 * dpr + u * 30 * dpr, 0);
        ctx.fillStyle = 'rgba(13,15,23,0.9)';
        ctx.beginPath(); ctx.moveTo(-tw / 2 + sz * 0.5, -sz * 0.8); ctx.lineTo(tw / 2 + sz * 0.5, -sz * 0.8); ctx.lineTo(tw / 2 - sz * 0.5, sz * 0.8); ctx.lineTo(-tw / 2 - sz * 0.5, sz * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(c.text, 0, 0);
        if (c.sub) { ctx.font = `800 ${Math.round(sz * 0.32)}px Rubik, sans-serif`; ctx.fillStyle = '#ffc933'; ctx.fillText(c.sub, 0, sz * 1.25); }
      } else {
        const sz = base * (c.style === 'finish' ? 0.15 : c.style === 'fight' ? 0.12 : 0.13);
        ctx.scale(pop * (c.style === 'finish' ? 1 + u * 0.12 : 1), pop * (c.style === 'finish' ? 1 + u * 0.12 : 1));
        ctx.rotate(c.style === 'finish' ? -0.06 : c.style === 'fight' ? -0.03 : 0);
        ctx.font = `italic 900 ${Math.round(sz)}px Rubik, sans-serif`;
        ctx.lineJoin = 'round';
        const fill = c.style === 'fight' ? '#ffc933' : c.style === 'ko' ? '#ff3b4f' : c.style === 'perfect' ? '#45e08a' : '#ffffff';
        ctx.lineWidth = sz * 0.22; ctx.strokeStyle = '#000'; ctx.strokeText(c.text, 0, 0);
        if (c.style === 'finish') { ctx.lineWidth = sz * 0.1; ctx.strokeStyle = '#d10f2c'; ctx.strokeText(c.text, 0, 0); }
        ctx.fillStyle = fill; ctx.fillText(c.text, 0, 0);
        if (c.sub) {
          ctx.font = `900 ${Math.round(sz * 0.26)}px Rubik, sans-serif`;
          ctx.lineWidth = sz * 0.06; ctx.strokeStyle = '#000'; ctx.strokeText(c.sub, 0, sz * 0.75);
          ctx.fillStyle = '#ffc933'; ctx.fillText(c.sub, 0, sz * 0.75);
        }
      }
      ctx.restore();
    }
  }

  return G;
})();
