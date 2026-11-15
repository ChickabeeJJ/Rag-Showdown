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
const WALL_L = 60;
const WALL_R = 1540;
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
    this.cape = null;
    if (def.look.cape) {
      this.cape = [];
      for (let i = 0; i < 7; i++) this.cape.push({ x: o.x, y: GROUND - 200, px: o.x, py: GROUND - 200 });
    }
  }

  snapToPose() {
    for (let i = 0; i < 11; i++) { const p = this.pts[i]; p.x = p.px = this.T[i].x; p.y = p.py = this.T[i].y; this.Tp[i].x = this.T[i].x; this.Tp[i].y = this.T[i].y; }
    if (this.cape) { const n = this.pts[P.NECK]; for (const c of this.cape) { c.x = c.px = n.x; c.y = c.py = n.y; } }
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
    if (this.cape) this.stepCape(dt);
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
    if (r.grounded && Math.abs(r.vx) > 30 && !this.action) this.walkPh += r.vx * this.facing * dt * 0.05 / this.s;
  }

  basePose() {
    const r = this.root;
    if (this.pose) return mergePose(GUARD, POSES[this.pose] || this.pose);
    if (this.mode === 'hit') return mergePose(GUARD, POSES.hurt);
    if (this.mode === 'block' || this.blocking) return mergePose(GUARD, POSES.block);
    if (!r.grounded) {
      const tuck = clamp(-r.vy * 0.012 / this.s, -8, 16);
      return mergePose(GUARD, { ff: [16, -26 - tuck], bf: [-10, -12 - tuck * 0.5], fh: [22, 4], bh: [10, 10], crouch: 0 });
    }
    if (this.dashT > 0) return mergePose(GUARD, { lean: Math.sign(this.dashV) * this.facing * 14, crouch: 14 });
    const moving = Math.abs(r.vx) > 40 * this.s;
    if (moving) {
      const a = this.walkPh;
      return mergePose(GUARD, {
        ff: [20 + Math.sin(a) * 15, -Math.max(0, Math.cos(a)) * 12],
        bf: [-18 + Math.sin(a + Math.PI) * 15, -Math.max(0, Math.cos(a + Math.PI)) * 12],
        lean: clamp(r.vx * this.facing * 0.012 / this.s, -6, 8),
      });
    }
    return GUARD;
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
    const bob = this.idle && r.grounded ? Math.sin(this.t * 4.2) * 2.2 * s : 0;
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
    this.m = 0.05;
    this.juggle = 0;
  }

  stepCape(dt) {
    const c = this.cape, n = this.pts[P.NECK];
    const L = 9 * this.s;
    const ax = n.x - this.facing * 3 * this.s, ay = n.y + 3 * this.s;
    c[0].x = ax; c[0].y = ay;
    const g = 1400 * this.s * dt * dt;
    const wind = Math.sin(this.t * 1.7) * 0.12 - this.facing * 0.18;
    for (let i = 1; i < c.length; i++) {
      const p = c[i];
      const vx = (p.x - p.px) * 0.93, vy = (p.y - p.py) * 0.93;
      p.px = p.x; p.py = p.y;
      p.x += vx + wind; p.y += vy + g;
      if (p.y > GROUND - 2) p.y = GROUND - 2;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < c.length; i++) {
        const a = c[i - 1], b = c[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4;
        const diff = (d - L) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
      c[0].x = ax; c[0].y = ay;
    }
    for (const p of c) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { p.x = p.px = ax; p.y = p.py = ay; }
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
    const s = this.s, pts = this.pts;
    if (this.hidden) return;
    const fade = (this.mode === 'dead' && this.fadeOut ? clamp(1 - (this.deadT - 2.5) / 1, 0, 1) : 1) * this.alpha;
    if (fade <= 0) return;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake * 0.4);
    ctx.globalAlpha *= fade * (this.invuln > 0 && this.mode === 'rising' ? 0.7 : 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const fl = mono ? 0 : this.flash;
    const stopped = this.stopT > 0 && !mono;
    const dark = this.surge > 0 && this.def.look.surge && this.def.look.surge.dark;
    const baseBody = stopped ? '#a3a3ab' : dark ? '#3a3a44' : this.alt ? '#e4ddcf' : '#f7f2e7';
    const baseShade = stopped ? '#86868e' : dark ? '#2a2a32' : this.alt ? '#c2b7a2' : '#d6cab4';
    const body = mono || (fl > 0 ? mixHex(baseBody, '#ffffff', fl) : baseBody);
    const shade = mono || (fl > 0 ? mixHex(baseShade, '#ffffff', fl) : baseShade);
    const acc = mono || this.accent();
    const seg = (a, b, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w * s;
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
    };
    const plated = this.def.look.gear === 'helmet' || this.def.look.gear === 'crest';
    const cuff = (e, h, col) => {
      const E = pts[e], Hh = pts[h];
      ctx.strokeStyle = col; ctx.lineWidth = (plated ? 15.5 : 11.5) * s;
      ctx.beginPath();
      ctx.moveTo(lerp(E.x, Hh.x, plated ? 0.43 : 0.56), lerp(E.y, Hh.y, plated ? 0.43 : 0.56));
      ctx.lineTo(lerp(E.x, Hh.x, 0.83), lerp(E.y, Hh.y, 0.83));
      ctx.stroke();
    };
    if (this.cape) this.drawCape(ctx, acc);
    if (!mono && (this.surge > 0 || this.auraT > 0)) this.drawAura(ctx, time);
    // back limbs in the shade tone
    seg(2, 9, 13, shade); seg(9, 10, 11, shade);
    seg(1, 5, 11, shade); seg(5, 6, 9.5, shade);
    cuff(P.BELB, P.BHAND, acc);
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(pts[P.BHAND].x, pts[P.BHAND].y, 5.3 * s, 0, TAU); ctx.fill();
    // torso, front leg, head
    seg(1, 2, 22, body);
    seg(2, 7, 13.5, body); seg(7, 8, 11.5, body);
    const hd = pts[P.HEAD], hr = HEAD_R * s;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(hd.x - hr, hd.y - hr * 1.05, hr * 2, hr * 2.1, hr * 0.8); ctx.fill();
    this.drawHeadgear(ctx, hd, time, acc, mono);
    // front arm on top, with the blade if the fighter carries one
    if (!this.hideArm) {
      seg(1, 3, 11, body); seg(3, 4, 9.5, body);
      cuff(P.FELB, P.FHAND, acc);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(pts[P.FHAND].x, pts[P.FHAND].y, 5.8 * s, 0, TAU); ctx.fill();
    }
    if (this.def.look.weapon) this.drawWeapon(ctx, acc, mono);
    if (!mono && !stopped && this.alive) {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, acc, pts[P.FHAND].x, pts[P.FHAND].y, 16 * s, 0.45);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!mono && this.mode === 'block' && this.stunT > 0) {
      const c = this.chest(), f = this.facing;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * Math.min(1, this.stunT * 5);
      ctx.strokeStyle = '#8fd6ff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(c.x + f * 20 * s, c.y, 46 * s, -1.1, 1.1); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
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
      ctx.fillStyle = mono || (this.stopT > 0 ? '#86868e' : '#d6cab4');
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
    } else {
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
      const hd = this.pts[P.HEAD], f = this.facing, s = this.s;
      this.drawBlade(ctx, { x0: hd.x - f * 4 * s, y0: hd.y + 5 * s, x1: hd.x + f * 46 * s, y1: hd.y + 2 * s }, acc, mono, false);
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

  drawCape(ctx, color) {
    const c = this.cape;
    ctx.fillStyle = color;
    ctx.beginPath();
    const w0 = 8 * this.s;
    const left = [], right = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const w = w0 * (1 - i / c.length * 0.4);
      left.push([c[i].x - dy / l * w, c[i].y + dx / l * w]);
      right.push([c[i].x + dy / l * w, c[i].y - dx / l * w]);
    }
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
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
