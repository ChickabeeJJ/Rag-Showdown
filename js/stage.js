'use strict';
/* =========================================================================
   Stages: layered parallax backdrops in the spirit of Element Rag's
   Backdrop. Far, mid and near layers are painted once into offscreen
   canvases (the far ones at lower resolution, which softens them like
   depth of field), with haze between layers. Each frame adds the sky,
   light (sun glow, god rays, neon, aurora, spotlights), animated props,
   the floor, weather particles and a foreground frame.
   ========================================================================= */

const Stage = (() => {
  const X0 = -1100, X1 = 2700, SPAN = X1 - X0;
  const cache = {};

  /* ------------------------------------------------------------ helpers */
  function layer(q, fn, h = GROUND + 10) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(SPAN * q); c.height = Math.ceil(h * q);
    const g = c.getContext('2d');
    g.setTransform(q, 0, 0, q, -X0 * q, 0);
    fn(g);
    return { c, q, h };
  }
  function ridge(g, base, amp, color, rnd, opts = {}) {
    const ph = [rnd() * 10, rnd() * 10, rnd() * 10];
    const f1 = opts.f1 || 0.0021, f2 = opts.f2 || 0.0057, f3 = opts.f3 || 0.013;
    const y = x => {
      let n = Math.sin(x * f1 + ph[0]) * 0.55 + Math.sin(x * f2 + ph[1]) * 0.3 + Math.sin(x * f3 + ph[2]) * 0.15;
      if (opts.peaky) n = 1 - Math.abs(n) * 2;
      return base - n * amp;
    };
    g.fillStyle = color;
    g.beginPath(); g.moveTo(X0, GROUND + 20);
    for (let x = X0; x <= X1; x += 10) g.lineTo(x, y(x));
    g.lineTo(X1, GROUND + 20); g.closePath(); g.fill();
    return y;
  }
  function haze(g, top, bottom, color, a) {
    const gr = g.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(1, rgba(color, a));
    g.fillStyle = gr; g.fillRect(X0, top, SPAN, bottom - top);
  }
  function snowcap(g, yfn, x0, x1, thr, col) {
    g.fillStyle = col;
    g.beginPath();
    let open = false;
    const pts = [];
    for (let x = x0; x <= x1; x += 8) {
      const y = yfn(x), dep = clamp((thr - y) * 0.55, 0, 70);
      if (dep > 1) { pts.push([x, y, dep]); open = true; }
      else if (open) { flush(); open = false; }
    }
    if (open) flush();
    function flush() {
      if (pts.length < 2) { pts.length = 0; return; }
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) g.lineTo(x, y - 1);
      for (let i = pts.length - 1; i >= 0; i--) { const [x, y, dep] = pts[i]; g.lineTo(x, y + dep * (0.75 + 0.25 * Math.sin(x * 0.08))); }
      g.closePath(); g.fill();
      pts.length = 0;
    }
  }
  function pine(g, x, base, h, col) {
    g.fillStyle = col;
    for (let i = 0; i < 4; i++) {
      const w = h * (0.42 - i * 0.07), y = base - h * (0.18 + i * 0.22);
      g.beginPath(); g.moveTo(x - w, y + h * 0.26); g.lineTo(x, y - h * 0.12); g.lineTo(x + w, y + h * 0.26); g.closePath(); g.fill();
    }
    g.fillRect(x - h * 0.03, base - h * 0.2, h * 0.06, h * 0.2);
  }
  function pagoda(g, x, base, h, col) {
    g.fillStyle = col;
    const tiers = 5, th = h / tiers;
    for (let i = 0; i < tiers; i++) {
      const w = h * (0.34 - i * 0.05), y = base - i * th;
      g.fillRect(x - w * 0.55, y - th * 0.7, w * 1.1, th * 0.7);
      g.beginPath(); g.moveTo(x - w * 1.1, y - th * 0.62); g.quadraticCurveTo(x, y - th * 1.05, x + w * 1.1, y - th * 0.62); g.lineTo(x + w * 0.9, y - th * 0.9); g.quadraticCurveTo(x, y - th * 1.15, x - w * 0.9, y - th * 0.9); g.closePath(); g.fill();
    }
    g.fillRect(x - 2, base - h - th * 0.6, 4, th * 0.8);
  }
  function cloud(g, x, y, s, col, a) {
    g.fillStyle = rgba(col, a);
    for (const [dx, dy, r] of [[0, 0, 60], [55, 10, 46], [-55, 12, 44], [100, 22, 32], [-100, 24, 30], [25, -24, 42]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
  }
  function glowDisc(ctx, x, y, r, col, a) { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, col, x, y, r, a); ctx.globalCompositeOperation = 'source-over'; }
  function drawLayer(ctx, L, cam, par, vr) {
    const off = (cam.x - 800) * par;
    ctx.drawImage(L.c, X0 + off, 0, SPAN, L.h);
    // sky below the painted layers never shows: layers are opaque to the floor
  }
  function rays(ctx, x, y, col, a, time, n = 9, len = 1400, spread = 1.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = Math.PI / 2 + (n > 1 ? i / (n - 1) - 0.5 : 0) * spread + Math.sin(time * 0.2 + i) * 0.03;
      const w = 0.035 + (i % 3) * 0.015;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.addColorStop(0, rgba(col, a * (0.6 + 0.4 * Math.sin(time * 0.7 + i * 1.7))));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang - w) * len, y + Math.sin(ang - w) * len);
      ctx.lineTo(x + Math.cos(ang + w) * len, y + Math.sin(ang + w) * len);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------- stage art */
  const ART = {
    dojo: {
      sky: ['#f59a5c', '#ffc98a', '#ffe9be'], fog: '#ffd2a0', amb: 'dust', sun: [800, 470, '#fff3cf'],
      build(d, rnd) {
        d.far = layer(0.45, g => {
          const y0 = ridge(g, 560, 120, '#e3936a', rnd, { peaky: true }); haze(g, 420, 800, '#ffd2a0', 0.45);
          pagoda(g, 300, y0(300) + 10, 150, '#c97a58'); pagoda(g, 1500, y0(1500) + 10, 120, '#c97a58');
          ridge(g, 640, 90, '#c66e4c', rnd); haze(g, 540, 800, '#ffc890', 0.35);
        });
        d.mid = layer(0.6, g => {
          const y = ridge(g, 700, 50, '#8f4a35', rnd, { f1: 0.004 });
          for (let x = X0; x < X1; x += 38 + rnd() * 40) pine(g, x, y(x) + 8, 80 + rnd() * 90, '#6c3426');
          haze(g, 600, 800, '#ffb27a', 0.25);
        });
        d.near = layer(0.85, g => {
          // the dojo hall: stone base, pillars, lit paper doors and a sweeping double roof
          const L = 330, R = 1270;
          g.fillStyle = '#5b5148'; g.fillRect(L - 30, 760, R - L + 60, 40);
          g.fillStyle = '#4a2a1c'; g.fillRect(L, 560, R - L, 200);
          for (let i = 0; i < 7; i++) {
            const x = L + 20 + i * 130;
            g.fillStyle = '#f7dca4'; g.fillRect(x, 585, 110, 165);
            g.strokeStyle = '#6a3a24'; g.lineWidth = 5; g.strokeRect(x, 585, 110, 165);
            g.lineWidth = 2.5; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 27.5, 585); g.lineTo(x + k * 27.5, 750); g.stroke(); }
            for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x, 585 + k * 33); g.lineTo(x + 110, 585 + k * 33); g.stroke(); }
          }
          g.fillStyle = '#3a2016'; for (let i = 0; i <= 7; i++) g.fillRect(L + 6 + i * 130, 555, 14, 205);
          const roof = (y, w, h, col) => {
            g.fillStyle = col;
            g.beginPath(); g.moveTo(800 - w, y + 18); g.quadraticCurveTo(800 - w * 0.55, y - 6, 800 - w * 0.4, y - h); g.lineTo(800 + w * 0.4, y - h); g.quadraticCurveTo(800 + w * 0.55, y - 6, 800 + w, y + 18); g.lineTo(800 + w - 40, y + 28); g.lineTo(800 - w + 40, y + 28); g.closePath(); g.fill();
          };
          roof(548, 560, 70, '#2b1710'); g.fillStyle = '#4a2a1c'; g.fillRect(560, 430, 480, 60); roof(440, 330, 70, '#2b1710');
          g.fillStyle = '#d9a441'; g.fillRect(760, 448, 80, 34); g.fillStyle = '#2b1710'; g.fillRect(768, 454, 64, 22);
          // side walls and a stone path
          g.fillStyle = '#6d4632'; g.fillRect(X0, 690, L - 30 - X0, 110); g.fillRect(R + 30, 690, X1 - R - 30, 110);
          g.fillStyle = '#4f3022'; for (let x = X0; x < X1; x += 60) { if (x > L - 40 && x < R + 30) continue; g.fillRect(x, 684, 50, 10); }
        });
        d.floor = 'wood';
      },
      front(ctx, d, time, vr, cam) {
        // hanging lanterns that sway and glow
        const off = (cam.x - 800) * 0.3;
        for (let i = 0; i < 6; i++) {
          const x = 395 + i * 162 + off, sw = Math.sin(time * 1.3 + i) * 5;
          ctx.strokeStyle = '#2b1710'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x + sw, 590); ctx.stroke();
          glowDisc(ctx, x + sw, 606, 70, '#ffb347', 0.5 + Math.sin(time * 3 + i) * 0.08);
          ctx.fillStyle = '#e8402c'; ctx.beginPath(); ctx.ellipse(x + sw, 606, 13, 17, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2b1710'; ctx.fillRect(x + sw - 8, 588, 16, 4); ctx.fillRect(x + sw - 8, 620, 16, 4);
        }
      },
    },
    city: {
      sky: ['#05071a', '#1a1240', '#55255e'], fog: '#7a3a7a', amb: 'rain', moon: [1180, 200],
      build(d, rnd) {
        const tower = (g, x, w, top, base, col, win, wc) => {
          g.fillStyle = col; g.fillRect(x, top, w, base - top);
          if (rnd() < 0.4) { g.fillRect(x + w * 0.45, top - 40, 4, 40); }
          if (win) for (let y = top + 12; y < base - 8; y += 16) for (let xx = x + 6; xx < x + w - 8; xx += 12) if (rnd() < win) { g.fillStyle = wc[Math.floor(rnd() * wc.length)]; g.fillRect(xx, y, 6, 8); }
        };
        d.far = layer(0.45, g => {
          for (let x = X0; x < X1; x += 40 + rnd() * 50) tower(g, x, 40 + rnd() * 60, 380 + rnd() * 220, 800, '#1c1840', 0.2, ['rgba(255,214,140,0.45)', 'rgba(150,200,255,0.4)']);
          haze(g, 350, 800, '#8a3a8a', 0.35);
        });
        d.mid = layer(0.6, g => {
          for (let x = X0; x < X1; x += 90 + rnd() * 90) {
            const w = 90 + rnd() * 110, top = 300 + rnd() * 260;
            tower(g, x, w, top, 800, '#110f28', 0.3, ['rgba(255,220,150,0.6)', 'rgba(120,220,255,0.55)', 'rgba(255,120,200,0.5)']);
            d.signs.push({ x: x + w * (0.2 + rnd() * 0.5), y: top + 30 + rnd() * 120, w: 26 + rnd() * 20, h: 70 + rnd() * 90, c: ['#ff4fa3', '#4fd8ff', '#ffd34d', '#8a6bff'][Math.floor(rnd() * 4)], ph: rnd() * 6, vert: rnd() < 0.6 });
          }
          haze(g, 500, 800, '#5a2a6a', 0.3);
        });
        d.near = layer(0.85, g => {
          // rooftop: parapet, water tower, vents and pipes
          g.fillStyle = '#2a2a3c'; g.fillRect(X0, 720, SPAN, 80);
          g.fillStyle = '#34344a'; g.fillRect(X0, 712, SPAN, 10);
          const tank = x => { g.fillStyle = '#3a2e2a'; g.fillRect(x - 70, 520, 140, 130); g.beginPath(); g.moveTo(x - 80, 522); g.lineTo(x, 470); g.lineTo(x + 80, 522); g.fill(); g.fillStyle = '#2a201c'; for (let i = 0; i < 4; i++) g.fillRect(x - 64 + i * 40, 650, 8, 70); for (let k = 0; k < 4; k++) g.fillRect(x - 70, 540 + k * 30, 140, 3); };
          tank(120); tank(1500);
          g.fillStyle = '#3d3f52'; for (const x of [300, 1260]) { g.fillRect(x, 650, 110, 62); g.fillStyle = '#2b2d3c'; g.fillRect(x + 10, 660, 90, 6); g.fillRect(x + 10, 674, 90, 6); g.fillStyle = '#3d3f52'; }
          g.strokeStyle = '#4a4c60'; g.lineWidth = 3; g.beginPath(); for (let x = X0; x < X1; x += 60) { g.moveTo(x, 712); g.lineTo(x, 680); } g.moveTo(X0, 680); g.lineTo(X1, 680); g.stroke();
        });
        d.floor = 'wet';
      },
      afterFar(ctx, d, time, vr, cam) {
        // blinking aircraft lights on the far antennas
        const offF = (cam.x - 800) * 0.85;
        for (let i = 0; i < 10; i++) { const on = Math.sin(time * 2.5 + i * 1.7) > 0.6; if (on) glowDisc(ctx, -700 + i * 330 + offF, 360 + (i % 3) * 50, 18, '#ff3b3b', 0.9); }
      },
      afterMid(ctx, d, time, vr, cam) {
        const off = (cam.x - 800) * 0.6;
        ctx.globalCompositeOperation = 'lighter';
        for (const s of d.signs) {
          const flick = Math.sin(time * 9 + s.ph) > -0.92 ? 1 : 0.2;
          const x = s.x + off;
          Glow.draw(ctx, s.c, x + (s.vert ? s.w / 2 : s.h / 2), s.y + (s.vert ? s.h / 2 : s.w / 2), 110, 0.35 * flick);
          ctx.globalAlpha = 0.9 * flick; ctx.fillStyle = s.c;
          if (s.vert) { ctx.fillRect(x, s.y, s.w, s.h); ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 6, s.y + 10 + k * s.h / 4.4, s.w - 12, 5); }
          else { ctx.fillRect(x, s.y, s.h, s.w); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x + 8, s.y + s.w / 2 - 3, s.h - 16, 6); }
          ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    },
    temple: {
      sky: ['#7fb2e8', '#f4c4d6', '#fff0e4'], fog: '#ffd6e2', amb: 'petals', sun: [1150, 330, '#fff8e6'],
      build(d, rnd) {
        d.far = layer(0.45, g => {
          // a snow-capped volcano far away
          g.fillStyle = '#9fb0d6';
          g.beginPath(); g.moveTo(300, 760); g.lineTo(720, 330); g.lineTo(880, 330); g.lineTo(1300, 760); g.closePath(); g.fill();
          g.fillStyle = '#f4f6ff';
          g.beginPath(); g.moveTo(720, 330); g.lineTo(880, 330); g.lineTo(950, 400); g.lineTo(905, 390); g.lineTo(860, 420); g.lineTo(800, 395); g.lineTo(745, 425); g.lineTo(690, 395); g.lineTo(650, 400); g.closePath(); g.fill();
          haze(g, 380, 800, '#ffd6e2', 0.5);
          const y = ridge(g, 640, 70, '#c99ab4', rnd);
          pagoda(g, 1550, y(1550) + 6, 170, '#a77892');
          haze(g, 560, 800, '#ffd0de', 0.35);
        });
        d.mid = layer(0.6, g => {
          const y = ridge(g, 720, 30, '#8b6b7a', rnd);
          for (let x = X0; x < X1; x += 110 + rnd() * 120) {
            const s = 0.7 + rnd() * 0.6, bx = x, by = y(x) + 10;
            g.strokeStyle = '#4f3434'; g.lineWidth = 12 * s; g.lineCap = 'round';
            g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 10 * s, by - 90 * s, bx - 20 * s, by - 170 * s); g.stroke();
            g.lineWidth = 6 * s; g.beginPath(); g.moveTo(bx + 4 * s, by - 80 * s); g.lineTo(bx + 60 * s, by - 140 * s); g.stroke();
            for (let k = 0; k < 14; k++) { g.fillStyle = ['#ffb7cf', '#ff9fbf', '#ffd3e2'][k % 3]; g.beginPath(); g.arc(bx + (rnd() - 0.4) * 140 * s, by - 160 * s + (rnd() - 0.5) * 90 * s, (24 + rnd() * 26) * s, 0, TAU); g.fill(); }
          }
          haze(g, 520, 800, '#ffd6e2', 0.25);
        });
        d.near = layer(0.85, g => {
          // the great torii and stone lanterns
          g.fillStyle = '#d42e3c';
          g.fillRect(470, 420, 44, 380); g.fillRect(1086, 420, 44, 380);
          g.fillRect(420, 480, 760, 30);
          g.beginPath(); g.moveTo(370, 420); g.quadraticCurveTo(800, 395, 1230, 420); g.lineTo(1215, 385); g.quadraticCurveTo(800, 360, 385, 385); g.closePath(); g.fill();
          g.fillStyle = '#2a1a1a'; g.beginPath(); g.moveTo(375, 384); g.quadraticCurveTo(800, 358, 1225, 384); g.lineTo(1232, 372); g.quadraticCurveTo(800, 344, 368, 372); g.closePath(); g.fill();
          g.fillStyle = '#1e1414'; g.fillRect(468, 780, 48, 20); g.fillRect(1084, 780, 48, 20);
          for (const x of [220, 1380]) {
            g.fillStyle = '#9a9a96'; g.fillRect(x - 12, 690, 24, 110); g.fillRect(x - 40, 670, 80, 20); g.fillRect(x - 30, 620, 60, 50); g.fillRect(x - 48, 600, 96, 22); g.fillRect(x - 10, 580, 20, 20);
            g.fillStyle = '#ffd98a'; g.fillRect(x - 18, 630, 36, 30);
          }
        });
        d.floor = 'stone';
      },
      front(ctx, d, time, vr, cam) {
        const off = (cam.x - 800) * 0.3;
        for (const x of [220, 1380]) glowDisc(ctx, x + off, 645, 70, '#ffcf6a', 0.45 + Math.sin(time * 4 + x) * 0.05);
      },
    },
    void: {
      sky: ['#020108', '#0e0626', '#2a1056'], fog: '#5a2a9a', amb: 'motes', stars: 220,
      build(d, rnd) {
        d.nebula = layer(0.3, g => {
          for (let i = 0; i < 14; i++) {
            const x = X0 + rnd() * SPAN, y = 100 + rnd() * 450, r = 200 + rnd() * 380, c = ['#7a3cff', '#ff4fa3', '#3c7dff', '#c04bff'][i % 4];
            const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, 0.32)); gr.addColorStop(1, rgba(c, 0));
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
          }
          // a ringed planet
          g.fillStyle = '#3b2a6e'; g.beginPath(); g.arc(1250, 260, 110, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(1220, 230, 100, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(200,180,255,0.5)'; g.lineWidth = 8; g.beginPath(); g.ellipse(1250, 260, 200, 40, -0.3, 0, TAU); g.stroke();
        }, 800);
        d.far = layer(0.5, g => {
          for (let i = 0; i < 9; i++) {
            const x = X0 + 200 + i * 430 + rnd() * 120, y = 330 + rnd() * 220, w = 90 + rnd() * 120;
            g.fillStyle = '#1a1036';
            g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y - 10); g.lineTo(x + w * 0.5, y + 50); g.lineTo(x + w * 0.1, y + 120 + rnd() * 60); g.lineTo(x - w * 0.4, y + 60); g.closePath(); g.fill();
            g.fillStyle = '#9b6bff'; for (let k = 0; k < 3; k++) { const cx = x - w * 0.5 + rnd() * w; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + 8, y - 30 - rnd() * 30); g.lineTo(cx + 16, y); g.fill(); }
            d.isles.push({ x, y, ph: rnd() * 6 });
          }
          ridge(g, 700, 50, '#160d30', rnd); haze(g, 560, 800, '#5a2a9a', 0.35);
        });
        d.near = layer(0.85, g => {
          for (const x of [260, 1340]) {
            g.fillStyle = '#120a26';
            g.beginPath(); g.moveTo(x - 50, 800); g.lineTo(x - 40, 520); g.lineTo(x - 10, 470); g.lineTo(x + 20, 540); g.lineTo(x + 50, 800); g.closePath(); g.fill();
          }
        });
        d.floor = 'glass';
      },
      back(ctx, d, time, vr, cam) {
        // the rift: a glowing crack across the sky
        const off = (cam.x - 800) * 0.9;
        const rnd = mulberry32(7);
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.6 + Math.sin(time * 2) * 0.25;
        for (const [w, c, a] of [[16, '#7a3cff', 0.35], [6, '#d9b8ff', 0.8], [2, '#ffffff', 1]]) {
          ctx.strokeStyle = c; ctx.globalAlpha = a * pulse; ctx.lineWidth = w;
          ctx.beginPath(); let x = 200 + off, y = 120; ctx.moveTo(x, y);
          for (let i = 0; i < 12; i++) { x += 70 + rnd() * 40; y += (rnd() - 0.45) * 60; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      },
      afterFar(ctx, d, time, vr, cam) {
        const offF = (cam.x - 800) * 0.85;
        for (const s of d.isles) glowDisc(ctx, s.x + offF, s.y - 20, 90, '#9b6bff', 0.25 + Math.sin(time * 1.5 + s.ph) * 0.1);
      },
    },
    crater: {
      sky: ['#14040a', '#5a120e', '#e05a2a'], fog: '#ff6a2a', amb: 'embers',
      build(d, rnd) {
        d.far = layer(0.45, g => {
          // an erupting volcano
          g.fillStyle = '#3a1410';
          g.beginPath(); g.moveTo(500, 760); g.lineTo(760, 360); g.lineTo(860, 360); g.lineTo(1150, 760); g.closePath(); g.fill();
          g.strokeStyle = '#ff6a1c'; g.lineWidth = 6;
          g.beginPath(); g.moveTo(800, 365); g.quadraticCurveTo(780, 480, 720, 560); g.quadraticCurveTo(700, 640, 640, 740); g.stroke();
          g.beginPath(); g.moveTo(830, 365); g.quadraticCurveTo(880, 500, 930, 620); g.stroke();
          haze(g, 380, 800, '#ff6a2a', 0.3);
          ridge(g, 640, 90, '#4a1712', rnd, { peaky: true });
          haze(g, 520, 800, '#ff5a2a', 0.3);
        });
        d.mid = layer(0.6, g => {
          const y = ridge(g, 720, 40, '#2e0f0c', rnd);
          for (let x = X0; x < X1; x += 120 + rnd() * 160) {
            const h = 120 + rnd() * 200, w = 26 + rnd() * 30;
            g.fillStyle = '#240b09';
            g.beginPath(); g.moveTo(x - w, y(x) + 10); g.lineTo(x - w * 0.3, y(x) - h); g.lineTo(x + w * 0.2, y(x) - h * 1.08); g.lineTo(x + w, y(x) + 10); g.closePath(); g.fill();
          }
          haze(g, 600, 800, '#ff4a1c', 0.18);
        });
        d.near = layer(0.85, g => {
          for (const [x, s] of [[150, 1], [1450, 1.1]]) {
            g.fillStyle = '#1c0907';
            g.fillRect(x - 60 * s, 520 * s + 0, 34 * s, 300); g.fillRect(x + 30 * s, 560, 34 * s, 240);
            g.beginPath(); g.moveTo(x - 70 * s, 530); g.quadraticCurveTo(x, 470, x + 70 * s, 560); g.lineTo(x + 64 * s, 584); g.quadraticCurveTo(x, 500, x - 60 * s, 556); g.closePath(); g.fill();
          }
        });
        d.floor = 'lava';
      },
      afterFar(ctx, d, time, vr, cam) {
        const off = (cam.x - 800) * 0.85;
        glowDisc(ctx, 810 + off, 360, 260, '#ff7a1a', 0.55 + Math.sin(time * 3) * 0.1);
        // lava bursting from the crater
        if (Math.random() < 0.4) Game.fx.add({ kind: 'ember', x: 810 + off + rand(-30, 30), y: 362, vx: rand(-120, 120), vy: rand(-520, -260), g: 500, life: rand(0.8, 1.4), size: rand(4, 8), color: '#ffb13d' });
      },
    },
    forest: {
      sky: ['#7fbf8a', '#cfe7b8', '#f4f2d0'], fog: '#e6f0c8', amb: 'fireflies', sun: [1000, 220, '#fffbe0'],
      build(d, rnd) {
        const stalks = (g, n, base, col, w0, w1, node) => {
          for (let i = 0; i < n; i++) {
            const x = X0 + rnd() * SPAN, w = w0 + rnd() * (w1 - w0), lean = (rnd() - 0.5) * 40;
            g.fillStyle = col;
            g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x - w / 2 + lean, -40); g.lineTo(x + w / 2 + lean, -40); g.lineTo(x + w / 2, base); g.closePath(); g.fill();
            g.fillStyle = node;
            for (let y = base - 60 - rnd() * 40; y > 0; y -= 70 + rnd() * 30) { const lx = x + lean * (1 - y / base); g.fillRect(lx - w / 2 - 1, y, w + 2, 4); }
            for (let k = 0; k < 3; k++) { const y = 80 + rnd() * 400, lx = x + lean * (1 - y / base); g.beginPath(); g.ellipse(lx + w * 1.6, y, w * 1.8, w * 0.35, -0.5, 0, TAU); g.fill(); }
          }
        };
        d.far = layer(0.4, g => { stalks(g, 120, 800, '#a6cf9a', 8, 14, '#94bd88'); haze(g, 0, 800, '#e6f0c8', 0.55); });
        d.mid = layer(0.55, g => { stalks(g, 70, 800, '#5f9a5c', 14, 22, '#4c8048'); haze(g, 200, 800, '#dfeec0', 0.35); });
        d.near = layer(0.85, g => {
          stalks(g, 16, 800, '#2f5a33', 26, 36, '#244a28');
          g.fillStyle = '#3a4a24'; for (let x = X0; x < X1; x += 30) { g.beginPath(); g.moveTo(x, 800); g.lineTo(x + 8, 760 - rnd() * 30); g.lineTo(x + 16, 800); g.fill(); }
        });
        d.floor = 'dirt';
      },
      afterMid(ctx, d, time, vr, cam) { rays(ctx, 1000 + (cam.x - 800) * 0.95, 120, '#fffbe0', 0.13, time, 11, 1500, 1.5); },
    },
    snow: {
      sky: ['#070f2a', '#1a2c5c', '#5a7cb4'], fog: '#b4cbe8', amb: 'snow', moon: [420, 180], stars: 120,
      build(d, rnd) {
        d.far = layer(0.45, g => {
          const y = ridge(g, 540, 180, '#6a86b4', rnd, { peaky: true });
          snowcap(g, y, X0, X1, 520, '#eef4ff');
          haze(g, 380, 800, '#b4cbe8', 0.4);
          const y2 = ridge(g, 640, 90, '#4c6694', rnd, { peaky: true });
          snowcap(g, y2, X0, X1, 600, '#dfe9f8');
          haze(g, 520, 800, '#a4bde0', 0.3);
        });
        d.mid = layer(0.6, g => {
          const y = ridge(g, 720, 30, '#3a5280', rnd);
          for (let x = X0; x < X1; x += 40 + rnd() * 50) { const h = 90 + rnd() * 110; pine(g, x, y(x) + 8, h, '#1f3156'); g.fillStyle = '#e8f0ff'; for (let i = 0; i < 4; i++) { const ww = h * (0.42 - i * 0.07), yy = y(x) + 8 - h * (0.18 + i * 0.22); g.fillRect(x - ww * 0.6, yy + h * 0.14, ww * 1.2, 4); } }
          haze(g, 600, 800, '#b4cbe8', 0.3);
        });
        d.near = layer(0.85, g => {
          for (const x of [180, 1420]) {
            g.fillStyle = '#9fc4ee';
            for (let k = 0; k < 4; k++) { const cx = x + (k - 1.5) * 34, h = 120 + (k % 2) * 80; g.beginPath(); g.moveTo(cx - 18, 800); g.lineTo(cx, 800 - h); g.lineTo(cx + 18, 800); g.closePath(); g.fill(); }
            g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 40, 700, 6, 90);
          }
        });
        d.floor = 'snow';
      },
      back(ctx, d, time, vr, cam) {
        // aurora ribbons
        const off = (cam.x - 800) * 0.85;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          const col = ['#3dffb4', '#3dd0ff', '#9b6bff'][b];
          for (let x = -400; x < 2000; x += 24) {
            const y = 150 + b * 50 + Math.sin(x * 0.004 + time * 0.5 + b) * 50 + Math.sin(x * 0.011 + time * 0.8) * 20;
            const h = 120 + Math.sin(x * 0.007 + time + b * 2) * 50;
            const g = ctx.createLinearGradient(0, y, 0, y + h);
            g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.3, rgba(col, 0.16)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.fillRect(x + off, y, 26, h);
          }
        }
        ctx.restore();
      },
    },
    arena: {
      sky: ['#07040f', '#1d1030', '#3a1c3a'], fog: '#5a2a5a', amb: 'confetti',
      build(d, rnd) {
        d.far = layer(0.5, g => {
          // tiered stands packed with a crowd
          for (let tier = 0; tier < 5; tier++) {
            const y = 360 + tier * 70;
            g.fillStyle = ['#241a36', '#2a1e3e', '#302246', '#36264e', '#3c2a56'][tier];
            g.fillRect(X0, y, SPAN, 70);
            for (let x = X0; x < X1; x += 18) {
              const c = ['#c94a6a', '#4a8ac9', '#c9b44a', '#6ac94a', '#d9d0e6', '#8a6bc9'][Math.floor(rnd() * 6)];
              g.fillStyle = mixHex(c, '#1a1028', 0.55 - tier * 0.06);
              g.beginPath(); g.arc(x + rnd() * 6, y + 26, 8, 0, TAU); g.fill(); g.fillRect(x - 8 + rnd() * 6, y + 32, 16, 30);
            }
          }
          g.fillStyle = '#120a1c'; g.fillRect(X0, 300, SPAN, 60);
          // the big screen
          g.fillStyle = '#0a0a12'; g.fillRect(620, 120, 360, 200); g.fillStyle = '#2a2a3a'; g.fillRect(630, 130, 340, 180);
          haze(g, 300, 800, '#3a1c3a', 0.35);
        });
        d.near = layer(0.85, g => {
          // the ring's barrier wall with banners
          g.fillStyle = '#2a1e2e'; g.fillRect(X0, 700, SPAN, 100);
          g.fillStyle = '#3a2a3e'; g.fillRect(X0, 692, SPAN, 12);
          const cols = ['#ff9b2a', '#ffd23f', '#35c3d6', '#ff4fa3', '#2fd47a', '#5b6cff', '#a06bff', '#e8323f'];
          for (let i = 0; i < 16; i++) { const x = X0 + 120 + i * 230; g.fillStyle = cols[i % cols.length]; g.fillRect(x, 560, 70, 120); g.beginPath(); g.moveTo(x, 680); g.lineTo(x + 35, 660); g.lineTo(x + 70, 680); g.fill(); g.fillStyle = '#1a1220'; g.fillRect(x - 6, 552, 82, 10); }
        });
        d.floor = 'ring';
      },
      afterFar(ctx, d, time, vr, cam) {
        const off = (cam.x - 800) * 0.85;
        // the screen shows a pulsing VS
        ctx.fillStyle = `rgba(255,201,51,${0.5 + Math.sin(time * 3) * 0.2})`;
        ctx.font = 'italic 900 90px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('VS', 800 + off, 222);
        // the crowd bobs
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i < 40; i++) { const x = -900 + i * 90 + off, y = 380 + (i % 5) * 70 - Math.abs(Math.sin(time * 6 + i)) * 6; ctx.fillRect(x, y, 14, 4); }
      },
      front(ctx, d, time, vr, cam) {
        const off = (cam.x - 800) * 0.85;
        // sweeping spotlights
        for (let i = 0; i < 4; i++) {
          const x = 100 + i * 470 + off * 0.3, ang = Math.PI / 2 + Math.sin(time * 0.6 + i * 1.7) * 0.5;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const len = 900, w = 0.09;
          const g = ctx.createLinearGradient(x, 40, x + Math.cos(ang) * len, 40 + Math.sin(ang) * len);
          g.addColorStop(0, 'rgba(255,240,210,0.22)'); g.addColorStop(1, 'rgba(255,240,210,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x + Math.cos(ang - w) * len, 40 + Math.sin(ang - w) * len); ctx.lineTo(x + Math.cos(ang + w) * len, 40 + Math.sin(ang + w) * len); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      },
    },
    lab: {
      sky: ['#0d1018', '#131826', '#1a2030'], fog: '#2a3146', amb: null,
      build(d) {
        d.far = layer(0.5, g => {
          g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2; g.beginPath();
          for (let x = X0; x < X1; x += 80) { g.moveTo(x, 0); g.lineTo(x, 800); }
          for (let y = 0; y < 800; y += 80) { g.moveTo(X0, y); g.lineTo(X1, y); }
          g.stroke();
          g.fillStyle = 'rgba(255,201,51,0.5)'; g.fillRect(WALL_L - 6, 300, 6, 500); g.fillRect(WALL_R, 300, 6, 500);
        });
        d.floor = 'tile';
      },
    },
  };

  /* ------------------------------------------------------------- floors */
  const FLOOR = {
    wood: ['#7a4a2e', '#6c3f26', '#5a331f'], wet: ['#1e1f2e', '#24263a', '#17182a'], stone: ['#a39a92', '#968d85', '#8a8178'],
    glass: ['#140c2a', '#1a1036', '#0c0820'], lava: ['#2e1410', '#24100c', '#1a0a08'], dirt: ['#7a6a44', '#6c5d3b', '#5e5032'],
    snow: ['#dce7f4', '#cfdcec', '#c2d2e6'], ring: ['#8e8070', '#857766', '#7a6c5c'], tile: ['#1a1e2a', '#1e2230', '#161a24'],
  };
  function floorLayer(kind, rnd) {
    const cols = FLOOR[kind] || FLOOR.tile;
    return layer(1, g => {
      const top = GROUND, h = 260;
      const gr = g.createLinearGradient(0, top, 0, top + h);
      gr.addColorStop(0, cols[0]); gr.addColorStop(1, mixHex(cols[2], '#000000', 0.5));
      g.fillStyle = gr; g.fillRect(X0, top, SPAN, h);
      if (kind === 'wood' || kind === 'dirt' || kind === 'ring' || kind === 'stone' || kind === 'tile') {
        // boards / tiles in perspective
        for (let row = 0; row < 7; row++) {
          const y0 = top + row * row * 6 + row * 6, y1 = top + (row + 1) * (row + 1) * 6 + (row + 1) * 6;
          const step = kind === 'wood' ? 180 : 120;
          for (let x = X0 - (row % 2) * step / 2; x < X1; x += step) {
            g.fillStyle = cols[Math.floor(rnd() * 3)];
            const sx = (xx, yy) => 800 + (xx - 800) * (1 + (yy - top) / 260);
            g.beginPath(); g.moveTo(sx(x, y0), y0); g.lineTo(sx(x + step - 4, y0), y0); g.lineTo(sx(x + step - 4, y1), y1); g.lineTo(sx(x, y1), y1); g.closePath(); g.fill();
          }
        }
      }
      if (kind === 'lava') {
        g.strokeStyle = '#ff5a1c'; g.lineWidth = 3;
        for (let i = 0; i < 40; i++) { let x = X0 + rnd() * SPAN, y = top + 4 + rnd() * 150; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 80; y += rnd() * 20; g.lineTo(x, y); } g.stroke(); }
      }
      if (kind === 'glass') {
        g.strokeStyle = 'rgba(155,107,255,0.35)'; g.lineWidth = 2; g.beginPath();
        for (let i = -20; i <= 20; i++) { g.moveTo(800 + i * 60, top); g.lineTo(800 + i * 220, top + 260); }
        for (let r = 1; r < 7; r++) { const y = top + r * r * 6; g.moveTo(X0, y); g.lineTo(X1, y); }
        g.stroke();
      }
      if (kind === 'snow') { g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 300; i++) g.fillRect(X0 + rnd() * SPAN, top + rnd() * 200, 2, 2); }
      if (kind === 'ring') { g.fillStyle = '#e8d8b0'; g.fillRect(X0, top + 6, SPAN, 5); g.fillRect(WALL_L - 10, top, 12, 260); g.fillRect(WALL_R, top, 12, 260); }
      // top lip catching the light
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X0, top, SPAN, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X0, top + 3, SPAN, 5);
    }, GROUND + 270);
  }

  /* -------------------------------------------------------------- weather */
  function spawnAmb(d, kind, vr, fresh) {
    const x = rand(vr.x0 - 100, vr.x1 + 100), y = fresh ? rand(vr.y0, vr.y1) : vr.y0 - 20;
    switch (kind) {
      case 'rain': return { x, y, vx: -260, vy: rand(1300, 1700), s: rand(0.6, 1) };
      case 'snow': return { x, y, vx: rand(-30, 30), vy: rand(50, 120), s: rand(1.5, 4), ph: rand(0, 6) };
      case 'petals': return { x, y, vx: rand(-90, -30), vy: rand(50, 110), s: rand(0.6, 1.2), ph: rand(0, 6) };
      case 'embers': return { x, y: fresh ? y : GROUND + 10, vx: rand(-30, 30), vy: rand(-140, -50), s: rand(1.5, 3.5), ph: rand(0, 6) };
      case 'motes': return { x, y: fresh ? y : GROUND + 10, vx: rand(-15, 15), vy: rand(-60, -20), s: rand(1.5, 3), ph: rand(0, 6) };
      case 'fireflies': return { x, y: rand(400, GROUND - 20), vx: rand(-20, 20), vy: rand(-20, 20), s: rand(2, 3.5), ph: rand(0, 6) };
      case 'dust': return { x, y: rand(300, GROUND), vx: rand(5, 20), vy: rand(-8, 8), s: rand(1, 2.5), ph: rand(0, 6) };
      case 'confetti': return { x, y, vx: rand(-40, 40), vy: rand(80, 160), s: rand(3, 6), ph: rand(0, 6), c: pick(['#ffc933', '#ff4fa3', '#4fd8ff', '#45e08a']) };
      default: return null;
    }
  }
  const AMB_N = { rain: 160, snow: 130, petals: 50, embers: 60, motes: 60, fireflies: 30, dust: 40, confetti: 40 };
  function updateAmb(d, kind, vr, dt) {
    if (!kind) return;
    const want = AMB_N[kind];
    while (d.amb.length < want) d.amb.push(spawnAmb(d, kind, vr, true));
    for (let i = 0; i < d.amb.length; i++) {
      const p = d.amb[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.ph != null) { p.ph += dt; if (kind === 'petals' || kind === 'snow' || kind === 'confetti') p.x += Math.sin(p.ph * 1.6) * 30 * dt; if (kind === 'fireflies') { p.vx += rand(-40, 40) * dt; p.vy += rand(-40, 40) * dt; } }
      const out = p.y > GROUND + 20 || p.y < vr.y0 - 60 || p.x < vr.x0 - 200 || p.x > vr.x1 + 200;
      if (out) {
        if (kind === 'rain' && p.y > GROUND) d.splash.push({ x: p.x, t: 0 });
        d.amb[i] = spawnAmb(d, kind, vr, false);
      }
    }
    for (const s of d.splash) s.t += dt;
    d.splash = d.splash.filter(s => s.t < 0.25).slice(-40);
  }
  function drawAmb(ctx, d, kind, time) {
    if (!kind) return;
    ctx.save();
    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(190,210,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (const p of d.amb) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.03, p.y - p.vy * 0.03 * p.s); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,220,255,0.5)';
      for (const s of d.splash) { ctx.globalAlpha = 1 - s.t / 0.25; ctx.beginPath(); ctx.ellipse(s.x, GROUND + 2, 6 + s.t * 40, 2 + s.t * 6, 0, 0, TAU); ctx.stroke(); }
    } else if (kind === 'petals') {
      ctx.fillStyle = '#ffc6d9';
      for (const p of d.amb) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 2); ctx.scale(1, Math.cos(p.ph * 3)); ctx.beginPath(); ctx.ellipse(0, 0, 7 * p.s, 4 * p.s, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    } else if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const p of d.amb) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); }
    } else if (kind === 'confetti') {
      for (const p of d.amb) { ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 4); ctx.fillRect(-p.s, -p.s * 0.4, p.s * 2, p.s * 0.8); ctx.restore(); }
    } else {
      const col = kind === 'embers' ? '#ffb13d' : kind === 'motes' ? '#c9a8ff' : kind === 'fireflies' ? '#e8ff8a' : '#fff1c8';
      ctx.globalCompositeOperation = 'lighter';
      for (const p of d.amb) { const a = kind === 'dust' ? 0.35 : 0.6 + Math.sin(p.ph * 5) * 0.35; Glow.draw(ctx, col, p.x, p.y, p.s * 5, a); }
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------- public */
  function prepare(id) {
    if (cache[id]) return cache[id];
    const art = ART[id] || ART.dojo;
    const rnd = mulberry32(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const d = { art, amb: [], splash: [], signs: [], isles: [], stars: [] };
    for (let i = 0; i < (art.stars || 0); i++) d.stars.push({ x: X0 + rnd() * SPAN, y: rnd() * 600, r: 0.6 + rnd() * 1.6, tw: rnd() * 6 });
    art.build(d, rnd);
    d.floorL = floorLayer(d.floor || 'tile', rnd);
    cache[id] = d;
    return d;
  }

  let lastT = 0;
  function draw(ctx, id, vr, time, cam) {
    const d = prepare(id), art = d.art;
    const dt = clamp(time - lastT, 0, 0.05); lastT = time;
    // sky
    const g = ctx.createLinearGradient(0, vr.y0, 0, GROUND);
    g.addColorStop(0, art.sky[0]); g.addColorStop(0.55, art.sky[1]); g.addColorStop(1, art.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(vr.x0 - 10, vr.y0 - 10, vr.x1 - vr.x0 + 20, GROUND - vr.y0 + 20);
    for (const s of d.stars) { ctx.globalAlpha = 0.35 + Math.sin(time * 2 + s.tw) * 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x + (cam.x - 800) * 0.95, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    if (art.sun) {
      const [sx, sy, sc] = art.sun, x = sx + (cam.x - 800) * 0.95;
      glowDisc(ctx, x, sy, 560, sc, 0.75);
      ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(x, sy, 70, 0, TAU); ctx.fill();
      if (id !== 'forest') rays(ctx, x, sy, sc, 0.08, time, 9, 1100, TAU);
    }
    if (art.moon) {
      const [mx, my] = art.moon, x = mx + (cam.x - 800) * 0.95;
      glowDisc(ctx, x, my, 260, '#cfd8ff', 0.45);
      ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(x, my, 52, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,170,210,0.35)'; ctx.beginPath(); ctx.arc(x - 14, my - 10, 12, 0, TAU); ctx.arc(x + 16, my + 14, 8, 0, TAU); ctx.fill();
    }
    if (d.nebula) drawLayer(ctx, d.nebula, cam, 0.92, vr);
    if (art.back) art.back(ctx, d, time, vr, cam);
    if (d.far) drawLayer(ctx, d.far, cam, 0.85, vr);
    if (art.afterFar) art.afterFar(ctx, d, time, vr, cam);
    if (d.mid) drawLayer(ctx, d.mid, cam, 0.6, vr);
    if (art.afterMid) art.afterMid(ctx, d, time, vr, cam);
    if (d.near) drawLayer(ctx, d.near, cam, 0.3, vr);
    if (art.front) art.front(ctx, d, time, vr, cam);
    // floor
    ctx.drawImage(d.floorL.c, X0, 0, SPAN, d.floorL.h);
    if (vr.y1 > GROUND + 260) { ctx.fillStyle = '#000'; ctx.globalAlpha = 0.6; ctx.fillRect(vr.x0, GROUND + 260, vr.x1 - vr.x0, vr.y1 - GROUND - 260); ctx.globalAlpha = 1; }
    floorFx(ctx, id, d, time, vr, cam);
    updateAmb(d, art.amb, vr, dt);
  }

  // per-frame floor light: reflections, lava glow, sun streaks
  function floorFx(ctx, id, d, time, vr, cam) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (id === 'dojo' && d.art.sun) {
      const x = d.art.sun[0] + (cam.x - 800) * 0.95;
      const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 160);
      g.addColorStop(0, 'rgba(255,230,170,0.35)'); g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 60, GROUND); ctx.lineTo(x + 60, GROUND); ctx.lineTo(x + 260, GROUND + 160); ctx.lineTo(x - 260, GROUND + 160); ctx.closePath(); ctx.fill();
    }
    if (id === 'city') {
      const off = (cam.x - 800) * 0.6;
      for (const s of d.signs) {
        const x = s.x + off + s.w / 2;
        if (x < vr.x0 - 50 || x > vr.x1 + 50) continue;
        const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 160);
        g.addColorStop(0, rgba(s.c, 0.2)); g.addColorStop(1, rgba(s.c, 0));
        ctx.fillStyle = g; ctx.fillRect(x - s.w / 2 + Math.sin(time * 3 + s.ph + GROUND) * 3, GROUND + 4, s.w * 0.8, 110);
      }
    }
    if (id === 'crater') {
      ctx.globalAlpha = 0.35 + Math.sin(time * 2) * 0.12;
      Glow.draw(ctx, '#ff5a1c', 800 + (cam.x - 800) * 0.2, GROUND + 60, 900, 0.5);
      ctx.globalAlpha = 1;
    }
    if (id === 'void') { const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 200); g.addColorStop(0, 'rgba(155,107,255,0.25)'); g.addColorStop(1, 'rgba(155,107,255,0)'); ctx.fillStyle = g; ctx.fillRect(vr.x0, GROUND, vr.x1 - vr.x0, 200); }
    if (id === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 20; i++) { const x = ((i * 137 + Math.floor(time * 2) * 61) % 1600), a = Math.max(0, Math.sin(time * 4 + i)); ctx.globalAlpha = a; ctx.fillRect(x, GROUND + 10 + (i * 37) % 120, 2, 2); } ctx.globalAlpha = 1; }
    ctx.restore();
  }

  // drawn after the fighters: weather, a soft foreground frame and a vignette
  function drawFront(ctx, id, vr, time, cam) {
    const d = prepare(id);
    drawAmb(ctx, d, d.art.amb, time);
    // foreground frame posts outside the walls, out of focus
    const fc = { dojo: '#2b1710', city: '#0b0a18', temple: '#3a1418', void: '#0a0618', crater: '#120605', forest: '#16301a', snow: '#22385e', arena: '#150e1c' }[id];
    if (fc) {
      const off = (cam.x - 800) * -0.25;
      ctx.fillStyle = fc; ctx.globalAlpha = 0.92;
      for (const x of [WALL_L - 190, WALL_R + 120]) ctx.fillRect(x + off, vr.y0 - 20, 70, vr.y1 - vr.y0 + 40);
      ctx.globalAlpha = 1;
    }
  }

  return { prepare, draw, drawFront };
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
