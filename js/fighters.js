'use strict';
/* =========================================================================
   Roster. Nine original fighters; each kit is an homage to a battle-anime
   archetype (see README). Moves are data plus small hooks:
     w / a / r     wind-up, active and recovery time (s)
     pose/poseFn   how the body moves (rag.js POSES or a function)
     box           [x, y, r] hitbox, facing space, unscaled, from the feet
     hit           damage spec handed to Game.hit
     start/tick/draw optional hooks for specials and supers
   Boxes: a standing fighter's head is near y = -130, chest -100, knees -30.
   ========================================================================= */

/* --------------------------------------------------------------- helpers */
function phaseOf(act) {
  const t = act.t, w = act.w, a = act.a, r = act.r;
  if (t < w) return { ph: 0, u: clamp(t / Math.max(w, 1e-3), 0, 1) };
  if (t < w + a) return { ph: 1, u: clamp((t - w) / Math.max(a, 1e-3), 0, 1) };
  return { ph: 2, u: clamp((t - w - a) / Math.max(r, 1e-3), 0, 1) };
}
const once = (act, key) => (act[key] ? false : (act[key] = true));
const hand = (f, back) => f.pts[back ? P.BHAND : P.FHAND];
const handT = (f, back) => f.T[back ? P.BHAND : P.FHAND];

// sword swing: the front fist travels an arc around the neck, both hands on the grip
function arcPose(a0, a1, extra) {
  return (f, act, base) => {
    const { ph, u } = phaseOf(act);
    const wind = a0 - 0.35;
    let ang = ph === 0 ? lerp(-0.6, wind, easeInOut(u)) : ph === 1 ? lerp(wind, a1, easeOut(u)) : lerp(a1, 0.25, easeInOut(u));
    const R = 42;
    const fh = [Math.cos(ang) * R, Math.sin(ang) * R];
    const o = Object.assign({}, base, { fh, bh: [fh[0] * 0.72 - 4, fh[1] * 0.72 + 6], lean: ph === 1 ? 10 : 2 });
    if (extra) Object.assign(o, extra(ph, u));
    return o;
  };
}
// rapid alternating fists (barrages)
function barragePose(rate = 18) {
  return (f, act, base) => {
    const { ph } = phaseOf(act);
    if (ph !== 1) return Object.assign({}, base, { fh: [30, 6], bh: [22, 12], lean: 6, crouch: 10 });
    const k = (act.t * rate) % 1, alt = Math.floor(act.t * rate) % 2;
    const out = [46 - Math.abs(k - 0.5) * 30, 2 + Math.sin(act.t * 41) * 10];
    const back = [18, 14];
    return Object.assign({}, base, alt ? { fh: out, bh: back } : { fh: back, bh: out }, { lean: 12, crouch: 12, ff: [34, 0], bf: [-34, 0] });
  };
}

// melee hit check helper used by specials
function boxHit(G, f, act, box, spec, key) {
  const o = G.opp(f);
  if (!o) return null;
  const p = f.local(box[0], box[1]);
  const res = o.hitTest(p.x, p.y, box[2] * f.s);
  if (!res) return null;
  if (key && act[key]) return null;
  const out = G.hit(f, o, spec, res.x, res.y, act);
  if (out && key) act[key] = true;
  return out;
}

/* ------------------------------------------------------------- normals */
function normalsFor(def) {
  const R = def.reach || 0;
  const sword = !!def.look.weapon;
  const c = def.color;
  const N = {
    l1: { id: 'l1', name: 'Jab', kind: 'light', w: 0.05, a: 0.07, r: 0.13, pose: 'jab', box: [64 + R, -112, 24], chain: 'l2',
      hit: { dmg: 30, kb: [170, 0], stun: 0.3, bstun: 0.17, hs: 0.05, sfx: 'hitL', color: c } },
    l2: { id: 'l2', name: 'Cross', kind: 'light', w: 0.06, a: 0.07, r: 0.15, pose: 'cross', box: [64 + R, -108, 25], chain: 'h',
      hit: { dmg: 34, kb: [200, 0], stun: 0.32, bstun: 0.18, hs: 0.055, sfx: 'hitL', color: c } },
    h: { id: 'h', name: 'Roundhouse', kind: 'heavy', w: 0.13, a: 0.08, r: 0.27, pose: 'kickM', box: [76, -88, 30],
      hit: { dmg: 70, kb: [430, -60], stun: 0.42, bstun: 0.24, hs: 0.09, sfx: 'hitH', bf: true, color: c } },
    hEnd: { id: 'hEnd', name: 'Rising Upper', kind: 'heavy', w: 0.08, a: 0.1, r: 0.32, pose: 'upper', box: [52 + R * 0.5, -128, 34],
      hit: { dmg: 62, kb: [220, -1050], stun: 0.9, bstun: 0.26, hs: 0.1, launch: true, sfx: 'hitH', bf: true, color: c } },
    airL: { id: 'airL', name: 'Air Jab', kind: 'light', w: 0.04, a: 0.12, r: 0.1, pose: 'airP', box: [46 + R, -78, 26], air: true,
      hit: { dmg: 36, kb: [200, 80], stun: 0.32, bstun: 0.17, hs: 0.05, sfx: 'hitL', color: c } },
    airH: { id: 'airH', name: 'Flying Kick', kind: 'heavy', w: 0.08, a: 0.16, r: 0.14, pose: 'airK', box: [56, -26, 30], air: true,
      hit: { dmg: 60, kb: [360, 160], stun: 0.42, bstun: 0.22, hs: 0.09, sfx: 'hitH', bf: true, color: c } },
    throw: { id: 'throw', name: 'Throw', kind: 'throw', w: 0.06, a: 0.06, r: 0.36, pose: 'grab',
      start: (G, f, act) => { act.target = null; },
      tick: (G, f, act) => throwTick(G, f, act) },
  };
  if (sword) {
    N.l1.pose = undefined; N.l1.poseFn = arcPose(-1.0, 0.7); N.l1.box = [92 + R, -100, 30]; N.l1.name = 'Quick Slash'; N.l1.slash = true;
    N.l2.pose = undefined; N.l2.poseFn = arcPose(-0.2, 1.1); N.l2.box = [92 + R, -82, 30]; N.l2.name = 'Return Slash'; N.l2.slash = true;
    N.h.pose = undefined; N.h.poseFn = arcPose(-1.5, 1.2, ph => (ph === 1 ? { ff: [40, 0], bf: [-34, 0], crouch: 14 } : {})); N.h.box = [100 + R, -92, 36]; N.h.name = 'Heavy Slash'; N.h.slash = true;
    N.hEnd.pose = undefined; N.hEnd.poseFn = arcPose(1.3, -1.6, ph => (ph === 1 ? { crouch: -4 } : { crouch: 20 })); N.hEnd.box = [76 + R, -130, 38]; N.hEnd.name = 'Rising Slash'; N.hEnd.slash = true;
    N.airH.pose = undefined; N.airH.poseFn = arcPose(-1.2, 1.4); N.airH.box = [70 + R, -40, 34]; N.airH.name = 'Air Slash'; N.airH.slash = true;
  }
  return N;
}

function throwTick(G, f, act) {
  const o = G.opp(f);
  const { ph } = phaseOf(act);
  if (ph === 1 && !act.target && !act.missed) {
    const close = o && Math.abs(o.root.x - f.root.x) < 96 * f.s && o.root.grounded && o.mode === 'active' && o.invuln <= 0 && !o.airborneHit;
    if (close) { act.target = o; act.hold = true; act.a = 0.42; o.action = null; o.mode = 'hit'; o.stunT = 1; Sfx.play('grab'); }
    else act.missed = true;
  }
  if (act.target) {
    const k = clamp((act.t - act.w) / 0.42, 0, 1);
    // lift the victim overhead, then hurl them
    const hp = f.local(lerp(44, -10, k), lerp(-110, -190, k));
    const pv = o.pts[P.NECK];
    for (const q of o.pts) { q.x += (hp.x - pv.x) * 0.25; q.y += (hp.y - pv.y) * 0.25; q.px = lerp(q.px, q.x, 0.5); q.py = lerp(q.py, q.y, 0.5); }
    o.root.x = hp.x; o.stunT = 1;
    if (k >= 1 && once(act, 'tossed')) {
      act.hold = false; act.target = null;
      G.hit(f, o, { dmg: 95, dir: f.facing, kb: [720, -820], stun: 1.1, launch: true, hs: 0.1, unblockable: true, throw: true, sfx: 'hitH', color: f.def.color, kind: 'heavy', name: 'Throw' }, hp.x, hp.y, act);
      G.shake(10);
    }
  }
}
// the toss swings the victim over the thrower's head, so the knockback flips direction
function throwPoseFn(f, act, base) {
  const { ph, u } = phaseOf(act);
  const g = POSES.grab, l = POSES.lift;
  if (ph === 0) return lerpPose(base, mergePose(base, g.wind), u);
  if (act.target || act.tossed) {
    const k = clamp((act.t - act.w) / 0.42, 0, 1);
    return lerpPose(mergePose(base, l.wind), mergePose(base, l.strike), easeInOut(k));
  }
  return ph === 1 ? mergePose(base, g.strike) : lerpPose(mergePose(base, g.strike), base, u);
}

/* --------------------------------------------------------- shared FX */
function orbDraw(ctx, p, time) {
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, p.color, p.x, p.y, p.r * 3.2, 0.9);
  ctx.fillStyle = mixHex(p.color, '#ffffff', 0.6);
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.75, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.42, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.color; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { const a = time * 9 + i * 2.1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.95, a, a + 1.2); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
}
function crescentDraw(ctx, p, time) {
  const dir = Math.sign(p.vx) || 1, R = p.r * 1.7;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(dir, 1);
  ctx.globalCompositeOperation = p.dark ? 'source-over' : 'lighter';
  if (!p.dark) Glow.draw(ctx, p.color, 0, 0, R * 1.6, 0.6);
  const draw = (rr, col) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(-R * 0.5, 0, rr, -1.25, 1.25); ctx.arc(-R * 0.95, 0, rr * 0.92, 1.1, -1.1, true); ctx.closePath(); ctx.fill();
  };
  if (p.dark) { draw(R * 1.08, p.edge || '#ff2740'); draw(R, '#08080c'); }
  else { draw(R, p.color); draw(R * 0.8, '#ffffff'); }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function ringDraw(ctx, p, time) {
  const dir = Math.sign(p.vx) || 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.7 - i * 0.2;
    ctx.strokeStyle = i ? p.color : '#ffffff'; ctx.lineWidth = 6 - i * 1.5;
    ctx.beginPath(); ctx.ellipse(p.x - dir * i * 26, p.y, p.r * (0.55 + i * 0.12), p.r * (1.2 - i * 0.15), 0, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function shurikenDraw(ctx, p, time) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, '#8fdcff', 0, 0, p.r * 2.6, 0.8);
  ctx.rotate(time * 26);
  ctx.fillStyle = 'rgba(200,240,255,0.75)';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(TAU / 4);
    ctx.beginPath(); ctx.moveTo(0, -p.r * 0.2); ctx.quadraticCurveTo(p.r * 0.9, -p.r * 0.5, p.r * 1.6, 0); ctx.quadraticCurveTo(p.r * 0.8, p.r * 0.1, 0, p.r * 0.2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function drawSphereAt(ctx, x, y, r, col, time) {
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, col, x, y, r * 3, 0.85);
  ctx.fillStyle = mixHex(col, '#ffffff', 0.5); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { const a = time * 14 + i * 1.6; ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.5, a, 0, Math.PI * 1.3); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
}
// a stretched rubber arm from shoulder to a fist far away
function drawRubberArm(ctx, f, fx, fy) {
  const n = f.pts[P.NECK], s = f.s, body = f.alt ? '#e4ddcf' : '#f7f2e7';
  ctx.lineCap = 'round';
  ctx.strokeStyle = body; ctx.lineWidth = 9.5 * s;
  ctx.beginPath(); ctx.moveTo(n.x, n.y + 4 * s); ctx.quadraticCurveTo((n.x + fx) / 2, (n.y + fy) / 2 - 10 * s, fx, fy); ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(fx, fy, 10 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = f.accent(); ctx.lineWidth = 11.5 * s;
  const dx = fx - n.x, dy = fy - n.y, l = Math.hypot(dx, dy) || 1;
  ctx.beginPath(); ctx.moveTo(fx - dx / l * 26 * s, fy - dy / l * 26 * s); ctx.lineTo(fx - dx / l * 12 * s, fy - dy / l * 12 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  }

/* =================================================================== ROSTER */
const ROSTER = [];
const BY_ID = {};
function fighter(def) {
  def.moves = Object.assign(normalsFor(def), def.moves);
  def.moves.throw.poseFn = throwPoseFn;
  for (const k in def.moves) { def.moves[k].key = k; if (!def.moves[k].id) def.moves[k].id = k; }
  ROSTER.push(def); BY_ID[def.id] = def;
  return def;
}

/* ------------------------------------------------------------- KAZE */
fighter({
  id: 'kaze', name: 'KAZE', title: 'KI WARRIOR', color: '#ff9b2a', aura: '#ffd34d',
  hp: 1000, walk: 300, power: 1, stats: [4, 4, 4], price: 0, stage: 'crater',
  blurb: 'A martial artist who never stops training. Fires ki blasts, vanishes behind you, and ends fights with a beam that splits the sky.',
  look: { gear: 'headband', cape: true, surge: { accent: '#ffd84d' } },
  ai: { style: 'balanced', range: 260 },
  moves: {
    sp1: { name: 'Ki Blast', icon: 'orb', kind: 'special', w: 0.15, a: 0.05, r: 0.28, pose: 'cast', cd: 1.4, air: true, ai: { range: [220, 1400], zone: true },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'fired')) {
          const h = hand(f);
          G.proj({ owner: f, x: h.x + f.facing * 18, y: h.y, vx: f.facing * 980, vy: 0, r: 24, color: '#7fd4ff', life: 1.6, strength: 1, draw: orbDraw,
            spec: { dmg: 62, kb: [320, -40], stun: 0.4, bstun: 0.22, hs: 0.07, chip: 0.2, sfx: 'blast', color: '#7fd4ff', kind: 'special', name: 'Ki Blast' } });
          Sfx.play('ki');
        }
      } },
    sp2: { name: 'Afterimage Rush', icon: 'blink', kind: 'special', w: 0.16, a: 0.12, r: 0.34, pose: 'slam', cd: 5, ai: { range: [0, 700] },
      start: (G, f, act) => { f.invuln = Math.max(f.invuln, 0.24); G.fx.add({ kind: 'smoke', x: f.root.x, y: f.root.y - 110 * f.s, size: 50, life: 0.4, color: '#ffffff', add: false }); Sfx.play('vanish'); f.alpha = 0.25; },
      tick: (G, f, act) => {
        const o = G.opp(f);
        if (act.t >= act.w * 0.6 && once(act, 'tp')) {
          const behind = o.root.x + (o.root.x >= f.root.x ? 1 : -1) * 90 * f.s;
          const x = clamp(behind, WALL_L + 50 * f.s, WALL_R - 50 * f.s);
          G.teleport(f, Math.abs(x - o.root.x) < 40 * f.s ? o.root.x - (o.root.x >= f.root.x ? 1 : -1) * 90 * f.s : x, o.root.y < GROUND - 20 ? o.root.y - 40 * f.s : GROUND);
          f.facing = o.root.x >= f.root.x ? 1 : -1; f.alpha = 1;
          if (!f.root.grounded) f.root.hover = true;
        }
        if (phaseOf(act).ph === 1) boxHit(G, f, act, [58, -110, 46], { dmg: 60, kb: [260, -980], stun: 0.95, bstun: 0.25, hs: 0.11, launch: true, sfx: 'hitH', color: '#ffd34d', kind: 'special', name: 'Afterimage Rush', bf: true }, 'h1');
      },
      end: (G, f) => { f.alpha = 1; } },
    super: { name: 'Wave Cannon', icon: 'beam', kind: 'super', w: 0.85, a: 1.2, r: 0.45, pose: 'beam', ai: { range: [0, 1400] },
      start: (G, f, act) => { G.cutin(f, 'WAVE CANNON', 'ULTIMATE'); f.invuln = 0.9; f.surge = 8; f.auraT = 2.5; },
      tick: (G, f, act, dt) => {
        const { ph, u } = phaseOf(act);
        const h = hand(f), b = hand(f, true);
        const cx = (h.x + b.x) / 2, cy = (h.y + b.y) / 2;
        if (ph === 0) {
          act.charge = u;
          if (Math.random() < 0.6) { const a = rand(0, TAU), d = rand(90, 200); G.fx.add({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: -Math.cos(a) * d * 4, vy: -Math.sin(a) * d * 4, life: 0.25, size: 7, color: '#9fe3ff' }); }
          if (once(act, 'chg')) Sfx.play('charge');
        }
        if (ph >= 1 && once(act, 'fire')) {
          act.beam = G.beam({ owner: f, x: cx + f.facing * 20, y: cy, dir: f.facing, width: 120, color: '#5fc8ff', core: '#ffffff', dur: act.a, every: 0.075, grow: 5200,
            spec: { dmg: 19, kb: [240, -10], stun: 0.3, bstun: 0.16, hs: 0.02, chip: 0.35, color: '#7fd4ff', kind: 'super', name: 'Wave Cannon', sfx: 'beamHit' },
            final: { dmg: 90, kb: [900, -700], stun: 1.2, launch: true, hs: 0.18, chip: 0.4, color: '#bfefff', kind: 'super', big: true, name: 'Wave Cannon' } });
          G.shake(14); Sfx.play('beam'); G.say(f.root.x, f.root.y - 300 * f.s / 2, 'HAAAAAA!', '#bfefff', 64);
        }
        if (act.beam) { act.beam.x = cx + f.facing * 20; act.beam.y = cy; G.shake(4); }
      },
      draw: (G, ctx, f, act, time) => {
        if (phaseOf(act).ph === 0) {
          const h = hand(f), b = hand(f, true);
          drawSphereAt(ctx, (h.x + b.x) / 2, (h.y + b.y) / 2, 10 + (act.charge || 0) * 34, '#5fc8ff', time);
        }
      } },
  },
});

/* ------------------------------------------------------------- RYO */
fighter({
  id: 'ryo', name: 'RYO', title: 'SHINOBI', color: '#ffd23f', aura: '#ffe27a', jumps: 2,
  hp: 1080, walk: 345, power: 1.1, stats: [3, 5, 4], price: 0, stage: 'temple',
  blurb: 'A loud ninja who never gives up. Double jumps, drills in with a vortex palm and swarms you with mirror clones.',
  look: { gear: 'headband' },
  ai: { style: 'rush', range: 180 },
  moves: {
    sp1: { name: 'Vortex Palm', icon: 'swirl', kind: 'special', w: 0.24, a: 0.34, r: 0.28, pose: 'palm', cd: 3, ai: { range: [80, 560] },
      start: (G, f) => Sfx.play('spiral'),
      tick: (G, f, act) => {
        const { ph } = phaseOf(act);
        act.vx = ph === 1 && !act.h2 ? f.facing * 1150 * f.s / 2 : ph === 2 ? 0 : null;
        if (ph === 1) {
          act.tk = (act.tk || 0) + STEP;
          if (!act.h2 && act.tk >= 0.06) {
            act.tk = 0;
            const r = boxHit(G, f, act, [64, -108, 40], { dmg: 15, kb: [90, -20], stun: 0.3, bstun: 0.12, hs: 0.025, chip: 0.2, color: '#8fdcff', kind: 'special', sfx: 'drill' });
            if (r) { act.n = (act.n || 0) + 1; if (r === 'block') act.h2 = true; }
            if (act.n >= 4) {
              act.h2 = true;
              boxHit(G, f, act, [64, -108, 46], { dmg: 64, kb: [820, -520], stun: 1, launch: true, hs: 0.12, chip: 0.2, color: '#8fdcff', kind: 'special', sfx: 'hitH', name: 'Vortex Palm' });
              G.fx.ring(hand(f).x, hand(f).y, '#8fdcff', 180, 0.4, 10);
            }
          }
        }
      },
      draw: (G, ctx, f, act, time) => { if (phaseOf(act).ph < 2) { const h = hand(f); drawSphereAt(ctx, h.x + f.facing * 10, h.y, 16 + Math.min(1, act.t / act.w) * 10, '#5fc8ff', time); } } },
    sp2: { name: 'Mirror Clones', icon: 'swarm', kind: 'special', w: 0.2, a: 0.05, r: 0.3, pose: 'grab', cd: 5.5, ai: { range: [0, 900] },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'spawn')) {
          const o = G.opp(f);
          Sfx.play('pop');
          for (const side of [-1, 1]) {
            const x = clamp(o.root.x + side * 260, WALL_L + 60, WALL_R - 60);
            G.cloneOf(f, x, side > 0 ? -1 : 1, 0.12 + (side > 0 ? 0.12 : 0));
          }
        }
      } },
    super: { name: 'Storm Star', icon: 'cyclone', kind: 'super', w: 0.8, a: 0.12, r: 0.5, pose: 'raise', ai: { range: [0, 1300] },
      start: (G, f) => { G.cutin(f, 'STORM STAR', 'ULTIMATE'); f.invuln = 0.85; f.auraT = 1.6; Sfx.play('charge'); },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'throw')) {
          const n = f.pts[P.NECK];
          G.proj({ owner: f, x: n.x + f.facing * 40, y: n.y - 30, vx: f.facing * 700, vy: 0, r: 58, life: 2.4, strength: 9, pierce: true, draw: shurikenDraw, sfxLoop: 'wind',
            onHit: (G, p, o) => {
              // the shuriken bursts into a dome of wind blades that holds the target
              p.dead = true;
              G.field({ owner: f, x: o.root.x, y: o.root.y - 110 * o.s, r: 150, life: 1.1, every: 0.06, color: '#bfefff', hold: o,
                spec: { dmg: 15, kb: [0, -10], stun: 0.3, bstun: 0.1, hs: 0.015, chip: 0.3, color: '#bfefff', kind: 'super', sfx: 'cut' },
                final: { dmg: 115, kb: [700, -900], stun: 1.3, launch: true, hs: 0.2, chip: 0.4, color: '#ffffff', kind: 'super', big: true, name: 'Storm Star' } });
            },
            spec: { dmg: 20, kb: [100, 0], stun: 0.3, bstun: 0.2, chip: 0.3, hs: 0.03, unblockable: true, color: '#bfefff', kind: 'super', name: 'Storm Star' } });
          Sfx.play('whoosh');
        }
      },
      draw: (G, ctx, f, act, time) => { if (act.t < act.w) { const n = f.pts[P.NECK]; shurikenDraw(ctx, { x: n.x, y: n.y - 70 * f.s, r: 20 + (act.t / act.w) * 38 }, time); } } },
  },
});

/* ------------------------------------------------------------- AOI */
fighter({
  id: 'aoi', name: 'AOI', title: 'SORCERER', color: '#a06bff', aura: '#7fb6ff',
  hp: 950, walk: 295, power: 1.05, stats: [5, 3, 5], price: 600, stage: 'void',
  blurb: 'The strongest of his generation, and he knows it. Pulls you in with azure, blasts you out with crimson, and traps you inside his infinite domain.',
  look: { gear: 'hood' },
  ai: { style: 'zoner', range: 340 },
  moves: {
    sp1: { name: 'Azure Pull', icon: 'rift', kind: 'special', w: 0.18, a: 0.2, r: 0.3, pose: 'point', cd: 4, air: true, ai: { range: [150, 900], zone: true },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'spawn')) {
          const x = clamp(f.root.x + f.facing * 360, WALL_L + 80, WALL_R - 80);
          G.field({ owner: f, x, y: GROUND - 120 * f.s / 2 - 60, r: 90, life: 1.0, every: 0.16, color: '#4f8dff', pull: 2600, draw: 'blue',
            spec: { dmg: 11, kb: [0, 0], stun: 0.28, bstun: 0.12, hs: 0.02, chip: 0.25, color: '#7fb6ff', kind: 'special', sfx: 'zap' },
            final: { dmg: 30, kb: [-200, -500], stun: 0.7, launch: true, hs: 0.08, chip: 0.2, color: '#9fc6ff', kind: 'special', name: 'Azure Pull' } });
          Sfx.play('blue');
        }
      } },
    sp2: { name: 'Crimson Burst', icon: 'burst', kind: 'special', w: 0.18, a: 0.07, r: 0.36, pose: 'point', cd: 4, ai: { range: [0, 220] },
      tick: (G, f, act) => {
        if (phaseOf(act).ph === 1) {
          if (once(act, 'boom')) { const h = hand(f); G.fx.ring(h.x, h.y, '#ff3b4f', 170, 0.35, 12); G.fx.burst(h.x, h.y, '#ff5a6a', 22, 600); Sfx.play('red'); G.shake(8); }
          boxHit(G, f, act, [74, -104, 70], { dmg: 66, kb: [1250, -380], stun: 1.05, bstun: 0.3, launch: true, hs: 0.12, chip: 0.2, color: '#ff3b4f', kind: 'special', sfx: 'hitH', name: 'Crimson Burst', bf: true }, 'h1');
        }
      },
      draw: (G, ctx, f, act, time) => { if (act.t < act.w + act.a) { const h = hand(f); drawSphereAt(ctx, h.x + f.facing * 6, h.y, 8 + Math.min(1, act.t / act.w) * 10, '#ff3b4f', time); } } },
    super: { name: 'Infinite Expanse', icon: 'void', kind: 'super', w: 0.55, a: 1.55, r: 0.4, pose: 'grab', ai: { range: [0, 1400] },
      start: (G, f) => { G.cutin(f, 'INFINITE EXPANSE', 'DOMAIN'); f.invuln = 2.6; f.eyeGlint = 2.5; Sfx.play('domain'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        if (act.t >= act.w && once(act, 'domain')) {
          G.tint('void', 2.4);
          if (o.alive && !(o.invuln > 0 && o.mode !== 'rising')) { o.stopT = 1.35; o.action = null; o.flash = 1; G.say(o.root.x, o.root.y - 300, 'FROZEN IN THE VOID', '#d9e4ff', 34); }
        }
        if (act.t >= act.w + 0.95 && once(act, 'violet')) {
          const h = hand(f);
          G.proj({ owner: f, x: h.x + f.facing * 30, y: f.root.y - 110 * f.s, vx: f.facing * 1500, vy: 0, r: 92, life: 1.6, strength: 99, pierce: true, color: '#b06bff',
            draw: (ctx, p, time) => { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#a35bff', p.x, p.y, p.r * 3.4, 1); ctx.fillStyle = '#e8d6ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; G.fx.add({ x: p.x - Math.sign(p.vx) * p.r, y: p.y + rand(-p.r, p.r), vx: -p.vx * 0.2, vy: rand(-60, 60), life: 0.4, size: rand(10, 24), color: '#b06bff' }); },
            spec: { dmg: 300, kb: [1300, -700], stun: 1.4, launch: true, hs: 0.22, unblockable: true, color: '#c58bff', kind: 'super', big: true, name: 'Violet Void', sfx: 'hitH' } });
          G.shake(16); Sfx.play('violet'); G.say(f.root.x, f.root.y - 330, 'VIOLET VOID', '#e0c8ff', 50);
        }
      },
      draw: (G, ctx, f, act, time) => {
        const k = act.t - act.w;
        if (k > 0.3 && k < 0.95) {
          const h = hand(f), b = hand(f, true), m = clamp((k - 0.3) / 0.6, 0, 1);
          drawSphereAt(ctx, lerp(h.x, b.x, m * 0.5) + f.facing * 10, h.y - 20, 14, '#4f8dff', time);
          drawSphereAt(ctx, lerp(b.x, h.x, m * 0.5) + f.facing * 10, b.y - 20 + 14, 14, '#ff3b4f', time);
        }
      } },
  },
});

/* ------------------------------------------------------------- HOMURA */
fighter({
  id: 'homura', name: 'HOMURA', title: 'DEMON HUNTER', color: '#35c3d6', aura: '#ff7a2a', reach: 18,
  hp: 1030, walk: 315, power: 1.1, stats: [4, 4, 5], price: 0, stage: 'temple',
  blurb: 'A gentle swordsman with a burning will. His tide forms flow into each other, and his flame form turns the blade into the sun.',
  look: { gear: 'headband', cape: true, weapon: 'katana', weaponLen: 60 },
  ai: { style: 'balanced', range: 230 },
  moves: {
    sp1: { name: 'Tide Flip', icon: 'wave', kind: 'special', w: 0.1, a: 0.26, r: 0.26, cd: 3, ai: { range: [60, 420] },
      poseFn: arcPose(-2.6, 1.6, ph => ({ crouch: ph === 1 ? -6 : 10, ff: [10, -40], bf: [-20, -30] })),
      start: (G, f, act) => { f.root.vy = -820 * f.s / 2 * 1.2; f.root.vx = f.facing * 520; f.root.grounded = false; Sfx.play('swish'); },
      tick: (G, f, act) => {
        const { ph, u } = phaseOf(act);
        if (ph === 1) {
          if (once(act, 'fx')) { const n = f.pts[P.NECK]; G.fx.slash(n.x, n.y + 10, 95 * f.s / 2 * 1.4, f.facing > 0 ? -2.6 : -0.5, f.facing > 0 ? 1.6 : -4.7, '#4fd2ff', 30, 0.3); }
          boxHit(G, f, act, [88, -70, 52], { dmg: 86, kb: [360, -900], stun: 1, bstun: 0.28, launch: true, hs: 0.11, chip: 0.2, color: '#4fd2ff', kind: 'special', sfx: 'slashH', name: 'Tide Flip', bf: true }, 'h1');
        }
      } },
    sp2: { name: 'River Rush', icon: 'tornado', kind: 'special', w: 0.1, a: 0.38, r: 0.26, cd: 4, ai: { range: [80, 600] },
      poseFn: arcPose(-1.0, 1.0, ph => ({ lean: ph === 1 ? 18 : 4, crouch: 14 })),
      start: (G, f, act) => { act.ghost = true; Sfx.play('swish'); },
      tick: (G, f, act) => {
        const { ph } = phaseOf(act);
        act.vx = ph === 1 ? f.facing * 1100 * f.s / 2 : ph === 2 ? 0 : null;
        if (ph === 1) {
          act.tk = (act.tk || 0) + STEP;
          if (act.tk > 0.045) { act.tk = 0; const n = f.pts[P.NECK]; G.fx.slash(n.x, n.y + 20, 70 + rand(0, 30), rand(-3, 0), rand(0.5, 2.5), '#4fd2ff', 16, 0.25); }
          act.ht = (act.ht || 0) + STEP;
          if ((act.n || 0) < 3 && act.ht > 0.09) {
            const r = boxHit(G, f, act, [40, -96, 54], { dmg: 28, kb: [act.n === 2 ? 600 : 80, act.n === 2 ? -600 : -40], stun: act.n === 2 ? 0.9 : 0.35, bstun: 0.16, launch: act.n === 2, hs: 0.04, chip: 0.2, color: '#4fd2ff', kind: 'special', sfx: 'slash', name: 'River Rush' });
            if (r) { act.n = (act.n || 0) + 1; act.ht = 0; }
          }
        }
      } },
    super: { name: 'Solar Coil', icon: 'sun', kind: 'super', w: 0.5, a: 1.5, r: 0.45, ai: { range: [0, 520] },
      poseFn: (f, act, base) => {
        const { ph } = phaseOf(act);
        if (ph === 0) return Object.assign({}, base, { fh: [-20, 30], bh: [-26, 34], crouch: 22, lean: 8 });
        const k = (act.t * 7) % 1;
        const ang = (Math.floor(act.t * 7) % 2 ? lerp(-1.8, 1.4, k) : lerp(1.4, -1.8, k));
        return Object.assign({}, base, { fh: [Math.cos(ang) * 44, Math.sin(ang) * 44], bh: [Math.cos(ang) * 30, Math.sin(ang) * 30 + 6], lean: 12, crouch: 10 });
      },
      start: (G, f, act) => { G.cutin(f, 'SOLAR COIL', 'FLAME FORM'); f.invuln = 2.2; f.auraT = 2.5; act.ghost = true; Sfx.play('flame'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        const { ph } = phaseOf(act);
        if (ph === 0 && act.t > act.w * 0.5 && once(act, 'go')) G.tint('sun', 2.2);
        if (ph === 1) {
          const k = act.t - act.w;
          const idx = Math.floor(k / 0.2);
          if (idx < 6 && act.last !== idx) {
            act.last = idx;
            // blink to alternating sides of the target and cut through
            const side = idx % 2 ? 1 : -1;
            G.teleport(f, clamp(o.root.x + side * 110 * f.s / 2 * 1.6, WALL_L + 40, WALL_R - 40), GROUND);
            f.facing = o.root.x >= f.root.x ? 1 : -1;
            const c = o.center();
            G.fx.slash(c.x, c.y, 120, rand(-3.2, 0), rand(0.6, 3), idx % 2 ? '#ffb13d' : '#ff5a2a', 26, 0.32);
            if (o.alive) G.hit(f, o, { dmg: 30, kb: [40, -60], stun: 0.45, bstun: 0.2, hs: 0.05, chip: 0.3, color: '#ffb13d', kind: 'super', sfx: 'slashH', noLaunch: true }, c.x, c.y, act);
          }
          if (k >= 1.25 && once(act, 'final')) {
            const c = o.center();
            G.fx.slash(f.pts[P.NECK].x, f.pts[P.NECK].y, 190, -Math.PI, Math.PI, '#ff7a1a', 46, 0.6);
            G.fx.ring(c.x, c.y, '#ffd54a', 300, 0.6, 16);
            G.hit(f, o, { dmg: 125, kb: [520, -1150], stun: 1.3, launch: true, hs: 0.22, chip: 0.4, color: '#ffd54a', kind: 'super', big: true, sfx: 'slashH', name: 'Solar Coil' }, c.x, c.y, act);
          }
        }
      },
      draw: (G, ctx, f, act, time) => {
        if (act.t > act.w) {
          // a coiling fire dragon trailing the blade
          const w = f.weaponLine();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 6; i++) G.fx.add({ kind: 'flame', x: lerp(w.x0, w.x1, Math.random()), y: lerp(w.y0, w.y1, Math.random()), vx: rand(-200, 200), vy: rand(-300, -80), life: 0.35, size: rand(6, 12), color: i % 2 ? '#ff7a1a' : '#ffd54a' });
          ctx.globalCompositeOperation = 'source-over';
        }
      } },
  },
});

/* ------------------------------------------------------------- JIN */
fighter({
  id: 'jin', name: 'JIN', title: 'REAPER', color: '#5b6cff', aura: '#ff2c4a', reach: 22,
  hp: 1050, walk: 290, power: 1.1, stats: [5, 3, 5], price: 450, stage: 'city',
  blurb: 'A reaper with a blade as big as he is. Throws crescent waves, blinks behind you, and releases an eclipse.',
  look: { gear: 'hood', cape: true, weapon: 'cleaver', weaponLen: 64, surge: { accent: '#ff2c4a', dark: true } },
  ai: { style: 'zoner', range: 300 },
  moves: {
    sp1: { name: 'Crescent Wave', icon: 'crescent', kind: 'special', w: 0.16, a: 0.06, r: 0.3, cd: 2.4, air: true, ai: { range: [200, 1400], zone: true },
      poseFn: arcPose(-1.6, 1.1),
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'fired')) {
          const big = f.surge > 0;
          G.proj({ owner: f, x: f.root.x + f.facing * 80 * f.s / 2, y: f.root.y - 100 * f.s, vx: f.facing * 1050, vy: 0, r: big ? 62 : 48, life: 1.4, strength: 2, draw: crescentDraw, color: '#9fe6ff', dark: big, edge: '#ff2c4a',
            spec: { dmg: big ? 90 : 74, kb: [460, -160], stun: 0.45, bstun: 0.24, hs: 0.08, chip: 0.25, color: '#9fe6ff', kind: 'special', sfx: 'slashH', name: 'Crescent Wave' } });
          Sfx.play('fang');
        }
      } },
    sp2: { name: 'Blink Step', icon: 'shadowstep', kind: 'special', w: 0.1, a: 0.08, r: 0.24, cd: 3, ai: { range: [0, 700] },
      poseFn: arcPose(-0.8, 1.3),
      start: (G, f) => { f.invuln = 0.2; f.alpha = 0.2; Sfx.play('vanish'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        if (act.t >= act.w * 0.7 && once(act, 'tp')) {
          const near = Math.abs(o.root.x - f.root.x) < 520;
          let x = near ? o.root.x + (o.root.x >= f.root.x ? 1 : -1) * 100 * f.s / 2 * 1.4 : f.root.x + f.facing * 320;
          x = clamp(x, WALL_L + 50, WALL_R - 50);
          if (Math.abs(x - o.root.x) < 50) x = o.root.x - (o.root.x >= f.root.x ? 1 : -1) * 140;
          G.teleport(f, x, f.root.y);
          f.facing = o.root.x >= f.root.x ? 1 : -1; f.alpha = 1;
          if (!f.root.grounded) f.root.hover = true;
        }
        if (phaseOf(act).ph === 1) {
          if (once(act, 'sl')) { const n = f.pts[P.NECK]; G.fx.slash(n.x, n.y + 10, 90, f.facing > 0 ? -0.8 : -2.3, f.facing > 0 ? 1.3 : 1.8 + Math.PI, '#9fe6ff', 20, 0.22); }
          boxHit(G, f, act, [94, -96, 40], { dmg: 56, kb: [320, -360], stun: 0.6, bstun: 0.22, hs: 0.08, chip: 0.2, color: '#9fe6ff', kind: 'special', sfx: 'slashH', launch: true, name: 'Blink Step' }, 'h1');
        }
      },
      end: (G, f) => { f.alpha = 1; } },
    super: { name: 'Eclipse Crescent', icon: 'moon', kind: 'super', w: 0.75, a: 0.1, r: 0.55, ai: { range: [0, 1400] },
      poseFn: arcPose(-2.2, 1.4, ph => (ph === 0 ? { crouch: 18 } : { crouch: 6, ff: [40, 0], bf: [-36, 0] })),
      start: (G, f) => { G.cutin(f, 'ECLIPSE CRESCENT', 'RELEASE'); f.invuln = 0.8; f.surge = 9; f.auraT = 2; G.tint('blood', 1.2); Sfx.play('domain'); },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'fire')) {
          G.proj({ owner: f, x: f.root.x + f.facing * 90, y: f.root.y - 120 * f.s, vx: f.facing * 1350, vy: 0, r: 120, life: 1.4, strength: 9, pierce: true, draw: crescentDraw, dark: true, edge: '#ff2c4a', every: 0.07, multi: 6, grind: 0.1,
            spec: { dmg: 26, kb: [260, -40], stun: 0.35, bstun: 0.15, hs: 0.03, chip: 0.3, color: '#ff2c4a', kind: 'super', sfx: 'cut' },
            final: { dmg: 120, kb: [1000, -760], stun: 1.3, launch: true, hs: 0.2, chip: 0.4, color: '#ff2c4a', kind: 'super', big: true, name: 'Eclipse Crescent' } });
          G.shake(16); Sfx.play('fang'); Sfx.play('boom');
        }
      } },
  },
});

/* ------------------------------------------------------------- MUGI */
fighter({
  id: 'mugi', name: 'MUGI', title: 'RUBBER BRAWLER', color: '#ff4fa3', aura: '#ffffff',
  hp: 1000, walk: 305, power: 1, stats: [4, 4, 5], price: 0, stage: 'dojo',
  blurb: 'A rubber-bodied brawler who laughs through every fight. His fists stretch across the arena, and his awakening goes giant.',
  look: { gear: 'band', surge: { accent: '#ffffff' } },
  ai: { style: 'balanced', range: 300 },
  moves: {
    l1: { id: 'l1', name: 'Stretch Jab', kind: 'light', w: 0.06, a: 0.08, r: 0.14, pose: 'jab', box: [96, -112, 24], chain: 'l2', rubber: 90,
      hit: { dmg: 30, kb: [170, 0], stun: 0.3, bstun: 0.17, hs: 0.05, sfx: 'hitL', color: '#e8323f' } },
    sp1: { name: 'Stretch Punch', icon: 'stretch', kind: 'special', w: 0.15, a: 0.16, r: 0.26, pose: 'punchH', cd: 2.2, air: true, ai: { range: [150, 640] },
      start: (G, f) => Sfx.play('stretch'),
      tick: (G, f, act) => {
        const { ph, u } = phaseOf(act);
        const reach = ph === 1 ? easeOut(Math.min(1, u * 2.2)) : ph === 2 ? 1 - easeInOut(u) : 0;
        act.ext = reach * 600 * f.s / 2;
        f.hideArm = ph > 0 && act.ext > 10;
        if (ph === 1 && !act.h1) {
          const n = f.pts[P.NECK];
          const fx = n.x + f.facing * act.ext, fy = n.y + 8;
          const o = G.opp(f);
          const res = o.hitTest(fx, fy, 22 * f.s);
          if (res) { act.h1 = true; G.hit(f, o, { dmg: 66, kb: [560, -100], stun: 0.5, bstun: 0.24, hs: 0.09, chip: 0.2, color: '#ffcc66', kind: 'special', sfx: 'hitH', name: 'Stretch Punch', bf: true }, res.x, res.y, act); }
        }
      },
      end: (G, f) => { f.hideArm = false; },
      draw: (G, ctx, f, act) => { if (act.ext > 10) { const n = f.pts[P.NECK]; drawRubberArm(ctx, f, n.x + f.facing * act.ext, n.y + 8); } } },
    sp2: { name: 'Rapid Barrage', icon: 'fist', kind: 'special', w: 0.12, a: 0.66, r: 0.3, cd: 4.5, ai: { range: [0, 380] },
      poseFn: barragePose(16),
      start: (G, f) => Sfx.play('stretch'),
      tick: (G, f, act) => {
        const { ph } = phaseOf(act);
        if (ph === 1) {
          act.tk = (act.tk || 0) + STEP;
          if (act.tk >= 0.055) {
            act.tk = 0; act.n = (act.n || 0) + 1;
            const last = act.n >= 11;
            const r = boxHit(G, f, act, [150, -104, 90], last
              ? { dmg: 40, kb: [620, -520], stun: 0.9, launch: true, hs: 0.1, chip: 0.2, color: '#ffcc66', kind: 'special', sfx: 'hitH', name: 'Rapid Barrage' }
              : { dmg: 8, kb: [60, 0], stun: 0.25, bstun: 0.12, hs: 0.012, chip: 0.2, color: '#ffcc66', kind: 'special', sfx: 'tap' });
            if (last) act.n = -99;
          }
        }
      },
      draw: (G, ctx, f, act, time) => {
        if (phaseOf(act).ph !== 1) return;
        const n = f.pts[P.NECK];
        for (let i = 0; i < 7; i++) {
          const d = 60 + ((time * 13 + i * 0.37) % 1) * 180 * f.s / 2, y = n.y + Math.sin(i * 2.3 + time * 30) * 34;
          ctx.globalAlpha = 0.55; drawRubberArm(ctx, f, n.x + f.facing * d, y); ctx.globalAlpha = 1;
        }
      } },
    super: { name: 'Titan Fist', icon: 'goldfist', kind: 'super', w: 0.95, a: 0.25, r: 0.55, ai: { range: [0, 900] },
      poseFn: (f, act, base) => {
        const { ph } = phaseOf(act);
        return ph === 0 ? Object.assign({}, base, { fh: [-10, -40], bh: [-20, -30], lean: -12 }) : Object.assign({}, base, { fh: [40, 30], bh: [-20, 20], lean: 22, crouch: 20 });
      },
      start: (G, f, act) => { G.cutin(f, 'TITAN FIST', 'AWAKENING'); f.invuln = 1.25; f.surge = 9; f.auraT = 2; act.vy = -260; f.root.hover = true; f.root.grounded = false; Sfx.play('drum'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        const { ph, u } = phaseOf(act);
        if (ph === 0) { act.vy = -300 * (1 - u); act.vx = 0; act.fist = 40 + u * 150; act.tx = o.root.x; }
        if (ph === 1) {
          act.vy = 0;
          if (once(act, 'slam')) {
            act.fist = 190;
            G.shake(26); Sfx.play('boom');
            G.fx.ring(act.tx, GROUND - 20, '#ffffff', 420, 0.7, 20);
            G.fx.chunks(act.tx, GROUND - 4, '#b9a58f', 24, 900, 12);
            if (Math.abs(o.root.x - act.tx) < 260 && o.alive)
              G.hit(f, o, { dmg: 290, kb: [300, -1100], stun: 1.4, launch: true, hs: 0.24, chip: 0.4, color: '#ffffff', kind: 'super', big: true, sfx: 'hitH', name: 'Titan Fist' }, o.center().x, o.center().y, act);
          }
        }
        if (ph === 2) { f.root.hover = false; act.vy = null; act.fist = Math.max(0, (act.fist || 0) * (1 - u)); }
      },
      end: (G, f) => { f.root.hover = false; },
      draw: (G, ctx, f, act, time) => {
        const r = act.fist || 0;
        if (r < 4) return;
        const n = f.pts[P.NECK];
        const { ph } = phaseOf(act);
        const fx = ph === 0 ? n.x - f.facing * 40 : act.tx, fy = ph === 0 ? n.y - 120 - r * 0.6 : GROUND - r * 0.85;
        ctx.strokeStyle = '#f6eadb'; ctx.lineWidth = 16 * f.s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.quadraticCurveTo(lerp(n.x, fx, 0.5), Math.min(n.y, fy) - 60, fx, fy); ctx.stroke();
        ctx.fillStyle = '#f6eadb';
        ctx.beginPath(); ctx.ellipse(fx, fy, r, r * 0.86, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 6;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(fx - r * 0.5, fy + i * r * 0.3); ctx.lineTo(fx + r * 0.5, fy + i * r * 0.3); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, '#ffffff', fx, fy, r * 1.6, 0.35); ctx.globalCompositeOperation = 'source-over';
      } },
  },
});

/* ------------------------------------------------------------- KOHEI */
fighter({
  id: 'kohei', name: 'KOHEI', title: 'RISING HERO', color: '#2fd47a', aura: '#7dff8a',
  hp: 950, walk: 335, power: 1, stats: [4, 5, 3], price: 300, stage: 'city',
  blurb: 'A hero-in-training whose power could break his own bones. Flicks shockwaves, cracks the ground with a lightning kick, and smashes at max power.',
  look: { gear: 'band' },
  ai: { style: 'rush', range: 220 },
  moves: {
    sp1: { name: 'Air Flick', icon: 'sonic', kind: 'special', w: 0.1, a: 0.05, r: 0.24, pose: 'point', cd: 1.6, air: true, ai: { range: [100, 700], zone: true },
      tick: (G, f, act) => {
        if (act.t >= act.w && once(act, 'fired')) {
          const h = hand(f);
          G.proj({ owner: f, x: h.x, y: h.y, vx: f.facing * 1500, vy: 0, r: 34, life: 0.45, strength: 1, draw: ringDraw, color: '#c9ffe0',
            spec: { dmg: 52, kb: [520, -110], stun: 0.42, bstun: 0.2, hs: 0.07, chip: 0.2, color: '#c9ffe0', kind: 'special', sfx: 'hitH', name: 'Air Flick' } });
          G.fx.arc(h.x, h.y, h.x - f.facing * 60, h.y - 40, '#7dff8a', 0.2);
          Sfx.play('flick');
        }
      } },
    sp2: { name: 'Volt Kick', icon: 'bolt', kind: 'special', w: 0.16, a: 0.4, r: 0.22, pose: 'kickH', cd: 3, ai: { range: [120, 560] },
      start: (G, f, act) => { f.root.vy = -1150 * f.s / 2 * 1.15; f.root.vx = f.facing * 640; f.root.grounded = false; Sfx.play('zap'); },
      tick: (G, f, act) => {
        const { ph } = phaseOf(act);
        if (Math.random() < 0.5) { const c = f.center(); G.fx.arc(c.x + rand(-50, 50), c.y + rand(-80, 60), c.x + rand(-50, 50), c.y + rand(-80, 60), '#7dff8a', 0.12); }
        if (ph === 1 && act.t > act.w + 0.12) {
          if (f.root.vy < 0) f.root.vy = Math.max(f.root.vy, 200);
          boxHit(G, f, act, [70, -40, 56], { dmg: 90, kb: [320, -620], stun: 0.95, bstun: 0.3, launch: true, hs: 0.12, chip: 0.2, color: '#7dff8a', kind: 'special', sfx: 'hitH', name: 'Volt Kick', bf: true }, 'h1');
        }
      },
      endOnLand: true,
      onLand: (G, f, act) => { G.fx.ring(f.root.x, GROUND, '#7dff8a', 160, 0.35, 8); G.shake(6); G.fx.dust(f.root.x, GROUND, 8); } },
    super: { name: 'Max Impact', icon: 'magmafist', kind: 'super', w: 0.8, a: 0.25, r: 0.6, pose: 'punchH', ai: { range: [0, 1000] },
      start: (G, f) => { G.cutin(f, 'MAX IMPACT', 'FULL POWER'); f.invuln = 0.9; f.auraT = 2; Sfx.play('charge'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        if (act.t < act.w && Math.random() < 0.7) { const c = f.center(); G.fx.arc(c.x + rand(-70, 70), c.y + rand(-110, 90), c.x + rand(-70, 70), c.y + rand(-110, 90), '#7dff8a', 0.14); }
        if (act.t >= act.w && once(act, 'smash')) {
          G.shake(28); Sfx.play('boom'); G.flash('#ffffff', 0.7);
          const h = hand(f);
          G.wind(f, 1.1);
          for (let i = 0; i < 40; i++) G.fx.add({ kind: 'spark', x: h.x, y: h.y + rand(-200, 200), vx: f.facing * rand(1800, 3600), vy: rand(-200, 200), life: rand(0.3, 0.6), size: rand(6, 14), color: i % 3 ? '#ffffff' : '#9dffb8', drag: 1 });
          const ahead = (o.root.x - f.root.x) * f.facing;
          if (ahead > -40 && ahead < 1100 && o.alive)
            G.hit(f, o, { dmg: 330, kb: [1500, -650], stun: 1.4, launch: true, hs: 0.24, chip: 0.4, color: '#9dffb8', kind: 'super', big: true, sfx: 'hitH', name: 'Max Impact' }, o.center().x, o.center().y, act);
        }
      } },
  },
});

/* ------------------------------------------------------------- TARO */
const STAND_DEF = {
  id: 'spirit', name: 'SPIRIT', hp: 1, walk: 0, scale: 1.12, color: '#9b7bff',
  look: { gear: 'helmet' },
  moves: {},
};
fighter({
  id: 'taro', name: 'TARO', title: 'SPIRIT MASTER', color: '#9fb3d9', aura: '#b39bff',
  hp: 1050, walk: 275, power: 1.05, stats: [5, 2, 4], price: 800, stage: 'city',
  blurb: 'A stoic fighter with a guardian spirit standing behind him. His spirit punches faster than the eye, and for a moment he can stop time itself.',
  look: { gear: 'helmet', cape: true },
  ai: { style: 'balanced', range: 260 },
  moves: {
    sp1: { name: 'Spirit Rush', icon: 'fist', kind: 'special', w: 0.16, a: 0.72, r: 0.3, pose: 'point', cd: 4.5, ai: { range: [0, 360] },
      tick: (G, f, act) => {
        const { ph } = phaseOf(act);
        if (once(act, 'st')) { act.stand = G.stand(f, act.w + act.a); Sfx.play('stand'); }
        if (ph === 1) {
          act.tk = (act.tk || 0) + STEP;
          if (act.tk >= 0.055) {
            act.tk = 0; act.n = (act.n || 0) + 1;
            const last = act.n >= 12;
            const r = boxHit(G, f, act, [150, -110, 80], last
              ? { dmg: 42, kb: [700, -520], stun: 0.9, launch: true, hs: 0.1, chip: 0.2, color: '#b39bff', kind: 'special', sfx: 'hitH', name: 'Spirit Rush' }
              : { dmg: 8, kb: [50, 0], stun: 0.25, bstun: 0.12, hs: 0.012, chip: 0.2, color: '#b39bff', kind: 'special', sfx: 'tap' });
            if (r === 'hit' && act.n % 3 === 0) { const o = G.opp(f); G.say(o.root.x + rand(-60, 60), o.root.y - rand(250, 330), 'BAM!', '#ffd34d', 38); }
            if (last) act.n = -99;
          }
        }
      } },
    sp2: { name: 'Spirit Finger', icon: 'lance', kind: 'special', w: 0.14, a: 0.12, r: 0.28, pose: 'point', cd: 2.4, ai: { range: [120, 520] },
      tick: (G, f, act) => {
        const { ph, u } = phaseOf(act);
        if (once(act, 'st')) act.stand = G.stand(f, act.w + act.a + act.r * 0.6);
        act.ext = ph === 1 ? easeOut(u) * 420 : ph === 2 ? 420 * (1 - u) : 0;
        if (ph === 1 && !act.h1) {
          const n = f.pts[P.NECK];
          const o = G.opp(f);
          const x = n.x + f.facing * (60 + act.ext), y = n.y - 10;
          const res = o.hitTest(x, y, 20);
          if (res) { act.h1 = true; G.hit(f, o, { dmg: 60, kb: [440, -80], stun: 0.48, bstun: 0.22, hs: 0.08, chip: 0.2, color: '#b39bff', kind: 'special', sfx: 'hitH', name: 'Spirit Finger' }, res.x, res.y, act); }
        }
      },
      draw: (G, ctx, f, act) => {
        if (!(act.ext > 5)) return;
        const n = f.pts[P.NECK];
        ctx.strokeStyle = '#8b6bff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(n.x + f.facing * 50, n.y - 10); ctx.lineTo(n.x + f.facing * (60 + act.ext), n.y - 10); ctx.stroke();
        ctx.fillStyle = '#e7c04c'; ctx.beginPath(); ctx.arc(n.x + f.facing * (60 + act.ext), n.y - 10, 7, 0, TAU); ctx.fill();
      } },
    super: { name: 'Time Halt', icon: 'timestop', kind: 'super', w: 0.6, a: 1.7, r: 0.4, pose: 'point', ai: { range: [0, 1400] },
      poseFn: (f, act, base) => {
        const { ph } = phaseOf(act);
        return ph === 0 ? Object.assign({}, base, { fh: [20, -40], bh: [-14, 20], lean: -6 }) : Object.assign({}, base, { fh: [30, 4], bh: [20, 14], lean: 6 });
      },
      start: (G, f, act) => { G.cutin(f, 'TIME HALT', 'TIME STANDS STILL'); f.invuln = 2.8; Sfx.play('clock'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        const { ph } = phaseOf(act);
        if (act.t >= act.w * 0.8 && once(act, 'stop')) {
          G.tint('stop', act.a + 0.3);
          G.timeStop(f, act.a + 0.2);
          act.stand = G.stand(f, act.a + 0.3);
          // step in front of the frozen target
          const x = clamp(o.root.x - (o.root.x >= f.root.x ? 1 : -1) * 130, WALL_L + 50, WALL_R - 50);
          G.teleport(f, x, GROUND); f.facing = o.root.x >= f.root.x ? 1 : -1;
          G.say(f.root.x, f.root.y - 330, 'TIME HALT', '#ffe08a', 52);
        }
        if (ph === 1) {
          act.tk = (act.tk || 0) + STEP;
          if (act.tk >= 0.07 && act.t < act.w + act.a - 0.2) {
            act.tk = 0;
            const c = o.center();
            G.hit(f, o, { dmg: 11, kb: [70, -30], stun: 0.3, hs: 0.0, unblockable: true, color: '#b39bff', kind: 'super', sfx: 'tap', noLaunch: true }, c.x + rand(-20, 20), c.y + rand(-50, 40), act);
            if (Math.random() < 0.35) G.say(c.x + rand(-80, 80), c.y - rand(140, 220), 'BAM!', '#ffd34d', 34);
          }
          if (act.t >= act.w + act.a - 0.2 && once(act, 'fin')) {
            const c = o.center();
            G.hit(f, o, { dmg: 90, kb: [1000, -700], stun: 1.3, launch: true, hs: 0.1, unblockable: true, color: '#ffe08a', kind: 'super', big: true, sfx: 'hitH', name: 'Time Halt' }, c.x, c.y, act);
          }
        }
      } },
  },
});

/* ------------------------------------------------------------- SAIBO */
fighter({
  id: 'saibo', name: 'SAIBO', title: 'BORED HERO', color: '#e8323f', aura: '#ffffff',
  hp: 1050, walk: 265, power: 1.05, stats: [5, 3, 3], price: 1500, unlockByClear: true, stage: 'crater', boss: true,
  blurb: 'A hero who got too strong to enjoy a fight. He fights bored, until he stops holding back. Unlock by clearing Arcade.',
  look: { gear: 'crest', cape: true },
  ai: { style: 'balanced', range: 240 },
  moves: {
    sp1: { name: 'Hundred Fists', icon: 'fist', kind: 'special', w: 0.12, a: 0.6, r: 0.3, cd: 4, ai: { range: [0, 300] },
      poseFn: barragePose(22),
      tick: (G, f, act) => {
        if (phaseOf(act).ph !== 1) return;
        act.tk = (act.tk || 0) + STEP;
        if (act.tk >= 0.05) {
          act.tk = 0; act.n = (act.n || 0) + 1;
          const last = act.n >= 11;
          boxHit(G, f, act, [100, -108, 70], last
            ? { dmg: 46, kb: [760, -500], stun: 0.9, launch: true, hs: 0.1, chip: 0.2, color: '#ffffff', kind: 'special', sfx: 'hitH', name: 'Hundred Fists' }
            : { dmg: 9, kb: [50, 0], stun: 0.25, bstun: 0.12, hs: 0.012, chip: 0.2, color: '#ffffff', kind: 'special', sfx: 'tap' });
          if (last) act.n = -99;
        }
      },
      draw: (G, ctx, f, act, time) => {
        if (phaseOf(act).ph !== 1) return;
        const n = f.pts[P.NECK];
        ctx.fillStyle = 'rgba(216,40,58,0.5)';
        for (let i = 0; i < 9; i++) { const d = 50 + ((time * 17 + i * 0.29) % 1) * 90, y = n.y + Math.sin(i * 1.9 + time * 40) * 40; ctx.beginPath(); ctx.arc(n.x + f.facing * d, y, 12, 0, TAU); ctx.fill(); }
      } },
    sp2: { name: 'Plain Punch', icon: 'goldfist', kind: 'special', w: 0.24, a: 0.08, r: 0.34, pose: 'punchH', cd: 3.5, ai: { range: [0, 220] },
      tick: (G, f, act) => {
        if (phaseOf(act).ph === 1) {
          if (boxHit(G, f, act, [86, -108, 40], { dmg: 125, kb: [1400, -360], stun: 1.1, bstun: 0.35, launch: true, hs: 0.16, chip: 0.25, color: '#ffffff', kind: 'special', sfx: 'hitH', name: 'Plain Punch', bf: true }, 'h1') === 'hit')
            G.say(f.root.x, f.root.y - 300, 'OK.', '#ffffff', 34);
        }
      } },
    super: { name: 'Final Punch', icon: 'skull', kind: 'super', w: 0.9, a: 0.12, r: 0.8, pose: 'punchH', ai: { range: [0, 1100] },
      start: (G, f) => { G.cutin(f, 'FINAL PUNCH', 'NO MORE HOLDING BACK'); f.invuln = 1.0; f.eyeGlint = 1.2; Sfx.play('charge'); },
      tick: (G, f, act) => {
        const o = G.opp(f);
        if (act.t >= act.w && once(act, 'punch')) {
          G.flash('#ffffff', 1); G.shake(34); Sfx.play('boom'); Sfx.play('boom');
          G.wind(f, 1.4, true);
          const ahead = (o.root.x - f.root.x) * f.facing;
          if (ahead > -40 && ahead < 1300 && o.alive)
            G.hit(f, o, { dmg: 400, kb: [1800, -900], stun: 1.6, launch: true, hs: 0.3, chip: 0.3, color: '#ffffff', kind: 'super', big: true, sfx: 'hitH', name: 'Final Punch' }, o.center().x, o.center().y, act);
        }
      } },
  },
});

/* ------------------------------------------------------------- stages */
const STAGES = {
  dojo:   { name: 'SUNSET DOJO', sky: ['#ff9a5a', '#ffcf7a', '#ffe6b0'], ground: '#7a4a2e', line: '#5e3820', far: '#c7724a', near: '#8d4a35', sun: '#fff1c4' },
  city:   { name: 'NEON ROOFTOP', sky: ['#0b0f2a', '#251a4d', '#4a2a6a'], ground: '#23263a', line: '#3a3f5a', far: '#1a1f3d', near: '#13162b', neon: ['#ff4fa3', '#4fd8ff', '#ffd34d'] },
  temple: { name: 'SAKURA SHRINE', sky: ['#ffb0c8', '#ffd6e0', '#fff0f0'], ground: '#9c7a5c', line: '#7d5f45', far: '#e59ab4', near: '#b5627a', petals: true },
  void:   { name: 'VOID RIFT', sky: ['#05030d', '#1a0f3a', '#3b1f6e'], ground: '#1c1530', line: '#3a2a66', far: '#26184d', near: '#160f2e', stars: true },
  crater: { name: 'CRATER PLAINS', sky: ['#3a0d14', '#8a2a1f', '#e8763a'], ground: '#4a3328', line: '#33231b', far: '#6e2b22', near: '#3b1d18', rocks: true },
  lab:    { name: 'TRAINING ROOM', sky: ['#11141d', '#161b27', '#1d2333'], ground: '#1a1e2a', line: '#2a3146', far: '#141824', near: '#10131c', grid: true },
};
