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
  reset(f) { this.t = rand(0.1, 0.4); this.hold = 0; this.holdT = 0; this.guardT = 0; this.combo = 0; this.lastThreat = 0; this.idleT = 0; }

  update(G, f, dt) {
    const o = G.opp(f);
    if (!o) return;
    const L = this.lv;
    if (L <= 0) { f.input.x = 0; return; }
    const react = lerp(0.46, 0.09, L / 9);
    const dx = o.root.x - f.root.x, d = Math.abs(dx), toward = Math.sign(dx) || f.facing;
    const s = f.s;
    this.t -= dt; this.holdT -= dt; this.guardT -= dt;

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

