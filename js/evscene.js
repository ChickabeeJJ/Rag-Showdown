'use strict';
/* =========================================================================
   Event hero scenes: the cinematic backdrop behind the exclusive fighter on
   the event screen, one per event.

   Built like a film plate: a sky, three depth layers with atmospheric
   perspective (far layers fade toward the sky colour), a key light the
   fighter is framed against, light shafts or aurora or searchlights, and
   particles at three depths (tiny and dim far away, big and soft up close).
   A slow camera drift moves each layer by a different amount for parallax.
   Static layers are painted once into offscreen canvases; only the light
   and the particles are drawn every frame. The composition is centred on
   the fighter (measured from the page), and the left side is kept dark so
   the title and progress stay readable.
   ========================================================================= */
const EvScene = (() => {
  let raf = 0, cur = null;

  // a small seeded random, so a scene looks the same every time it opens
  const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const layer = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // a ridge line across the width: a few octaves of smooth noise
  function ridge(rnd, w, base, amp, rough) {
    const n = 7, k = [];
    for (let o = 0; o < 4; o++) k.push(Array.from({ length: n * (1 << o) + 2 }, () => rnd()));
    const at = x => {
      let y = 0, a = 1, tot = 0;
      for (let o = 0; o < 4; o++) {
        const seg = n * (1 << o), f = (x / w) * seg, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t);
        y += (k[o][i] * (1 - s) + k[o][i + 1] * s) * a; tot += a; a *= rough;
      }
      return base - (y / tot) * amp;
    };
    return at;
  }
  function fillRidge(g, w, h, at, fill) {
    g.fillStyle = fill; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, at(x));
    g.lineTo(w, h); g.closePath(); g.fill();
  }

  /* ------------------------------------------------------------ SAKURA
     Golden hour on the shrine hill: a low sun behind the fighter, layered
     pink hills fading into haze, a torii on the far ridge, blossom boughs
     framing the top, light shafts and petals tumbling at three depths. */
  function sakura(W, H, fx) {
    const rnd = seeded(41), L = {};
    const sunX = fx + 120, sunY = H * 0.6;   // off the fighter's shoulder, so a pink fighter never melts into it
    // sky
    L.sky = layer(W, H); let g = L.sky.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2b0f2f'); gr.addColorStop(0.45, '#9b3d6e'); gr.addColorStop(0.78, '#ffb08a'); gr.addColorStop(1, '#ffd6b0');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // a wide warm bloom around the sun, then the disc itself
    let rg = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 1.1);
    rg.addColorStop(0, 'rgba(255,236,200,0.95)'); rg.addColorStop(0.12, 'rgba(255,190,160,0.55)'); rg.addColorStop(0.4, 'rgba(255,140,170,0.18)'); rg.addColorStop(1, 'rgba(255,120,170,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff3e0'; g.beginPath(); g.arc(sunX, sunY, H * 0.13, 0, Math.PI * 2); g.fill();
    // thin cloud bands lit from below
    for (let i = 0; i < 5; i++) {
      const y = H * (0.18 + i * 0.07), x = rnd() * W, w = W * (0.25 + rnd() * 0.3);
      const cg = g.createLinearGradient(0, y - 6, 0, y + 6); cg.addColorStop(0, 'rgba(255,180,200,0)'); cg.addColorStop(0.6, `rgba(255,${190 + i * 8},${190 + i * 6},${0.22 - i * 0.025})`); cg.addColorStop(1, 'rgba(255,180,200,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, w / 2, 7, 0, 0, Math.PI * 2); g.fill();
    }
    // far hills (hazy), with the torii on the ridge
    L.far = layer(W, H); g = L.far.getContext('2d');
    const far = ridge(rnd, W, H * 0.68, H * 0.2, 0.5);
    fillRidge(g, W, H, far, 'rgba(214,118,150,0.75)');
    const tx = W * 0.86, ty = far(tx) + 2, ts = H * 0.11;
    g.fillStyle = 'rgba(150,50,80,0.85)';
    g.fillRect(tx - ts * 0.55, ty - ts, ts * 0.09, ts); g.fillRect(tx + ts * 0.46, ty - ts, ts * 0.09, ts);
    g.fillRect(tx - ts * 0.72, ty - ts * 1.02, ts * 1.44, ts * 0.1); g.fillRect(tx - ts * 0.62, ty - ts * 0.8, ts * 1.24, ts * 0.07);
    // mid hills
    L.mid = layer(W, H); g = L.mid.getContext('2d');
    fillRidge(g, W, H, ridge(rnd, W, H * 0.8, H * 0.16, 0.45), '#8c3563');
    // the near slope, a dark plate the fighter stands in front of
    L.near = layer(W, H); g = L.near.getContext('2d');
    fillRidge(g, W, H, ridge(rnd, W, H * 0.93, H * 0.07, 0.4), '#3c1230');
    // blossom boughs framing the top corners: dark branches, then clusters lit from the sun side
    L.bough = layer(W, H); g = L.bough.getContext('2d');
    const branch = (x0, y0, ang, len, wd, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      g.strokeStyle = '#2a0c1e'; g.lineWidth = wd; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + Math.sin(ang) * len * 0.12, (y0 + y1) / 2 - Math.cos(ang) * len * 0.12, x1, y1); g.stroke();
      if (depth > 0) { branch(x1, y1, ang + 0.35 + rnd() * 0.3, len * 0.68, wd * 0.62, depth - 1); branch(x1, y1, ang - 0.4 - rnd() * 0.3, len * 0.62, wd * 0.6, depth - 1); }
      else for (let i = 0; i < 14; i++) {
        const cx = x1 + (rnd() - 0.5) * len * 0.9, cy = y1 + (rnd() - 0.5) * len * 0.7, r = 3 + rnd() * 6;
        const lit = (cx - sunX) < 0 ? 0.5 : 0.85;
        g.fillStyle = `rgba(255,${150 + rnd() * 60 | 0},${190 + rnd() * 40 | 0},${lit})`; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        if (rnd() < 0.4) { g.fillStyle = 'rgba(255,240,245,0.85)'; g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2); g.fill(); }
      }
    };
    branch(W + 10, -10, Math.PI * 0.8, H * 0.5, 14, 3);
    // petals at three depths
    const P = [];
    for (let d = 0; d < 3; d++) for (let i = 0; i < [36, 22, 7][d]; i++) P.push({ d, x: rnd() * W, y: rnd() * H, s: [2.2, 4.2, 9][d] * (0.7 + rnd() * 0.6), r: rnd() * 6, vr: (rnd() - 0.5) * 3, ph: rnd() * 6, v: [18, 34, 62][d] * (0.7 + rnd() * 0.6) });
    const PD = [0, 1, 2].map(d => P.filter(p => p.d === d));
    return {
      L, sunX, sunY,
      draw(c, t, cam) {
        c.drawImage(L.sky, 0, 0);
        // light shafts fanning from the sun, slowly breathing
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI * 0.95 + i * 0.29 + Math.sin(t * 0.15 + i) * 0.04, ln = W * 0.9, sp = 0.05 + (i % 3) * 0.02;
          const a2 = 0.05 + 0.04 * Math.sin(t * 0.6 + i * 1.7);
          const sg = c.createLinearGradient(sunX, sunY, sunX + Math.cos(a) * ln, sunY + Math.sin(a) * ln);
          sg.addColorStop(0, `rgba(255,230,200,${a2})`); sg.addColorStop(1, 'rgba(255,230,200,0)');
          c.fillStyle = sg; c.beginPath(); c.moveTo(sunX, sunY); c.lineTo(sunX + Math.cos(a - sp) * ln, sunY + Math.sin(a - sp) * ln); c.lineTo(sunX + Math.cos(a + sp) * ln, sunY + Math.sin(a + sp) * ln); c.closePath(); c.fill();
        }
        c.restore();
        c.drawImage(L.far, cam * 0.25, 0); c.drawImage(L.mid, cam * 0.5, 0);
        petals(c, PD[0], t, W, H);
        c.drawImage(L.near, cam * 0.8, 0);
        petals(c, PD[1], t, W, H);
        c.drawImage(L.bough, cam * 1.3, Math.sin(t * 0.5) * 1.5);
      },
      front(c, t) { petals(c, PD[2], t, W, H); },
    };
  }
  function petals(c, list, t, W, H) {
    for (const p of list) {
      const y = ((p.y + t * p.v) % (H + 40)) - 20, x = ((p.x - t * p.v * 0.8 + Math.sin(t * 0.9 + p.ph) * 18) % (W + 40) + W + 40) % (W + 40) - 20;
      const flip = Math.cos(t * 2 + p.ph);
      c.save(); c.translate(x, y); c.rotate(p.r + t * p.vr); c.scale(1, 0.35 + Math.abs(flip) * 0.65);
      c.globalAlpha = [0.45, 0.8, 0.5][p.d];
      c.fillStyle = flip > 0 ? '#ffd1e6' : '#ff9cc8';
      const s = p.s;
      c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s, -s * 0.8, s * 0.9, s * 0.6, 0, s); c.bezierCurveTo(-s * 0.9, s * 0.6, -s, -s * 0.8, -s * 0.18, -s * 0.95); c.lineTo(0, -s * 0.7); c.closePath(); c.fill();
      c.restore();
    }
  }

  /* ------------------------------------------------------------- FROST
     A clear arctic night: stars, a huge moon behind the fighter with a
     halo, aurora ribbons rolling across the sky, snow peaks with lit
     faces, a pine line, ground mist, and snow at three depths. */
  function frost(W, H, fx) {
    const rnd = seeded(77), L = {};
    const mx = fx + 20, my = H * 0.42, mr = H * 0.2;
    L.sky = layer(W, H); let g = L.sky.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#040a1c'); gr.addColorStop(0.55, '#0f2c55'); gr.addColorStop(1, '#3f78ad');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const s = rnd(); g.fillStyle = `rgba(230,245,255,${0.25 + s * 0.6})`; g.fillRect(rnd() * W, rnd() * H * 0.7, s > 0.92 ? 2 : 1, s > 0.92 ? 2 : 1); }
    let rg = g.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 4);
    rg.addColorStop(0, 'rgba(200,235,255,0.45)'); rg.addColorStop(1, 'rgba(160,210,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // the moon: a soft limb, a few maria, a faint halo ring
    rg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.8, '#e4f3ff'); rg.addColorStop(1, '#bcdaf2');
    g.fillStyle = rg; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,185,215,0.35)';
    for (const [a, b, r] of [[-0.3, -0.2, 0.28], [0.25, 0.1, 0.2], [-0.05, 0.35, 0.16], [0.35, -0.35, 0.1]]) { g.beginPath(); g.arc(mx + a * mr, my + b * mr, r * mr, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(210,240,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, mr * 1.55, 0, Math.PI * 2); g.stroke();
    // peaks: dark rock, snowy faces lit from the moon side
    const peaks = (base, amp, col, snow, seedOff) => {
      const c2 = layer(W, H), g2 = c2.getContext('2d');
      const r2 = seeded(seedOff), pts = [];
      let x = -40; while (x < W + 80) { pts.push([x, base - r2() * amp]); x += 60 + r2() * 90; pts.push([x, base - amp * 0.15 - r2() * amp * 0.2]); x += 40 + r2() * 60; }
      g2.fillStyle = col; g2.beginPath(); g2.moveTo(-40, H); for (const p of pts) g2.lineTo(p[0], p[1]); g2.lineTo(W + 80, H); g2.closePath(); g2.fill();
      // snow on the moon-facing slopes
      g2.fillStyle = snow;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        if (ay < by) {   // a peak, then the slope down to the right
          const toward = (ax < mx) ? 1 : 0.6;
          g2.globalAlpha = toward; g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(ax + (bx - ax) * 0.55, ay + (by - ay) * 0.55); g2.lineTo(ax + (bx - ax) * 0.3, ay + (by - ay) * 0.62); g2.lineTo(ax - 10, ay + (by - ay) * 0.4); g2.closePath(); g2.fill();
        }
      }
      g2.globalAlpha = 1;
      return c2;
    };
    L.far = peaks(H * 0.78, H * 0.38, 'rgba(70,110,160,0.85)', 'rgba(220,240,255,0.7)', 5);
    L.mid = peaks(H * 0.9, H * 0.3, '#1d3a5e', 'rgba(230,245,255,0.85)', 9);
    // pine line along the bottom
    L.near = layer(W, H); g = L.near.getContext('2d');
    g.fillStyle = '#081628';
    g.fillRect(0, H * 0.94, W, H * 0.06);
    for (let x = -10; x < W + 20; x += 9 + rnd() * 16) {
      const h = H * (0.08 + rnd() * 0.16), b = H * 0.96;
      g.beginPath(); g.moveTo(x, b - h); g.lineTo(x + h * 0.28, b); g.lineTo(x - h * 0.28, b); g.closePath(); g.fill();
    }
    const AQ = layer(Math.ceil(W / 4), Math.ceil(H / 4));
    // aurora strips: a vertical fade from nothing, up to the colour, back to nothing at the base
    const AUR = ['120,255,200', '90,200,255', '190,140,255'].map(col => {
      const st = layer(1, 64), sg = st.getContext('2d'), ag = sg.createLinearGradient(0, 0, 0, 64);
      ag.addColorStop(0, `rgba(${col},0)`); ag.addColorStop(0.75, `rgba(${col},0.125)`); ag.addColorStop(1, `rgba(${col},0)`);
      sg.fillStyle = ag; sg.fillRect(0, 0, 1, 64); return st;
    });
    const S = [];
    for (let d = 0; d < 3; d++) for (let i = 0; i < [90, 45, 12][d]; i++) S.push({ d, x: rnd() * W, y: rnd() * H, s: [0.9, 1.8, 4][d] * (0.7 + rnd() * 0.6), v: [22, 45, 90][d] * (0.7 + rnd() * 0.5), ph: rnd() * 6 });
    const snow = (c, d, t) => {
      c.fillStyle = '#ffffff';
      for (const p of S) {
        if (p.d !== d) continue;
        const y = ((p.y + t * p.v) % (H + 20)) - 10, x = ((p.x + Math.sin(t * 0.7 + p.ph) * 14 - t * p.v * 0.35) % W + W) % W;
        c.globalAlpha = [0.55, 0.85, 0.45][d]; c.beginPath(); c.arc(x, y, p.s, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    };
    return {
      draw(c, t, cam) {
        c.drawImage(L.sky, 0, 0);
        // aurora: three ribbons of vertical light rolling slowly across the sky. It's
        // soft light, so it renders at quarter resolution and is scaled up once.
        const q = AQ.getContext('2d'), qw = AQ.width, qh = AQ.height;
        q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, qw, qh); q.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const base = H * (0.2 + k * 0.08), strip = AUR[k];
          for (let x = 0; x < W; x += 10) {
            const y = base + Math.sin(x * 0.006 + t * 0.35 + k * 2) * H * 0.07 + Math.sin(x * 0.017 - t * 0.6 + k) * H * 0.025;
            const a = (0.06 + 0.05 * Math.sin(x * 0.02 + t * 1.3 + k * 3)) * (0.5 + 0.5 * Math.sin(x / W * Math.PI));
            const hgt = H * (0.16 + 0.06 * Math.sin(x * 0.01 + t * 0.5));
            q.globalAlpha = Math.max(0, a * 8); q.drawImage(strip, x / 4, (y - hgt) / 4, 11 / 4, hgt / 4);
          }
        }
        q.globalAlpha = 1;
        c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(AQ, 0, 0, W, H);
        c.restore();
        snow(c, 0, t);
        c.drawImage(L.far, cam * 0.25, 0); c.drawImage(L.mid, cam * 0.5, 0);
        // ground mist drifting between the ranges
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const y = H * (0.84 + i * 0.03), x = ((t * (8 + i * 5) + i * 300) % (W * 1.6)) - W * 0.3;
          const mg = c.createRadialGradient(x, y, 0, x, y, W * 0.35); mg.addColorStop(0, 'rgba(190,225,255,0.12)'); mg.addColorStop(1, 'rgba(190,225,255,0)');
          c.fillStyle = mg; c.fillRect(x - W * 0.35, y - 40, W * 0.7, 80);
        }
        c.restore();
        c.drawImage(L.near, cam * 0.8, 0);
        snow(c, 1, t);
      },
      front(c, t) {
        snow(c, 2, t);
        // the odd ice glint catching the moon
        const k = (t * 0.7) % 1, gx = (Math.floor(t * 0.7) * 0.37 % 1) * W;
        if (k < 0.18) { const a = Math.sin(k / 0.18 * Math.PI); c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(230,250,255,${0.7 * a})`; c.lineWidth = 1.5; const y = H * 0.88; c.beginPath(); c.moveTo(gx - 9 * a, y); c.lineTo(gx + 9 * a, y); c.moveTo(gx, y - 9 * a); c.lineTo(gx, y + 9 * a); c.stroke(); c.restore(); }
      },
    };
  }

  /* -------------------------------------------------------------- NEON
     A rooftop rave above the city: a magenta sky with a horizon glow, two
     skylines with lit windows and neon edges, searchlights sweeping, a
     perspective floor pulsing on the beat, rain and floating bokeh. */
  function neon(W, H, fx) {
    const rnd = seeded(13), L = {};
    L.sky = layer(W, H); let g = L.sky.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#06021a'); gr.addColorStop(0.55, '#2a0a45'); gr.addColorStop(0.85, '#7a1a66'); gr.addColorStop(1, '#ff4fa8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // a big striped sun behind the fighter
    const sx = fx + 20, sy = H * 0.6, sr = H * 0.3;
    g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.clip();
    let sg = g.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#ffd34d'); sg.addColorStop(1, '#ff3fa8');
    g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    g.fillStyle = '#2a0a45'; for (let i = 0; i < 7; i++) { const y = sy + sr * (0.05 + i * 0.13); g.fillRect(sx - sr, y, sr * 2, 2 + i * 1.4); }
    g.restore();
    const skyline = (base, minH, maxH, col, lit, edge) => {
      const c2 = layer(W, H), g2 = c2.getContext('2d');
      let x = -10;
      while (x < W + 10) {
        const w = 26 + rnd() * 50, h = minH + rnd() * (maxH - minH), top = base - h;
        g2.fillStyle = col; g2.fillRect(x, top, w, H - top);
        if (rnd() < 0.25) g2.fillRect(x + w * 0.4, top - h * 0.15, 3, h * 0.15);   // antenna
        for (let wy = top + 6; wy < base - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) if (rnd() < lit) { g2.fillStyle = pick3(rnd, ['rgba(79,216,255,0.75)', 'rgba(255,79,216,0.7)', 'rgba(255,211,77,0.6)']); g2.fillRect(wx, wy, 2.5, 3); }
        if (edge && rnd() < 0.5) { g2.fillStyle = edge[Math.floor(rnd() * edge.length)]; g2.fillRect(x, top, w, 2); }
        x += w + 2;
      }
      return c2;
    };
    L.far = skyline(H * 0.86, H * 0.18, H * 0.5, '#1a0830', 0.18, null);
    L.mid = skyline(H * 0.92, H * 0.12, H * 0.36, '#0d0420', 0.1, ['#ff4fd8', '#4fd8ff']);
    // neon sign shapes on the mid skyline (no lettering): a ring, a chevron, vertical bars
    L.signs = layer(W, H); g = L.signs.getContext('2d');
    g.lineCap = 'round';
    const glowLine = (draw, col) => { for (const [w, a] of [[9, 0.15], [4, 0.4], [1.8, 1]]) { g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = w; draw(); } g.globalAlpha = 1; };
    glowLine(() => { g.beginPath(); g.arc(W * 0.12, H * 0.42, H * 0.07, 0, Math.PI * 2); g.stroke(); }, '#4fd8ff');
    glowLine(() => { g.beginPath(); g.moveTo(W * 0.92, H * 0.3); g.lineTo(W * 0.95, H * 0.36); g.lineTo(W * 0.92, H * 0.42); g.stroke(); }, '#ff4fd8');
    glowLine(() => { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(W * 0.3 + i * 8, H * 0.5); g.lineTo(W * 0.3 + i * 8, H * 0.66); g.stroke(); } }, '#ffd34d');
    const B = Array.from({ length: 18 }, () => ({ x: rnd() * W, y: rnd() * H, r: 6 + rnd() * 16, c: pick3(rnd, ['79,216,255', '255,79,216', '255,211,77']), ph: rnd() * 6, v: 4 + rnd() * 8 }));
    const R = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * H, l: 10 + rnd() * 18, v: 500 + rnd() * 300 }));
    return {
      draw(c, t, cam) {
        c.drawImage(L.sky, 0, 0);
        // searchlights sweeping up from the city
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const bx = W * (0.15 + i * 0.25), a = -Math.PI / 2 + Math.sin(t * (0.35 + i * 0.07) + i * 2) * 0.55, ln = H * 1.4;
          const col = i % 2 ? '79,216,255' : '255,79,216';
          const lg = c.createLinearGradient(bx, H, bx + Math.cos(a) * ln, H + Math.sin(a) * ln);
          lg.addColorStop(0, `rgba(${col},0.22)`); lg.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = lg; c.beginPath(); c.moveTo(bx, H); c.lineTo(bx + Math.cos(a - 0.05) * ln, H + Math.sin(a - 0.05) * ln); c.lineTo(bx + Math.cos(a + 0.05) * ln, H + Math.sin(a + 0.05) * ln); c.closePath(); c.fill();
        }
        c.restore();
        c.drawImage(L.far, cam * 0.25, 0);
        c.drawImage(L.mid, cam * 0.5, 0);
        // the signs flicker now and then, like real tubes
        c.globalAlpha = Math.sin(t * 23) > 0.96 ? 0.35 : 1; c.drawImage(L.signs, cam * 0.5, 0); c.globalAlpha = 1;
        // the rooftop floor: a perspective grid that pulses on the beat
        const beat = Math.pow(1 - (t * 2.1 % 1), 3), fy = H * 0.9;
        c.fillStyle = '#0a0318'; c.fillRect(0, fy, W, H - fy);
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = `rgba(255,79,216,${0.35 + beat * 0.4})`; c.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) { const y = fy + Math.pow(i / 6, 1.8) * (H - fy) + ((t * 30) % 8) * (i / 6); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        c.strokeStyle = `rgba(79,216,255,${0.3 + beat * 0.3})`;
        for (let i = -12; i <= 12; i++) { const x = fx + i * 60; c.beginPath(); c.moveTo(fx + i * 8, fy); c.lineTo(x, H); c.stroke(); }
        c.restore();
        // bokeh drifting up
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const b of B) { const y = ((b.y - t * b.v) % H + H) % H, a = 0.08 + 0.06 * Math.sin(t + b.ph); const bg = c.createRadialGradient(b.x, y, 0, b.x, y, b.r); bg.addColorStop(0, `rgba(${b.c},${a * 2})`); bg.addColorStop(1, `rgba(${b.c},0)`); c.fillStyle = bg; c.fillRect(b.x - b.r, y - b.r, b.r * 2, b.r * 2); }
        c.restore();
      },
      front(c, t) {
        // fine rain catching the neon
        c.save(); c.strokeStyle = 'rgba(200,220,255,0.22)'; c.lineWidth = 1;
        c.beginPath();
        for (const r of R) { const y = (r.y + t * r.v) % (H + 30) - 15, x = (r.x - t * r.v * 0.15 % W + W) % W; c.moveTo(x, y); c.lineTo(x - r.l * 0.15, y + r.l); }
        c.stroke(); c.restore();
      },
    };
  }
  function pick3(rnd, a) { return a[Math.floor(rnd() * a.length)]; }

  const BUILD = { sakura, frost, neon };

  // grade the frame: keep the left (title side) dark, vignette the corners,
  // and a warm-or-cool backlight right behind the fighter
  function grade(c, W, H, fx, col) {
    const lg = c.createLinearGradient(0, 0, W * 0.62, 0);
    lg.addColorStop(0, 'rgba(8,6,14,0.78)'); lg.addColorStop(0.55, 'rgba(8,6,14,0.42)'); lg.addColorStop(1, 'rgba(8,6,14,0)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    const vg = c.createRadialGradient(fx, H * 0.55, H * 0.3, fx, H * 0.55, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    const bl = c.createRadialGradient(fx, H * 0.62, 0, fx, H * 0.62, H * 0.75);
    bl.addColorStop(0, col.replace('A', '0.32')); bl.addColorStop(1, col.replace('A', '0'));
    c.fillStyle = bl; c.fillRect(0, 0, W, H);
    c.restore();
  }
  const BACKLIGHT = { sakura: 'rgba(120,40,90,A)', frost: 'rgba(190,230,255,A)', neon: 'rgba(255,90,210,A)' };

  function mount(canvas, theme, focusEl) {
    stop();
    if (!canvas || !BUILD[theme]) return;
    const host = canvas.parentElement;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = { canvas, theme, focusEl, t0: performance.now(), w: 0, h: 0, scene: null, fx: 0 };
    cur = st;
    // the fighter's art may still be decoding: re-frame once it has a size
    if (focusEl && focusEl.tagName === 'IMG' && !focusEl.complete) focusEl.addEventListener('load', () => { st.w = 0; }, { once: true });
    const setup = () => {
      const r = host.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
      if (W === st.w && H === st.h && st.scene) return;
      st.w = W; st.h = H; st.dpr = dpr;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // frame the scene on the fighter (fall back to the right third)
      const fr = focusEl && focusEl.getBoundingClientRect();
      st.fx = fr && fr.width ? fr.left + fr.width / 2 - r.left : W * 0.68;
      st.scene = BUILD[theme](W + 40, H, st.fx + 20);   // 40px spare for the camera drift
    };
    const frame = now => {
      // stop once the screen is gone or hidden; reopening the event screen mounts a fresh scene
      if (cur !== st || !canvas.isConnected || canvas.offsetParent === null) { if (cur === st) cur = null; return; }
      setup();
      const t = (now - st.t0) / 1000, W = st.w, H = st.h, c = canvas.getContext('2d');
      c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      // a slow push across the plate, eased so it never jerks
      const cam = -20 + Math.sin(t * 0.12) * 20;
      c.save(); c.translate(-20, 0);
      st.scene.draw(c, t, cam);
      grade(c, W + 40, H, st.fx + 20, BACKLIGHT[theme]);
      st.scene.front(c, t);
      c.restore();
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; cur = null; }
  // tests: time n frames of a scene's drawing on its own
  function bench(theme, W = 1140, H = 280, n = 60) {
    const c = layer(W, H).getContext('2d'), sc = BUILD[theme](W + 40, H, W * 0.68), t0 = performance.now();
    for (let i = 0; i < n; i++) { sc.draw(c, i / 60, 0); grade(c, W + 40, H, W * 0.68, BACKLIGHT[theme]); sc.front(c, i / 60); }
    return (performance.now() - t0) / n;
  }
  return { mount, stop, bench };
})();
