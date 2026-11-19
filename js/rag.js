'use strict';
/* =========================================================================
   Rag: an active ragdoll fighter, adapted from Element Rag's Fighter.
   Eleven verlet points joined by bones are pulled toward an animated pose
   by "muscles". A kinematic root (the feet) drives walking and jumping.
   Hits shove the points; hitstun weakens the muscles so the body sways;
   knockdowns drop them to zero and the body flies limp, lands, and the
   fighter picks itself back up.
   The arena is a flat floor with a wall at each side.
   ========================================================================= */

const STEP = 1 / 120;
const GROUND = 800;
const WALL_L = -360;           // a wide stage the camera pans across
const WALL_R = 1960;
const MAX_SEP = 1180;          // fighters can't walk further apart than one screen
const RS = 2.0;               // fighter scale
const HP_SCALE = 2.4;         // every fighter's health; fights last a few combos, not one

const P = { HEAD: 0, NECK: 1, PELVIS: 2, FELB: 3, FHAND: 4, BELB: 5, BHAND: 6, FKNEE: 7, FFOOT: 8, BKNEE: 9, BFOOT: 10 };
// bones: [a, b, hurt radius]
const SEGS = [
  [1, 0, 0], [1, 2, 10],
  [1, 3, 6], [3, 4, 6], [1, 5, 6], [5, 6, 6],
  [2, 7, 7], [7, 8, 6], [2, 9, 7], [9, 10, 6],
];
const BONE_LEN = [17, 45, 24, 24, 24, 24, 29, 28, 29, 28];
const MUSCLE = [0.16, 0.24, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3];
const MUSCLE_DAMP = 0.22;
const INV_MASS = [0.8, 0.35, 0.3, 0.88, 0.92, 0.88, 0.92, 0.75, 1, 0.75, 1];
const JOINT_LIMITS = [
  [2, 8, 30, 58], [2, 10, 30, 58],
  [1, 4, 16, 49], [1, 6, 16, 49],
  [0, 2, 56, 64],
  [0, 3, 22, 60], [0, 5, 22, 60],
];
const HEAD_R = 13;
// hip-knee-foot and shoulder-elbow-hand chains that bend only one way
const HINGES = [[2, 7, 8], [2, 9, 10], [1, 3, 4], [1, 5, 6]];
const GRAV = 2700;
let WORLD_G = 1;              // gravity multiplier (Low Gravity levels)

/* ------------------------------------------------------------------ poses
   Facing-space, unscaled: +x is toward the way the fighter faces, -y is up.
   Hands (fh / bh) are relative to the neck, feet (ff / bf) to the root. */
const GUARD = { fh: [24, 10], bh: [13, 16], ff: [20, 0], bf: [-18, 0], lean: 3, crouch: 7 };
const POSES = {
  jab:     { wind: { fh: [10, 10] }, strike: { fh: [47, 3], lean: 6 } },
  cross:   { wind: { bh: [4, 12], lean: -2 }, strike: { bh: [46, 2], fh: [8, 18], lean: 11, ff: [26, 0] } },
  punchH:  { wind: { fh: [-10, 8], lean: -6, crouch: 12 }, strike: { fh: [50, 0], bh: [-6, 18], lean: 15, ff: [36, 0], bf: [-30, 0] } },
  upper:   { wind: { fh: [14, 32], crouch: 24, lean: 4 }, strike: { fh: [20, -50], bh: [-4, 16], lean: 2, crouch: -6 } },
  kickM:   { wind: { ff: [6, -36], lean: -6 }, strike: { ff: [64, -72], lean: -15, bf: [-12, 0] } },
  kickH:   { wind: { ff: [0, -42], lean: -8 }, strike: { ff: [60, -110], lean: -24, bf: [-10, 0] } },
  sweep:   { wind: { crouch: 30, ff: [10, 0] }, strike: { crouch: 38, ff: [76, -6], bf: [-22, 0], lean: 18, fh: [26, 42], bh: [-12, 44] } },
  airP:    { wind: { fh: [6, 4] }, strike: { fh: [40, 26], lean: 6 } },
  airK:    { wind: { ff: [6, -40] }, strike: { ff: [52, 6], bf: [-16, -34], lean: -8 } },
  cast:    { wind: { fh: [-8, 6], bh: [-12, 12], lean: -3 }, strike: { fh: [48, 4], bh: [44, 10], lean: 9, ff: [28, 0], bf: [-26, 0] } },
  palm:    { wind: { fh: [-12, 14], lean: -4, crouch: 10 }, strike: { fh: [50, 8], bh: [-26, 22], lean: 18, crouch: 10, ff: [34, 0], bf: [-34, 0] } },
  cupBack: { wind: { fh: [-26, 46], bh: [-22, 50], crouch: 16, lean: -7, ff: [32, 0], bf: [-36, 0] }, strike: { fh: [-26, 46], bh: [-22, 50], crouch: 18, lean: -8, ff: [32, 0], bf: [-36, 0] } },
  beam:    { wind: { fh: [-26, 46], bh: [-22, 50], crouch: 16, lean: -7, ff: [32, 0], bf: [-36, 0] }, strike: { fh: [48, 6], bh: [46, 12], lean: 12, ff: [32, 0], bf: [-38, 0], crouch: 12 } },
  raise:   { wind: { fh: [8, -30], bh: [-6, -28], crouch: 10 }, strike: { fh: [8, -48], bh: [-6, -46], lean: -4 } },
  slam:    { wind: { fh: [8, -48], bh: [-6, -46], lean: -6 }, strike: { fh: [44, 40], bh: [36, 42], lean: 20, crouch: 24 } },
  dash:    { wind: { fh: [-24, 22], bh: [-30, 18], lean: 14, crouch: 10 }, strike: { fh: [-26, 22], bh: [-32, 18], lean: 20, crouch: 12 } },
  grab:    { wind: { fh: [30, 10], bh: [24, 14] }, strike: { fh: [42, 6], bh: [38, 12], lean: 8 } },
  lift:    { wind: { fh: [40, 6], bh: [36, 12] }, strike: { fh: [-10, -46], bh: [-16, -44], lean: -14 } },
  point:   { wind: { fh: [10, 10] }, strike: { fh: [44, -8], bh: [-14, 24], lean: 4 } },
  block:   { fh: [22, -6], bh: [18, 8], lean: -7, crouch: 12 },
  hurt:    { fh: [4, 30], bh: [-18, 26], lean: -14, crouch: 4 },
  win:     { fh: [10, -52], bh: [-14, 20], lean: -2, crouch: 0, ff: [16, 0], bf: [-16, 0] },
  winArms: { fh: [20, -46], bh: [-20, -46], lean: -4, crouch: 0, ff: [18, 0], bf: [-18, 0] },
  winCross:{ fh: [16, 22], bh: [-6, 22], lean: -2, crouch: 0, ff: [14, 0], bf: [-14, 0] },
};

/* --------------------------------------------------------------- stances
   Every fighter stands, breathes and walks in their own style. A stance is
   the guard pose plus how it idles: breath rate, a bounce (boxers hop on the
   balls of their feet), a slow weight shift, hand drift, and the walk's
   stride and lean. Attacks start from and settle back into the stance. */
const ST = (pose, o) => Object.assign({
  pose: Object.assign({ fh: [24, 10], bh: [13, 16], ff: [20, 0], bf: [-18, 0], lean: 3, crouch: 7 }, pose),
  breathe: 1.7, bounce: 0, bounceF: 0, hop: false, sway: 0.7, swayA: 1.2, hand: 1.3, handA: 1.6,
  stride: 26, step: 9, walkLean: 5, backLean: -4,
}, o || {});
const STANCES = {
  karate:  ST({ fh: [32, 6], bh: [4, 26], ff: [30, 0], bf: [-37, 0], lean: 5, crouch: 14 }, { bounce: 1.4, bounceF: 2.1 }),
  ninja:   ST({ fh: [30, 20], bh: [-16, 30], ff: [34, 0], bf: [-42, 0], lean: 13, crouch: 24 }, { bounce: 1.2, bounceF: 2.6, stride: 30, walkLean: 9 }),
  mystic:  ST({ fh: [28, -2], bh: [-20, 2], ff: [13, 0], bf: [-19, 0], lean: -2, crouch: 2 }, { breathe: 1.2, hand: 1.6, handA: 4.5, sway: 0.5, swayA: 1.6, stride: 20, walkLean: 2 }),
  sword:   ST({ fh: [26, 16], bh: [18, 22], ff: [32, 0], bf: [-38, 0], lean: 7, crouch: 16 }, { bounce: 1, bounceF: 1.8, handA: 0.8 }),
  reaper:  ST({ fh: [30, 40], bh: [-6, 34], ff: [28, 0], bf: [-32, 0], lean: 15, crouch: 12 }, { breathe: 1.3, sway: 0.5, swayA: 2.2, handA: 1 }),
  loose:   ST({ fh: [16, 40], bh: [-10, 42], ff: [16, 0], bf: [-22, 0], lean: 2, crouch: 5 }, { bentBack: true, bounce: 3.6, bounceF: 5.4, hop: true, hand: 2.7, handA: 4, sway: 1.4, swayA: 2.5 }),
  boxer:   ST({ fh: [22, -10], bh: [12, -4], ff: [20, 0], bf: [-30, 0], lean: 7, crouch: 10 }, { bounce: 3.2, bounceF: 6.2, hop: true, hand: 3.1, handA: 1.6, stride: 24 }),
  monk:    ST({ fh: [24, 2], bh: [6, 16], ff: [17, 0], bf: [-24, 0], lean: 0, crouch: 5 }, { breathe: 1.1, sway: 0.4, swayA: 0.8, handA: 0.9, stride: 22 }),
  casual:  ST({ fh: [6, 44], bh: [-9, 44], ff: [12, 0], bf: [-14, 0], lean: -1, crouch: 0 }, { breathe: 0.9, sway: 0.35, swayA: 1, handA: 0.6, stride: 22, walkLean: 1, backLean: -1 }),
  feral:   ST({ fh: [36, 30], bh: [-26, 30], ff: [30, 0], bf: [-38, 0], lean: 19, crouch: 22 }, { bounce: 2, bounceF: 3.4, hand: 4.6, handA: 3, sway: 2.3, swayA: 2, stride: 30, walkLean: 10 }),
  regal:   ST({ fh: [10, 42], bh: [-12, 40], ff: [13, 0], bf: [-13, 0], lean: -3, crouch: 0 }, { breathe: 0.9, sway: 0.3, swayA: 0.6, handA: 0.5, stride: 22, walkLean: 0, backLean: -2 }),
  giant:   ST({ fh: [30, 22], bh: [-4, 28], ff: [32, 0], bf: [-36, 0], lean: 9, crouch: 15 }, { breathe: 1, bounce: 1.8, bounceF: 1.2, sway: 0.6, swayA: 2, handA: 1.2, stride: 30, step: 7 }),
  kungfu:  ST({ fh: [40, -2], bh: [-2, -16], ff: [26, -3], bf: [-24, 0], lean: 2, crouch: 19 }, { bounce: 1, bounceF: 2, hand: 1.9, handA: 2.6, bentBack: true }),
  soldier: ST({ fh: [26, 8], bh: [14, 14], ff: [22, 0], bf: [-32, 0], lean: 8, crouch: 11 }, { bounce: 2, bounceF: 4.4, hop: true, handA: 1.2 }),
  dual:    ST({ fh: [32, 12], bh: [-28, 10], ff: [32, 0], bf: [-40, 0], lean: 6, crouch: 18 }, { bounce: 1.2, bounceF: 2, handA: 1.2 }),
  calm:    ST({ fh: [14, 32], bh: [-10, 34], ff: [14, 0], bf: [-15, 0], lean: 0, crouch: 1 }, { breathe: 1.1, sway: 0.3, swayA: 0.6, handA: 0.8, stride: 20, walkLean: 1 }),
};
// reactions: snapped back by a head hit, doubled over by a body hit, buckled by a low one
const HURT = {
  high: { fh: [-4, 4], bh: [-26, 10], lean: -17, crouch: 5 },
  mid:  { fh: [12, 40], bh: [2, 42], lean: 17, crouch: 19 },
  low:  { fh: [20, 28], bh: [-22, 18], lean: 7, crouch: 27 },
};
const KNEEL = { ff: [28, 0], bf: [-26, -1], fh: [40, 62], bh: [-6, 44], lean: 22, crouch: 42 };

/* ------------------------------------------------------------ celebrations
   The winner doesn't just strike a pose: each style has its own short routine
   (with real jumps, spins and hovers), confetti and a little camera drama. */
const CELE_BY_STANCE = {
  karate: 'pump', boxer: 'pump', soldier: 'pump', loose: 'pump',
  ninja: 'flip', kungfu: 'flip', sword: 'flip', dual: 'flip',
  mystic: 'aura', calm: 'aura', regal: 'aura', monk: 'aura', reaper: 'aura',
  giant: 'roar', feral: 'roar', casual: 'wave',
};
const CROSSED = { fh: [16, 22], bh: [-6, 22], lean: -2, crouch: 0, ff: [14, 0], bf: [-14, 0] };

function mergePose(base, over) {
  const o = Object.assign({}, base);
  if (over) for (const k in over) o[k] = over[k];
  return o;
}
function lerpPose(a, b, k) {
  const o = {};
  for (const key of ['fh', 'bh', 'ff', 'bf']) o[key] = [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)];
  o.lean = lerp(a.lean, b.lean, k); o.crouch = lerp(a.crouch, b.crouch, k);
  o.spin = lerp(a.spin || 0, b.spin || 0, k); o.lift = lerp(a.lift || 0, b.lift || 0, k);
  return o;
}

class Rag {
  constructor(def, o) {
    this.def = def;
    this.side = o.side || 0;
    this.s = RS * (def.scale || 1);
    this.baseS = this.s;
    this.facing = o.facing || 1;
    this.maxHp = this.hp = Math.round(def.hp * (def.hp > 50 ? HP_SCALE : 1) * (o.hpMul || 1));
    this.walk = def.walk;
    this.jumpV = 1000;
    this.maxJumps = def.jumps || 1;
    this.root = { x: o.x, y: GROUND, vx: 0, vy: 0, grounded: true, jumps: 0, hover: false };
    this.mode = 'active';      // active | hit | block | tumble | rising | dead
    this.m = 1;
    this.stunT = 0;
    this.t = Math.random() * 10;
    this.walkPh = 0;
    this.st = STANCES[def.look.stance] || STANCES.karate;
    this.hurtKind = 'mid';
    this.riseT = 0;
    this.input = { x: 0 };
    this.action = null;
    this.cds = { sp1: 0, sp2: 0 };
    this.meter = 0;
    this.guard = 100;           // guard gauge; empties from blocking
    this.guardT = 0;            // time since last block (regen delay)
    this.invuln = 0;
    this.flash = 0;
    this.juggle = 0;
    this.knockT = 0;
    this.deadT = 0;
    this.dashT = 0; this.dashV = 0;
    this.stopT = 0;             // frozen in time (Time Halt / Domain)
    this.stored = null;         // knockback stored while time is stopped
    this.surge = 0;             // power-up glow (super aura)
    this.hidden = false;
    this.alpha = 1;
    this.shake = 0;
    this.pose = null;           // forced pose (intro / victory)
    this.blocking = false;
    this.landT = 0;
    this.pts = []; this.T = []; this.Tp = [];
    for (let i = 0; i < 11; i++) { this.pts.push({ x: o.x, y: GROUND, px: o.x, py: GROUND }); this.T.push({ x: o.x, y: GROUND }); this.Tp.push({ x: o.x, y: GROUND }); }
    this.computeTargets();
    this.snapToPose();
    this.initCloth();
    this.settleCloth();
  }

  /* ------------------------------------------------------------- cloth
     Scarves, capes, hair and coat tails are short verlet chains hung off
     the body. They lag, swing and settle on their own, which sells the
     weight of every move without any extra animation. */
  initCloth() {
    const L = this.def.look, x = this.root.x;
    this.chains = [];
    const add = (kind, n, len, w0, w1, color, o) => this.chains.push(Object.assign({ kind, n, len, w0, w1, color, drag: 0.93, grav: 1400, pts: Array.from({ length: n }, () => ({ x, y: GROUND - 200, px: x, py: GROUND - 200 })) }, o || {}));
    if (L.cape) add('cape', 7, 9, 6, 3.6, 'acc', { push: 0.05 });
    if (L.hair === 'ponytail') add('hair', 5, 7, 5.5, 2.4, L.hairC || '#2a2630', { drag: 0.9, push: 0.03, grav: 1700 });
    if (L.hair === 'long') add('hair', 4, 7.5, 10, 7, L.hairC || '#3a2c24', { drag: 0.88, push: 0.02, grav: 2000, long: true });
    if (L.coat) add('coat', 4, 9, 11, 13, L.coat, { drag: 0.88, grav: 1700, push: 0.03 });
    if (L.belt && L.beltTails !== false) add('belt', 3, 5, 2.4, 1.8, L.belt, { drag: 0.9, push: 0.02 });
    this.cape = (this.chains.find(c => c.kind === 'cape') || {}).pts || null;
  }
  clothAnchor(c) {
    const s = this.s, f = this.facing, n = this.pts[P.NECK], pv = this.pts[P.PELVIS], h = this.pts[P.HEAD], hr = HEAD_R * s;
    if (c.kind === 'cape') return [n.x - f * 3 * s, n.y + 3 * s];
    if (c.kind === 'hair') return c.long ? [h.x - f * hr * 0.78, h.y + hr * 0.45] : [h.x - f * hr * 0.8, h.y - hr * 0.5];
    if (c.kind === 'coat') return [lerp(n.x, pv.x, 0.86) - f * 6 * s, lerp(n.y, pv.y, 0.86)];
    return [lerp(n.x, pv.x, 0.86) + f * 5 * s, lerp(n.y, pv.y, 0.86) + 2 * s];
  }
  // hang every chain straight down from its anchor (spawns, teleports, portraits)
  settleCloth() {
    for (const c of this.chains) {
      const [ax, ay] = this.clothAnchor(c);
      c.pts.forEach((p, i) => { p.x = p.px = ax - this.facing * i * c.len * this.s * 0.35; p.y = p.py = ay + i * c.len * this.s * 0.9; });
    }
  }
  shiftCloth(dx, dy) { for (const c of this.chains) for (const p of c.pts) { p.x += dx; p.y += dy; p.px += dx; p.py += dy; } }

  snapToPose() {
    for (let i = 0; i < 11; i++) { const p = this.pts[i]; p.x = p.px = this.T[i].x; p.y = p.py = this.T[i].y; this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
    if (this.chains) this.settleCloth();
  }

  get alive() { return this.mode !== 'dead'; }
  get grounded() { return this.root.grounded; }
  get canAct() { return this.mode === 'active' && this.stopT <= 0; }
  get idle() { return this.canAct && !this.action && this.dashT <= 0; }
  get airborneHit() { return this.mode === 'tumble' && this.pelvis.y < GROUND - 70 * this.s; }
  get pelvis() { return this.pts[P.PELVIS]; }
  center() { const a = this.pts[P.NECK], b = this.pts[P.PELVIS]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  chest() { const a = this.pts[P.NECK], b = this.pts[P.PELVIS]; return { x: lerp(a.x, b.x, 0.3), y: lerp(a.y, b.y, 0.3) }; }
  head() { return this.pts[P.HEAD]; }
  // a point in facing space relative to the root (unscaled units)
  local(x, y) { return { x: this.root.x + this.facing * x * this.s, y: this.root.y + y * this.s }; }

  /* ------------------------------------------------------------ control */
  jump() {
    const r = this.root;
    if (!this.canAct || this.action) return false;
    if (r.grounded) r.jumps = 1;
    else if (r.jumps < this.maxJumps) r.jumps++;
    else return false;
    r.vy = -this.jumpV * this.s * (r.grounded ? 1 : 0.85);
    r.vx = this.input.x * this.walk * this.s * 1.15;
    r.grounded = false;
    return true;
  }
  dash(dir) {
    if (!this.canAct || this.action || !this.root.grounded || this.dashT > 0) return false;
    const fwd = dir === this.facing;
    this.dashT = fwd ? 0.2 : 0.17;
    this.dashV = dir * (fwd ? 1050 : 820) * this.s / 2;
    if (!fwd) this.invuln = Math.max(this.invuln, 0.12);
    return true;
  }

  /* -------------------------------------------------------------- hits */
  impulse(idx, vx, vy, spread = 0.45) {
    const dt = STEP;
    for (let i = 0; i < 11; i++) {
      const k = i === idx ? 1 : spread;
      this.pts[i].px -= vx * k * dt;
      this.pts[i].py -= vy * k * dt;
    }
  }

  celebrate() {
    this.pose = null;
    this.cele = { t: 0, kind: CELE_BY_STANCE[this.def.look.stance] || 'pump' };
  }
  // confetti in the fighter's colour, white and gold
  confetti(x, y, n, up = 900) {
    if (typeof Game === 'undefined') return;
    const cols = [this.def.color, '#ffffff', '#ffd34d', this.def.aura || '#ffffff'];
    for (let i = 0; i < n; i++) Game.fx.add({ kind: 'chunk', x: x + rand(-20, 20), y, vx: rand(-520, 520), vy: rand(-up, -up * 0.45), g: 1100, color: cols[i % cols.length], size: rand(4, 8), life: rand(1.2, 2), vr: rand(-12, 12), add: false });
  }
  celeTick(dt) {
    const c = this.cele, r = this.root, s = this.s, t = c.t, G = typeof Game !== 'undefined' ? Game : null;
    c.t += dt;
    const once = k => (c[k] ? false : (c[k] = true));
    if (!G) return;
    const hd = this.pts[P.HEAD];
    if (c.kind === 'pump' || c.kind === 'flip') {
      const jumpAt = c.kind === 'pump' ? 0.28 : 0.22;
      if (t >= jumpAt && once('jump')) { r.vy = -(c.kind === 'pump' ? 950 : 1100) * s / 2 * 1.1; r.grounded = false; G.fx.dust(r.x, GROUND, 8); Sfx.play('whoosh'); }
      if (t >= jumpAt + 0.32 && once('pop')) { this.confetti(hd.x, hd.y - 20, 36); G.fx.ring(hd.x, hd.y, this.def.color, 140, 0.5, 8); Sfx.play('pop'); }
      if (c.jump && r.grounded && t > jumpAt + 0.2 && once('land')) { G.fx.ring(r.x, GROUND, '#ffffff', 120, 0.35, 6); G.fx.dust(r.x, GROUND, 14); G.shake(5); }
    } else if (c.kind === 'aura') {
      // rise, flare, drift back down
      const lift = t < 0.8 ? easeInOut(t / 0.8) : t < 1.8 ? 1 : 1 - easeInOut(Math.min(1, (t - 1.8) / 0.6));
      r.hover = t < 2.4; r.vy = 0;
      if (t < 2.4) { r.y = GROUND - lift * 70 * s; r.grounded = false; }
      if (t >= 0.8 && once('flare')) { this.surge = Math.max(this.surge, 1.6); this.auraT = 1.6; const c0 = this.center(); G.fx.ring(c0.x, c0.y, this.def.aura || this.def.color, 220, 0.6, 10); G.fx.burst(c0.x, c0.y, this.def.color, 30, 520); this.confetti(c0.x, c0.y - 40, 24, 700); Sfx.play('charge'); }
      if (t >= 2.4 && once('down')) { r.hover = false; }
    } else if (c.kind === 'roar') {
      if (t >= 0.45 && once('roar')) { G.shake(14); G.fx.ring(r.x, GROUND - 10, '#ffffff', 260, 0.6, 12); G.fx.dust(r.x, GROUND, 18); G.fx.chunks(r.x, GROUND - 4, '#b9a58f', 12, 600, 7); Sfx.play('drum'); this.surge = Math.max(this.surge, 1.2); }
      if (t >= 1.5 && t < 2.3 && Math.floor(t * 6) !== c.beat) { c.beat = Math.floor(t * 6); const ch = this.chest(); G.fx.ring(ch.x, ch.y, this.def.color, 50, 0.2, 4); }
      if (t >= 0.5 && once('conf')) this.confetti(r.x, GROUND - 260 * s / 2, 28);
    } else {
      if (t >= 0.9 && once('conf')) this.confetti(hd.x, hd.y - 30, 28);
    }
  }
  celePose(G0) {
    const c = this.cele, t = c.t, r = this.root;
    const P = o => mergePose(G0, o);
    const bl = (a, b, k) => lerpPose(P(a), P(b), easeInOut(clamp(k, 0, 1)));
    const settle = (from, t0) => bl(from, CROSSED, (t - t0) / 0.4);
    if (c.kind === 'pump') {
      if (t < 0.28) return bl({}, { crouch: 28, fh: [10, 30], bh: [-8, 32], lean: 10 }, t / 0.2);
      if (!r.grounded) return P({ fh: [16, -54], bh: [-20, 6], ff: [18, -30], bf: [-16, -12], lean: -6, crouch: -2 });
      if (t < 2.0) { const up = Math.sin((t - 0.9) * 11) > 0; return P({ fh: [14, up ? -52 : -16], bh: [-10, 24], lean: up ? -4 : 2, crouch: up ? 2 : 10, ff: [18, 0], bf: [-20, 0] }); }
      return settle({ fh: [14, -16], bh: [-10, 24] }, 2.0);
    }
    if (c.kind === 'flip') {
      if (t < 0.22) return bl({}, { crouch: 30, fh: [-10, 24], bh: [-20, 26], lean: 8 }, t / 0.18);
      if (!r.grounded) { const k = clamp((t - 0.24) / 0.6, 0, 1); return Object.assign(P({ fh: [20, 10], bh: [-10, 14], ff: [16, -40], bf: [-6, -34], crouch: 4 }), { spin: -TAU * easeInOut(k) }); }
      if (t < 1.7) return P({ crouch: 32, fh: [46, 6], bh: [-34, -12], lean: 16, ff: [36, 0], bf: [-46, 0] });
      if (t < 2.3) return bl({ crouch: 32, fh: [46, 6], bh: [-34, -12], lean: 16 }, { fh: [-12, 30], bh: [-18, 32], lean: -2, crouch: 0 }, (t - 1.7) / 0.35);
      return P({ fh: [-12, 30], bh: [-18, 32], lean: -2, crouch: 0, ff: [14, 0], bf: [-14, 0] });
    }
    if (c.kind === 'aura') {
      const open = { fh: [30, -34], bh: [-30, -34], lean: -8, crouch: 0, ff: [10, -6], bf: [-12, -2] };
      if (t < 0.8) return bl({ fh: [20, 20], bh: [-10, 22] }, open, t / 0.8);
      if (t < 2.0) return P(Object.assign({}, open, { fh: [32, -38 + Math.sin(t * 5) * 4], bh: [-32, -38 + Math.sin(t * 5 + 1) * 4] }));
      return bl(open, { fh: [12, 40], bh: [-12, 40], lean: -3, crouch: 0, ff: [13, 0], bf: [-13, 0] }, (t - 2.0) / 0.5);
    }
    if (c.kind === 'roar') {
      if (t < 0.4) return bl({}, { crouch: 24, fh: [26, 30], bh: [-22, 30], lean: 14, ff: [34, 0], bf: [-40, 0] }, t / 0.3);
      if (t < 1.5) return P({ crouch: 14, fh: [26, -42], bh: [-26, -42], lean: -10 + Math.sin(t * 30) * 2, ff: [34, 0], bf: [-40, 0] });
      if (t < 2.3) { const a = Math.floor(t * 6) % 2; return P({ crouch: 8, fh: a ? [10, 8] : [24, 4], bh: a ? [6, 4] : [-8, 10], lean: -6, ff: [30, 0], bf: [-34, 0] }); }
      return P({ crouch: 8, fh: [26, -42], bh: [-26, -42], lean: -8, ff: [30, 0], bf: [-34, 0] });
    }
    // wave: a big stretch, then a wave, then a thumbs-up
    if (t < 0.8) return bl({}, { fh: [6, -58], bh: [-6, -58], lean: -8, crouch: -2 }, t / 0.6);
    if (t < 2.0) return P({ fh: [22 + Math.sin(t * 12) * 9, -50], bh: [-8, 40], lean: 2, crouch: 0 });
    return bl({ fh: [22, -50], bh: [-8, 40] }, { fh: [34, -6], bh: [-8, 40], lean: 4 }, (t - 2.0) / 0.3);
  }

  /* Render interpolation. The simulation ticks at a fixed 120 Hz, but the
     screen refreshes at its own rate (60, 90, 120, 144 Hz) and slow motion
     stretches the gap between ticks. Before each tick the body's positions are
     remembered; when drawing, every point is blended between the last tick and
     this one by how far the clock has run into the next tick, so motion is
     smooth at any refresh rate and in slow-mo. Gameplay never sees the blend. */
  snap() {
    const S = this._s || (this._s = { p: [], c: [] });
    S.p.length = 0; for (const q of this.pts) S.p.push(q.x, q.y);
    S.c.length = 0; for (const ch of this.chains) for (const q of ch.pts) S.c.push(q.x, q.y);
  }
  lerpIn(a) {
    const S = this._s;
    if (!S || S.p.length !== this.pts.length * 2) return;
    const C = this._cur || (this._cur = { p: [], c: [] });
    C.p.length = 0; C.c.length = 0;
    this.pts.forEach((q, i) => { C.p.push(q.x, q.y); q.x = S.p[i * 2] + (q.x - S.p[i * 2]) * a; q.y = S.p[i * 2 + 1] + (q.y - S.p[i * 2 + 1]) * a; });
    let k = 0;
    for (const ch of this.chains) for (const q of ch.pts) {
      C.c.push(q.x, q.y);
      if (k * 2 + 1 < S.c.length) { q.x = S.c[k * 2] + (q.x - S.c[k * 2]) * a; q.y = S.c[k * 2 + 1] + (q.y - S.c[k * 2 + 1]) * a; }
      k++;
    }
    this._lerped = true;
  }
  lerpOut() {
    if (!this._lerped) return;
    const C = this._cur;
    this.pts.forEach((q, i) => { q.x = C.p[i * 2]; q.y = C.p[i * 2 + 1]; });
    let k = 0;
    for (const ch of this.chains) for (const q of ch.pts) { q.x = C.c[k * 2]; q.y = C.c[k * 2 + 1]; k++; }
    this._lerped = false;
  }

  // the body point nearest a world position (where a hit lands)
  nearestIdx(x, y) {
    let bi = P.NECK, bd = Infinity;
    for (let i = 0; i < 11; i++) { const p = this.pts[i], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  }

  // end the current move from outside the move itself (hit, launched, KO,
  // grabbed, frozen). Runs the move's own cleanup so nothing a move changed
  // (size, hover, hidden, transparency) can outlive it.
  clearAction() {
    const a = this.action;
    if (!a) return;
    this.action = null;
    if (a.move && a.move.end && typeof Game !== 'undefined') a.move.end(Game, this, a);
    this.root.hover = false;
    this.hideArm = false;
    this.alpha = 1;
  }

  // knockback while staying on the feet (hitstun) or blocking
  stagger(kx, ky, idx, stun, blocking) {
    const r = this.root;
    this.clearAction();
    this.dashT = 0;
    r.vx = kx; r.hover = false;
    if (!r.grounded) r.vy = Math.min(r.vy, ky);
    this.impulse(idx != null ? idx : P.NECK, kx * (blocking ? 0.3 : 0.9), (ky - 120) * (blocking ? 0.2 : 0.6), 0.35);
    this.mode = blocking ? 'block' : 'hit';
    if (!blocking) this.hurtKind = idx === P.HEAD || idx === P.NECK || idx === P.FELB || idx === P.BELB || idx === P.FHAND || idx === P.BHAND ? 'high' : idx === P.FKNEE || idx === P.BKNEE || idx === P.FFOOT || idx === P.BFOOT ? 'low' : 'mid';
    this.stunT = stun;
    this.knockT = 0.2;
  }

  tumble(dur, kx = 0, ky = 0, idx) {
    if (this.mode === 'dead') return;
    const r = this.root;
    if (this.mode !== 'tumble') {
      // hand the root's momentum over to the body
      const dt = STEP;
      for (const p of this.pts) { p.px -= r.vx * dt * 0.5; p.py -= r.vy * dt * 0.5; }
    }
    this.impulse(idx != null ? idx : P.PELVIS, kx, ky, 0.75);
    // heavy hits set the body spinning: head and feet pushed opposite ways
    const kick = Math.hypot(kx, ky);
    if (kick > 300) {
      const dir = Math.sign(kx || 1) * Math.min(1, kick / 1600) * 300 * STEP;
      this.pts[P.HEAD].px -= dir; this.pts[P.NECK].px -= dir * 0.5;
      for (const i of [P.FFOOT, P.BFOOT]) this.pts[i].px += dir;
    }
    this.mode = 'tumble';
    this.m = 0;            // limp at once: lingering muscle pull toward the standing pose would eat the launch
    this.stunT = Math.max(this.stunT, dur);
    this.clearAction();
    this.dashT = 0;
    r.hover = false;
  }

  die() {
    if (this.mode === 'dead') return;
    if (this.mode !== 'tumble') this.tumble(1);
    this.mode = 'dead';
    this.m = 0;
    this.deadT = 0;
    this.hp = 0;
    this.clearAction();
  }

  /* ------------------------------------------------------------ update */
  update(dt) {
    if (this.stopT > 0) {
      // stopped in time: hold everything exactly where it is
      this.stopT = Math.max(0, this.stopT - dt);
      this.flash = Math.max(0, this.flash - dt * 4);
      for (const p of this.pts) { p.px = p.x; p.py = p.y; }
      if (this.stopT <= 0 && this.stored) this.releaseStored();
      return;
    }
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.knockT = Math.max(0, this.knockT - dt);
    this.surge = Math.max(0, this.surge - dt);
    this.landT = Math.max(0, this.landT - dt * 3);
    for (const k in this.cds) this.cds[k] = Math.max(0, this.cds[k] - dt);
    this.guardT += dt;
    if (this.guardT > 1.2) this.guard = Math.min(100, this.guard + dt * 22);

    if (this.mode === 'dead') this.deadT += dt;
    if (this.mode === 'hit' || this.mode === 'block') {
      this.stunT -= dt;
      if (this.stunT <= 0 && this.root.grounded) this.mode = 'active';
    }
    if (this.cele && this.mode === 'active') this.celeTick(dt);
    if (this.mode === 'active' || this.mode === 'rising' || this.mode === 'hit' || this.mode === 'block') {
      if (this.mode === 'rising') {
        this.riseT += dt;
        this.m = Math.min(1, this.m + dt / 0.5);
        if (this.m >= 0.9) { this.mode = 'active'; this.juggle = 0; }
      } else if (this.mode === 'hit') {
        this.m = Math.max(0.42, this.m - dt * 6);
      } else {
        this.m = Math.min(1, this.m + dt * 4);
      }
      this.stepRoot(dt);
      this.computeTargets();
    } else {
      this.m = Math.max(0, this.m - dt * 8);
      if (this.mode === 'tumble') this.stunT -= dt;
    }
    this.stepBody(dt);
    if (this.mode === 'tumble') this.followBody(dt);
    this.stepCloth(dt);
  }

  releaseStored() {
    const st = this.stored; this.stored = null;
    if (!st || this.mode === 'dead' && st.dead === false) return;
    this.tumble(1.0, st.kx, st.ky, P.NECK);
  }

  stepRoot(dt) {
    const r = this.root;
    const control = this.mode === 'active';
    if (this.dashT > 0) {
      this.dashT -= dt;
      r.vx = this.dashV;
      if (this.dashT <= 0) r.vx *= 0.3;
    } else {
      const act = this.action;
      let want = 0;
      if (control && !act && r.grounded && !this.cele) want = this.input.x * this.walk * this.s * (this.input.x === -this.facing ? 0.82 : 1);
      if (act && act.vx != null) {
        r.vx = act.vx;
      } else {
        let acc = r.grounded ? 16 : 1.2;
        if (this.knockT > 0 || this.mode !== 'active') acc = r.grounded ? 7 : 0.4;
        if (!r.grounded && control && !act) want = r.vx;   // keep jump momentum
        r.vx += (want - r.vx) * Math.min(1, acc * dt);
      }
    }
    if (r.hover) { r.vy = this.action && this.action.vy != null ? this.action.vy : 0; }
    else if (this.action && this.action.vy != null) r.vy = this.action.vy;
    else r.vy += GRAV * WORLD_G * this.s * dt * (r.vy > 0 ? 1.15 : 1);
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    const wasGrounded = r.grounded;
    r.grounded = false;
    if (r.y >= GROUND) {
      if (!wasGrounded && r.vy > 700) this.landT = Math.min(1, r.vy / 2200);
      r.y = GROUND; r.vy = 0; r.grounded = true; r.jumps = 0;
      if (!wasGrounded) { r.hover = false; this.onLand && this.onLand(); }
    }
    if (r.y < 160) { r.y = 160; r.vy = Math.max(0, r.vy); }
    const m = 24 * this.s;
    if (r.x < WALL_L + m) { r.x = WALL_L + m; if (r.vx < 0) r.vx = 0; }
    if (r.x > WALL_R - m) { r.x = WALL_R - m; if (r.vx > 0) r.vx = 0; }
    // the gait phase advances with distance travelled, so planted feet never slide
    if (r.grounded && Math.abs(r.vx) > 30 && !this.action) this.walkPh += r.vx * this.facing * dt / (2 * this.st.stride * this.s);
  }

  basePose() {
    const r = this.root, st = this.st, G0 = st.pose;
    this.gaitOn = false;   // set again below only while walking (feet may lock then)
    if (this.cele && this.mode === 'active') return this.celePose(G0);
    if (this.pose) return mergePose(G0, POSES[this.pose] || this.pose);
    if (this.mode === 'rising') {
      // push up off one knee, then settle into the stance
      const k = easeInOut(clamp((this.riseT - 0.12) / 0.38, 0, 1));
      return lerpPose(mergePose(G0, KNEEL), G0, k);
    }
    if (this.mode === 'hit') {
      const k = clamp(this.stunT / 0.22, 0, 1);
      return lerpPose(G0, mergePose(G0, HURT[this.hurtKind] || HURT.mid), easeOut(k));
    }
    if (this.mode === 'block' || this.blocking) return mergePose(G0, POSES.block);
    if (!r.grounded) {
      // tuck toward the apex, reach the legs down to land, arms out for balance
      const k = clamp(r.vy / (950 * this.s), -1, 1), tuck = 1 - Math.abs(k);
      const up = Math.max(0, -k), down = Math.max(0, k);
      return mergePose(G0, {
        ff: [18 + tuck * 6, -8 - tuck * 30 + up * 4], bf: [-12 - down * 6, -4 - tuck * 22 - up * 6],
        fh: [26 - down * 4, 2 - tuck * 8 - up * 10], bh: [-14 - down * 8, 6 - up * 12],
        lean: 4 * tuck - down * 3, crouch: -4 + tuck * 6,
      });
    }
    if (this.dashT > 0) {
      const fwd = Math.sign(this.dashV) === this.facing;
      return mergePose(G0, { lean: fwd ? 18 : -10, crouch: 16, fh: [fwd ? 30 : 20, fwd ? 14 : -4], bh: [fwd ? -20 : 10, fwd ? 22 : 4], ff: [fwd ? 34 : 18, 0], bf: [fwd ? -36 : -26, -6] });
    }
    const t = this.t, br = Math.sin(t * st.breathe * TAU * 0.35);
    const moving = Math.abs(r.vx) > 40 * this.s;
    const p = {
      fh: [G0.fh[0] + Math.cos(t * st.hand) * st.handA, G0.fh[1] + Math.sin(t * st.hand * 1.3) * st.handA - br * 1.2],
      bh: [G0.bh[0] + Math.cos(t * st.hand + 2.1) * st.handA * 0.7, G0.bh[1] + Math.sin(t * st.hand * 1.3 + 1.7) * st.handA * 0.7 - br],
      ff: G0.ff.slice(), bf: G0.bf.slice(),
      lean: G0.lean + br * 0.9 + Math.sin(t * st.sway) * st.swayA,
      crouch: G0.crouch + (st.bounce ? (st.hop ? 1 - Math.abs(Math.sin(t * st.bounceF)) : 0.5 + 0.5 * Math.sin(t * st.bounceF)) * st.bounce : 0),
    };
    // the back leg stays nearly straight in a fighting stance (it's what the
    // weight pushes off), so place the back foot at full reach from the hip
    if (!st.bentBack) {
      const h = 52 - p.crouch, reach = 57 * 0.985;
      if (h < reach) p.bf[0] = Math.min(p.bf[0], -Math.sqrt(reach * reach - h * h) + p.lean * 0.35);
    }
    if (!moving && this.footLock) this.footLock.ff = this.footLock.bf = null;
    if (moving) {
      // a fighting-game shuffle: the feet keep their order, each one is planted
      // for half the cycle (sliding back exactly as fast as the body moves) and
      // swings forward for the other half
      const fwd = r.vx * this.facing > 0;
      const L = st.stride, H = st.step;
      const gait = u => {
        u = ((u % 1) + 1) % 1;
        if (u < 0.5) return [L / 2 - L * u * 2, 0];
        const k = (u - 0.5) * 2, e = k * k * (3 - 2 * k);
        return [-L / 2 + L * e, -Math.sin(k * Math.PI) * H];
      };
      const a = gait(this.walkPh), b = gait(this.walkPh + 0.5);
      p.ff = [G0.ff[0] * 0.75 + a[0], a[1]];
      p.bf = [G0.bf[0] * 0.75 + b[0], b[1]];
      // foot lock: a foot plants where it actually touched down and holds that
      // exact spot in the world until it lifts, so it never slides on the floor
      this.gaitOn = true;
      const lk = this.footLock || (this.footLock = {});
      for (const [key, idx, g] of [['ff', P.FFOOT, a], ['bf', P.BFOOT, b]]) {
        if (g[1] !== 0) { lk[key] = null; continue; }
        if (lk[key] == null) lk[key] = this.pts[idx].x;
        const rel = (lk[key] - r.x) * this.facing / this.s;
        if (Math.abs(rel - p[key][0]) < 10) p[key][0] = rel; else lk[key] = null;
      }
      p.crouch = G0.crouch + 2 + Math.cos(this.walkPh * TAU * 2) * 1.6;
      p.lean = G0.lean + (fwd ? st.walkLean : st.backLean);
      // walking back keeps the guard tight; walking in, the arms swing a touch
      if (fwd) { p.fh[0] -= a[0] * 0.18; p.bh[0] -= b[0] * 0.18; }
      else { p.fh = [G0.fh[0] - 4, G0.fh[1] - 6]; p.bh = [G0.bh[0] + 4, G0.bh[1] - 4]; }
    }
    return p;
  }

  actionPose(base) {
    const act = this.action;
    const mv = act.move;
    if (mv.poseFn) return mv.poseFn(this, act, base);
    const pz = POSES[mv.pose] || POSES.jab;
    const w = act.w, a = act.a, rc = act.r, t = act.t;
    const wind = mergePose(base, pz.wind), strike = mergePose(base, pz.strike);
    if (t < w) return lerpPose(base, wind, easeInOut(clamp(t / Math.max(w, 1e-3), 0, 1)));
    if (t < w + a || act.hold) return lerpPose(wind, strike, easeOut(clamp((t - w) / Math.max(0.035, Math.min(a, 0.08)), 0, 1)));
    return lerpPose(strike, base, easeInOut(clamp((t - w - a) / Math.max(rc, 1e-3), 0, 1)));
  }

  computeTargets() {
    const s = this.s, f = this.facing, r = this.root, T = this.T, Tp = this.Tp;
    for (let i = 0; i < 11; i++) { Tp[i].x = T[i].x; Tp[i].y = T[i].y; }
    let pose = this.basePose();
    if (this.action && this.mode === 'active') pose = this.actionPose(pose);
    const bob = 0;
    const crouch = (pose.crouch + this.landT * 16) * s;
    const lean = pose.lean * s * f;
    const gx = r.x, gy = r.y;
    const px = gx + lean * 0.35, py = gy - 52 * s + crouch + bob;
    const nx = px + lean, ny = py - 45 * s + bob * 0.3;
    T[P.PELVIS].x = px; T[P.PELVIS].y = py;
    T[P.NECK].x = nx; T[P.NECK].y = ny;
    T[P.HEAD].x = nx + f * 3 * s + lean * 0.25; T[P.HEAD].y = ny - 17 * s;
    // two-bone IK: elbows / knees bend toward a preferred side
    const ik = (ox, oy, ex, ey, l1, l2, endIdx, midIdx, bendX, bendY) => {
      let dx = ex - ox, dy = ey - oy;
      let d = Math.hypot(dx, dy) || 1e-3;
      const reach = (l1 + l2) * 0.995;
      if (d > reach) { dx *= reach / d; dy *= reach / d; d = reach; }
      T[endIdx].x = ox + dx; T[endIdx].y = oy + dy;
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      let nxp = -dy / d, nyp = dx / d;
      if (nxp * bendX + nyp * bendY < 0) { nxp = -nxp; nyp = -nyp; }
      T[midIdx].x = ox + dx / d * a + nxp * h; T[midIdx].y = oy + dy / d * a + nyp * h;
    };
    const arm = 24 * s, th = 29 * s, sh = 28 * s;
    ik(nx, ny, nx + f * pose.fh[0] * s, ny + pose.fh[1] * s, arm, arm, P.FHAND, P.FELB, -f * 0.3, 1);
    ik(nx, ny, nx + f * pose.bh[0] * s, ny + pose.bh[1] * s, arm, arm, P.BHAND, P.BELB, -f * 0.3, 1);
    ik(px, py, gx + f * pose.ff[0] * s, gy + pose.ff[1] * s, th, sh, P.FFOOT, P.FKNEE, f, -0.2);
    ik(px, py, gx + f * pose.bf[0] * s, gy + pose.bf[1] * s, th, sh, P.BFOOT, P.BKNEE, f, -0.2);
    // whole-body flips and spins: rotate the pose around the middle of the body
    const spin = (pose.spin || 0) * f, lift = (pose.lift || 0) * s;
    if (spin || lift) {
      const cx = (px + nx) / 2, cy = (py + ny) / 2 - lift;
      const cs = Math.cos(spin), sn = Math.sin(spin);
      for (let i = 0; i < 11; i++) {
        const dx = T[i].x - (px + nx) / 2, dy = T[i].y - (py + ny) / 2;
        T[i].x = cx + dx * cs - dy * sn; T[i].y = cy + dx * sn + dy * cs;
      }
    }
  }

  stepBody(dt) {
    const m = this.m, pts = this.pts, T = this.T, Tp = this.Tp, s = this.s;
    const g = GRAV * WORLD_G * s * dt * dt * (1 - 0.92 * m) * (this.mode === 'tumble' && this.juggle > 0 ? 0.72 : 1);
    const air = m < 0.5 ? 0.997 : 0.99;
    for (let i = 0; i < 11; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * air, vy = (p.y - p.py) * air;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g;
      if (m > 0.01) {
        let k = MUSCLE[i] * m;
        let damp = MUSCLE_DAMP;
        if (this.mode === 'active' && this.action) { k = Math.min(0.6, k * 1.9); damp += 0.12; }
        const tvx = T[i].x - Tp[i].x, tvy = T[i].y - Tp[i].y;
        p.x += (T[i].x - p.x) * k - (vx - tvx) * damp * m;
        p.y += (T[i].y - p.y) * k - (vy - tvy) * damp * m;
      }
    }
    const solve = (A, B, wa, wb, d0, d1, stiff) => {
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 1e-4;
      const target = d < d0 ? d0 : d > d1 ? d1 : d;
      if (target === d) return;
      const k = ((d - target) / d) * stiff / (wa + wb);
      A.x += dx * k * wa; A.y += dy * k * wa;
      B.x -= dx * k * wb; B.y -= dy * k * wb;
    };
    const limp = this.mode === 'tumble' || this.mode === 'dead';
    const lockOn = this.gaitOn && this.mode === 'active' && this.root.grounded && !this.action && this.dashT <= 0 && this.footLock;
    const pinFF = lockOn && this.footLock.ff != null, pinBF = lockOn && this.footLock.bf != null;
    for (let it = 0; it < 6; it++) {
      for (let b = 0; b < SEGS.length; b++) {
        const ia = SEGS[b][0], ib = SEGS[b][1], L = BONE_LEN[b] * s;
        solve(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], L, L, 1);
      }
      for (const [ia, ib, lo, hi] of JOINT_LIMITS) solve(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], lo * s, hi * s, 0.6);
      for (const p of pts) this.contain(p, limp);
      // a locked (planted) foot is pinned inside the solver, so the knee bends
      // around it rather than dragging it along the floor
      if (pinFF) { pts[P.FFOOT].x = pts[P.FFOOT].px = this.footLock.ff; pts[P.FFOOT].y = pts[P.FFOOT].py = GROUND; }
      if (pinBF) { pts[P.BFOOT].x = pts[P.BFOOT].px = this.footLock.bf; pts[P.BFOOT].y = pts[P.BFOOT].py = GROUND; }
    }
    // planted feet grip the floor: a foot whose target sits on the ground, while
    // the fighter is on their feet, loses most of its sideways slip each tick, so
    // the stance foot stays put instead of skating back and forth
    if (this.mode === 'active' && this.root.grounded) {
      for (const fi of [P.FFOOT, P.BFOOT]) {
        const p = pts[fi];
        if (T[fi].y >= GROUND - 1.5 * s && p.y >= GROUND - 2.5 * s && Math.abs(T[fi].x - Tp[fi].x) < 4 * s) p.px = lerp(p.px, p.x, 0.88);
      }
    }
    // hinge joints: knees and elbows only bend one way, even when limp. The
    // bend direction comes from the animated pose (a 2D cross product keeps its
    // sign under rotation), and a joint bent the wrong way is mirrored back
    // across its limb line, which keeps both bone lengths
    if (limp || this.mode === 'hit') {
      for (const [a, b, c] of HINGES) {
        const want = Math.sign((T[b].x - T[a].x) * (T[c].y - T[b].y) - (T[b].y - T[a].y) * (T[c].x - T[b].x));
        const A = pts[a], B = pts[b], C = pts[c];
        const cr = (B.x - A.x) * (C.y - B.y) - (B.y - A.y) * (C.x - B.x);
        if (want && cr * want < -40 * s * s) {
          const dx = C.x - A.x, dy = C.y - A.y, l2 = dx * dx + dy * dy || 1;
          const u = ((B.x - A.x) * dx + (B.y - A.y) * dy) / l2;
          const fx = A.x + dx * u, fy = A.y + dy * u;
          const nx = 2 * fx - B.x, ny = 2 * fy - B.y;
          B.px += (nx - B.x) * 0.5; B.py += (ny - B.y) * 0.5;
          B.x = lerp(B.x, nx, 0.5); B.y = lerp(B.y, ny, 0.5);
        }
      }
    }
    // safety: never let a broken step leave NaN or a body far outside the arena
    const pv = pts[P.PELVIS];
    if (!Number.isFinite(pv.x) || !Number.isFinite(pv.y)) { this.computeTargets(); this.snapToPose(); }
  }

  contain(p, limp) {
    const r = (p === this.pts[P.HEAD] ? HEAD_R : 6) * this.s;
    const floor = GROUND - (p === this.pts[P.HEAD] ? r * 0.8 : limp ? 5 * this.s : 0);
    if (p.y > floor) {
      p.y = floor;
      const vy = p.y - p.py;
      p.px = lerp(p.px, p.x, limp ? 0.18 : 0.5);    // friction
      p.py = p.y + (vy > 0 ? -vy * (limp ? 0.25 : 0) : vy * 0.15);
    }
    if (p.x < WALL_L + r * 0.5) { const vx = p.x - p.px; p.x = WALL_L + r * 0.5; p.px = p.x + (vx < 0 ? vx * 0.35 : 0); this.wallHit = Math.max(this.wallHit || 0, -vx); }
    if (p.x > WALL_R - r * 0.5) { const vx = p.x - p.px; p.x = WALL_R - r * 0.5; p.px = p.x + (vx > 0 ? vx * 0.35 : 0); this.wallHit = Math.max(this.wallHit || 0, vx); }
    if (p.y < 40) { p.y = 40; if (p.py < p.y) p.py = p.y; }
  }

  followBody(dt) {
    const r = this.root, pv = this.pelvis;
    r.vx = (pv.x - pv.px) / dt; r.vy = (pv.y - pv.py) / dt;
    r.x = clamp(pv.x, WALL_L + 24 * this.s, WALL_R - 24 * this.s);
    r.y = Math.min(GROUND, pv.y + 50 * this.s);
    r.grounded = false;
    if (this.stunT > 0) return;
    const speed = Math.hypot(r.vx, r.vy);
    const low = pv.y > GROUND - 75 * this.s;
    if (!low || (speed > 220 * this.s && this.stunT > -1.5)) return;
    r.y = GROUND; r.vx = 0; r.vy = 0; r.grounded = true; r.jumps = 0;
    this.mode = 'rising';
    this.riseT = 0;
    this.m = 0.05;
    this.juggle = 0;
  }

  stepCloth(dt) {
    const s = this.s, f = this.facing;
    const wind = Math.sin(this.t * 1.7) * 0.12;
    for (const c of this.chains) {
      const P0 = c.pts, L = c.len * s;
      const [ax, ay] = this.clothAnchor(c);
      P0[0].x = ax; P0[0].y = ay;
      const g = c.grav * s * dt * dt;
      // cloth drifts a touch behind the way the fighter faces; movement does the rest
      const push = -f * (c.push != null ? c.push : 0.05);
      for (let i = 1; i < P0.length; i++) {
        const p = P0[i];
        const vx = (p.x - p.px) * c.drag, vy = (p.y - p.py) * c.drag;
        p.px = p.x; p.py = p.y;
        p.x += vx + wind + push; p.y += vy + g;
        if (p.y > GROUND - 2) { p.y = GROUND - 2; p.px = lerp(p.px, p.x, 0.4); }
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < P0.length; i++) {
          const a = P0[i - 1], b = P0[i];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4;
          const diff = (d - L) / d;
          if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
        P0[0].x = ax; P0[0].y = ay;
      }
      for (const p of P0) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { p.x = p.px = ax; p.y = p.py = ay; }
    }
  }

  /* ---------------------------------------------------------- hurtbox */
  // does a circle (x, y, r) touch this body? returns the struck point
  hitTest(x, y, rad) {
    const s = this.s, pts = this.pts;
    const h = pts[P.HEAD];
    if (dist(x, y, h.x, h.y) < HEAD_R * s + rad) return { idx: P.HEAD, x: h.x, y: h.y, head: true };
    let best = null, bd = Infinity;
    for (let i = 1; i < SEGS.length; i++) {
      const [a, b, br] = SEGS[i];
      const A = pts[a], B = pts[b];
      const res = segPointDist(A.x, A.y, B.x, B.y, x, y);
      const lim = br * s + rad;
      if (res.d < lim && res.d < bd) { bd = res.d; best = { idx: res.t > 0.5 ? b : a, x: lerp(A.x, B.x, res.t), y: lerp(A.y, B.y, res.t) }; }
    }
    if (best) return best;
    // a solid core so a hit never slips between swaying limbs; juggled bodies keep one along the spine
    if (this.mode === 'tumble') {
      const a = pts[P.NECK], b = pts[P.PELVIS];
      const res = segPointDist(a.x, a.y, b.x, b.y, x, y);
      if (res.d < 20 * s + rad) return { idx: P.NECK, x: lerp(a.x, b.x, res.t), y: lerp(a.y, b.y, res.t) };
    } else if (this.mode !== 'dead') {
      const r = this.root;
      const res = segPointDist(r.x, r.y - 20 * s, r.x, r.y - 120 * s, x, y);
      if (res.d < 17 * s + rad) return { idx: P.NECK, x: r.x, y: lerp(r.y - 20 * s, r.y - 120 * s, res.t) };
    }
    return null;
  }

  /* --------------------------------------------------------------- draw
     Element Rag's mannequin: flat, chunky, faceless limbs in one body colour,
     wrist bands in the fighter's colour, and Element Rag's own headgear. */
  accent() {
    if (this.stopT > 0) return '#b8b8c0';
    const L = this.def.look;
    if (this.surge > 0 && L.surge && L.surge.accent) return L.surge.accent;
    return this.alt ? mixHex(this.def.color, '#000000', 0.3) : this.def.color;
  }

  draw(ctx, time, mono) {
    const s = this.s, pts = this.pts, L = this.def.look, f = this.facing;
    if (this.hidden) return;
    const fade = (this.mode === 'dead' && this.fadeOut ? clamp(1 - (this.deadT - 2.5) / 1, 0, 1) : 1) * this.alpha;
    if (fade <= 0) return;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake * 0.4);
    ctx.globalAlpha *= fade * (this.invuln > 0 && this.mode === 'rising' ? 0.7 : 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const fl = mono ? 0 : this.flash;
    const stopped = this.stopT > 0 && !mono;
    const dark = this.surge > 0 && L.surge && L.surge.dark;
    const baseBody = stopped ? '#a3a3ab' : dark ? '#3a3a44' : this.alt ? '#e4ddcf' : '#f7f2e7';
    const baseShade = stopped ? '#86868e' : dark ? '#2a2a32' : this.alt ? '#c2b7a2' : '#d6cab4';
    const body = mono || (fl > 0 ? mixHex(baseBody, '#ffffff', fl) : baseBody);
    const shade = mono || (fl > 0 ? mixHex(baseShade, '#ffffff', fl) : baseShade);
    const acc = mono || this.accent();
    // garment colours: 'acc' means the fighter's colour; back limbs get a darker tone
    const tone = (c, back) => {
      if (mono) return mono;
      if (!c) return null;
      let col = c === 'acc' ? this.accent() : c;
      if (stopped) col = mixHex(col, '#9a9aa2', 0.75);
      else if (dark) col = mixHex(col, '#000000', 0.45);
      else if (this.alt && c !== 'acc') col = mixHex(col, '#000000', 0.2);
      if (back) col = mixHex(col, '#000000', 0.22);
      if (fl > 0) col = mixHex(col, '#ffffff', fl);
      return col;
    };
    const B = L.build || {};
    const legW = B.leg || 1, armW = B.arm || 1;
    // a limb that tapers from one end to the other
    const cap = (a, b, wa, wb, col) => {
      const A = pts[a], Bp = pts[b];
      const dx = Bp.x - A.x, dy = Bp.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const ra = wa * s / 2, rb = wb * s / 2;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(A.x + nx * ra, A.y + ny * ra); ctx.lineTo(Bp.x + nx * rb, Bp.y + ny * rb);
      ctx.lineTo(Bp.x - nx * rb, Bp.y - ny * rb); ctx.lineTo(A.x - nx * ra, A.y - ny * ra); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(A.x, A.y, ra, 0, TAU); ctx.arc(Bp.x, Bp.y, rb, 0, TAU); ctx.fill();
    };
    // a band part-way along a limb (cuffs, wraps, boots)
    const band = (a, b, u0, u1, w, col) => {
      const A = pts[a], Bp = pts[b];
      ctx.strokeStyle = col; ctx.lineWidth = w * s; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(lerp(A.x, Bp.x, u0), lerp(A.y, Bp.y, u0)); ctx.lineTo(lerp(A.x, Bp.x, u1), lerp(A.y, Bp.y, u1)); ctx.stroke();
      ctx.lineCap = 'round';
    };
    const plated = L.gear === 'helmet' || L.gear === 'crest';
    const leg = (hip, knee, foot, back) => {
      const col = back ? shade : body;
      cap(hip, knee, 14.5 * legW, 12 * legW, col); cap(knee, foot, 12 * legW, 10 * legW, col);
      const pc = tone(L.pants, back);
      if (pc) {
        if (L.pantsKind === 'shorts') cap(hip, knee, 16.5 * legW, 14 * legW, pc);
        else if (L.pantsKind === 'hakama') {
          // wide pleated trousers flare out toward the ankle
          cap(hip, knee, 16.5 * legW, 17 * legW, pc); cap(knee, foot, 17 * legW, 18 * legW, pc);
        } else { cap(hip, knee, 16 * legW, 13.5 * legW, pc); cap(knee, foot, 13.5 * legW, 11.5 * legW, pc); }
      }
      const bc = tone(L.boots, back);
      if (bc) band(knee, foot, 0.55, 1.08, 12.5 * legW, bc);
      if (L.shinWrap) { const wc = tone(L.shinWrap, back); for (const u of [0.35, 0.55, 0.75]) band(knee, foot, u, u + 0.08, 12.6 * legW, wc); }
    };
    const arm = (sh, el, hand, back) => {
      const col = back ? shade : body;
      cap(sh, el, 11.5 * armW, 10 * armW, col); cap(el, hand, 10 * armW, 8.5 * armW, col);
      const sc = tone(L.top, back);
      if (sc && L.sleeve === 'short') cap(sh, el, 13.5 * armW, 12 * armW, sc);
      // sleeveless tops still cover the shoulder, ending in a clean cap
      if (sc && !L.sleeve && !L.bareShoulder) {
        const A = pts[sh], E = pts[el], m = { x: lerp(A.x, E.x, 0.32), y: lerp(A.y, E.y, 0.32) };
        const ddx = m.x - A.x, ddy = m.y - A.y, ll = Math.hypot(ddx, ddy) || 1, qx = -ddy / ll, qy = ddx / ll, r0 = 7 * armW * s, r1 = 6.6 * armW * s;
        ctx.fillStyle = sc;
        ctx.beginPath(); ctx.moveTo(A.x + qx * r0, A.y + qy * r0); ctx.lineTo(m.x + qx * r1, m.y + qy * r1); ctx.lineTo(m.x - qx * r1, m.y - qy * r1); ctx.lineTo(A.x - qx * r0, A.y - qy * r0); ctx.fill();
        ctx.beginPath(); ctx.arc(A.x, A.y, r0, 0, TAU); ctx.fill();
      }
      if (sc && L.sleeve === 'long') { cap(sh, el, 13.5 * armW, 12 * armW, sc); cap(el, hand, L.wideSleeve ? 15 : 11.5 * armW, L.wideSleeve ? 18 : 10 * armW, sc); }
      if (L.stripes) band(sh, el, 0.55, 0.7, 13.8 * armW, tone('#e9f0b0', back));
      if (L.wraps) { const wc = tone(L.wraps === true ? '#ece6d8' : L.wraps, back); band(el, hand, 0.45, 0.85, 10.6 * armW, wc); }
      else if (!L.glove && !(sc && L.sleeve === 'long')) {
        // Element Rag's wrist band
        ctx.strokeStyle = back ? mixHex(acc, '#000000', 0.15) : acc; ctx.lineWidth = (plated ? 15.5 : 11.5) * s;
        ctx.beginPath(); ctx.moveTo(lerp(pts[el].x, pts[hand].x, plated ? 0.43 : 0.56), lerp(pts[el].y, pts[hand].y, plated ? 0.43 : 0.56));
        ctx.lineTo(lerp(pts[el].x, pts[hand].x, 0.83), lerp(pts[el].y, pts[hand].y, 0.83)); ctx.stroke();
      }
      const gc = tone(L.glove, back);
      ctx.fillStyle = gc || col;
      ctx.beginPath(); ctx.arc(pts[hand].x, pts[hand].y, (gc ? 8.2 : back ? 5.3 : 5.8) * s, 0, TAU); ctx.fill();
      if (gc) band(el, hand, 0.72, 0.92, 11 * armW, gc);
    };

    // cloth behind the body: cape / scarf, hair, coat tails
    for (const c of this.chains) if (c.kind !== 'belt') this.drawChain(ctx, c, c.color === 'acc' ? acc : tone(c.color));
    if (!mono && (this.surge > 0 || this.auraT > 0) && !(this.def.form && this.surge > 0)) this.drawAura(ctx, time);
    // back limbs in the shade tone
    leg(P.PELVIS, P.BKNEE, P.BFOOT, true);
    arm(P.NECK, P.BELB, P.BHAND, true);
    // torso: a tapered chest-to-waist shape
    this.drawTorso(ctx, body, tone(L.top), tone(L.trim), acc, mono, tone(L.pants));
    if (L.pantsKind === 'robe' && L.pants) this.drawSkirt(ctx, tone(L.pants));
    leg(P.PELVIS, P.FKNEE, P.FFOOT, false);
    if (L.belt) {
      const bc = tone(L.belt), n = pts[P.NECK], pv = pts[P.PELVIS];
      const ang = Math.atan2(pv.y - n.y, pv.x - n.x) - Math.PI / 2;
      ctx.save(); ctx.translate(lerp(n.x, pv.x, 0.86), lerp(n.y, pv.y, 0.86)); ctx.rotate(ang);
      ctx.fillStyle = bc; ctx.fillRect(-11 * s * (B.waist || 1), -2.6 * s, 22 * s * (B.waist || 1), 5.4 * s);
      ctx.restore();
      const bt = this.chains.find(c => c.kind === 'belt');
      if (bt) this.drawChain(ctx, bt, bc);
    }
    if (L.extra === 'beads') {
      const n = pts[P.NECK];
      ctx.fillStyle = mono || '#6b3b2a';
      for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.0875); ctx.beginPath(); ctx.arc(n.x + Math.cos(a) * 12 * s, n.y + Math.sin(a) * 9 * s - 2 * s, 2.6 * s, 0, TAU); ctx.fill(); }
    }
    const hd = pts[P.HEAD], hr = HEAD_R * s;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(hd.x - hr, hd.y - hr * 1.05, hr * 2, hr * 2.1, hr * 0.8); ctx.fill();
    this.drawHair(ctx, hd, tone(L.hairC || '#2a2630'), mono);
    this.drawHeadgear(ctx, hd, time, acc, mono);
    this.drawFace(ctx, hd, tone, acc, mono, time);
    if (L.extra === 'pauldron') {
      const n = pts[P.NECK], e = pts[P.FELB];
      ctx.fillStyle = tone(L.trim || '#8c8c96');
      ctx.beginPath(); ctx.ellipse(lerp(n.x, e.x, 0.3), lerp(n.y, e.y, 0.3) - 2 * s, 12 * s, 8 * s, Math.atan2(e.y - n.y, e.x - n.x), 0, TAU); ctx.fill();
    }
    // front arm on top, with the blade if the fighter carries one
    if (!this.hideArm) arm(P.NECK, P.FELB, P.FHAND, false);
    if (L.weapon) this.drawWeapon(ctx, acc, mono);
    if (!mono && !stopped && this.alive) {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, acc, pts[P.FHAND].x, pts[P.FHAND].y, 16 * s, 0.45);
      if (L.extra === 'orbs') for (let i = 0; i < 3; i++) {
        const a = time * 1.6 + i * TAU / 3, c = this.center();
        Glow.draw(ctx, acc, c.x + Math.cos(a) * 34 * s, c.y - 26 * s + Math.sin(a) * 12 * s, 9 * s, 0.6);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!mono && this.mode === 'block' && this.stunT > 0) {
      const c = this.chest();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * Math.min(1, this.stunT * 5);
      ctx.strokeStyle = '#8fd6ff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(c.x + f * 20 * s, c.y, 46 * s, -1.1, 1.1); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // chest wider than the waist; tops, vests and jackets drawn over it
  drawTorso(ctx, body, top, trim, acc, mono, pants) {
    const s = this.s, f = this.facing, pts = this.pts, L = this.def.look, B = L.build || {};
    const n = pts[P.NECK], pv = pts[P.PELVIS];
    const dx = pv.x - n.x, dy = pv.y - n.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const cw = 13 * (B.chest || 1) * s, ww = 10.5 * (B.waist || 1) * s;
    // the torso's half-width along its length: chest to waist, and for a curvy
    // build a nipped waist and wider hips
    const sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const prof = u => B.curvy
      ? (u < 0.28 ? cw : u < 0.7 ? lerp(cw, ww, sm((u - 0.28) / 0.42)) : lerp(ww, ww * (B.hip || 1), sm((u - 0.7) / 0.3)))
      : lerp(cw, ww, u) * (1 + 0.06 * Math.sin(Math.PI * u));
    const shape = (c0, c1, k0 = 0, k1 = 1) => {
      const N = 8, L = [], R = [];
      const frontL = -f > 0;   // which side of the outline faces forward
      for (let i = 0; i <= N; i++) {
        const u = lerp(k0, k1, i / N), w = prof(Math.min(1, u));
        // a soft chest line on the front of the outline, nothing stuck on
        const fb = B.bust ? 1 + 0.16 * Math.exp(-Math.pow((u - 0.24) / 0.11, 2)) : 1;
        const x = n.x + dx * u, y = n.y + dy * u;
        L.push([x + nx * w * (frontL ? fb : 1) * (i === 0 ? c0 : 1), y + ny * w * (frontL ? fb : 1) * (i === 0 ? c0 : 1)]);
        R.push([x - nx * w * (frontL ? 1 : fb) * (i === 0 ? c1 : 1), y - ny * w * (frontL ? 1 : fb) * (i === 0 ? c1 : 1)]);
      }
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (const q of L) ctx.lineTo(q[0], q[1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
    };
    ctx.fillStyle = body;
    shape(1, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(n.x + ux * 3 * s, n.y + uy * 3 * s, cw * 0.98, 0, TAU); ctx.fill();
    // the hips are part of the trousers, so the waist never shows a sliver of skin
    ctx.fillStyle = pants && L.pantsKind !== 'robe' ? pants : body;
    const hipW = ww * (B.curvy ? B.hip || 1 : 1);
    ctx.beginPath(); ctx.arc(pv.x, pv.y, hipW * 1.04, 0, TAU); ctx.fill();
    if (pants && L.pantsKind !== 'robe') { ctx.beginPath(); ctx.moveTo(pv.x + nx * hipW * 1.04, pv.y + ny * hipW * 1.04); ctx.lineTo(pv.x - ux * 6 * s + nx * prof(0.88), pv.y - uy * 6 * s + ny * prof(0.88)); ctx.lineTo(pv.x - ux * 6 * s - nx * prof(0.88), pv.y - uy * 6 * s - ny * prof(0.88)); ctx.lineTo(pv.x - nx * hipW * 1.04, pv.y - ny * hipW * 1.04); ctx.fill(); }
    if (!top) return;
    const kind = L.topKind || 'tank';
    ctx.fillStyle = top;
    if (kind === 'vest') {
      // an open vest: the whole back and sides, with the chest showing down the front
      shape(1, 1, 0, 1.04); ctx.fill();
      ctx.beginPath(); ctx.arc(n.x + ux * 3 * s, n.y + uy * 3 * s, cw * 0.98, 0, TAU); ctx.fill();
      const fx = -f;   // the side the fighter faces, along the torso's normal
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(n.x + nx * cw * 0.15 * fx + ux * 4 * s, n.y + ny * cw * 0.15 * fx + uy * 4 * s);
      ctx.lineTo(n.x + nx * cw * 1.02 * fx, n.y + ny * cw * 1.02 * fx);
      ctx.lineTo(pv.x + nx * ww * 1.02 * fx - ux * 4 * s, pv.y + ny * ww * 1.02 * fx - uy * 4 * s);
      ctx.lineTo(pv.x + nx * ww * 0.45 * fx - ux * 4 * s, pv.y + ny * ww * 0.45 * fx - uy * 4 * s);
      ctx.closePath(); ctx.fill();
      if (trim) { ctx.strokeStyle = trim; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(n.x + nx * cw * 0.15 * fx + ux * 4 * s, n.y + ny * cw * 0.15 * fx + uy * 4 * s); ctx.lineTo(pv.x + nx * ww * 0.45 * fx - ux * 4 * s, pv.y + ny * ww * 0.45 * fx - uy * 4 * s); ctx.stroke(); }
    } else {
      shape(1, 1, kind === 'tank' && L.bareShoulder ? 0.12 : 0, 1.04); ctx.fill();
      if (kind !== 'tank' || !L.bareShoulder) { ctx.beginPath(); ctx.arc(n.x + ux * 3 * s, n.y + uy * 3 * s, cw * 0.98, 0, TAU); ctx.fill(); }
      if (kind === 'gi' || kind === 'robe' || kind === 'haori') {
        // the crossed collar: a V of skin and a trim line
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.moveTo(n.x - nx * cw * 0.15 * f, n.y - ny * cw * 0.15 * f); ctx.lineTo(n.x + ux * 22 * s, n.y + uy * 22 * s); ctx.lineTo(n.x + nx * cw * 0.55 * f, n.y + ny * cw * 0.55 * f); ctx.closePath(); ctx.fill();
        if (trim) { ctx.strokeStyle = trim; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(n.x + nx * cw * 0.6 * f, n.y + ny * cw * 0.6 * f); ctx.lineTo(n.x + ux * 24 * s, n.y + uy * 24 * s); ctx.stroke(); }
      }
      if (kind === 'hoodie' || kind === 'jacket') {
        // a collar or a hood bunched behind the neck
        ctx.fillStyle = top;
        ctx.beginPath(); ctx.ellipse(n.x - f * 6 * s, n.y - 1 * s, 10 * s, 7 * s, 0, 0, TAU); ctx.fill();
        if (trim) { ctx.strokeStyle = trim; ctx.lineWidth = 2.6 * s; ctx.beginPath(); ctx.moveTo(n.x + ux * 4 * s, n.y + uy * 4 * s); ctx.lineTo(pv.x - ux * 2 * s, pv.y - uy * 2 * s); ctx.stroke(); }
      }
    }
    if (L.stripes) {
      ctx.strokeStyle = mono || '#e9f0b0'; ctx.lineWidth = 3.4 * s; ctx.lineCap = 'butt';
      for (const u of [0.55, 0.68]) { const x = lerp(n.x, pv.x, u), y = lerp(n.y, pv.y, u), w = lerp(cw, ww, u); ctx.beginPath(); ctx.moveTo(x + nx * w, y + ny * w); ctx.lineTo(x - nx * w, y - ny * w); ctx.stroke(); }
      ctx.lineCap = 'round';
    }
    if (L.sash) {
      // a cloth sash across the chest
      ctx.strokeStyle = trim || acc; ctx.lineWidth = 5 * s; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(n.x + nx * cw * f, n.y + ny * cw * f); ctx.lineTo(pv.x - nx * ww * f, pv.y - ny * ww * f); ctx.stroke();
      ctx.lineCap = 'round';
    }
  }

  // a robe hangs from the waist to the knees
  drawSkirt(ctx, col) {
    const s = this.s, pts = this.pts, pv = pts[P.PELVIS], a = pts[P.FKNEE], b = pts[P.BKNEE];
    const lo = Math.max(a.y, b.y) + 6 * s, x0 = Math.min(a.x, b.x, pv.x) - 9 * s, x1 = Math.max(a.x, b.x, pv.x) + 9 * s;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(pv.x - 11 * s, pv.y - 4 * s); ctx.lineTo(pv.x + 11 * s, pv.y - 4 * s);
    ctx.quadraticCurveTo(x1, lerp(pv.y, lo, 0.5), x1 + 2 * s, lo); ctx.lineTo(x0 - 2 * s, lo);
    ctx.quadraticCurveTo(x0, lerp(pv.y, lo, 0.5), pv.x - 11 * s, pv.y - 4 * s); ctx.fill();
  }

  // Hair and head pieces all grow out of one scalp cap that hugs the head's
  // own outline, so spikes, crests, knots and horns are always rooted in it.
  scalpPt(hd, a, out = 0) {
    // a point on the head outline (a rounded square) in facing space:
    // a = 0 straight ahead, -PI/2 straight up, -PI straight back
    const hr = HEAD_R * this.s, c = Math.cos(a), sn = Math.sin(a);
    const r = hr / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(sn) / 1.05, 4), 0.25) * 0.97 + out;
    return [hd.x + this.facing * c * r, hd.y + sn * r];
  }
  drawHair(ctx, hd, col, mono) {
    const L = this.def.look, kind = L.hair;
    if (!kind && !L.horns) return;
    const s = this.s, f = this.facing, hr = HEAD_R * s, e = 0.5 * s;
    const P = (a, out) => this.scalpPt(hd, a, out);
    // the cap: the head outline grown a little, kept above a hairline that runs
    // from the forehead (front) to behind the ear (back)
    const cap = (front, back) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hd.x + f * (hr + 12 * s), hd.y + hr * front);
      ctx.lineTo(hd.x - f * (hr + 12 * s), hd.y + hr * back);
      ctx.lineTo(hd.x - f * (hr + 12 * s), hd.y - hr * 3); ctx.lineTo(hd.x + f * (hr + 12 * s), hd.y - hr * 3);
      ctx.closePath(); ctx.clip();
      ctx.beginPath(); ctx.roundRect(hd.x - hr - e, hd.y - hr * 1.05 - e, hr * 2 + e * 2, hr * 2.1 + e * 2, hr * 0.8 + e); ctx.fill();
      ctx.restore();
    };
    // a spike rooted inside the cap: base across [a - w, a + w], tip out along a (+ sweep back)
    const spike = (a, w, len, sweep = -0.25) => {
      const b0 = P(a - w, -2 * s), b1 = P(a + w, -2 * s), t = P(a + sweep, len);
      ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.quadraticCurveTo(lerp(b0[0], t[0], 0.6), lerp(b0[1], t[1], 0.4), t[0], t[1]);
      ctx.quadraticCurveTo(lerp(b1[0], t[0], 0.4), lerp(b1[1], t[1], 0.6), b1[0], b1[1]); ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = col;
    if (kind === 'tuft') {
      cap(-0.42, 0.15);
      spike(-1.2, 0.35, 5 * s, -0.5); spike(-2.0, 0.4, 7 * s, -0.55); spike(-2.6, 0.35, 6 * s, -0.4);
    } else if (kind === 'spikes') {
      cap(-0.5, 0.2);
      [[-0.75, 9], [-1.2, 12], [-1.65, 13], [-2.1, 12], [-2.55, 10], [-2.95, 7]].forEach(([a, l]) => spike(a, 0.26, l * s * (L.horns ? 0.55 : 1), -0.3));
    } else if (kind === 'mohawk') {
      // shaved sides (a short shadow), with a crest running front to back
      ctx.fillStyle = mono || mixHex(col, '#cfc3ad', 0.5); cap(-0.4, 0.25); ctx.fillStyle = col;
      [[-1.1, 7], [-1.45, 10], [-1.8, 12], [-2.15, 12], [-2.5, 10], [-2.85, 7]].forEach(([a, l]) => spike(a, 0.2, l * s * (L.horns ? 0.55 : 1), -0.35));
    } else if (kind === 'topknot' || kind === 'buns') {
      cap(-0.5, 0.25);
      const knots = kind === 'buns' ? [[-1.05, 0.5], [-2.25, 0.5]] : [[-1.85, 0.46]];
      for (const [a, k] of knots) { const [x, y] = P(a, hr * k * 0.55); ctx.beginPath(); ctx.arc(x, y, hr * k, 0, TAU); ctx.fill(); }
      if (kind === 'buns') {
        // soft bangs over the brow
        const a0 = P(-0.15, 0), a1 = P(-1.25, 0);
        ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.quadraticCurveTo(hd.x + f * hr * 0.9, hd.y - hr * 0.95, a0[0], a0[1] - hr * 0.1);
        ctx.quadraticCurveTo(hd.x + f * hr * 0.55, hd.y - hr * 0.45, hd.x + f * hr * 0.1, hd.y - hr * 0.55); ctx.closePath(); ctx.fill();
      }
      if (kind === 'topknot' && !mono) { const [x, y] = P(-1.85, 1 * s); ctx.fillStyle = this.accent(); ctx.beginPath(); ctx.arc(x, y, 2.4 * s, 0, TAU); ctx.fill(); }
    } else if (kind === 'long') {
      cap(-0.45, 0.65);
      // the fall of hair behind the head, joined to the cap, down to the shoulders
      const t0 = P(-2.4, 0), t1 = P(-3.05, 0);
      ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]);
      ctx.quadraticCurveTo(hd.x - f * (hr + 4 * s), hd.y + hr * 1.0, hd.x - f * hr * 0.75, hd.y + hr * 1.45);
      ctx.lineTo(hd.x - f * hr * 0.05, hd.y + hr * 0.8);
      ctx.quadraticCurveTo(hd.x - f * hr * 0.2, hd.y - hr * 0.2, t0[0], t0[1]); ctx.fill();
      // a swept fringe
      spike(-0.75, 0.38, 4 * s, 0.35);
    } else if (kind === 'buzz' || kind === 'ponytail' || kind === 'part') {
      cap(kind === 'buzz' ? -0.55 : -0.42, kind === 'buzz' ? 0.3 : 0.45);
      if (kind === 'part') spike(-0.85, 0.42, 4 * s, 0.4);
      if (kind === 'ponytail') { const [x, y] = P(-2.55, 0); ctx.beginPath(); ctx.arc(x, y, 3.6 * s, 0, TAU); ctx.fill(); }
    }
    if (L.horns) {
      // two curved horns, each rooted in the scalp
      ctx.fillStyle = mono || '#d9cbb2';
      for (const a of [-1.05, -2.15]) {
        const b0 = P(a - 0.3, -4 * s), b1 = P(a + 0.3, -4 * s), t = P(a + (a > -1.6 ? 0.25 : -0.25), 18 * s);
        const c = P(a + (a > -1.6 ? -0.2 : 0.2), 14 * s);
        ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.quadraticCurveTo(c[0], c[1], t[0], t[1]);
        ctx.quadraticCurveTo(lerp(b1[0], c[0], 0.6), lerp(b1[1], c[1], 0.6), b1[0], b1[1]); ctx.closePath(); ctx.fill();
      }
    }
  }

  // masks, visors and goggles over the faceless head
  drawFace(ctx, hd, tone, acc, mono, time) {
    const L = this.def.look, s = this.s, f = this.facing, hr = HEAD_R * s;
    if (L.face === 'mask') {
      ctx.fillStyle = tone(L.maskC || '#2b2f40');
      ctx.beginPath(); ctx.roundRect(hd.x - hr * 1.02, hd.y + hr * 0.02, hr * 2.04, hr * 1.04, [2 * s, 2 * s, hr * 0.8, hr * 0.8]); ctx.fill();
    } else if (L.face === 'visor') {
      ctx.fillStyle = mono || '#1c1d26';
      ctx.beginPath(); ctx.roundRect(hd.x - hr * 0.9 + f * hr * 0.15, hd.y - hr * 0.42, hr * 1.9, hr * 0.62, hr * 0.3); ctx.fill();
      if (!mono) { ctx.fillStyle = acc; ctx.fillRect(hd.x + f * hr * 0.15 - (f > 0 ? 0 : hr * 0.75), hd.y - hr * 0.18, hr * 0.75, 2.4 * s); }
    } else if (L.face === 'goggles') {
      // a strap that wraps the head (clipped to a band of the head outline),
      // with the lenses pushed up on the forehead
      const e = 1.8 * s, dark = mono || '#2c2c34';
      ctx.save();
      ctx.beginPath(); ctx.rect(hd.x - hr * 2, hd.y - hr * 0.86, hr * 4, hr * 0.32); ctx.clip();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(hd.x - hr - e, hd.y - hr * 1.05 - e, hr * 2 + e * 2, hr * 2.1 + e * 2, hr * 0.8 + e); ctx.fill();
      ctx.restore();
      for (const a of [-0.5, -0.95]) {
        const [x, y] = this.scalpPt(hd, a, 1.5 * s);
        ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, TAU); ctx.fill();
        if (!mono) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - 1 * s, y - 1 * s, 1 * s, 0, TAU); ctx.fill(); }
      }
    }
  }

  // Element Rag's headgear: the hero's headband with tails, a caster's hood,
  // a brute's helmet and plates, and the boss crest
  drawHeadgear(ctx, hd, time, acc, mono) {
    const s = this.s, f = this.facing, hr = HEAD_R * s, gear = this.def.look.gear;
    const plate = mono || '#9a9a9a', plate2 = mono || '#8c8c8c', plate3 = mono || '#a6a6a6';
    if (gear === 'headband') {
      ctx.fillStyle = acc;
      ctx.fillRect(hd.x - hr, hd.y - hr * 0.55, hr * 2, 5 * s);
      ctx.strokeStyle = acc; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
      const wave = Math.sin(time * 6 + this.t) * 3 * s;
      ctx.beginPath();
      ctx.moveTo(hd.x - f * hr, hd.y - hr * 0.45);
      ctx.quadraticCurveTo(hd.x - f * (hr + 10 * s), hd.y - hr * 0.5 + wave, hd.x - f * (hr + 18 * s), hd.y - hr * 0.1 + wave);
      ctx.stroke();
    } else if (gear === 'hood') {
      // a cowl: wraps the back and top of the head and drapes onto the shoulders,
      // open at the front so the face shows, with a trim in the fighter's colour
      const hc = this.def.look.hoodC;
      const col = mono || (this.stopT > 0 ? '#86868e' : hc ? (this.alt ? mixHex(hc, '#000000', 0.2) : hc) : '#d6cab4');
      const n = this.pts[P.NECK];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(hd.x + f * hr * 0.55, hd.y - hr * 1.28);
      ctx.quadraticCurveTo(hd.x - f * hr * 0.6, hd.y - hr * 1.62, hd.x - f * hr * 1.32, hd.y - hr * 0.55);
      ctx.quadraticCurveTo(hd.x - f * hr * 1.55, hd.y + hr * 0.5, n.x - f * 15 * s, n.y + 6 * s);
      ctx.lineTo(n.x + f * 12 * s, n.y + 6 * s);
      ctx.quadraticCurveTo(hd.x + f * hr * 1.0, hd.y + hr * 1.0, hd.x + f * hr * 1.22, hd.y - hr * 0.2);
      ctx.quadraticCurveTo(hd.x + f * hr * 1.25, hd.y - hr * 0.95, hd.x + f * hr * 0.55, hd.y - hr * 1.28);
      ctx.fill();
      // the face opening
      ctx.fillStyle = mono || (this.stopT > 0 ? '#a3a3ab' : this.alt ? '#e4ddcf' : '#f7f2e7');
      ctx.beginPath(); ctx.ellipse(hd.x + f * hr * 0.42, hd.y + hr * 0.08, hr * 0.68, hr * 0.82, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 2.6 * s;
      ctx.beginPath(); ctx.ellipse(hd.x + f * hr * 0.42, hd.y + hr * 0.08, hr * 0.74, hr * 0.88, 0, f > 0 ? -2.4 : -0.74, f > 0 ? 0.74 : 2.4, f < 0); ctx.stroke();
    } else if (gear === 'helmet' || gear === 'crest') {
      ctx.fillStyle = plate;
      ctx.beginPath(); ctx.roundRect(hd.x - hr - 2 * s, hd.y - hr * 1.15, hr * 2 + 4 * s, hr * 1.15, [hr * 0.9, hr * 0.9, 2 * s, 2 * s]); ctx.fill();
      const n = this.pts[P.NECK], pv = this.pts[P.PELVIS];
      ctx.strokeStyle = plate2; ctx.lineWidth = 24 * s;
      ctx.beginPath(); ctx.moveTo(n.x, n.y + 2 * s); ctx.lineTo(lerp(n.x, pv.x, 0.45), lerp(n.y, pv.y, 0.45)); ctx.stroke();
      ctx.fillStyle = plate3;
      ctx.beginPath(); ctx.ellipse(n.x, n.y + 2 * s, 16 * s, 8 * s, 0, Math.PI, 0); ctx.fill();
      if (gear === 'crest') {
        ctx.fillStyle = acc;
        const by = hd.y - hr * 1.1;
        ctx.beginPath(); ctx.moveTo(hd.x - 6 * s, by); ctx.lineTo(hd.x - f * 4 * s, by - 18 * s); ctx.lineTo(hd.x + 6 * s, by); ctx.closePath(); ctx.fill();
        ctx.fillRect(hd.x - hr - 2 * s, hd.y - hr * 0.2, hr * 2 + 4 * s, 4 * s);
      } else {
        ctx.fillStyle = acc;
        ctx.fillRect(hd.x - hr - 2 * s, hd.y - hr * 0.2, hr * 2 + 4 * s, 3.5 * s);
      }
    } else if (gear === 'band') {
      // plain band (Element Rag's grunt)
      ctx.fillStyle = acc;
      ctx.fillRect(hd.x - hr, hd.y - hr * 0.55, hr * 2, 5 * s);
    }
    if (!mono && this.eyeGlint > 0) {
      ctx.globalAlpha *= Math.min(1, this.eyeGlint * 3);
      ctx.strokeStyle = this.surge > 0 && this.def.look.surge && this.def.look.surge.dark ? '#ff2c4a' : '#ffffff'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(hd.x + f * hr * 0.2, hd.y - hr * 0.1); ctx.lineTo(hd.x + f * hr * 0.95, hd.y - hr * 0.3); ctx.stroke();
    }
  }

  weaponLine(back) {
    // the blade runs along the forearm, out of the fist
    const E = this.pts[back ? P.BELB : P.FELB], Hh = this.pts[back ? P.BHAND : P.FHAND], s = this.s;
    let dx = Hh.x - E.x, dy = Hh.y - E.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const len = (this.def.look.weaponLen || 58) * s;
    return { x0: Hh.x - dx * 6 * s, y0: Hh.y - dy * 6 * s, x1: Hh.x + dx * len, y1: Hh.y + dy * len, dx, dy };
  }

  // a plain energy blade in the fighter's colour (wider for the cleaver)
  drawWeapon(ctx, acc, mono) {
    const kind = this.def.look.weapon;
    if (kind === 'tri') {
      // a blade in each hand and one held in the teeth
      this.drawBlade(ctx, this.weaponLine(), acc, mono, false);
      this.drawBlade(ctx, this.weaponLine(true), acc, mono, false);
      // the third blade hovers over the shoulder, point up, and follows the body
      const n = this.pts[P.NECK], f = this.facing, s = this.s, bob = Math.sin(this.t * 2.4) * 3 * s;
      const bx = n.x - f * 22 * s, by = n.y - 30 * s + bob;
      this.drawBlade(ctx, { x0: bx + f * 6 * s, y0: by + 28 * s, x1: bx - f * 10 * s, y1: by - 26 * s }, acc, mono, false);
      return;
    }
    this.drawBlade(ctx, this.weaponLine(), acc, mono, kind === 'cleaver', kind === 'saw');
  }

  drawBlade(ctx, w, acc, mono, wide, saw) {
    const s = this.s;
    if (saw) {
      // a chainsaw bar: a dark body with running teeth
      ctx.strokeStyle = mono || '#3a3d4a'; ctx.lineWidth = 9 * s;
      ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      const dx = w.x1 - w.x0, dy = w.y1 - w.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.fillStyle = mono || acc;
      const ph = (this.t * 14) % 1;
      for (let i = 0; i < 9; i++) {
        const u = (i + ph) / 9, x = w.x0 + dx * u, y = w.y0 + dy * u;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + nx * sd * 4 * s, y + ny * sd * 4 * s); ctx.lineTo(x + nx * sd * 8 * s + dx / L * 3 * s, y + ny * sd * 8 * s + dy / L * 3 * s); ctx.lineTo(x + nx * sd * 4 * s + dx / L * 5 * s, y + ny * sd * 4 * s + dy / L * 5 * s); ctx.fill(); }
      }
      return;
    }
    const dx = w.x1 - w.x0, dy = w.y1 - w.y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy * this.facing, ny = ux * this.facing;
    const bx = w.x0 + ux * 6 * s, by = w.y0 + uy * 6 * s;            // where the blade leaves the guard
    if (wide && this.surge > 0 && this.def.look.surge && this.def.look.surge.dark && !mono) {
      // red form: the blade turns black, with a burning red edge
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff2c4a'; ctx.globalAlpha *= 0.55; ctx.lineWidth = 20 * s;
      ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke(); ctx.globalAlpha /= 0.55; ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#0b0507'; ctx.lineWidth = 11 * s; ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 2.2 * s; const ex = -(w.y1 - w.y0) / (Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1) * 5 * s * this.facing, ey = (w.x1 - w.x0) / (Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1) * 5 * s * this.facing;
      ctx.beginPath(); ctx.moveTo(w.x0 + ex, w.y0 + ey); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      return;
    }
    if (wide) {
      // the cleaver: a broad energy slab
      if (!mono) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = acc; ctx.globalAlpha *= 0.5; ctx.lineWidth = 16 * s; ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke(); ctx.globalAlpha /= 0.5; ctx.globalCompositeOperation = 'source-over'; }
      ctx.strokeStyle = mono || acc; ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      if (!mono) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(lerp(w.x0, w.x1, 0.15), lerp(w.y0, w.y1, 0.15)); ctx.lineTo(w.x1, w.y1); ctx.stroke(); }
      return;
    }
    // a katana: wrapped hilt, round guard, and a gently curved, pointed blade
    // with a glowing edge in the fighter's colour
    const hw = 3.1 * s, curve = 5 * s;
    const mx = bx + (w.x1 - bx) * 0.55 + nx * curve, my = by + (w.y1 - by) * 0.55 + ny * curve;
    if (!mono) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = acc; ctx.lineWidth = 11 * s;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, w.x1, w.y1); ctx.stroke();
      ctx.globalAlpha /= 0.35; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = mono || '#e8edf4';
    ctx.beginPath();
    ctx.moveTo(bx + nx * hw, by + ny * hw);
    ctx.quadraticCurveTo(mx + nx * hw * 0.8, my + ny * hw * 0.8, w.x1, w.y1);
    ctx.quadraticCurveTo(mx - nx * hw * 0.9, my - ny * hw * 0.9, bx - nx * hw, by - ny * hw);
    ctx.closePath(); ctx.fill();
    if (!mono) {
      ctx.strokeStyle = acc; ctx.lineWidth = 1.8 * s;   // the tempered edge
      ctx.beginPath(); ctx.moveTo(bx - nx * hw * 0.8, by - ny * hw * 0.8); ctx.quadraticCurveTo(mx - nx * hw * 0.75, my - ny * hw * 0.75, w.x1, w.y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(bx + nx * hw * 0.3, by + ny * hw * 0.3); ctx.quadraticCurveTo(mx + nx * hw * 0.3, my + ny * hw * 0.3, lerp(mx, w.x1, 0.7), lerp(my, w.y1, 0.7)); ctx.stroke();
    }
    // hilt behind the guard, wrapped in diamonds
    const hx = bx - ux * 18 * s, hy = by - uy * 18 * s;
    ctx.strokeStyle = mono || '#2a2230'; ctx.lineWidth = 5.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
    if (!mono) { ctx.fillStyle = acc; for (let k = 1; k < 4; k++) { const cx = lerp(bx, hx, k / 4), cy = lerp(by, hy, k / 4); ctx.beginPath(); ctx.arc(cx, cy, 1.3 * s, 0, TAU); ctx.fill(); } }
    // the guard
    ctx.fillStyle = mono || '#2b2b33';
    ctx.beginPath(); ctx.ellipse(bx, by, 2.4 * s, 6.4 * s, Math.atan2(uy, ux), 0, TAU); ctx.fill();
    if (!mono) { ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 1.2 * s; ctx.stroke(); }
  }

  // a tapered ribbon along a cloth chain
  drawChain(ctx, c, color) {
    const P0 = c.pts, s = this.s;
    ctx.fillStyle = color;
    ctx.beginPath();
    const left = [], right = [];
    for (let i = 0; i < P0.length; i++) {
      const a = P0[Math.max(0, i - 1)], b = P0[Math.min(P0.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const w = lerp(c.w0, c.w1, i / (P0.length - 1)) * s;
      left.push([P0[i].x - dy / l * w, P0[i].y + dx / l * w]);
      right.push([P0[i].x + dy / l * w, P0[i].y - dx / l * w]);
    }
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
    if (c.w1 < 7) { const e = P0[P0.length - 1]; ctx.beginPath(); ctx.arc(e.x, e.y, c.w1 * s, 0, TAU); ctx.fill(); }
  }

  drawAura(ctx, time) {
    const c = this.center(), s = this.s, col = this.accent();
    const k = Math.min(1, Math.max(this.surge, this.auraT || 0) * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, col, c.x, c.y, 120 * s, 0.35 * k);
    ctx.fillStyle = col;
    for (let i = 0; i < 9; i++) {
      const ph = (time * 2.2 + i / 9) % 1, sx = Math.sin(i * 2.7) * 34 * s;
      const x = c.x + sx * (1 - ph * 0.4), y = c.y + 70 * s - ph * 190 * s;
      const r = (16 - ph * 12) * s;
      ctx.globalAlpha = 0.28 * k * Math.sin(ph * Math.PI);
      ctx.beginPath(); ctx.moveTo(x, y - r * 2.4); ctx.quadraticCurveTo(x + r, y, x, y + r); ctx.quadraticCurveTo(x - r, y, x, y - r * 2.4); ctx.fill();
    }
    ctx.restore();
  }
}
