'use strict';
/* =========================================================================
   Stages: procedural parallax backdrops in world space, and fighter
   portraits (drawn from a posed ragdoll) for the UI and super cut-ins.
   ========================================================================= */

const Stage = (() => {
  const cache = {};
  function prepare(id) {
    if (cache[id]) return cache[id];
    const rnd = mulberry32(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const d = { far: [], near: [], deco: [], stars: [], petals: [] };
    for (let i = 0; i < 26; i++) d.far.push({ x: -1400 + i * 180 + rnd() * 80, h: 120 + rnd() * 220, w: 160 + rnd() * 200 });
    for (let i = 0; i < 22; i++) d.near.push({ x: -1400 + i * 230 + rnd() * 90, h: 90 + rnd() * 260, w: 110 + rnd() * 140, win: rnd() });
    for (let i = 0; i < 120; i++) d.stars.push({ x: -1600 + rnd() * 4800, y: rnd() * 560, r: 0.6 + rnd() * 1.8, tw: rnd() * 6 });
    for (let i = 0; i < 46; i++) d.petals.push({ x: rnd() * 3200 - 800, y: rnd() * 900, s: 0.5 + rnd(), ph: rnd() * TAU });
    for (let i = 0; i < 14; i++) d.deco.push({ x: -800 + i * 260 + rnd() * 120, s: 0.6 + rnd() * 0.7, k: rnd() });
    cache[id] = d;
    return d;
  }

  function skyGrad(ctx, st, vr) {
    const g = ctx.createLinearGradient(0, vr.y0, 0, GROUND);
    g.addColorStop(0, st.sky[0]); g.addColorStop(0.6, st.sky[1]); g.addColorStop(1, st.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(vr.x0 - 10, vr.y0 - 10, vr.x1 - vr.x0 + 20, GROUND - vr.y0 + 20);
  }

  function floor(ctx, st, vr) {
    const top = GROUND;
    const g = ctx.createLinearGradient(0, top, 0, vr.y1);
    g.addColorStop(0, st.ground); g.addColorStop(1, mixHex(st.ground, '#000000', 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(vr.x0 - 10, top, vr.x1 - vr.x0 + 20, vr.y1 - top + 10);
    // perspective lines converging on a far vanishing point
    ctx.strokeStyle = st.line; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) {
      const x = 800 + i * 140;
      ctx.moveTo(800 + i * 40, top); ctx.lineTo(x + i * 120, top + 400);
    }
    for (let j = 1; j < 6; j++) { const y = top + j * j * 9; ctx.moveTo(vr.x0, y); ctx.lineTo(vr.x1, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(vr.x0, top, vr.x1 - vr.x0, 3);
    // the arena walls are marked so ring position reads
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(WALL_L - 400, top - 2, 400, 200); ctx.fillRect(WALL_R, top - 2, 400, 200);
  }

  function mountains(ctx, list, color, base, par, cam, peak) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const off = (cam.x - 800) * par;
    ctx.moveTo(-1600 + off, base + 400);
    for (const m of list) {
      const x = m.x + off;
      ctx.lineTo(x - m.w / 2, base);
      ctx.lineTo(x, base - m.h * peak);
      ctx.lineTo(x + m.w / 2, base);
    }
    ctx.lineTo(3200 + off, base); ctx.lineTo(3200 + off, base + 400);
    ctx.closePath(); ctx.fill();
  }

  function draw(ctx, id, vr, time, cam) {
    const st = STAGES[id] || STAGES.dojo, d = prepare(id);
    skyGrad(ctx, st, vr);
    if (id === 'dojo') {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ffe1a0', 800 + (cam.x - 800) * 0.9, 420, 520, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = st.sun; ctx.beginPath(); ctx.arc(800 + (cam.x - 800) * 0.9, 430, 120, 0, TAU); ctx.fill();
      mountains(ctx, d.far, st.far, 640, 0.75, cam, 1.1);
      mountains(ctx, d.near, st.near, 720, 0.55, cam, 0.6);
      // dojo hall
      const ox = (cam.x - 800) * 0.3;
      ctx.fillStyle = '#4a2a1c'; ctx.fillRect(420 + ox, 560, 760, 240);
      ctx.fillStyle = '#2b1810';
      ctx.beginPath(); ctx.moveTo(340 + ox, 575); ctx.quadraticCurveTo(800 + ox, 520, 1260 + ox, 575); ctx.lineTo(1180 + ox, 500); ctx.quadraticCurveTo(800 + ox, 430, 420 + ox, 500); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2dcb0';
      for (let i = 0; i < 6; i++) ctx.fillRect(470 + ox + i * 118, 610, 90, 150);
      ctx.strokeStyle = '#4a2a1c'; ctx.lineWidth = 6;
      for (let i = 0; i < 6; i++) { ctx.strokeRect(470 + ox + i * 118, 610, 90, 150); ctx.beginPath(); ctx.moveTo(515 + ox + i * 118, 610); ctx.lineTo(515 + ox + i * 118, 760); ctx.stroke(); }
    } else if (id === 'city') {
      for (const s of d.stars) { ctx.globalAlpha = 0.5 + Math.sin(time * 2 + s.tw) * 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x + (cam.x - 800) * 0.95, s.y * 0.7, s.r, s.r); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8e6ff'; ctx.beginPath(); ctx.arc(1180 + (cam.x - 800) * 0.92, 210, 56, 0, TAU); ctx.fill();
      const layer = (list, col, base, par, winCol) => {
        const off = (cam.x - 800) * par;
        for (const b of list) {
          const x = b.x + off, top = base - b.h;
          ctx.fillStyle = col; ctx.fillRect(x, top, b.w, base - top + 400);
          if (winCol) {
            for (let yy = top + 16; yy < base - 10; yy += 26) for (let xx = x + 12; xx < x + b.w - 14; xx += 22) {
              const on = ((xx * 13 + yy * 7) | 0) % 5 === 0;
              if (on) { ctx.fillStyle = winCol; ctx.fillRect(xx, yy, 10, 12); }
            }
          }
        }
      };
      layer(d.far, st.far, 700, 0.7, 'rgba(255,220,140,0.25)');
      layer(d.near, st.near, 760, 0.45, 'rgba(120,220,255,0.35)');
      const off = (cam.x - 800) * 0.45;
      ctx.globalCompositeOperation = 'lighter';
      d.near.forEach((b, i) => { if (i % 4 === 1) { const c = st.neon[i % 3]; const x = b.x + off + b.w / 2, y = 760 - b.h + 40; Glow.draw(ctx, c, x, y, 90, 0.5 + Math.sin(time * 3 + i) * 0.2); ctx.fillStyle = c; ctx.fillRect(x - 36, y - 8, 72, 16); } });
      ctx.globalCompositeOperation = 'source-over';
    } else if (id === 'temple') {
      mountains(ctx, d.far, st.far, 650, 0.8, cam, 1.3);
      const ox = (cam.x - 800) * 0.4;
      // torii gate
      ctx.fillStyle = '#c8283a';
      ctx.fillRect(560 + ox, 470, 36, 330); ctx.fillRect(1004 + ox, 470, 36, 330);
      ctx.fillRect(520 + ox, 520, 560, 26);
      ctx.beginPath(); ctx.moveTo(480 + ox, 470); ctx.quadraticCurveTo(800 + ox, 450, 1120 + ox, 470); ctx.lineTo(1110 + ox, 440); ctx.quadraticCurveTo(800 + ox, 410, 490 + ox, 440); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a1a'; ctx.fillRect(500 + ox, 432, 600, 10);
      // cherry trees
      for (const t of d.deco) {
        const x = t.x + (cam.x - 800) * 0.2, s = t.s;
        ctx.fillStyle = '#5a3a32'; ctx.fillRect(x - 8 * s, 800 - 200 * s, 16 * s, 200 * s);
        ctx.fillStyle = t.k > 0.5 ? '#ffb7cf' : '#ff9fbf';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.7) * 60 * s, 800 - 220 * s + Math.sin(i * 2.3) * 40 * s, 52 * s, 0, TAU); ctx.fill(); }
      }
    } else if (id === 'void') {
      for (const s of d.stars) { ctx.globalAlpha = 0.4 + Math.sin(time * 3 + s.tw) * 0.4; ctx.fillStyle = '#d9d0ff'; ctx.beginPath(); ctx.arc(s.x + (cam.x - 800) * 0.9, s.y, s.r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const gx = 800 + (cam.x - 800) * 0.85;
      for (let i = 0; i < 5; i++) Glow.draw(ctx, i % 2 ? '#7a3cff' : '#ff4fa3', gx + Math.cos(time * 0.2 + i * 1.3) * 160, 330 + Math.sin(time * 0.2 + i) * 60, 260, 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#120b26';
      for (const r of d.deco) { const x = r.x + (cam.x - 800) * 0.4, y = 420 + Math.sin(time * 0.8 + r.k * 6) * 16 + r.k * 160; ctx.beginPath(); ctx.moveTo(x - 60 * r.s, y); ctx.lineTo(x + 70 * r.s, y - 10); ctx.lineTo(x + 30 * r.s, y + 60 * r.s); ctx.lineTo(x - 20 * r.s, y + 40 * r.s); ctx.closePath(); ctx.fill(); }
    } else if (id === 'crater') {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ff7a2a', 800 + (cam.x - 800) * 0.9, 700, 900, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      mountains(ctx, d.far, st.far, 690, 0.8, cam, 0.9);
      // rock spires
      const ox = (cam.x - 800) * 0.35;
      ctx.fillStyle = st.near;
      for (const r of d.deco) { const x = r.x + ox; ctx.beginPath(); ctx.moveTo(x - 50 * r.s, 800); ctx.lineTo(x - 18 * r.s, 800 - 300 * r.s); ctx.lineTo(x + 10 * r.s, 800 - 330 * r.s); ctx.lineTo(x + 46 * r.s, 800); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 2; i++) if (Math.random() < 0.3) G_fxEmber(cam, vr);
    } else if (id === 'lab') {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = Math.floor(vr.x0 / 80) * 80; x < vr.x1; x += 80) { ctx.moveTo(x, vr.y0); ctx.lineTo(x, GROUND); }
      for (let y = Math.floor(vr.y0 / 80) * 80; y < GROUND; y += 80) { ctx.moveTo(vr.x0, y); ctx.lineTo(vr.x1, y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,201,51,0.6)';
      ctx.fillRect(WALL_L - 6, 300, 6, 500); ctx.fillRect(WALL_R, 300, 6, 500);
    }
    floor(ctx, st, vr);
    if (st.petals) {
      ctx.fillStyle = '#ffc6d9';
      for (const p of d.petals) {
        const y = (p.y + time * 60 * p.s) % 900, x = p.x + Math.sin(time + p.ph) * 40 - time * 30 * p.s % 3200;
        const xx = ((x % 3200) + 3200) % 3200 - 800;
        ctx.save(); ctx.translate(xx, y); ctx.rotate(time * 2 + p.ph);
        ctx.beginPath(); ctx.ellipse(0, 0, 7 * p.s, 3.5 * p.s, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
  }

  function G_fxEmber(cam, vr) {
    if (typeof Game === 'undefined' || !Game.fx) return;
    Game.fx.add({ kind: 'ember', x: rand(vr.x0, vr.x1), y: GROUND + 10, vx: rand(-30, 30), vy: rand(-160, -60), life: rand(1, 2), size: rand(4, 8), color: '#ffb13d' });
  }

  return { prepare, draw };
})();

/* ------------------------------------------------------------- portraits */
const Portraits = (() => {
  const rags = {}, urls = {};
  function rag(def) {
    if (rags[def.id]) return rags[def.id];
    const r = new Rag(def, { x: 0, facing: 1 });
    r.root.y = GROUND; r.t = 0;
    r.pose = { fh: [20, 26], bh: [8, 30], lean: 0, crouch: 0, ff: [16, 0], bf: [-16, 0] };
    r.computeTargets(); r.snapToPose();
    if (r.cape) for (let i = 0; i < r.cape.length; i++) { const n = r.pts[P.NECK]; r.cape[i].x = n.x - 8 - i * 4; r.cape[i].y = n.y + i * 18; }
    rags[def.id] = r;
    return r;
  }
  // draw head and shoulders centred at (x, y) filling roughly `size` px tall
  function drawBig(ctx, def, x, y, size, facing, time, mono) {
    const r = rag(def);
    r.facing = facing;
    r.computeTargets(); r.snapToPose();
    if (r.cape) for (let i = 0; i < r.cape.length; i++) { const n = r.pts[P.NECK]; r.cape[i].x = n.x - facing * (8 + i * 4); r.cape[i].y = n.y + i * 18; }
    const n = r.pts[P.NECK], h = r.pts[P.HEAD];
    const k = size / (70 * r.s);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.translate(-(n.x + h.x) / 2 + facing * 4 * r.s, -n.y + 2 * r.s);
    r.draw(ctx, time || 0, mono);
    ctx.restore();
  }
  function url(def, w = 160, h = 160) {
    const key = def.id + w + 'x' + h;
    if (urls[key]) return urls[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    drawBig(g, def, w * 0.5, h * 0.6, h * 0.95, 1, 0);
    urls[key] = c.toDataURL();
    return urls[key];
  }
  return { drawBig, url };
})();
