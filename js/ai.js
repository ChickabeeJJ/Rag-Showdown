'use strict';
/* =========================================================================
   CPU fighters. A reaction-delayed decision loop: guard against attacks
   and projectiles, keep the fighter's preferred range, poke, zone with
   specials, finish chains (light, light, launcher, special cancel),
   anti-air, throw turtles and spend the super when it will land.
   Level 1..8 scales reaction time, guarding, combo follow-through and aggression.
   ========================================================================= */

class CpuCtrl {
  constructor(level = 3) {
    this.lv = clamp(level, 0, 9);
    this.human = false;
  }
  reset(f) { this.shotPlan = null; this.seen = new WeakSet(); this.zoneHeat = 0; this.stunPlan = null; this.t = rand(0.1, 0.4); this.hold = 0; this.holdT = 0; this.guardT = 0; this.combo = 0; this.lastThreat = 0; this.idleT = 0; }

  update(G, f, dt) {
    const o = G.opp(f);
    if (!o) return;
    const L = this.lv;
    if (L <= 0) { f.input.x = 0; return; }
    const react = lerp(0.46, 0.09, L / 9);
    const dx = o.root.x - f.root.x, d = Math.abs(dx), toward = Math.sign(dx) || f.facing;
    const s = f.s;
    this.t -= dt; this.holdT -= dt; this.guardT -= dt;

    // ----- defence out of hitstun or blockstun, the way a person plays it:
    // keep holding back so the next button is blocked, or mash a reversal
    // jab that beats an attacker who keeps pressing after a minus string
    if (f.mode === 'hit' || f.mode === 'block') {
      if (!this.stunPlan) {
        const r = Math.random(), pRev = 0.05 + L * 0.03, pGuard = Math.min(0.9, 0.3 + L * 0.075);
        this.stunPlan = r < pRev ? 'jab' : r < pRev + pGuard ? 'guard' : 'none';
        this.revDone = false;
      }
      if (this.stunPlan === 'guard') { this.hold = -toward; this.holdT = Math.max(this.holdT, f.stunT + 0.28); this.guardT = this.holdT; }
      if (this.stunPlan === 'jab' && !this.revDone && f.stunT < 0.12 && d < 260 * s / 2) { this.revDone = true; G.press(f.side, 'l'); }
    } else if (f.mode === 'active') this.stunPlan = null;

    // ----- continue a combo that is connecting (works off real hit confirms)
    const act = f.action;
    if (act && act.connected && act.t >= act.w && Math.random() < 0.25 + L * 0.085) {
      const k = act.key;
      const sp = this.pickSpecial(G, f, o, d, true);
      if (k === 'l1') G.press(f.side, 'l');
      else if (k === 'l2') G.press(f.side, Math.random() < 0.7 ? 'h' : (sp || 'h'));
      else if (k === 'hEnd' && L >= 5 && Math.random() < 0.35 && o.mode === 'tumble') { G.press(f.side, 'jump'); this.airChase = 3; }
      else if (k === 'hEnd' || k === 'h') { if (f.meter >= 100 && this.superFits(f, d + 120) && Math.random() < 0.4 + L * 0.06) G.press(f.side, 'sup'); else if (sp) G.press(f.side, sp); }
      else if (k === 'airL' && this.airChase > 0) { this.airChase--; G.press(f.side, this.airChase > 0 ? 'l' : 'h'); }
      else if (act.move.kind === 'special' && f.meter >= 100 && this.superFits(f, d) && L >= 5) G.press(f.side, 'sup');
    }

    // ----- time stopped or opponent helpless: rush in
    const helpless = o.stopT > 0.3 || (o.mode === 'hit' && o.stunT > 0.2) || (o.mode === 'tumble' && o.airborneHit && o.juggle < 4);

    // ----- projectiles, read the way a player reads a fireball: it is on screen
    // long before it lands, so the CPU sees it coming, doesn't walk or swing into
    // it, blocks it or jumps it, then uses the thrower's recovery to close in.
    // A fighter who keeps throwing heats up the CPU, which then rushes them down.
    this.zoneHeat = Math.max(0, this.zoneHeat - dt * 0.12);
    for (const p of G.projs) if (p.owner === o && !this.seen.has(p)) { this.seen.add(p); if (p.strength < 9) this.zoneHeat = Math.min(4, this.zoneHeat + 1); }
    const shot = this.incoming(G, f, o);
    if (shot && f.root.grounded && f.mode === 'active') {
      if (!this.shotPlan || this.shotPlan.p !== shot.p) {
        const r = Math.random();
        const pJump = d > 300 * s / 2 && shot.p.r < 80 && !shot.big ? Math.min(0.55, 0.06 + L * 0.045 + this.zoneHeat * 0.06) : 0;
        const pBlock = Math.min(0.97, 0.62 + L * 0.05);
        this.shotPlan = { p: shot.p, kind: r < pJump ? 'jump' : r < pJump + (1 - pJump) * pBlock ? 'guard' : 'none' };
      }
      const plan = this.shotPlan.kind;
      if (plan !== 'none') this.t = Math.max(this.t, shot.tti + 0.08);   // don't start anything that would eat it
      if (plan === 'guard' && !act) { this.hold = -toward; this.holdT = Math.max(this.holdT, shot.tti + 0.22); this.guardT = this.holdT; }
      if (plan === 'jump' && !act && shot.tti < 0.34 && shot.tti > 0.08) { this.shotPlan.kind = 'done'; G.press(f.side, 'jump'); this.hold = toward; this.holdT = 0.55; this.airAttack = true; }
      if (plan === 'jump' && shot.tti <= 0.08 && !act) { this.shotPlan.kind = 'guard'; this.hold = -toward; this.holdT = 0.3; this.guardT = 0.3; }
    } else if (!shot) this.shotPlan = null;
    // the throw itself is the tell: a ranged move's wind-up is big and readable, so
    // block on the startup (that's what stops point-blank fireballs) instead of
    // waiting to see the projectile
    const oa0 = o.action;
    if (oa0 && o.mode === 'active' && oa0.move.kind !== 'super' && (oa0.move.ranged || (oa0.move.ai && oa0.move.ai.zone)) && oa0.t < oa0.w + oa0.a && f.root.grounded && d < 900) {
      if (!this.startPlan || this.startPlan.a !== oa0) this.startPlan = { a: oa0, go: Math.random() < Math.min(0.92, 0.45 + L * 0.06 + this.zoneHeat * 0.06), at: react * 0.4 };
      if (this.startPlan.go && !act && oa0.t >= this.startPlan.at) { this.hold = -toward; this.holdT = Math.max(this.holdT, 0.4); this.guardT = this.holdT; this.t = Math.max(this.t, 0.25); }
    }

    // ----- guard
    const threat = this.threatOf(G, f, o, d);
    if (threat && !act && f.root.grounded) {
      if (this.lastThreat <= 0) this.lastThreat = react;
    } else this.lastThreat = 0;
    if (this.lastThreat > 0) {
      this.lastThreat -= dt;
      if (this.lastThreat <= 0 && Math.random() < 0.18 + L * 0.085) {
        const def2 = ['sp1', 'sp2'].find(k => f.def.moves[k].ai && f.def.moves[k].ai.defensive && f.cds[k] <= 0);
        if (def2 && Math.random() < 0.3 + L * 0.06) { G.press(f.side, def2 === 'sp1' ? 's1' : 's2'); }
        else if (threat === 'proj' && Math.random() < 0.25 + L * 0.03 && d > 260) { G.press(f.side, 'jump'); this.hold = toward; this.holdT = 0.5; }
        else { this.hold = -toward; this.holdT = 0.32 + Math.random() * 0.2; this.guardT = this.holdT; }
      }
    }

    // ----- decide
    if (this.t <= 0 && !act && f.canAct) {
      this.t = react * rand(0.7, 1.3);
      this.decide(G, f, o, d, toward, helpless);
    }

    // air chase after a launcher jump-cancel
    if (this.airChase > 0 && !f.root.grounded && !act && o.mode === 'tumble' && d < 220 * s / 2) G.press(f.side, 'l');
    if (f.root.grounded && !act) this.airChase = 0;
    // jump-ins: attack on the way down when close
    if (this.airAttack && !f.root.grounded && !act && f.root.vy > -200 && d < 230 * s / 2) { this.airAttack = false; G.press(f.side, Math.random() < 0.7 ? 'h' : 'l'); }
    if (f.root.grounded && !act && this.airAttack && this.holdT <= 0) this.airAttack = false;

    if (this.holdT > 0) f.input.x = this.hold;
    else f.input.x = 0;
    if (!f.root.grounded && this.holdT <= 0) f.input.x = 0;
  }

  // the nearest of the opponent's projectiles heading this way, and how soon it lands
  incoming(G, f, o) {
    let best = null;
    for (const p of G.projs) {
      if (p.owner !== o || p.dead || !p.vx || Math.sign(p.vx) !== Math.sign(f.root.x - p.x)) continue;
      const gap = Math.abs(p.x - f.root.x) - p.r - 30 * f.s / 2;
      const tti = Math.max(0, gap) / Math.abs(p.vx);
      if (tti > 0.8) continue;
      if (!best || tti < best.tti) best = { p, tti, big: p.strength >= 9 };
    }
    return best;
  }

  threatOf(G, f, o, d) {
    if (o.action && o.mode === 'active') {
      const mv = o.action.move;
      const reach = mv.kind === 'super' ? 900 : mv.box ? (Math.abs(mv.box[0]) + mv.box[2] + 40) * o.s : 420;
      if (d < reach && o.action.t < o.action.w + o.action.a) return 'melee';
    }
    for (const p of G.projs) if (p.owner === o && Math.sign(p.vx) === Math.sign(f.root.x - p.x) && Math.abs(p.x - f.root.x) < 520) return 'proj';
    for (const b of G.beams) if (b.owner === o) return 'proj';
    return null;
  }

  superFits(f, d) {
    const r = (f.def.moves.super.ai && f.def.moves.super.ai.range) || [0, 600];
    return d >= r[0] && d <= r[1];
  }

  pickSpecial(G, f, o, d, inCombo) {
    const opts = [];
    for (const k of ['sp1', 'sp2']) {
      const mv = f.def.moves[k];
      if (f.cds[k] > 0) continue;
      if (!f.root.grounded && !mv.air) continue;
      const r = (mv.ai && mv.ai.range) || [0, 400];
      if (d < r[0] - 40 || d > r[1]) continue;
      if (inCombo && mv.ai && mv.ai.zone && d < 200) continue;
      if (mv.ai && mv.ai.defensive) continue;
      opts.push(k === 'sp1' ? 's1' : 's2');
    }
    return opts.length ? pick(opts) : null;
  }

  decide(G, f, o, d, toward, helpless) {
    const L = this.lv, s = f.s, style = f.def.ai.style;
    const pref = f.def.ai.range;
    const rnd = Math.random();
    if (Math.random() < 0.12 - L * 0.012) { this.hold = 0; this.holdT = rand(0.2, 0.5); return; }   // easy CPUs hesitate

    // super when it will connect
    if (f.meter >= 100 && this.superFits(f, d) && o.alive) {
      const sure = helpless || o.mode === 'hit' || (o.action && o.action.t > o.action.w + o.action.a);
      if (sure || rnd < 0.05 + L * 0.035) { G.press(f.side, 'sup'); return; }
    }
    const meleeR = 150 * s / 2 * 1.15 + (f.def.reach || 0) * s;

    // anti-air
    if (!o.root.grounded && o.mode === 'active' && d < 300 && f.root.grounded && rnd < 0.2 + L * 0.07) { G.press(f.side, 'h'); return; }

    // close range
    if (d < meleeR) {
      const turtling = o.mode === 'block' || o.blocking;
      if (turtling && rnd < 0.2 + L * 0.05 && o.root.grounded) { G.press(f.side, 'throw'); return; }
      if (rnd < 0.55) { G.press(f.side, 'l'); return; }
      if (rnd < 0.75) { G.press(f.side, 'h'); return; }
      const sp = this.pickSpecial(G, f, o, d);
      if (sp) { G.press(f.side, sp); return; }
      this.hold = -toward; this.holdT = rand(0.15, 0.35); return;
    }

    // the thrower is stuck in a ranged move's recovery: close the gap now
    const oa = o.action, recovering = oa && oa.move.ranged && oa.t > oa.w + oa.a;
    if (recovering && f.root.grounded && d > meleeR && rnd < 0.5 + L * 0.05) {
      if (d > 520 * s / 2 || rnd < 0.5) { G.press(f.side, 'dashF'); return; }
      G.press(f.side, 'jump'); this.hold = toward; this.holdT = 0.55; this.airAttack = true; return;
    }
    // against a zoner, don't trade fireballs from far away: walk them down
    if (this.zoneHeat >= 1.5 && d > meleeR && !G.projs.some(p => p.owner === o)) {
      if (f.root.grounded && d > 380 && rnd < 0.35 + L * 0.04) { G.press(f.side, 'dashF'); return; }
      this.hold = toward; this.holdT = rand(0.25, 0.45); return;
    }

    // mid / long range
    const sp = this.pickSpecial(G, f, o, d);
    const zoner = style === 'zoner';
    if (sp && rnd < (zoner ? 0.42 : 0.24) + L * 0.02) { G.press(f.side, sp); return; }
    if (d > pref + 60 || helpless) {
      if (f.root.grounded && rnd < 0.18 + (style === 'rush' ? 0.15 : 0) && d > 380) { G.press(f.side, 'dashF'); return; }
      if (f.root.grounded && rnd < 0.08 + (style === 'rush' ? 0.08 : 0) && d > 260 && d < 560) { G.press(f.side, 'jump'); this.hold = toward; this.holdT = 0.5; this.airAttack = true; return; }
      this.hold = toward; this.holdT = rand(0.18, 0.45); return;
    }
    if (d < pref - 80 && zoner) { if (rnd < 0.3) G.press(f.side, 'dashB'); else { this.hold = -toward; this.holdT = rand(0.2, 0.4); } return; }
    // footsies: step in and out
    if (rnd < 0.5) { this.hold = toward; this.holdT = rand(0.12, 0.3); }
    else if (rnd < 0.75) { this.hold = -toward; this.holdT = rand(0.12, 0.3); }
    else { this.hold = 0; this.holdT = rand(0.1, 0.25); }
  }
}

