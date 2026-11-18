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
    this.maxHp = this.hp = Math.round(def.hp * (o.hpMul || 1));
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
    if (L.cape) add('cape', 7, 9, 8, 4.8, 'acc');
    if (L.hair === 'ponytail') add('hair', 5, 7, 6, 2.6, L.hairC || '#2a2630', { drag: 0.9 });
    if (L.hair === 'long') add('hair', 4, 8.5, 12, 8, L.hairC || '#3a2c24', { drag: 0.9 });
    if (L.coat) add('coat', 4, 9, 11, 13, L.coat, { drag: 0.88, grav: 1700 });
    if (L.belt && L.beltTails !== false) add('belt', 3, 6.5, 3.6, 2.6, L.belt, { drag: 0.9 });
    this.cape = (this.chains.find(c => c.kind === 'cape') || {}).pts || null;
  }
  clothAnchor(c) {
    const s = this.s, f = this.facing, n = this.pts[P.NECK], pv = this.pts[P.PELVIS], h = this.pts[P.HEAD], hr = HEAD_R * s;
    if (c.kind === 'cape') return [n.x - f * 3 * s, n.y + 3 * s];
    if (c.kind === 'hair') return c.n === 5 ? [h.x - f * hr * 0.75, h.y - hr * 0.55] : [h.x - f * hr * 0.55, h.y - hr * 0.2];
    if (c.kind === 'coat') return [lerp(n.x, pv.x, 0.86) - f * 6 * s, lerp(n.y, pv.y, 0.86)];
    return [lerp(n.x, pv.x, 0.88) + f * 7 * s, lerp(n.y, pv.y, 0.88) + 2 * s];
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
      if (control && !act && r.grounded) want = this.input.x * this.walk * this.s * (this.input.x === -this.facing ? 0.82 : 1);
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
    for (let it = 0; it < 6; it++) {
      for (let b = 0; b < SEGS.length; b++) {
        const ia = SEGS[b][0], ib = SEGS[b][1], L = BONE_LEN[b] * s;
        solve(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], L, L, 1);
      }
      for (const [ia, ib, lo, hi] of JOINT_LIMITS) solve(pts[ia], pts[ib], INV_MASS[ia], INV_MASS[ib], lo * s, hi * s, 0.6);
      for (const p of pts) this.contain(p, limp);
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
      // cloth trails behind the way the fighter faces, a little
      const push = c.kind === 'coat' ? -f * 0.1 : -f * 0.18;
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
    if (!mono && (this.surge > 0 || this.auraT > 0)) this.drawAura(ctx, time);
    // back limbs in the shade tone
    leg(P.PELVIS, P.BKNEE, P.BFOOT, true);
    arm(P.NECK, P.BELB, P.BHAND, true);
    // torso: a tapered chest-to-waist shape
    this.drawTorso(ctx, body, tone(L.top), tone(L.trim), acc, mono);
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
  drawTorso(ctx, body, top, trim, acc, mono) {
    const s = this.s, f = this.facing, pts = this.pts, L = this.def.look, B = L.build || {};
    const n = pts[P.NECK], pv = pts[P.PELVIS];
    const dx = pv.x - n.x, dy = pv.y - n.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const cw = 13 * (B.chest || 1) * s, ww = 10.5 * (B.waist || 1) * s;
    const shape = (c0, c1, k0 = 0, k1 = 1) => {
      const ax = n.x + dx * k0, ay = n.y + dy * k0, bx = n.x + dx * k1, by = n.y + dy * k1;
      const w0 = lerp(cw, ww, k0), w1 = lerp(cw, ww, k1);
      ctx.beginPath();
      ctx.moveTo(ax + nx * w0 * c0, ay + ny * w0 * c0);
      ctx.quadraticCurveTo(ax + nx * w0 * 1.05 + ux * 8 * s, ay + ny * w0 * 1.05 + uy * 8 * s, bx + nx * w1, by + ny * w1);
      ctx.lineTo(bx - nx * w1, by - ny * w1);
      ctx.quadraticCurveTo(ax - nx * w0 * 1.05 + ux * 8 * s, ay - ny * w0 * 1.05 + uy * 8 * s, ax - nx * w0 * c1, ay - ny * w0 * c1);
      ctx.closePath();
    };
    ctx.fillStyle = body;
    shape(1, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(n.x + ux * 3 * s, n.y + uy * 3 * s, cw * 0.98, 0, TAU); ctx.arc(pv.x, pv.y, ww, 0, TAU); ctx.fill();
    if (!top) return;
    const kind = L.topKind || 'tank';
    ctx.fillStyle = top;
    if (kind === 'vest') {
      // open down the middle: two panels, the chest shows between them
      for (const sd of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(n.x + nx * cw * sd, n.y + ny * cw * sd);
        ctx.lineTo(pv.x + nx * ww * sd, pv.y + ny * ww * sd);
        ctx.lineTo(pv.x + nx * ww * sd * 0.25, pv.y + ny * ww * sd * 0.25);
        ctx.lineTo(n.x + nx * cw * sd * 0.35 + ux * 10 * s, n.y + ny * cw * sd * 0.35 + uy * 10 * s);
        ctx.closePath(); ctx.fill();
      }
    } else {
      shape(1, 1, kind === 'tank' ? 0.12 : 0, 1.04); ctx.fill();
      if (kind !== 'tank') { ctx.beginPath(); ctx.arc(n.x + ux * 3 * s, n.y + uy * 3 * s, cw * 0.98, 0, TAU); ctx.fill(); }
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

  // hair shapes on the head (long hair and ponytails are cloth chains)
  drawHair(ctx, hd, col, mono) {
    const L = this.def.look, kind = L.hair;
    if (!kind) return;
    const s = this.s, f = this.facing, hr = HEAD_R * s;
    ctx.fillStyle = col;
    const top = hd.y - hr * 1.02;
    if (kind === 'tuft') {
      ctx.beginPath(); ctx.moveTo(hd.x - f * hr * 1.05, hd.y - hr * 0.2);
      ctx.quadraticCurveTo(hd.x - f * hr * 1.1, top - 4 * s, hd.x + f * hr * 0.2, top - 3 * s);
      ctx.quadraticCurveTo(hd.x + f * hr * 1.1, top - 6 * s, hd.x + f * hr * 1.15, top + 6 * s);
      ctx.quadraticCurveTo(hd.x + f * hr * 0.4, top + 3 * s, hd.x - f * hr * 0.3, hd.y - hr * 0.45); ctx.closePath(); ctx.fill();
    } else if (kind === 'spikes') {
      ctx.beginPath(); ctx.moveTo(hd.x - f * hr * 1.05, hd.y - hr * 0.1);
      const tips = [[-1.25, -0.6], [-0.75, -1.45], [-0.15, -1.62], [0.45, -1.48], [1.0, -1.05]];
      let px = -1.0, py = -0.75;
      for (const [tx, ty] of tips) { ctx.lineTo(hd.x + f * hr * tx, hd.y + hr * ty); px += 0.5; ctx.lineTo(hd.x + f * hr * (tx + 0.3), hd.y + hr * (ty + 0.55)); }
      ctx.lineTo(hd.x + f * hr * 1.05, hd.y - hr * 0.4); ctx.lineTo(hd.x - f * hr * 0.5, hd.y - hr * 0.5); ctx.closePath(); ctx.fill();
    } else if (kind === 'topknot' || kind === 'buns') {
      ctx.beginPath(); ctx.ellipse(hd.x, hd.y - hr * 0.55, hr * 1.04, hr * 0.62, 0, Math.PI, 0); ctx.fill();
      const knots = kind === 'buns' ? [[-0.75, -1.05], [0.65, -1.15]] : [[-0.25, -1.35]];
      for (const [kx, ky] of knots) { ctx.beginPath(); ctx.arc(hd.x + f * hr * kx, hd.y + hr * ky, hr * (kind === 'buns' ? 0.45 : 0.42), 0, TAU); ctx.fill(); }
      if (kind === 'topknot' && !mono) { ctx.fillStyle = this.accent(); ctx.fillRect(hd.x - f * hr * 0.25 - 2 * s, hd.y - hr * 1.02, 4 * s, 3 * s); }
    } else if (kind === 'mohawk') {
      ctx.beginPath(); ctx.moveTo(hd.x - f * hr * 0.9, hd.y - hr * 0.5);
      ctx.quadraticCurveTo(hd.x - f * hr * 0.6, top - hr * 0.9, hd.x + f * hr * 0.75, top - hr * 0.35);
      ctx.lineTo(hd.x + f * hr * 0.4, top + 4 * s); ctx.quadraticCurveTo(hd.x - f * hr * 0.2, top + 2 * s, hd.x - f * hr * 0.9, hd.y - hr * 0.5); ctx.fill();
    } else if (kind === 'buzz' || kind === 'long' || kind === 'ponytail' || kind === 'part') {
      ctx.beginPath(); ctx.ellipse(hd.x - f * hr * 0.08, hd.y - hr * 0.42, hr * 1.06, hr * 0.72, 0, Math.PI, 0); ctx.fill();
      if (kind !== 'buzz') { ctx.beginPath(); ctx.ellipse(hd.x - f * hr * 0.55, hd.y - hr * 0.2, hr * 0.55, hr * 0.62, 0, 0, TAU); ctx.fill(); }
      if (kind === 'part') { ctx.beginPath(); ctx.moveTo(hd.x - f * hr * 0.2, top); ctx.quadraticCurveTo(hd.x + f * hr * 1.0, top - 2 * s, hd.x + f * hr * 1.08, hd.y - hr * 0.05); ctx.lineTo(hd.x + f * hr * 0.55, hd.y - hr * 0.5); ctx.closePath(); ctx.fill(); }
    }
    if (L.horns) {
      ctx.fillStyle = mono || '#2c2622';
      for (const sd of [-0.55, 0.55]) { ctx.beginPath(); ctx.moveTo(hd.x + hr * sd - 4 * s, top + 4 * s); ctx.quadraticCurveTo(hd.x + hr * sd * 1.6, top - 10 * s, hd.x + hr * sd * 1.25 + f * 4 * s, top - 18 * s); ctx.lineTo(hd.x + hr * sd + 4 * s, top + 3 * s); ctx.fill(); }
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
      ctx.fillStyle = mono || '#2c2c34';
      ctx.fillRect(hd.x - hr * 1.02, hd.y - hr * 0.78, hr * 2.04, 4 * s);
      for (const sd of [0.1, 0.62]) { ctx.fillStyle = mono || '#2c2c34'; ctx.beginPath(); ctx.arc(hd.x + f * hr * sd, hd.y - hr * 0.72, 5.2 * s, 0, TAU); ctx.fill(); if (!mono) { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(hd.x + f * hr * sd, hd.y - hr * 0.72, 3 * s, 0, TAU); ctx.fill(); } }
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
      const hc = this.def.look.hoodC;
      ctx.fillStyle = mono || (this.stopT > 0 ? '#86868e' : hc ? (this.alt ? mixHex(hc, '#000000', 0.2) : hc) : '#d6cab4');
      ctx.beginPath();
      ctx.moveTo(hd.x - hr - 3 * s, hd.y + hr * 0.4);
      ctx.quadraticCurveTo(hd.x - hr * 0.4, hd.y - hr * 1.8, hd.x - f * hr * 0.9, hd.y - hr * 2.4);
      ctx.quadraticCurveTo(hd.x + hr * 0.6, hd.y - hr * 1.2, hd.x + hr + 3 * s, hd.y + hr * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = acc;
      ctx.fillRect(hd.x - hr - 1 * s, hd.y - hr * 0.1, hr * 2 + 2 * s, 3.5 * s);
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
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * s;
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
    if (!mono) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = acc; ctx.globalAlpha *= 0.5; ctx.lineWidth = (wide ? 16 : 10) * s;
      ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
      ctx.globalAlpha /= 0.5;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = mono || acc; ctx.lineWidth = (wide ? 9 : 5) * s;
    ctx.beginPath(); ctx.moveTo(w.x0, w.y0); ctx.lineTo(w.x1, w.y1); ctx.stroke();
    if (!mono) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (wide ? 3 : 2) * s;
      ctx.beginPath(); ctx.moveTo(lerp(w.x0, w.x1, 0.15), lerp(w.y0, w.y1, 0.15)); ctx.lineTo(w.x1, w.y1); ctx.stroke();
    }
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
