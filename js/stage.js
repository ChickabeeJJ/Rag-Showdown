'use strict';
/* =========================================================================
   Stages: cinematic layered backdrops in the spirit of Element Rag's
   Backdrop. Far, mid and near layers are painted once into offscreen
   canvases (far ones at lower resolution, so they read soft like depth of
   field), with haze between them. Structures are shaded with vertical
   light, rim light and contact shadows so nothing floats. Each frame adds
   the sky, light (sun, god rays, neon, aurora, spotlights), animated props
   (lanterns, trains, crowd), the floor's reflections, weather (layered
   rain with splashes and lightning, snow, petals, embers), a foreground
   frame and a colour grade with a vignette.
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
  function vgrad(g, y0, y1, c0, c1, c2) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0); if (c2) { gr.addColorStop(0.55, c1); gr.addColorStop(1, c2); } else gr.addColorStop(1, c1);
    return gr;
  }
  function ridge(g, base, amp, fill, rnd, opts = {}) {
    const ph = [rnd() * 10, rnd() * 10, rnd() * 10];
    const f1 = opts.f1 || 0.0021, f2 = opts.f2 || 0.0057, f3 = opts.f3 || 0.013;
    const y = x => {
      let n = Math.sin(x * f1 + ph[0]) * 0.55 + Math.sin(x * f2 + ph[1]) * 0.3 + Math.sin(x * f3 + ph[2]) * 0.15;
      if (opts.peaky) n = 1 - Math.abs(n) * 2;
      return base - n * amp;
    };
    g.fillStyle = fill;
    g.beginPath(); g.moveTo(X0, GROUND + 20);
    for (let x = X0; x <= X1; x += 8) g.lineTo(x, y(x));
    g.lineTo(X1, GROUND + 20); g.closePath(); g.fill();
    if (opts.rim) {
      // a thin rim of light along the crest
      g.strokeStyle = opts.rim; g.lineWidth = opts.rimW || 2;
      g.beginPath(); for (let x = X0; x <= X1; x += 8) (x === X0 ? g.moveTo(x, y(x)) : g.lineTo(x, y(x))); g.stroke();
    }
    return y;
  }
  function haze(g, top, bottom, color, a) {
    g.fillStyle = vgrad(g, top, bottom, rgba(color, 0), rgba(color, a));
    g.fillRect(X0, top, SPAN, bottom - top);
  }
  // a soft dark contact shadow so props sit on the ground
  function contact(g, x, y, w, a = 0.35) {
    const gr = g.createRadialGradient(x, y, 0, x, y, w);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, 0.22); g.translate(-x, -y);
    g.beginPath(); g.arc(x, y, w, 0, TAU); g.fill(); g.restore();
  }
  function pine(g, x, base, h, dark, light, snow) {
    for (let i = 0; i < 5; i++) {
      const w = h * (0.46 - i * 0.075), y = base - h * (0.14 + i * 0.18);
      g.fillStyle = dark;
      g.beginPath(); g.moveTo(x - w, y + h * 0.2); g.quadraticCurveTo(x - w * 0.3, y + h * 0.12, x, y - h * 0.16); g.quadraticCurveTo(x + w * 0.3, y + h * 0.12, x + w, y + h * 0.2); g.closePath(); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.moveTo(x - w * 0.9, y + h * 0.19); g.quadraticCurveTo(x - w * 0.3, y + h * 0.1, x, y - h * 0.14); g.lineTo(x - w * 0.1, y + h * 0.16); g.closePath(); g.fill();
      if (snow) { g.fillStyle = snow; g.beginPath(); g.moveTo(x - w * 0.55, y + h * 0.05); g.quadraticCurveTo(x, y - h * 0.2, x + w * 0.55, y + h * 0.05); g.quadraticCurveTo(x, y - h * 0.08, x - w * 0.55, y + h * 0.05); g.fill(); }
    }
    g.fillStyle = dark; g.fillRect(x - h * 0.025, base - h * 0.14, h * 0.05, h * 0.14);
  }
  function pagoda(g, x, base, h, col, lit) {
    const tiers = 5, th = h / tiers;
    g.fillStyle = col;
    g.fillRect(x - h * 0.26, base - 6, h * 0.52, 6);
    for (let i = 0; i < tiers; i++) {
      const w = h * (0.3 - i * 0.045), y = base - i * th;
      g.fillStyle = col; g.fillRect(x - w * 0.55, y - th * 0.72, w * 1.1, th * 0.72);
      if (lit) { g.fillStyle = lit; for (let k = -1; k <= 1; k++) g.fillRect(x + k * w * 0.32 - 2, y - th * 0.5, 4, th * 0.3); }
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x - w * 1.15, y - th * 0.6); g.quadraticCurveTo(x - w * 0.5, y - th * 0.82, x, y - th * 1.02); g.quadraticCurveTo(x + w * 0.5, y - th * 0.82, x + w * 1.15, y - th * 0.6); g.lineTo(x + w * 0.95, y - th * 0.72); g.quadraticCurveTo(x, y - th * 0.92, x - w * 0.95, y - th * 0.72); g.closePath(); g.fill();
    }
    g.fillRect(x - 2, base - h - th * 0.9, 4, th);
  }
  // a five-petal blossom
  function blossom(g, x, y, r, col, eye, rot) {
    g.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const a = rot + k * TAU / 5;
      g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.38, a, 0, TAU); g.fill();
    }
    g.fillStyle = eye; g.beginPath(); g.arc(x, y, r * 0.22, 0, TAU); g.fill();
  }
  // cherry tree: a dark forked trunk that splits into twigs, and a canopy of
  // soft lobed blossom clusters: shadowed underneath, lit from the upper left,
  // with single flowers dotted round the edges and twigs showing through
  function cherry(g, x, base, s, rnd, tones) {
    const [deep, mid, light] = tones, bark = '#3e2626';
    g.strokeStyle = bark; g.lineCap = 'round';
    const tips = [], twigs = [];
    const limb = (x0, y0, ang, len, w, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + rnd() * 10 - 5, (y0 + y1) / 2, x1, y1); g.stroke();
      if (depth <= 1) twigs.push([x0, y0, x1, y1, w]);
      if (depth <= 0) { tips.push([x1, y1]); return; }
      limb(x1, y1, ang - 0.45 - rnd() * 0.3, len * 0.72, w * 0.62, depth - 1);
      limb(x1, y1, ang + 0.35 + rnd() * 0.3, len * 0.7, w * 0.6, depth - 1);
    };
    limb(x, base, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 90 * s, 16 * s, 3);
    // cluster centres around the branch tips
    const cl = [];
    for (const [bx, by] of tips) for (let k = 0; k < 2; k++) cl.push([bx + (rnd() - 0.5) * 36 * s, by + (rnd() - 0.65) * 26 * s, (26 + rnd() * 14) * s]);
    // each cluster is many small puffs inside an ellipse
    const puffs = cl.map(([cx, cy, R]) => {
      const out = [];
      for (let k = 0; k < 16; k++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R; out.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, (7 + rnd() * 7) * s, d / R, Math.cos(a), Math.sin(a)]); }
      return out;
    });
    // shadow pass, offset down and right
    g.fillStyle = deep;
    for (const P of puffs) for (const [px, py, r] of P) { g.beginPath(); g.arc(px + 3 * s, py + 4 * s, r, 0, TAU); g.fill(); }
    // body pass
    g.fillStyle = mid;
    for (const P of puffs) for (const [px, py, r] of P) { g.beginPath(); g.arc(px, py, r * 0.94, 0, TAU); g.fill(); }
    // twigs poking through the lower canopy
    g.strokeStyle = bark;
    for (const [x0, y0, x1, y1, w] of twigs) if (rnd() < 0.5) { g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(lerp(x0, x1, 0.5), lerp(y0, y1, 0.5)); g.lineTo(x1, y1); g.stroke(); }
    // light on the upper-left puffs
    g.fillStyle = light;
    for (const P of puffs) for (const [px, py, r, dd, ca, sa] of P) if (ca * 0.6 + sa < -0.25 && dd > 0.3) { g.beginPath(); g.arc(px - r * 0.25, py - r * 0.3, r * 0.6, 0, TAU); g.fill(); }
    // single flowers round the edges, and a few fallen in the grass
    for (const P of puffs) for (const [px, py, r, dd] of P) if (dd > 0.7 && rnd() < 0.55) blossom(g, px + (rnd() - 0.5) * r, py + (rnd() - 0.5) * r, (3 + rnd() * 2.5) * s, rnd() < 0.5 ? light : '#fff0f5', deep, rnd() * TAU);
    for (let k = 0; k < 6; k++) blossom(g, x + (rnd() - 0.5) * 120 * s, base + (rnd() - 0.3) * 8, 2.6 * s, light, deep, rnd() * TAU);
  }
  function glowDisc(ctx, x, y, r, col, a) { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, col, x, y, r, a); ctx.globalCompositeOperation = 'source-over'; }
  function drawLayer(ctx, L, cam, par) { ctx.drawImage(L.c, X0 + (cam.x - 800) * par, 0, SPAN, L.h); }
  function rays(ctx, x, y, col, a, time, n = 9, len = 1400, spread = 1.2, center = Math.PI / 2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = center + (n > 1 ? i / (n - 1) - 0.5 : 0) * spread + Math.sin(time * 0.2 + i) * 0.03;
      const w = 0.03 + (i % 3) * 0.014;
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
  // made-up glyphs for signs: stroke clusters that read as lettering without being any real script
  function glyph(g, x, y, s, rnd) {
    g.beginPath();
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const t = rnd();
      if (t < 0.4) { const yy = y + (rnd() - 0.5) * s; g.moveTo(x - s * 0.45, yy); g.lineTo(x + s * 0.45, yy); }
      else if (t < 0.7) { const xx = x + (rnd() - 0.5) * s * 0.8; g.moveTo(xx, y - s * 0.5); g.lineTo(xx + (rnd() - 0.5) * s * 0.3, y + s * 0.5); }
      else { g.moveTo(x - s * 0.4, y - s * 0.4); g.quadraticCurveTo(x + s * 0.4, y - s * 0.3, x + (rnd() - 0.5) * s * 0.4, y + s * 0.5); }
    }
    g.stroke();
  }
  function cloudBank(g, y, rnd, col, n, rmin, rmax) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = X0 + rnd() * SPAN, r = rmin + rnd() * (rmax - rmin);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (k - 2) * r * 0.7, y + (rnd() - 0.5) * r * 0.3, r * (0.8 + rnd() * 0.5), r * 0.45, 0, 0, TAU); g.fill(); }
    }
  }

  /* ---------------------------------------------------------- stage art */
  const ART = {};

  /* Sunset Dojo ------------------------------------------------------ */
  ART.dojo = {
    sky: ['#e2794b', '#ffb36b', '#ffe3b0'], amb: 'dust', sun: [800, 470, '#fff3cf'], grade: ['#ff9a4a', 0.08], vignette: 0.45,
    build(d, rnd) {
      d.far = layer(0.4, g => {
        cloudBank(g, 260, rnd, 'rgba(255,214,170,0.35)', 14, 40, 90);
        const y0 = ridge(g, 560, 120, vgrad(g, 420, 800, '#e99a72', '#d7845e'), rnd, { peaky: true, rim: 'rgba(255,230,190,0.6)' });
        haze(g, 420, 800, '#ffcf9a', 0.5);
        pagoda(g, 280, y0(280) + 18, 150, '#c97a58', 'rgba(255,220,150,0.5)');
        pagoda(g, 1560, y0(1560) + 18, 120, '#c97a58', 'rgba(255,220,150,0.5)');
        ridge(g, 650, 80, vgrad(g, 560, 800, '#c26c4a', '#a8573a'), rnd, { rim: 'rgba(255,200,150,0.4)' });
        haze(g, 540, 800, '#ffc890', 0.35);
      });
      d.mid = layer(0.55, g => {
        const y = ridge(g, 708, 40, vgrad(g, 640, 800, '#8f4a35', '#6e3426'), rnd, { f1: 0.004 });
        for (let x = X0; x < X1; x += 34 + rnd() * 36) pine(g, x, y(x) + 10, 80 + rnd() * 90, '#6c3426', '#8c4a33');
        haze(g, 600, 800, '#ffb27a', 0.28);
      });
      d.near = layer(0.85, g => {
        // the dojo hall on a stone plinth, with an engawa porch down to the floor
        const L = 300, R = 1300;
        g.fillStyle = vgrad(g, 740, 800, '#7a6b5e', '#4e443b'); g.fillRect(L - 50, 740, R - L + 100, 60);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(L - 50, 740, R - L + 100, 3);
        g.fillStyle = vgrad(g, 556, 740, '#5a3322', '#3e2216'); g.fillRect(L, 556, R - L, 184);
        for (let i = 0; i < 7; i++) {
          const x = L + 18 + i * 140;
          g.fillStyle = vgrad(g, 580, 735, '#ffe9b8', '#f2c27a'); g.fillRect(x, 580, 120, 155);
          g.strokeStyle = '#5c321f'; g.lineWidth = 6; g.strokeRect(x, 580, 120, 155);
          g.lineWidth = 2.5; g.beginPath();
          for (let k = 1; k < 4; k++) { g.moveTo(x + k * 30, 580); g.lineTo(x + k * 30, 735); }
          for (let k = 1; k < 5; k++) { g.moveTo(x, 580 + k * 31); g.lineTo(x + 120, 580 + k * 31); }
          g.stroke();
        }
        g.fillStyle = '#2e1a10'; for (let i = 0; i <= 7; i++) g.fillRect(L + 2 + i * 140, 548, 16, 192);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(L, 556, R - L, 14);
        // sweeping roofs with tile lines and flared ends
        const roof = (y, w, h, col) => {
          g.fillStyle = col;
          g.beginPath(); g.moveTo(800 - w, y + 20); g.quadraticCurveTo(800 - w * 0.55, y - 4, 800 - w * 0.4, y - h); g.lineTo(800 + w * 0.4, y - h); g.quadraticCurveTo(800 + w * 0.55, y - 4, 800 + w, y + 20); g.lineTo(800 + w - 36, y + 30); g.lineTo(800 - w + 36, y + 30); g.closePath(); g.fill();
          g.save(); g.clip();
          g.strokeStyle = 'rgba(255,190,130,0.12)'; g.lineWidth = 2;
          for (let k = -w; k < w; k += 16) { g.beginPath(); g.moveTo(800 + k, y - h); g.lineTo(800 + k * 1.25, y + 30); g.stroke(); }
          g.fillStyle = vgrad(g, y - h, y + 30, 'rgba(255,200,140,0.18)', 'rgba(0,0,0,0)'); g.fillRect(800 - w, y - h, w * 2, h + 30);
          g.restore();
          g.fillStyle = '#c99a4a'; g.beginPath(); g.arc(800 - w + 6, y + 22, 7, 0, TAU); g.arc(800 + w - 6, y + 22, 7, 0, TAU); g.fill();
        };
        roof(546, 590, 74, '#24130c');
        g.fillStyle = vgrad(g, 420, 480, '#5a3322', '#3e2216'); g.fillRect(560, 420, 480, 70);
        for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,214,150,0.55)'; g.fillRect(590 + i * 112, 436, 70, 36); }
        roof(430, 340, 72, '#24130c');
        g.fillStyle = '#2a170e'; g.fillRect(796, 300, 8, 64);
        g.fillStyle = '#d9a441'; g.beginPath(); g.arc(800, 298, 9, 0, TAU); g.fill();
        // a low wooden fence that runs off to both sides of the hall, posts standing on the floor
        for (const [a, b] of [[X0, L - 60], [R + 60, X1]]) {
          g.fillStyle = vgrad(g, 700, 800, '#6b3e26', '#4a2a1a'); g.fillRect(a, 712, b - a, 10); g.fillRect(a, 752, b - a, 10);
          for (let x = a + 20; x < b; x += 70) { g.fillStyle = '#3f2416'; g.fillRect(x, 700, 12, 100); g.fillStyle = 'rgba(255,200,150,0.25)'; g.fillRect(x, 700, 3, 100); }
        }
        // stone lanterns at the hall's corners
        for (const x of [L - 120, R + 120]) {
          contact(g, x, 800, 60, 0.4);
          g.fillStyle = vgrad(g, 640, 800, '#a49c92', '#7a736b');
          g.fillRect(x - 12, 700, 24, 100); g.fillRect(x - 40, 684, 80, 18); g.fillRect(x - 28, 640, 56, 46); g.fillRect(x - 44, 622, 88, 20); g.fillRect(x - 10, 604, 20, 20);
          g.fillStyle = '#ffd98a'; g.fillRect(x - 16, 650, 32, 26);
          d.lamps.push([x, 662]);
        }
      });
      d.floor = 'wood';
    },
    front(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.3;
      for (let i = 0; i < 6; i++) {
        const x = 388 + i * 165 + off, sw = Math.sin(time * 1.3 + i) * 5;
        ctx.strokeStyle = '#24130c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 566); ctx.lineTo(x + sw, 594); ctx.stroke();
        glowDisc(ctx, x + sw, 610, 80, '#ffb347', 0.5 + Math.sin(time * 3 + i) * 0.06);
        ctx.fillStyle = vgrad(ctx, 592, 628, '#ff6a4a', '#c8281c'); ctx.beginPath(); ctx.ellipse(x + sw, 610, 13, 18, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#24130c'; ctx.fillRect(x + sw - 8, 591, 16, 4); ctx.fillRect(x + sw - 8, 625, 16, 4);
      }
      for (const [x, y] of d.lamps) glowDisc(ctx, x + off, y, 80, '#ffcf6a', 0.5 + Math.sin(time * 4 + x) * 0.05);
    },
    afterMid(ctx, d, time, vr, cam) { rays(ctx, 800 + (cam.x - 800) * 0.95, 470, '#fff0c8', 0.08, time, 11, 1300, 2.6, -Math.PI / 2); },
  };

  /* Neon Rooftop: a rain-soaked night city ------------------------- */
  ART.city = {
    sky: ['#05060f', '#141032', '#3b1f4e'], amb: 'rain', grade: ['#4a3aff', 0.06], vignette: 0.55,
    build(d, rnd) {
      d.clouds = layer(0.3, g => {
        // low storm clouds lit from below by the city
        for (let i = 0; i < 26; i++) {
          const x = X0 + rnd() * SPAN, y = 80 + rnd() * 220, r = 120 + rnd() * 200;
          const gr = g.createRadialGradient(x, y + r * 0.3, 0, x, y, r);
          gr.addColorStop(0, 'rgba(120,70,140,0.35)'); gr.addColorStop(0.6, 'rgba(40,28,70,0.45)'); gr.addColorStop(1, 'rgba(20,16,40,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU); g.fill();
        }
      }, 520);
      // the far skyline: stepped towers, spires and masts, lit from the streets below
      d.far = layer(0.42, g => {
        const tower = (x, w, top) => {
          const kind = rnd();
          g.fillStyle = vgrad(g, top, 800, '#1d1a3e', '#2c2150', '#3c2756');
          g.fillRect(x, top, w, 800 - top);
          if (kind < 0.35) { g.fillRect(x + w * 0.15, top - 40, w * 0.7, 42); g.fillRect(x + w * 0.32, top - 70, w * 0.36, 32); }
          else if (kind < 0.55) { g.beginPath(); g.moveTo(x + w * 0.2, top); g.lineTo(x + w * 0.5, top - 90); g.lineTo(x + w * 0.8, top); g.fill(); g.fillRect(x + w * 0.5 - 1.5, top - 140, 3, 60); d.masts.push([x + w * 0.5, top - 140]); }
          else if (kind < 0.7) { g.fillRect(x + w * 0.45, top - 60, 3, 60); d.masts.push([x + w * 0.45 + 1.5, top - 60]); }
          // sparse window lights in clusters of floors
          for (let y = top + 10; y < 790; y += 10) {
            if (rnd() < 0.55) continue;
            for (let xx = x + 4; xx < x + w - 4; xx += 7) if (rnd() < 0.35) { g.fillStyle = rnd() < 0.7 ? 'rgba(255,214,150,0.55)' : 'rgba(150,210,255,0.5)'; g.fillRect(xx, y, 3, 4); }
          }
        };
        for (let x = X0; x < X1;) { const w = 50 + rnd() * 90; tower(x, w, 360 + rnd() * 240); x += w + rnd() * 10; }
        // a lattice broadcast tower
        const tx = 1450, base = 800, top = 170;
        g.strokeStyle = '#3a2a58'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(tx - 60, base); g.lineTo(tx - 6, top); g.lineTo(tx + 6, top); g.lineTo(tx + 60, base);
        for (let y = base; y > top + 20; y -= 40) { const k = (y - top) / (base - top), w = 6 + 54 * k, w2 = 6 + 54 * ((y - 40 - top) / (base - top)); g.moveTo(tx - w, y); g.lineTo(tx + w2, y - 40); g.moveTo(tx + w, y); g.lineTo(tx - w2, y - 40); g.moveTo(tx - w, y); g.lineTo(tx + w, y); }
        g.stroke(); d.masts.push([tx, top]);
        haze(g, 380, 800, '#a0407a', 0.4);
      });
      // mid buildings with real facades, rooftop kit, and signs that glow each frame
      d.mid = layer(0.62, g => {
        let x = X0;
        while (x < X1) {
          const w = 120 + rnd() * 150, top = 260 + rnd() * 250;
          const lit = 0.15 + rnd() * 0.45, warm = rnd() < 0.6;
          g.fillStyle = vgrad(g, top, 800, '#121029', '#17142f', '#22183a');
          g.fillRect(x, top, w, 800 - top);
          // setback crown
          if (rnd() < 0.5) { g.fillRect(x + w * 0.12, top - 26, w * 0.76, 28); }
          // window grid: mullions, lit floors in clusters, unlit glass catching a little light
          for (let y = top + 14; y < 790; y += 18) {
            const floorLit = rnd() < lit;
            for (let xx = x + 8; xx < x + w - 14; xx += 14) {
              if (floorLit && rnd() < 0.85) { g.fillStyle = warm ? (rnd() < 0.85 ? '#ffd79a' : '#fff1d0') : (rnd() < 0.8 ? '#9fdcff' : '#e2f4ff'); g.globalAlpha = 0.55 + rnd() * 0.35; }
              else { g.fillStyle = '#2a2650'; g.globalAlpha = 0.6; }
              g.fillRect(xx, y, 9, 11);
            }
          }
          g.globalAlpha = 1;
          // neon rim light down one edge
          const rim = pick(['#ff4fa3', '#4fd8ff', '#b06bff']);
          g.fillStyle = rgba(rim, 0.35); g.fillRect(x + w - 3, top, 3, 800 - top);
          // rooftop kit: water tank on legs, AC boxes, antennas
          if (rnd() < 0.45) { const tx = x + w * (0.25 + rnd() * 0.5); g.fillStyle = '#0d0b1e'; g.fillRect(tx - 18, top - 46, 36, 30); g.beginPath(); g.moveTo(tx - 21, top - 45); g.lineTo(tx, top - 60); g.lineTo(tx + 21, top - 45); g.fill(); g.fillRect(tx - 15, top - 16, 4, 16); g.fillRect(tx + 11, top - 16, 4, 16); }
          if (rnd() < 0.5) { g.fillStyle = '#0d0b1e'; g.fillRect(x + 10, top - 12, 26, 12); g.fillRect(x + 42, top - 9, 18, 9); }
          if (rnd() < 0.4) { g.fillStyle = '#0d0b1e'; g.fillRect(x + w * 0.8, top - 70, 2, 70); d.mastsMid.push([x + w * 0.8 + 1, top - 70]); }
          // signs: tall vertical boards with glyph rows, or wide boards across the facade
          if (rnd() < 0.75) {
            const vert = rnd() < 0.6, c = pick(['#ff4fa3', '#4fd8ff', '#ffd34d', '#b06bff', '#ff6a3d']);
            const sx = vert ? x + (rnd() < 0.5 ? -6 : w - 26) : x + w * 0.15, sy = top + 40 + rnd() * 160;
            const sw = vert ? 32 : w * 0.7, sh = vert ? 110 + rnd() * 90 : 34;
            d.signs.push({ x: sx, y: sy, w: sw, h: sh, c, vert, ph: rnd() * 10, seed: Math.floor(rnd() * 1e6) });
            g.fillStyle = '#0a0918'; g.fillRect(sx - 3, sy - 3, sw + 6, sh + 6);
            if (vert) { g.fillRect(sx + sw / 2 - 1, sy - 20, 2, 20); }
          }
          x += w + 6 + rnd() * 26;
        }
        // one big LED screen
        d.screen = { x: 520, y: 230, w: 240, h: 130 };
        g.fillStyle = '#07060f'; g.fillRect(510, 220, 260, 150); g.fillRect(560, 370, 6, 60); g.fillRect(714, 370, 6, 60);
        haze(g, 420, 800, '#5a2a6a', 0.35);
      });
      // an elevated rail line crossing the city
      d.rail = layer(0.8, g => {
        g.fillStyle = vgrad(g, 600, 640, '#1a1730', '#0d0b1c'); g.fillRect(X0, 604, SPAN, 22);
        g.fillStyle = 'rgba(255,120,200,0.25)'; g.fillRect(X0, 604, SPAN, 2);
        for (let x = X0; x < X1; x += 260) { g.fillStyle = vgrad(g, 626, 800, '#141226', '#0b0a18'); g.fillRect(x, 626, 26, 174); g.fillRect(x - 14, 626, 54, 12); }
      });
      // the rooftop we fight on: parapet, railing, vents and a stair hut, all standing on the roof
      d.near = layer(1, g => {
        g.fillStyle = vgrad(g, 700, 800, '#3a3a4c', '#232332'); g.fillRect(X0, 706, SPAN, 94);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X0, 706, SPAN, 3);
        // concrete stains and panel seams
        for (let x = X0; x < X1; x += 120) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 709, 2, 91); }
        for (let i = 0; i < 60; i++) { const x = X0 + rnd() * SPAN; g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 720 + rnd() * 30, 6 + rnd() * 14, 40 + rnd() * 40); }
        // railing
        g.strokeStyle = '#5a5c72'; g.lineWidth = 4; g.beginPath(); g.moveTo(X0, 668); g.lineTo(X1, 668); g.moveTo(X0, 688); g.lineTo(X1, 688); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X0, 666); g.lineTo(X1, 666); g.stroke();
        g.fillStyle = '#4a4c60'; for (let x = X0; x < X1; x += 80) g.fillRect(x, 664, 5, 44);
        // stair hut with a lit door, outside the arena on the left; vents on the right
        g.fillStyle = vgrad(g, 560, 800, '#2e2e40', '#1c1c2a'); g.fillRect(-180, 560, 190, 240);
        g.fillStyle = '#16161f'; g.fillRect(-200, 548, 230, 16);
        g.fillStyle = '#ffd79a'; g.fillRect(-120, 640, 60, 160);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-120, 640, 60, 8);
        d.lamps.push([-90, 630]);
        for (const x of [1620, 1720]) {
          contact(g, x + 50, 800, 80, 0.45);
          g.fillStyle = vgrad(g, 720, 800, '#4a4c60', '#2c2d3c'); g.fillRect(x, 720, 100, 80);
          g.fillStyle = '#1d1e2a'; g.beginPath(); g.arc(x + 50, 760, 26, 0, TAU); g.fill();
          g.strokeStyle = '#5a5c72'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 24, 760); g.lineTo(x + 76, 760); g.moveTo(x + 50, 734); g.lineTo(x + 50, 786); g.stroke();
        }
      });
      d.floor = 'wet';
    },
    back(ctx, d, time, vr, cam) {
      // city glow at the horizon, under the clouds
      const off = (cam.x - 800) * 0.9;
      glowDisc(ctx, 800 + off, 640, 1200, '#ff4f9a', 0.25);
      if (d.clouds) drawLayer(ctx, d.clouds, cam, 0.93);
      lightning(ctx, d, time, vr, cam);
    },
    afterFar(ctx, d, time, vr, cam) {
      // blinking aircraft lights on the far masts
      const off = (cam.x - 800) * 0.85;
      ctx.globalCompositeOperation = 'lighter';
      d.masts.forEach(([x, y], i) => { if (Math.sin(time * 2.2 + i * 1.3) > 0.4) Glow.draw(ctx, '#ff3b3b', x + off, y, 16, 0.9); });
      ctx.globalCompositeOperation = 'source-over';
    },
    afterMid(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.6;
      ctx.globalCompositeOperation = 'lighter';
      d.mastsMid.forEach(([x, y], i) => { if (Math.sin(time * 1.8 + i * 2.1) > 0.5) Glow.draw(ctx, '#ff3b3b', x + off, y, 14, 0.9); });
      ctx.globalCompositeOperation = 'source-over';
      // the LED screen cycles colour washes and bars
      const s = d.screen, sx = s.x + off;
      const hue = (time * 30) % 360;
      const g = ctx.createLinearGradient(sx, s.y, sx + s.w, s.y + s.h);
      g.addColorStop(0, `hsl(${hue},90%,55%)`); g.addColorStop(1, `hsl(${(hue + 80) % 360},90%,45%)`);
      ctx.fillStyle = g; ctx.fillRect(sx, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) { const w = 40 + ((Math.sin(time * 2 + i) + 1) * 0.5) * 140; ctx.fillRect(sx + 20, s.y + 22 + i * 26, w, 10); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = s.y; y < s.y + s.h; y += 4) ctx.fillRect(sx, y, s.w, 1);
      glowDisc(ctx, sx + s.w / 2, s.y + s.h / 2, 260, `hsl(${hue},90%,60%)`, 0.25);
      // neon signs: glowing tubes, glyph rows, occasional flicker
      for (const n of d.signs) {
        const flick = Math.sin(time * 11 + n.ph) > -0.95 && !(Math.sin(time * 0.7 + n.ph) > 0.97) ? 1 : 0.15;
        const x = n.x + off;
        if (x + n.w < vr.x0 - 50 || x > vr.x1 + 50) continue;
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, n.c, x + n.w / 2, n.y + n.h / 2, Math.max(n.w, n.h) * 1.1, 0.35 * flick);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(n.c, 0.22 * flick + 0.05); ctx.fillRect(x, n.y, n.w, n.h);
        ctx.strokeStyle = n.c; ctx.globalAlpha = 0.95 * flick + 0.05; ctx.lineWidth = 2.5; ctx.strokeRect(x + 2, n.y + 2, n.w - 4, n.h - 4);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        const rnd = mulberry32(n.seed);
        if (n.vert) for (let k = 0; k < Math.floor(n.h / 30); k++) glyph(ctx, x + n.w / 2, n.y + 18 + k * 30, 16, rnd);
        else for (let k = 0; k < Math.floor(n.w / 28); k++) glyph(ctx, x + 18 + k * 28, n.y + n.h / 2, 16, rnd);
        ctx.globalAlpha = 1;
      }
    },
    afterRail(ctx, d, time, vr, cam) {
      // a train crossing on the elevated line
      const off = (cam.x - 800) * 0.8;
      const span = 5200, x = ((time * 420) % span) - 1700 + off;
      ctx.fillStyle = '#0c0b18'; ctx.fillRect(x, 572, 900, 34);
      ctx.fillStyle = 'rgba(255,240,200,0.8)';
      for (let k = 0; k < 30; k++) ctx.fillRect(x + 12 + k * 30, 580, 18, 12);
      glowDisc(ctx, x + 900, 590, 120, '#fff6d0', 0.5);
      glowDisc(ctx, x + 450, 590, 500, '#ffe2a0', 0.12);
    },
    front(ctx, d, time, vr, cam) {
      for (const [x, y] of d.lamps) glowDisc(ctx, x + (cam.x - 800) * 0.0, y, 160, '#ffd79a', 0.45);
    },
  };

  /* Sakura Shrine ------------------------------------------------- */
  ART.temple = {
    sky: ['#6fa6e2', '#f2c0d4', '#fff0e4'], amb: 'petals', sun: [1150, 330, '#fff8e6'], noRays: true, grade: ['#ff9fc4', 0.06], vignette: 0.35,
    build(d, rnd) {
      d.far = layer(0.42, g => {
        cloudBank(g, 200, rnd, 'rgba(255,255,255,0.45)', 10, 50, 90);
        // a snow-capped volcano far away, with shading on one flank
        g.fillStyle = vgrad(g, 330, 760, '#a8b6dc', '#c9b6d6');
        g.beginPath(); g.moveTo(260, 760); g.quadraticCurveTo(600, 520, 720, 340); g.lineTo(880, 340); g.quadraticCurveTo(1000, 520, 1340, 760); g.closePath(); g.fill();
        g.fillStyle = 'rgba(80,70,120,0.18)'; g.beginPath(); g.moveTo(800, 340); g.lineTo(880, 340); g.quadraticCurveTo(1000, 520, 1340, 760); g.lineTo(900, 760); g.closePath(); g.fill();
        g.fillStyle = '#f6f8ff';
        g.beginPath(); g.moveTo(720, 340); g.lineTo(880, 340); g.lineTo(935, 395); g.quadraticCurveTo(905, 385, 880, 410); g.quadraticCurveTo(850, 380, 820, 405); g.quadraticCurveTo(790, 378, 760, 412); g.quadraticCurveTo(735, 382, 665, 400); g.closePath(); g.fill();
        haze(g, 380, 800, '#ffd6e2', 0.5);
        const y = ridge(g, 650, 60, vgrad(g, 580, 800, '#cf9fba', '#b98aa6'), rnd, { rim: 'rgba(255,255,255,0.4)' });
        pagoda(g, 1560, y(1560) + 14, 170, '#9e6f8a', 'rgba(255,230,200,0.5)');
        haze(g, 560, 800, '#ffd0de', 0.35);
      });
      d.mid = layer(0.6, g => {
        const y = ridge(g, 722, 24, vgrad(g, 680, 800, '#9a7a88', '#836472'), rnd);
        for (let x = X0 + 40; x < X1; x += 150 + rnd() * 140) cherry(g, x, y(x) + 12, 0.75 + rnd() * 0.4, rnd, ['#d87ea0', '#f7a9c4', '#ffd6e4']);
        haze(g, 520, 800, '#ffd6e2', 0.28);
      });
      d.near = layer(0.85, g => {
        // stone steps and the great torii, standing on the paving
        g.fillStyle = vgrad(g, 760, 800, '#a29890', '#7e756c'); g.fillRect(560, 770, 480, 30);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(560, 770, 480, 2);
        // the torii, low enough to sit fully below the HUD; every beam meets the pillars
        const T = 470;                                   // top of the upper beam
        for (const x of [500, 1100]) {
          contact(g, x, 800, 50, 0.4);
          // pillars taper slightly and run up into the top beam
          g.fillStyle = vgrad(g, T, 800, '#e23a48', '#a8202c');
          g.beginPath(); g.moveTo(x - 19, T + 30); g.lineTo(x + 19, T + 30); g.lineTo(x + 23, 772); g.lineTo(x - 23, 772); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(x - 19, T + 30); g.lineTo(x - 13, T + 30); g.lineTo(x - 17, 772); g.lineTo(x - 23, 772); g.closePath(); g.fill();
          g.fillStyle = '#1e1414'; g.fillRect(x - 27, 768, 54, 32);                // black footings
          g.fillStyle = '#2a1a1a'; g.fillRect(x - 25, T + 92, 50, 8);             // collar where the tie beam passes
        }
        // the tie beam (passes through both pillars, ends sticking out)
        g.fillStyle = vgrad(g, T + 96, T + 124, '#e23a48', '#a8202c'); g.fillRect(434, T + 96, 732, 26);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(434, T + 118, 732, 4);
        // the centre plaque post joining the tie beam to the top beam
        g.fillStyle = '#231616'; g.fillRect(780, T + 34, 40, 64); g.fillStyle = '#d9a441'; g.fillRect(785, T + 40, 30, 50);
        g.fillStyle = '#231616'; g.fillRect(797, T + 46, 6, 38);
        // the top beam: red under-beam and black curved cap with upswept ends
        g.fillStyle = vgrad(g, T + 14, T + 40, '#e23a48', '#b4252f');
        g.beginPath(); g.moveTo(400, T + 30); g.quadraticCurveTo(800, T + 12, 1200, T + 30); g.lineTo(1192, T + 42); g.quadraticCurveTo(800, T + 26, 408, T + 42); g.closePath(); g.fill();
        g.fillStyle = '#231616';
        g.beginPath(); g.moveTo(372, T + 12); g.quadraticCurveTo(800, T - 12, 1228, T + 12); g.lineTo(1246, T - 6); g.lineTo(1236, T + 24); g.quadraticCurveTo(800, T + 2, 364, T + 24); g.lineTo(354, T - 6); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(372, T + 12); g.quadraticCurveTo(800, T - 12, 1228, T + 12); g.lineTo(1226, T + 15); g.quadraticCurveTo(800, T - 8, 374, T + 15); g.closePath(); g.fill();
        for (const x of [210, 1390]) {
          contact(g, x, 800, 70, 0.4);
          g.fillStyle = vgrad(g, 580, 800, '#a9a49c', '#7e7870');
          g.fillRect(x - 13, 690, 26, 110); g.fillRect(x - 42, 672, 84, 20); g.fillRect(x - 30, 622, 60, 52); g.fillRect(x - 50, 602, 100, 22); g.fillRect(x - 11, 582, 22, 22);
          g.fillStyle = '#ffd98a'; g.fillRect(x - 18, 632, 36, 30);
          d.lamps.push([x, 646]);
        }
      });
      d.floor = 'stone';
    },
    front(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.3;
      for (const [x, y] of d.lamps) glowDisc(ctx, x + off, y, 80, '#ffcf6a', 0.45 + Math.sin(time * 4 + x) * 0.05);
    },
    afterMid(ctx, d, time, vr, cam) { rays(ctx, 1150 + (cam.x - 800) * 0.95, 330, '#fff4f0', 0.06, time, 7, 1200, 0.9, Math.PI * 0.62); },
  };

  /* Bamboo Grove -------------------------------------------------- */
  ART.forest = {
    sky: ['#6fae7c', '#c9e4b4', '#eef4d4'], amb: 'fireflies', sun: [1000, 200, '#fffbe0'], noRays: true, grade: ['#9fe08a', 0.05], vignette: 0.45,
    build(d, rnd) {
      const stalks = (g, n, base, light, dark, w0, w1, leaf) => {
        for (let i = 0; i < n; i++) {
          const x = X0 + rnd() * SPAN, w = w0 + rnd() * (w1 - w0), lean = (rnd() - 0.5) * 50;
          const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
          gr.addColorStop(0, dark); gr.addColorStop(0.35, light); gr.addColorStop(1, dark);
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x - w / 2 + lean, -40); g.lineTo(x + w / 2 + lean, -40); g.lineTo(x + w / 2, base); g.closePath(); g.fill();
          g.fillStyle = dark;
          for (let y = base - 50 - rnd() * 40; y > 0; y -= 66 + rnd() * 30) { const lx = x + lean * (1 - y / base); g.fillRect(lx - w / 2 - 1, y, w + 2, 3); }
          g.fillStyle = leaf;
          for (let k = 0; k < 4; k++) {
            const y = 60 + rnd() * 420, lx = x + lean * (1 - y / base), dir = rnd() < 0.5 ? -1 : 1;
            for (let j = 0; j < 3; j++) { g.save(); g.translate(lx, y + j * 8); g.rotate(dir * (0.5 + j * 0.25)); g.beginPath(); g.ellipse(dir * w * 2.2, 0, w * 2.2, w * 0.32, 0, 0, TAU); g.fill(); g.restore(); }
          }
        }
      };
      d.far = layer(0.36, g => { stalks(g, 130, 800, '#b9dcaa', '#9cc690', 8, 14, '#a9d39a'); haze(g, 0, 800, '#e6f0c8', 0.6); });
      d.mid = layer(0.55, g => { stalks(g, 70, 800, '#7bb874', '#4f8a4c', 14, 22, '#5d9a58'); haze(g, 150, 800, '#dfeec0', 0.38); });
      d.near = layer(0.9, g => {
        stalks(g, 14, 800, '#4a8048', '#244a28', 26, 36, '#2f5a33');
        // grass tufts: curved blades in several greens
        for (let x = X0; x < X1; x += 14 + rnd() * 10) {
          const n = 3 + Math.floor(rnd() * 4);
          for (let k = 0; k < n; k++) {
            const h = 18 + rnd() * 34, lean = (rnd() - 0.5) * 24;
            g.strokeStyle = pick(['#3f6a2e', '#4f7f38', '#2f5424']); g.lineWidth = 2.5; g.lineCap = 'round';
            g.beginPath(); g.moveTo(x + k * 3, 800); g.quadraticCurveTo(x + k * 3 + lean * 0.3, 800 - h * 0.6, x + k * 3 + lean, 800 - h); g.stroke();
          }
        }
      });
      d.floor = 'dirt';
    },
    afterMid(ctx, d, time, vr, cam) {
      rays(ctx, 1000 + (cam.x - 800) * 0.95, 80, '#fffbe0', 0.14, time, 11, 1600, 1.2);
      // drifting mist bands
      ctx.save(); ctx.globalAlpha = 0.25;
      for (let i = 0; i < 3; i++) { const y = 620 + i * 50, x = ((time * (12 + i * 6)) % 1600) - 800; ctx.fillStyle = vgrad(ctx, y - 40, y + 40, 'rgba(240,250,225,0)', 'rgba(240,250,225,0.8)', 'rgba(240,250,225,0)'); ctx.fillRect(vr.x0 - 200 + x * 0, y - 40, vr.x1 - vr.x0 + 400, 80); }
      ctx.restore();
    },
  };

  /* Frost Peak ----------------------------------------------------- */
  ART.snow = {
    sky: ['#060d26', '#18295a', '#5878b0'], amb: 'snow', moon: [420, 180], stars: 140, grade: ['#6fb4ff', 0.06], vignette: 0.5,
    build(d, rnd) {
      d.far = layer(0.42, g => {
        const peaks = (base, amp, col, shadow, cap, snowLine) => {
          const y = ridge(g, base, amp, col, rnd, { peaky: true });
          // a separate snow cap on every peak above the snow line, thinning toward its edges
          g.fillStyle = cap;
          let seg = [];
          const flush = () => {
            if (seg.length > 2) {
              g.beginPath(); g.moveTo(seg[0][0], seg[0][1]);
              for (const [x, yy] of seg) g.lineTo(x, yy - 1);
              for (let k = seg.length - 1; k >= 0; k--) { const [x, yy] = seg[k]; g.lineTo(x, yy + (snowLine - yy) * 0.55 + Math.sin(x * 0.05) * 5); }
              g.closePath(); g.fill();
            }
            seg = [];
          };
          for (let x = X0; x <= X1; x += 6) { const yy = y(x); if (yy < snowLine) seg.push([x, yy]); else flush(); }
          flush();
          // a soft shadow on the far side of each slope
          g.fillStyle = shadow; g.globalAlpha = 0.25;
          g.beginPath(); g.moveTo(X0, 800);
          for (let x = X0; x <= X1; x += 6) g.lineTo(x, y(x) + Math.max(0, (y(x + 6) - y(x))) * 0 + (y(x + 6) > y(x) ? 0 : 900));
          g.lineTo(X1, 800); g.closePath(); g.globalAlpha = 1;
          return y;
        };
        peaks(540, 190, vgrad(g, 340, 800, '#7891c2', '#5b74a6'), '#2a3a66', '#eef4ff', 520);
        haze(g, 380, 800, '#b4cbe8', 0.35);
        peaks(640, 100, vgrad(g, 520, 800, '#55709f', '#425a88'), '#22305a', '#dfe9f8', 610);
        haze(g, 520, 800, '#a4bde0', 0.3);
      });
      d.mid = layer(0.6, g => {
        const y = ridge(g, 722, 26, vgrad(g, 690, 800, '#9db6d8', '#7f9cc4'), rnd, { rim: 'rgba(255,255,255,0.5)' });
        for (let x = X0; x < X1; x += 34 + rnd() * 46) pine(g, x, y(x) + 10, 90 + rnd() * 110, '#1c2c50', '#2c4170', '#e8f0ff');
        haze(g, 600, 800, '#b4cbe8', 0.3);
      });
      d.near = layer(0.9, g => {
        // faceted ice crystals growing out of the snow at the arena edges
        for (const x0 of [140, 1460]) {
          contact(g, x0, 800, 110, 0.3);
          for (let k = 0; k < 5; k++) {
            const cx = x0 + (k - 2) * 30, h = 90 + ((k * 37) % 5) * 26, w = 18 + (k % 2) * 8, lean = (k - 2) * 6;
            g.fillStyle = '#9cc8f0'; g.beginPath(); g.moveTo(cx - w, 800); g.lineTo(cx + lean - 2, 800 - h); g.lineTo(cx + lean, 800 - h - 8); g.lineTo(cx + lean + 2, 800 - h); g.lineTo(cx + w, 800); g.closePath(); g.fill();
            g.fillStyle = '#d8eeff'; g.beginPath(); g.moveTo(cx - w, 800); g.lineTo(cx + lean - 2, 800 - h); g.lineTo(cx + lean, 800 - h - 8); g.lineTo(cx, 800); g.closePath(); g.fill();
          }
        }
        // snow banks
        g.fillStyle = vgrad(g, 760, 800, '#f2f7ff', '#cddcef');
        for (const [x, w] of [[X0, 1050], [1650, 1100]]) { g.beginPath(); g.ellipse(x + w / 2, 800, w / 2, 40, 0, Math.PI, TAU); g.fill(); }
      });
      d.floor = 'snow';
    },
    back(ctx, d, time, vr, cam) {
      // aurora: smooth ribbons that ripple, drawn as continuous curtains
      const off = (cam.x - 800) * 0.88;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const col = ['#3dffb4', '#3dd0ff', '#9b6bff'][b];
        const yAt = x => 130 + b * 46 + Math.sin(x * 0.0035 + time * 0.45 + b) * 46 + Math.sin(x * 0.009 + time * 0.8) * 16;
        const g = ctx.createLinearGradient(0, 80, 0, 420);
        g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.35, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-500 + off, yAt(-500));
        for (let x = -500; x <= 2100; x += 20) ctx.lineTo(x + off, yAt(x));
        for (let x = 2100; x >= -500; x -= 20) ctx.lineTo(x + off, yAt(x) + 120 + Math.sin(x * 0.006 + time + b * 2) * 40);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
  };

  /* Void Rift ------------------------------------------------------ */
  ART.void = {
    sky: ['#010109', '#060a24', '#160d38'], amb: 'motes', grade: ['#7a6bff', 0.06], vignette: 0.6,
    build(d, rnd) {
      // the Milky Way runs diagonally across the sky
      const bandY = x => 110 + (x - X0) / SPAN * 380, bandW = 210;
      d.starsL = layer(1, g => {
        const cols = ['#ffffff', '#cfe0ff', '#ffe9d0', '#d8ccff'];
        for (let i = 0; i < 2600; i++) {
          const x = X0 + rnd() * SPAN;
          // half the stars crowd into the band
          const y = rnd() < 0.5 ? bandY(x) + (rnd() + rnd() + rnd() - 1.5) * bandW * 0.6 : rnd() * 760;
          const r = rnd() < 0.92 ? 0.5 + rnd() * 0.9 : 1.2 + rnd() * 1.2;
          g.globalAlpha = 0.25 + rnd() * 0.75; g.fillStyle = cols[(rnd() * cols.length) | 0];
          g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }, 820);
      d.bright = [];
      for (let i = 0; i < 34; i++) d.bright.push({ x: X0 + rnd() * SPAN, y: 20 + rnd() * 560, r: 1.6 + rnd() * 1.8, ph: rnd() * 6, c: ['#ffffff', '#bcd4ff', '#ffd9b8', '#e2c8ff'][i % 4] });
      d.nebula = layer(0.35, g => {
        // glowing gas along the band, in violet, magenta and teal
        for (let i = 0; i < 150; i++) {
          const x = X0 + rnd() * SPAN, y = bandY(x) + (rnd() - 0.5) * bandW * 1.3, r = 60 + rnd() * 170;
          const c = ['#6a3cff', '#ff4fa3', '#2fb6ff', '#a04bff', '#ff8a5a'][(rnd() * 5) | 0];
          const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, 0.16 + rnd() * 0.12)); gr.addColorStop(1, rgba(c, 0));
          g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // dark dust lanes give the clouds structure
        for (let i = 0; i < 70; i++) {
          const x = X0 + rnd() * SPAN, y = bandY(x) + (rnd() - 0.5) * bandW * 0.5, r = 40 + rnd() * 110;
          const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(2,2,12,0.55)'); gr.addColorStop(1, 'rgba(2,2,12,0)');
          g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // two separate nebulae: a magenta pillar and a teal veil
        for (const [cx, cy, c1, c2] of [[-340, 300, '#ff4fa3', '#ffb36b'], [2150, 180, '#2fd6ff', '#6a3cff']]) {
          for (let i = 0; i < 40; i++) {
            const x = cx + (rnd() - 0.5) * 260, y = cy + (rnd() - 0.5) * 300, r = 50 + rnd() * 120, c = rnd() < 0.6 ? c1 : c2;
            const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, 0.2)); gr.addColorStop(1, rgba(c, 0));
            g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
      }, 820);
      d.planetL = layer(1, g => {
        // a distant spiral galaxy, tilted
        g.save(); g.translate(240, 150); g.rotate(-0.5); g.scale(1, 0.42);
        const gg = g.createRadialGradient(0, 0, 0, 0, 0, 90); gg.addColorStop(0, 'rgba(255,240,220,0.75)'); gg.addColorStop(0.25, 'rgba(200,170,255,0.3)'); gg.addColorStop(1, 'rgba(120,90,255,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(0, 0, 90, 0, TAU); g.fill();
        for (let arm = 0; arm < 2; arm++) for (let k = 0; k < 160; k++) {
          const u = k / 160, a = arm * Math.PI + u * 5.2, rr = 8 + u * 86;
          g.globalAlpha = 0.5 * (1 - u); g.fillStyle = k % 3 ? '#d8ccff' : '#ffffff';
          g.beginPath(); g.arc(Math.cos(a) * rr + (rnd() - 0.5) * 8, Math.sin(a) * rr + (rnd() - 0.5) * 8, 1 + rnd() * 1.4, 0, TAU); g.fill();
        }
        g.restore(); g.globalAlpha = 1;
        // a small cratered moon
        const mx = 930, my = 120, mr = 30;
        g.fillStyle = vgrad(g, my - mr, my + mr, '#d9d4e8', '#6f6890'); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
        g.fillStyle = 'rgba(60,50,90,0.35)'; for (const [cx, cy, cr] of [[-9, -6, 7], [10, 8, 5], [-2, 13, 4], [12, -10, 3]]) { g.beginPath(); g.arc(mx + cx, my + cy, cr, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(6,4,20,0.55)'; g.save(); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.clip(); g.beginPath(); g.arc(mx + 16, my + 10, mr, 0, TAU); g.fill(); g.restore();
        // the gas giant: banded, lit from the upper left, with a glowing rim and a ring
        const px = 1330, py = 300, pr = 170;
        const ring = (from, to) => {
          for (const [rx, ry, w, a] of [[380, 82, 22, 0.16], [352, 76, 10, 0.5], [330, 71, 5, 0.75], [300, 64, 8, 0.35], [272, 58, 3, 0.55]]) {
            g.strokeStyle = `rgba(226,210,255,${a})`; g.lineWidth = w; g.beginPath(); g.ellipse(px, py, rx, ry, -0.28, from, to); g.stroke();
          }
        };
        ring(Math.PI, TAU);
        const atm = g.createRadialGradient(px, py, pr * 0.9, px, py, pr * 1.25); atm.addColorStop(0, 'rgba(170,140,255,0.35)'); atm.addColorStop(1, 'rgba(170,140,255,0)');
        g.fillStyle = atm; g.beginPath(); g.arc(px, py, pr * 1.25, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip();
        g.fillStyle = vgrad(g, py - pr, py + pr, '#9a82e6', '#3a2470'); g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        g.translate(px, py); g.rotate(-0.28);
        const bands = [[-140, 22, '#c7b2ff', 0.35], [-100, 14, '#5c3fa8', 0.4], [-70, 26, '#e6c8ff', 0.25], [-30, 18, '#4a2f8f', 0.45], [5, 30, '#d8b6ff', 0.3], [48, 16, '#6a46b8', 0.4], [80, 24, '#f0cdea', 0.22], [118, 20, '#4a2f8f', 0.4]];
        for (const [y, h, c, a] of bands) { g.fillStyle = rgba(c, a); g.beginPath(); g.ellipse(0, y, pr * 1.3, h / 2, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,190,220,0.55)'; g.beginPath(); g.ellipse(-40, 40, 30, 12, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(120,60,140,0.5)'; g.beginPath(); g.ellipse(-40, 40, 18, 6, 0, 0, TAU); g.fill();
        g.rotate(0.28); g.translate(-px, -py);
        // night side and the ring's shadow
        const sh = g.createRadialGradient(px - pr * 0.45, py - pr * 0.5, pr * 0.2, px - pr * 0.2, py - pr * 0.2, pr * 1.6);
        sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(6,3,20,0.2)'); sh.addColorStop(1, 'rgba(6,3,20,0.85)');
        g.fillStyle = sh; g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 14; g.beginPath(); g.ellipse(px + 6, py + 16, 340, 74, -0.28, 0, Math.PI); g.stroke();
        g.restore();
        // a thin lit rim on the sunward edge
        g.strokeStyle = 'rgba(230,215,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, pr - 1, Math.PI * 0.95, Math.PI * 1.65); g.stroke();
        ring(0, Math.PI);
      }, 820);
      // asteroid isles are drawn one by one as sprites, so each can drift on its own
      d.isleSprites = [];
      for (let i = 0; i < 9; i++) {
        const w = 70 + rnd() * 90;
        d.isleSprites.push(Object.assign(makeIsle(rnd, w, i), { x: X0 + 240 + i * 420 + rnd() * 100, y: 270 + rnd() * 150, ph: rnd() * 6 }));
      }
      d.far = layer(0.5, g => {
        ridge(g, 705, 40, vgrad(g, 640, 800, '#1a1236', '#0c0820'), rnd, { rim: 'rgba(170,140,255,0.45)' });
        haze(g, 560, 800, '#4a2a8a', 0.35);
      });
      d.near = layer(0.9, g => {
        for (const x of [220, 1380]) { drawMonolith(g, x, rnd); d.runes.push([x, 0]); d.cores = d.cores || []; d.cores.push([x, 388]); }
      });
      d.floor = 'glass';
    },
    back(ctx, d, time, vr, cam) {
      drawLayer(ctx, d.starsL, cam, 0.97);
      // the brightest stars twinkle, with a soft four-point glint
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of d.bright) {
        const x = s.x + (cam.x - 800) * 0.97, a = 0.55 + Math.sin(time * 2.2 + s.ph) * 0.35;
        Glow.draw(ctx, s.c, x, s.y, s.r * 7, 0.5 * a);
        ctx.globalAlpha = a; ctx.strokeStyle = s.c; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - s.r * 6, s.y); ctx.lineTo(x + s.r * 6, s.y); ctx.moveTo(x, s.y - s.r * 6); ctx.lineTo(x, s.y + s.r * 6); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.restore();
      drawLayer(ctx, d.nebula, cam, 0.94);
      drawLayer(ctx, d.planetL, cam, 0.92);
      // shooting stars, every few seconds
      const per = 4.5, k = (time % per) / 0.7;
      if (k < 1) {
        const seed = Math.floor(time / per), sx = 200 + ((seed * 977) % 1200) + (cam.x - 800) * 0.95, sy = 60 + ((seed * 431) % 220);
        const x = sx + k * 420, y = sy + k * 160;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(x - 160, y - 60, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - k)})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 160, y - 60); ctx.lineTo(x, y); ctx.stroke();
        ctx.restore();
      }
    },
    afterFar(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.85;
      for (const s of d.isleSprites) {
        const x = s.x + off, y = s.y + Math.sin(time * 0.55 + s.ph) * 7;
        // the crystals light the space around them, breathing slowly
        for (const [cx, cy, col] of s.lights) glowDisc(ctx, x + cx, y + cy, 70, col, 0.22 + Math.sin(time * 1.4 + s.ph + cx) * 0.06);
        ctx.drawImage(s.c, x - s.ox, y - s.oy, s.c.width / s.q, s.c.height / s.q);
      }
    },
    front(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.3;
      for (const [x] of d.runes) {
        // light runs up the rune channel, glyph by glyph
        const cx = x + off;
        for (let k = 0; k < 6; k++) {
          const y = 708 - k * 40, a = 0.35 + 0.65 * Math.max(0, Math.sin(time * 2.4 - k * 0.7));
          ctx.globalCompositeOperation = 'lighter';
          Glow.draw(ctx, '#9b6bff', cx, y, 26, 0.35 * a);
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = rgba('#e2d4ff', 0.25 + 0.75 * a); ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath();
          if (k % 3 === 0) { ctx.moveTo(cx - 6, y - 8); ctx.lineTo(cx + 6, y); ctx.lineTo(cx - 6, y + 8); }
          else if (k % 3 === 1) { ctx.moveTo(cx, y - 9); ctx.lineTo(cx, y + 9); ctx.moveTo(cx - 6, y - 3); ctx.lineTo(cx + 6, y - 3); }
          else { ctx.arc(cx, y, 6, 0.3, TAU - 0.3); }
          ctx.stroke();
        }
      }
      for (const [x, y] of d.cores || []) drawCoreCrystal(ctx, x + off, y + Math.sin(time * 1.4 + x) * 6, time + x * 0.01);
    },
  };

  /* faceted asteroid isle sprite: lit from the upper left. Top face, a cliff
     band, a cone of facets underneath, boulders, and crystal clusters. */
  function makeIsle(rnd, w, seed) {
    const q = 1.5, W = w * 2.7, H = w * 2.2 + 110, ox = W / 2, oy = 110;
    const c = document.createElement('canvas'); c.width = Math.ceil(W * q); c.height = Math.ceil(H * q);
    const g = c.getContext('2d'); g.setTransform(q, 0, 0, q, ox * q, oy * q);
    const lights = [];
    // the top face: a jittered ellipse
    const N = 14, rx = w, ry = w * 0.2, top = [];
    for (let k = 0; k < N; k++) { const a = k / N * TAU, j = 0.86 + rnd() * 0.2; top.push([Math.cos(a) * rx * j, Math.sin(a) * ry * j]); }
    const cliff = w * (0.14 + rnd() * 0.08);
    const front = top.filter(([, y]) => y >= -ry * 0.15).sort((a, b) => a[0] - b[0]);
    // underside: the cliff's lower edge narrows to a mid ring, then to the tip
    const low = front.map(([x, y]) => [x, y + cliff]);
    const depth = w * (0.95 + rnd() * 0.45), tipX = (rnd() - 0.5) * w * 0.3;
    const mid = low.map(([x, y], k) => [x * 0.58 + tipX * 0.2, y + depth * (0.42 + rnd() * 0.12) * (1 - Math.abs(x / w) * 0.35)]);
    const tip = [tipX, cliff + depth];
    const shade = (x0, x1) => { const nx = x1 - x0; return nx; };
    const facet = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    const tone = u => { const L = ['#3a2a6a', '#2f2258', '#251a48', '#1c1338', '#140d2a']; return L[clamp(Math.floor(u * L.length), 0, L.length - 1)]; };
    for (let k = 0; k < low.length - 1; k++) {
      const u = (low[k][0] + w) / (2 * w);
      facet([low[k], low[k + 1], mid[k + 1], mid[k]], tone(u * 0.9 + 0.1));
      facet([mid[k], mid[k + 1], tip], tone(u * 0.8 + 0.25));
      // a few stalactites hanging from the mid ring
      if (rnd() < 0.45) { const m = mid[k], L = 14 + rnd() * 26; facet([[m[0] - 5, m[1] - 2], [m[0] + 5, m[1] - 2], [m[0] + rnd() * 4, m[1] + L]], tone(u * 0.6 + 0.4)); }
    }
    // facet seams catch a little light
    g.strokeStyle = 'rgba(190,170,255,0.12)'; g.lineWidth = 1;
    for (let k = 0; k < mid.length; k++) { g.beginPath(); g.moveTo(low[k][0], low[k][1]); g.lineTo(mid[k][0], mid[k][1]); g.lineTo(tip[0], tip[1]); g.stroke(); }
    // a smaller second spur off to one side breaks the symmetry
    const sp = Math.floor(low.length * (rnd() < 0.5 ? 0.25 : 0.7)), m0 = mid[sp], m1 = mid[Math.min(mid.length - 1, sp + 1)];
    const tip2 = [lerp(m0[0], m1[0], 0.5) + (rnd() - 0.5) * 20, Math.max(m0[1], m1[1]) + depth * 0.45];
    facet([m0, m1, tip2], tone(0.75)); facet([m0, [lerp(m0[0], m1[0], 0.5), lerp(m0[1], m1[1], 0.5)], tip2], tone(0.45));
    // the cliff band
    for (let k = 0; k < front.length - 1; k++) { const u = (front[k][0] + w) / (2 * w); facet([front[k], front[k + 1], low[k + 1], low[k]], ['#4a3884', '#3f2f74', '#342664', '#2a1e54'][clamp(Math.floor(u * 4), 0, 3)]); }
    // the top face, brighter toward the light
    const tg = g.createLinearGradient(-rx, -ry, rx, ry); tg.addColorStop(0, '#6b58b0'); tg.addColorStop(1, '#3d2e78');
    facet(top, tg);
    g.save(); g.beginPath(); top.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(20,10,40,0.18)'; g.beginPath(); g.ellipse((rnd() - 0.5) * rx * 1.4, (rnd() - 0.5) * ry, 6 + rnd() * 12, 2 + rnd() * 3, 0, 0, TAU); g.fill(); }
    g.restore();
    // rim light on the sunward lip
    g.strokeStyle = 'rgba(214,200,255,0.85)'; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath(); top.forEach(([x, y], k) => { if (x < rx * 0.25 && y < ry * 0.4) g.lineTo(x, y); }); g.stroke();
    // boulders
    for (let k = 0; k < 3; k++) {
      const bx = (rnd() - 0.5) * rx * 1.3, by = (rnd() - 0.5) * ry * 0.6, r = 5 + rnd() * 7;
      facet([[bx - r, by], [bx - r * 0.4, by - r * 0.9], [bx + r * 0.6, by - r * 0.7], [bx + r, by]], '#4e3d8c');
      facet([[bx - r * 0.4, by - r * 0.9], [bx + r * 0.6, by - r * 0.7], [bx + r, by], [bx, by]], '#352868');
    }
    // one neat crystal cluster: a tall centre crystal flanked by two shorter
    // ones fanning out, rooted in a rock socket, lit facet / shaded facet / ridge
    const teal = seed % 3 === 1;
    const cols = teal ? ['#a8f2ff', '#45b9d6', '#effdff'] : ['#cdb8ff', '#7d5ae6', '#f7f2ff'];
    const cx0 = (rnd() - 0.5) * rx * 0.7, cy0 = -ry * 0.15;
    lights.push([cx0, cy0 - 18, teal ? '#5fe0ff' : '#9b6bff']);
    const gl = g.createRadialGradient(cx0, cy0, 0, cx0, cy0, 36); gl.addColorStop(0, rgba(cols[0], 0.4)); gl.addColorStop(1, rgba(cols[0], 0));
    g.fillStyle = gl; g.fillRect(cx0 - 36, cy0 - 36, 72, 72);
    const crystal = (bx, h, cw, tilt) => {
      const ux = Math.sin(tilt), uy = -Math.cos(tilt), nx = -uy, ny = ux, by = cy0;
      const sh = [bx + ux * h * 0.78, by + uy * h * 0.78], tp = [bx + ux * h, by + uy * h];
      const L0 = [bx - nx * cw, by - ny * cw], R0 = [bx + nx * cw, by + ny * cw];
      const L1 = [sh[0] - nx * cw, sh[1] - ny * cw], R1 = [sh[0] + nx * cw, sh[1] + ny * cw];
      facet([L0, [bx, by], sh, tp, L1], cols[0]);
      facet([[bx, by], R0, R1, tp, sh], cols[1]);
      g.strokeStyle = cols[2]; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(sh[0], sh[1]); g.lineTo(tp[0], tp[1]); g.stroke();
    };
    crystal(cx0 - 9, 20 + rnd() * 5, 4.5, -0.32);
    crystal(cx0 + 9, 18 + rnd() * 5, 4.5, 0.3);
    crystal(cx0, 34 + rnd() * 8, 6, (rnd() - 0.5) * 0.12);
    // the rock socket they grow from
    facet([[cx0 - 16, cy0 + 2], [cx0 - 8, cy0 - 4], [cx0 + 8, cy0 - 4], [cx0 + 16, cy0 + 2], [cx0, cy0 + 6]], '#4e3d8c');
    facet([[cx0, cy0 + 6], [cx0 + 8, cy0 - 4], [cx0 + 16, cy0 + 2]], '#352868');
    // a couple of pebbles drifting under the isle
    for (let k = 0; k < 3; k++) {
      const px = (rnd() - 0.5) * w * 1.4, py = cliff + depth * (0.5 + rnd() * 0.5), r = 3 + rnd() * 5;
      facet([[px - r, py], [px, py - r], [px + r, py], [px, py + r * 0.8]], '#2a1f52');
      facet([[px - r, py], [px, py - r], [px, py]], '#4a3a86');
    }
    // depth haze so the isles sit back behind the arena
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(60,36,120,0.16)'; g.fillRect(-ox, -oy, W, H);
    return { c, q, ox, oy, lights };
  }

  /* an ancient obelisk on a stepped plinth, with a rune channel and a cradle
     that holds the floating crystal. Light from the upper left. */
  function drawMonolith(g, x, rnd) {
    // a soft dark halo behind it, so it reads against busy sky and drifting isles
    const halo = g.createRadialGradient(x, 560, 20, x, 560, 260); halo.addColorStop(0, 'rgba(4,2,14,0.5)'); halo.addColorStop(1, 'rgba(4,2,14,0)');
    g.fillStyle = halo; g.fillRect(x - 260, 300, 520, 520);
    contact(g, x, 800, 110, 0.55);
    // stepped plinth: lit top, mid front, dark right side
    let y = 800;
    for (const [w, h] of [[150, 18], [126, 16], [104, 14]]) {
      g.fillStyle = vgrad(g, y - h, y, '#2c2252', '#1a1334'); g.fillRect(x - w / 2, y - h, w, h);
      g.fillStyle = '#120c26'; g.fillRect(x + w / 2 - 12, y - h, 12, h);
      g.fillStyle = 'rgba(200,180,255,0.35)'; g.fillRect(x - w / 2, y - h, w, 2);
      y -= h;
    }
    // the shaft: a tapered bevelled obelisk
    const b = y, t = 470, wb = 46, wt = 32;
    g.fillStyle = vgrad(g, t, b, '#33275e', '#1a1336');
    g.beginPath(); g.moveTo(x - wb, b); g.lineTo(x - wt, t); g.lineTo(x + wt, t); g.lineTo(x + wb, b); g.closePath(); g.fill();
    g.fillStyle = 'rgba(200,180,255,0.16)';   // lit bevel
    g.beginPath(); g.moveTo(x - wb, b); g.lineTo(x - wt, t); g.lineTo(x - wt + 9, t); g.lineTo(x - wb + 11, b); g.closePath(); g.fill();
    g.fillStyle = 'rgba(4,2,12,0.45)';         // shaded side
    g.beginPath(); g.moveTo(x + wb, b); g.lineTo(x + wt, t); g.lineTo(x + wt - 10, t); g.lineTo(x + wb - 12, b); g.closePath(); g.fill();
    // carved bands
    for (const yy of [520, 610, 735]) {
      const k = (yy - t) / (b - t), hw = lerp(wt, wb, k);
      g.fillStyle = 'rgba(4,2,12,0.55)'; g.fillRect(x - hw, yy, hw * 2, 4);
      g.fillStyle = 'rgba(200,180,255,0.22)'; g.fillRect(x - hw, yy + 4, hw * 2, 1.5);
    }
    // recessed relief panels either side of the channel
    for (const sd of [-1, 1]) for (const [y0, y1] of [[532, 600], [618, 728]]) {
      const k0 = (y0 - t) / (b - t), k1 = (y1 - t) / (b - t), o0 = lerp(wt, wb, k0) - 8, o1 = lerp(wt, wb, k1) - 8;
      g.fillStyle = 'rgba(4,2,12,0.35)';
      g.beginPath(); g.moveTo(x + sd * 14, y0); g.lineTo(x + sd * o0, y0); g.lineTo(x + sd * o1, y1); g.lineTo(x + sd * 14, y1); g.closePath(); g.fill();
      g.fillStyle = sd < 0 ? 'rgba(200,180,255,0.18)' : 'rgba(0,0,0,0.25)'; g.fillRect(x + (sd < 0 ? -o0 : 14), y0, sd < 0 ? o0 - 14 : o0 - 14, 1.5);
    }
    // the rune channel: an inset slot down the face
    g.fillStyle = '#0a0618'; g.fillRect(x - 9, 530, 18, 200);
    g.fillStyle = 'rgba(155,107,255,0.25)'; g.fillRect(x - 9, 530, 2, 200);
    // pyramidion cap
    g.fillStyle = '#3a2d6c'; g.beginPath(); g.moveTo(x - wt, t); g.lineTo(x, t - 26); g.lineTo(x, t); g.closePath(); g.fill();
    g.fillStyle = '#1c1438'; g.beginPath(); g.moveTo(x + wt, t); g.lineTo(x, t - 26); g.lineTo(x, t); g.closePath(); g.fill();
    // the cradle: two curved prongs that hold the crystal
    for (const sd of [-1, 1]) {
      g.fillStyle = sd < 0 ? '#3a2d6c' : '#221944';
      g.beginPath(); g.moveTo(x + sd * 6, t - 20); g.quadraticCurveTo(x + sd * 34, t - 30, x + sd * 30, t - 70);
      g.lineTo(x + sd * 24, t - 66); g.quadraticCurveTo(x + sd * 24, t - 36, x + sd * 2, t - 26); g.closePath(); g.fill();
      if (sd < 0) { g.strokeStyle = 'rgba(210,195,255,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 6, t - 20); g.quadraticCurveTo(x - 34, t - 30, x - 30, t - 70); g.stroke(); }
    }
    // rim light: cool on the lit edge, violet back-light from the crystal on the other
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(220,208,255,0.6)'; g.beginPath(); g.moveTo(x - wb, b); g.lineTo(x - wt, t); g.lineTo(x, t - 26); g.stroke();
    g.strokeStyle = 'rgba(160,110,255,0.45)'; g.beginPath(); g.moveTo(x + wb, b); g.lineTo(x + wt, t); g.lineTo(x, t - 26); g.stroke();
    // a crack and a few fallen fragments
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 14, t + 20); g.lineTo(x + 8, t + 70); g.lineTo(x + 18, t + 120); g.stroke();
    for (let k = 0; k < 4; k++) { const fx = x + (rnd() - 0.5) * 190, r = 4 + rnd() * 6; g.fillStyle = '#231a44'; g.beginPath(); g.moveTo(fx - r, 800); g.lineTo(fx - r * 0.3, 800 - r); g.lineTo(fx + r, 800); g.closePath(); g.fill(); }
  }

  /* the floating crystal: a turning octahedron with shading per facet, orbiting
     shards, a halo, and a thin beam of light down into the cradle */
  function drawCoreCrystal(ctx, x, y, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, '#a07bff', x, y, 120, 0.5);
    const beam = ctx.createLinearGradient(x, y, x, y + 70); beam.addColorStop(0, 'rgba(200,170,255,0.55)'); beam.addColorStop(1, 'rgba(200,170,255,0)');
    ctx.fillStyle = beam; ctx.fillRect(x - 3, y, 6, 70);
    ctx.globalCompositeOperation = 'source-over';
    const R = 18, Hh = 30, a0 = time * 0.9, V = [];
    for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; V.push({ x: x + Math.cos(a) * R, z: Math.sin(a), a }); }
    // shards behind the crystal
    const shards = [0, 1, 2].map(k => { const a = time * 1.6 + k * TAU / 3; return { x: x + Math.cos(a) * 40, y: y + Math.sin(a * 2) * 6, z: Math.sin(a) }; });
    const shard = s => { const r = 4 + s.z * 1.5; ctx.globalAlpha = 0.6 + s.z * 0.3; ctx.fillStyle = '#e2d6ff'; ctx.beginPath(); ctx.moveTo(s.x, s.y - r * 1.6); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r * 1.6); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; };
    shards.filter(s => s.z < 0).forEach(shard);
    // facets facing us (between consecutive vertices with positive depth)
    const faces = [];
    for (let k = 0; k < 4; k++) { const A = V[k], B = V[(k + 1) % 4], mz = (A.z + B.z) / 2; if (mz > -0.2) faces.push({ A, B, mz, mid: (A.a + Math.PI / 4) }); }
    faces.sort((p, q) => p.mz - q.mz);
    for (const f of faces) {
      const lit = 0.5 + 0.5 * Math.cos(f.mid - Math.PI * 1.25);   // light from the upper left
      const top = mixHex('#6b45e0', '#f4eeff', lit), bot = mixHex('#3a20a0', '#b89bff', lit);
      ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(f.A.x, y); ctx.lineTo(x, y - Hh); ctx.lineTo(f.B.x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = bot; ctx.beginPath(); ctx.moveTo(f.A.x, y); ctx.lineTo(x, y + Hh); ctx.lineTo(f.B.x, y); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2;
    for (const v of V) if (v.z > 0) { ctx.beginPath(); ctx.moveTo(x, y - Hh); ctx.lineTo(v.x, y); ctx.lineTo(x, y + Hh); ctx.stroke(); }
    shards.filter(s => s.z >= 0).forEach(shard);
    ctx.restore();
  }

  /* Crater Plains -------------------------------------------------- */
  ART.crater = {
    sky: ['#12030a', '#4e100e', '#d0502a'], amb: 'embers', grade: ['#ff5a1c', 0.07], vignette: 0.55,
    build(d, rnd) {
      d.far = layer(0.42, g => {
        // smoke plumes, then the volcano with lava channels
        for (let i = 0; i < 12; i++) { const x = 800 + (rnd() - 0.5) * 500, y = 330 - i * 30, r = 60 + i * 18; g.fillStyle = `rgba(30,12,12,${0.35 - i * 0.02})`; g.beginPath(); g.ellipse(x + i * 14, y, r * 1.4, r * 0.7, 0, 0, TAU); g.fill(); }
        g.fillStyle = vgrad(g, 360, 760, '#4a1a14', '#2a0d0a');
        g.beginPath(); g.moveTo(460, 760); g.quadraticCurveTo(700, 480, 760, 370); g.lineTo(860, 370); g.quadraticCurveTo(930, 480, 1180, 760); g.closePath(); g.fill();
        g.strokeStyle = '#ff6a1c'; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(800, 372); g.quadraticCurveTo(780, 480, 720, 560); g.quadraticCurveTo(700, 640, 640, 740); g.stroke();
        g.beginPath(); g.moveTo(830, 372); g.quadraticCurveTo(880, 500, 930, 620); g.stroke();
        g.strokeStyle = 'rgba(255,200,120,0.8)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(800, 372); g.quadraticCurveTo(780, 480, 720, 560); g.stroke();
        haze(g, 380, 800, '#ff6a2a', 0.3);
        ridge(g, 640, 90, vgrad(g, 540, 800, '#4a1712', '#2a0c08'), rnd, { peaky: true, rim: 'rgba(255,120,60,0.45)' });
        haze(g, 520, 800, '#ff5a2a', 0.3);
      });
      d.mid = layer(0.6, g => {
        const y = ridge(g, 720, 34, vgrad(g, 680, 800, '#2e0f0c', '#1c0806'), rnd);
        for (let x = X0; x < X1; x += 130 + rnd() * 170) {
          const h = 120 + rnd() * 200, w = 26 + rnd() * 30, by = y(x) + 12;
          const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, '#3a140f'); gr.addColorStop(0.5, '#240b09'); gr.addColorStop(1, '#16060a');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(x - w, by); g.lineTo(x - w * 0.3, by - h); g.lineTo(x + w * 0.2, by - h * 1.08); g.lineTo(x + w, by); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,110,50,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w, by); g.lineTo(x - w * 0.3, by - h); g.stroke();
        }
        haze(g, 600, 800, '#ff4a1c', 0.18);
      });
      d.near = layer(0.9, g => {
        // ruined stone arches with both feet on the ground
        for (const [x, s] of [[150, 1], [1450, 1.1]]) {
          contact(g, x, 800, 120 * s, 0.5);
          const gr = vgrad(g, 470, 800, '#3a1610', '#160706');
          g.fillStyle = gr;
          g.fillRect(x - 74 * s, 540, 34 * s, 260); g.fillRect(x + 40 * s, 560, 34 * s, 240);
          g.beginPath(); g.moveTo(x - 80 * s, 548); g.quadraticCurveTo(x, 450, x + 80 * s, 568); g.lineTo(x + 74 * s, 596); g.quadraticCurveTo(x, 500, x - 74 * s, 576); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,120,60,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 80 * s, 548); g.quadraticCurveTo(x, 450, x + 80 * s, 568); g.stroke();
          // rubble at the base
          g.fillStyle = '#1c0907'; for (let k = 0; k < 6; k++) { const rx = x + (k - 3) * 30 * s, r = 8 + (k % 3) * 6; g.beginPath(); g.ellipse(rx, 798, r * 1.4, r, 0, Math.PI, TAU); g.fill(); }
        }
      });
      d.floor = 'lava';
    },
    afterFar(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.85;
      glowDisc(ctx, 810 + off, 372, 280, '#ff7a1a', 0.55 + Math.sin(time * 3) * 0.1);
      if (Math.random() < 0.4) Game.fx.add({ kind: 'ember', x: 810 + off + rand(-30, 30), y: 374, vx: rand(-120, 120), vy: rand(-520, -260), g: 500, life: rand(0.8, 1.4), size: rand(4, 8), color: '#ffb13d' });
    },
  };

  /* Grand Arena ---------------------------------------------------- */
  ART.arena = {
    sky: ['#06030c', '#170c26', '#2a1530'], amb: 'confetti', grade: ['#ffc97a', 0.05], vignette: 0.55,
    build(d, rnd) {
      d.far = layer(0.5, g => {
        // the roof truss with spotlight rigs
        g.fillStyle = '#0d0815'; g.fillRect(X0, 0, SPAN, 70);
        g.strokeStyle = '#231a33'; g.lineWidth = 4; g.beginPath();
        for (let x = X0; x < X1; x += 60) { g.moveTo(x, 70); g.lineTo(x + 30, 30); g.lineTo(x + 60, 70); }
        g.moveTo(X0, 30); g.lineTo(X1, 30); g.moveTo(X0, 70); g.lineTo(X1, 70); g.stroke();
        // tiered stands: each tier has a dark rail, steps and a packed crowd with shoulders and heads
        for (let tier = 0; tier < 6; tier++) {
          const y = 300 + tier * 64;
          g.fillStyle = vgrad(g, y, y + 64, ['#1d1530', '#211835', '#261b3c', '#2b1f44', '#30224b', '#352653'][tier], '#140e22');
          g.fillRect(X0, y, SPAN, 64);
          const dim = 0.62 - tier * 0.07;
          for (let x = X0; x < X1; x += 13 + rnd() * 4) {
            if ((Math.floor((x - X0) / 420) % 1 === 0) && ((x - X0) % 420) < 26) continue;   // aisles
            const c = mixHex(pick(['#c94a6a', '#4a8ac9', '#c9b44a', '#6ac94a', '#d9d0e6', '#8a6bc9', '#e0784a']), '#120a1e', dim);
            const hx = x + rnd() * 4, hy = y + 22 + rnd() * 4;
            g.fillStyle = c; g.beginPath(); g.ellipse(hx, hy + 22, 9, 14, 0, Math.PI, TAU); g.fill();
            g.fillStyle = mixHex(pick(['#f0c49a', '#c99a6a', '#8a5a3a', '#f6d2ad']), '#120a1e', dim + 0.1);
            g.beginPath(); g.arc(hx, hy, 6.5, 0, TAU); g.fill();
            g.fillStyle = mixHex(pick(['#1a1a1f', '#3a2418', '#c9a646', '#6a3a2a']), '#120a1e', dim); g.beginPath(); g.arc(hx, hy - 2, 6.5, Math.PI, TAU); g.fill();
          }
          g.fillStyle = '#0c0816'; g.fillRect(X0, y + 58, SPAN, 6);
          g.fillStyle = 'rgba(255,200,140,0.12)'; g.fillRect(X0, y + 58, SPAN, 1);
        }
        // the big screen hung from the truss
        g.fillStyle = '#0c0912'; g.fillRect(612, 70, 6, 60); g.fillRect(982, 70, 6, 60);
        g.fillStyle = '#05040a'; g.fillRect(600, 120, 400, 210);
        g.fillStyle = '#1a1626'; g.fillRect(612, 132, 376, 186);
        haze(g, 280, 800, '#3a1c3a', 0.3);
      });
      d.near = layer(0.9, g => {
        // the ring wall with banners hanging from a beam
        g.fillStyle = vgrad(g, 600, 640, '#2e2238', '#1a1222'); g.fillRect(X0, 600, SPAN, 18);
        const cols = ['#ff9b2a', '#ffd23f', '#35c3d6', '#ff4fa3', '#2fd47a', '#5b6cff', '#a06bff', '#e8323f'];
        for (let i = 0; i < 16; i++) {
          const x = X0 + 120 + i * 230, c = cols[i % cols.length];
          g.fillStyle = vgrad(g, 618, 690, c, mixHex(c, '#000000', 0.35)); g.fillRect(x, 618, 74, 70);
          g.beginPath(); g.moveTo(x, 688); g.lineTo(x + 37, 708); g.lineTo(x + 74, 688); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 8, 630, 58, 4); g.fillRect(x + 18, 640, 38, 3);
        }
        g.fillStyle = vgrad(g, 708, 800, '#2a1e2e', '#170f1c'); g.fillRect(X0, 712, SPAN, 88);
        g.fillStyle = '#e8d8b0'; g.fillRect(X0, 712, SPAN, 4);
        g.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = X0; x < X1; x += 90) g.fillRect(x, 716, 2, 84);
      });
      d.floor = 'ring';
    },
    afterFar(ctx, d, time, vr, cam) {
      const off = (cam.x - 800) * 0.85;
      // the screen replays a pulsing VS with scanlines
      const sx = 612 + off;
      ctx.fillStyle = vgrad(ctx, 132, 318, '#2a1a3e', '#140c22'); ctx.fillRect(sx, 132, 376, 186);
      ctx.fillStyle = `rgba(255,201,51,${0.75 + Math.sin(time * 3) * 0.2})`;
      ctx.font = 'italic 900 110px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VS', sx + 188, 228);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 132; y < 318; y += 4) ctx.fillRect(sx, y, 376, 1);
      glowDisc(ctx, sx + 188, 228, 300, '#ffc933', 0.18);
      // camera flashes in the crowd
      for (let i = 0; i < 3; i++) { const k = Math.floor(time * 3 + i * 7.3); const r = mulberry32(k); if (r() < 0.5) glowDisc(ctx, -800 + r() * 3200 + off, 320 + r() * 360, 26, '#ffffff', 0.9); }
    },
    front(ctx, d, time, vr, cam) {
      // sweeping spotlights from the truss
      for (let i = 0; i < 4; i++) {
        const x = 80 + i * 480 + (cam.x - 800) * 0.4, ang = Math.PI / 2 + Math.sin(time * 0.6 + i * 1.7) * 0.45;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const len = 980, w = 0.08;
        const g = ctx.createLinearGradient(x, 60, x + Math.cos(ang) * len, 60 + Math.sin(ang) * len);
        g.addColorStop(0, 'rgba(255,240,210,0.2)'); g.addColorStop(1, 'rgba(255,240,210,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x + Math.cos(ang - w) * len, 60 + Math.sin(ang - w) * len); ctx.lineTo(x + Math.cos(ang + w) * len, 60 + Math.sin(ang + w) * len); ctx.closePath(); ctx.fill();
        Glow.draw(ctx, '#fff0d0', x, 60, 40, 0.8);
        ctx.restore();
      }
    },
  };

  /* Training Room -------------------------------------------------- */
  ART.lab = {
    sky: ['#0d1018', '#131826', '#1a2030'], amb: null, vignette: 0.4,
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
  };

  /* ------------------------------------------------------------- floors */
  const FLOOR = {
    wood: ['#7a4a2e', '#6c3f26', '#5a331f'], wet: ['#1b1c2a', '#202234', '#151626'], stone: ['#a39a92', '#968d85', '#8a8178'],
    glass: ['#140c2a', '#1a1036', '#0c0820'], lava: ['#2e1410', '#24100c', '#1a0a08'], dirt: ['#6e5e3c', '#625434', '#56492e'],
    snow: ['#dce7f4', '#cfdcec', '#c2d2e6'], ring: ['#8e8070', '#857766', '#7a6c5c'], tile: ['#1a1e2a', '#1e2230', '#161a24'],
  };
  function floorLayer(kind, rnd) {
    const cols = FLOOR[kind] || FLOOR.tile;
    return layer(1, g => {
      const top = GROUND, h = 260;
      g.fillStyle = vgrad(g, top, top + h, cols[0], mixHex(cols[2], '#000000', 0.5)); g.fillRect(X0, top, SPAN, h);
      const sx = (xx, yy) => 800 + (xx - 800) * (1 + (yy - top) / 260);
      if (kind === 'wood' || kind === 'ring' || kind === 'stone' || kind === 'tile' || kind === 'wet') {
        for (let row = 0; row < 7; row++) {
          const y0 = top + row * row * 6 + row * 6, y1 = top + (row + 1) * (row + 1) * 6 + (row + 1) * 6;
          const step = kind === 'wood' ? 180 : 120;
          for (let x = X0 - (row % 2) * step / 2; x < X1; x += step) {
            g.fillStyle = cols[Math.floor(rnd() * 3)];
            g.beginPath(); g.moveTo(sx(x, y0), y0); g.lineTo(sx(x + step - 3, y0), y0); g.lineTo(sx(x + step - 3, y1), y1); g.lineTo(sx(x, y1), y1); g.closePath(); g.fill();
            if (kind === 'wood') { g.strokeStyle = 'rgba(40,20,10,0.25)'; g.lineWidth = 1; for (let k = 1; k < 3; k++) { const yy = y0 + (y1 - y0) * k / 3; g.beginPath(); g.moveTo(sx(x + 8, yy), yy); g.lineTo(sx(x + step - 10, yy), yy); g.stroke(); } }
          }
        }
        g.fillStyle = vgrad(g, top, top + h, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'); g.fillRect(X0, top, SPAN, h);
      }
      if (kind === 'wet') {
        // puddles that will catch reflections
        for (let i = 0; i < 26; i++) { const x = X0 + rnd() * SPAN, y = top + 12 + rnd() * 120, w = 60 + rnd() * 160; g.fillStyle = 'rgba(8,8,18,0.55)'; g.beginPath(); g.ellipse(x, y, w, 6 + rnd() * 8, 0, 0, TAU); g.fill(); d_puddles.push([x, y, w]); }
      }
      if (kind === 'dirt') {
        for (let i = 0; i < 400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,240,200,0.08)'; g.fillRect(X0 + rnd() * SPAN, top + rnd() * 200, 2 + rnd() * 4, 2); }
      }
      if (kind === 'lava') {
        g.strokeStyle = '#ff5a1c'; g.lineWidth = 3;
        for (let i = 0; i < 40; i++) { let x = X0 + rnd() * SPAN, y = top + 4 + rnd() * 150; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 80; y += rnd() * 20; g.lineTo(x, y); } g.stroke(); }
      }
      if (kind === 'glass') {
        // faint energy veins under the glass
        g.strokeStyle = 'rgba(190,150,255,0.28)'; g.lineWidth = 1.5;
        for (let i = 0; i < 26; i++) { let x = X0 + rnd() * SPAN, y = top + 8 + rnd() * 120; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 90; y += rnd() * 26; g.lineTo(x, y); } g.stroke(); }
        g.strokeStyle = 'rgba(155,107,255,0.3)'; g.lineWidth = 2; g.beginPath();
        for (let i = -20; i <= 20; i++) { g.moveTo(800 + i * 60, top); g.lineTo(800 + i * 220, top + 260); }
        for (let r = 1; r < 7; r++) { const y = top + r * r * 6; g.moveTo(X0, y); g.lineTo(X1, y); }
        g.stroke();
      }
      if (kind === 'snow') { g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 300; i++) g.fillRect(X0 + rnd() * SPAN, top + rnd() * 200, 2, 2); g.fillStyle = vgrad(g, top, top + 40, 'rgba(90,120,170,0.25)', 'rgba(90,120,170,0)'); g.fillRect(X0, top, SPAN, 40); }
      if (kind === 'ring') { g.fillStyle = '#e8d8b0'; g.fillRect(X0, top + 6, SPAN, 5); g.fillRect(WALL_L - 10, top, 12, 260); g.fillRect(WALL_R, top, 12, 260); }
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X0, top, SPAN, 3);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X0, top + 3, SPAN, 6);
    }, GROUND + 270);
  }
  let d_puddles = [];

  /* -------------------------------------------------------------- weather */
  // rain falls in three depths: far (fine and faint), mid, and near (long, bright, in front of the fighters)
  const RAIN = [{ n: 260, len: 18, w: 1, a: 0.16, v: 1500, par: 0.6 }, { n: 140, len: 36, w: 1.4, a: 0.26, v: 1900, par: 0.85 }, { n: 46, len: 80, w: 2.2, a: 0.32, v: 2600, par: 1.15 }];
  const WIND = -0.2;
  function rainInit(d, vr) {
    d.rain = RAIN.map(L => Array.from({ length: L.n }, () => ({ x: rand(vr.x0 - 300, vr.x1 + 300), y: rand(vr.y0 - 100, GROUND + 120), s: rand(0.8, 1.2) })));
    d.splash = []; d.ripples = [];
  }
  function rainUpdate(d, vr, dt) {
    if (!d.rain) rainInit(d, vr);
    RAIN.forEach((L, li) => {
      for (const p of d.rain[li]) {
        p.y += L.v * p.s * dt; p.x += L.v * p.s * WIND * dt;
        const floorY = li === 0 ? GROUND - 30 + (p.s - 1) * 100 : li === 1 ? GROUND + 10 + (p.s - 0.8) * 120 : GROUND + 60;
        if (p.y > floorY) {
          if (li > 0 && Math.random() < 0.7) {
            d.splash.push({ x: p.x, y: Math.min(p.y, GROUND + 140), t: 0, big: li === 2 });
            if (d_puddles.length && Math.random() < 0.4) d.ripples.push({ x: p.x, y: Math.min(p.y, GROUND + 140), t: 0 });
          }
          p.y = vr.y0 - rand(0, 200); p.x = rand(vr.x0 - 300, vr.x1 + 400);
        }
      }
    });
    for (const s of d.splash) s.t += dt;
    d.splash = d.splash.filter(s => s.t < 0.22).slice(-120);
    for (const r of d.ripples) r.t += dt;
    d.ripples = d.ripples.filter(r => r.t < 0.6).slice(-60);
  }
  function rainDraw(ctx, d, layers) {
    if (!d.rain) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (const li of layers) {
      const L = RAIN[li];
      // each streak: a faint long tail and a brighter head, angled with the wind
      ctx.strokeStyle = `rgba(200,215,255,${L.a * 0.5})`; ctx.lineWidth = L.w;
      ctx.beginPath();
      for (const p of d.rain[li]) { const len = L.len * p.s; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - WIND * len, p.y - len); }
      ctx.stroke();
      ctx.strokeStyle = `rgba(225,235,255,${L.a})`; ctx.lineWidth = L.w * 0.9;
      ctx.beginPath();
      for (const p of d.rain[li]) { const len = L.len * p.s * 0.35; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - WIND * len, p.y - len); }
      ctx.stroke();
    }
    if (layers.includes(1)) {
      // crown splashes and puddle ripples
      ctx.strokeStyle = 'rgba(210,225,255,0.55)'; ctx.lineWidth = 1.2;
      for (const s of d.splash) {
        const k = s.t / 0.22, r = (s.big ? 10 : 6) * (0.4 + k);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.moveTo(s.x - r, s.y - r * 0.2 - k * 6); ctx.lineTo(s.x - r * 0.4, s.y - r * 0.9 * (1 - k)); ctx.moveTo(s.x + r, s.y - r * 0.2 - k * 6); ctx.lineTo(s.x + r * 0.4, s.y - r * 0.9 * (1 - k)); ctx.stroke();
      }
      for (const r of d.ripples) { const k = r.t / 0.6; ctx.globalAlpha = (1 - k) * 0.6; ctx.beginPath(); ctx.ellipse(r.x, r.y, 4 + k * 30, 1.5 + k * 5, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function lightning(ctx, d, time, vr, cam) {
    d.boltT = (d.boltT == null ? 6 : d.boltT) - (time - (d.lastLT || time));
    d.lastLT = time;
    if (d.boltT <= 0) {
      d.boltT = rand(7, 14);
      d.flash = 1;
      const x = rand(vr.x0 + 200, vr.x1 - 200);
      const pts = [[x, vr.y0]]; let y = vr.y0;
      while (y < 520) { y += rand(30, 70); pts.push([pts[pts.length - 1][0] + rand(-50, 50), y]); }
      d.bolt = { pts, t: 0 };
      setTimeout(() => Sfx.play('thunder'), 450);
    }
    if (d.flash > 0) {
      d.flash = Math.max(0, d.flash - 0.08);
      ctx.fillStyle = `rgba(190,200,255,${d.flash * 0.35})`; ctx.fillRect(vr.x0, vr.y0, vr.x1 - vr.x0, GROUND - vr.y0);
    }
    if (d.bolt) {
      d.bolt.t += 1 / 60;
      const a = Math.max(0, 1 - d.bolt.t / 0.25);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [w, c] of [[8, 'rgba(160,170,255,0.4)'], [2.5, 'rgba(255,255,255,0.95)']]) {
        ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); d.bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      ctx.restore();
      if (a <= 0) d.bolt = null;
    }
  }

  function spawnAmb(kind, vr, fresh) {
    const x = rand(vr.x0 - 100, vr.x1 + 100), y = fresh ? rand(vr.y0, vr.y1) : vr.y0 - 20;
    switch (kind) {
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
  const AMB_N = { snow: 130, petals: 50, embers: 60, motes: 60, fireflies: 30, dust: 40, confetti: 40 };
  function updateAmb(d, kind, vr, dt) {
    if (!kind) return;
    if (kind === 'rain') { rainUpdate(d, vr, dt); return; }
    while (d.amb.length < AMB_N[kind]) d.amb.push(spawnAmb(kind, vr, true));
    for (let i = 0; i < d.amb.length; i++) {
      const p = d.amb[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.ph += dt;
      if (kind === 'petals' || kind === 'snow' || kind === 'confetti') p.x += Math.sin(p.ph * 1.6) * 30 * dt;
      if (kind === 'fireflies') { p.vx += rand(-40, 40) * dt; p.vy += rand(-40, 40) * dt; }
      if (p.y > GROUND + 20 || p.y < vr.y0 - 60 || p.x < vr.x0 - 200 || p.x > vr.x1 + 200) d.amb[i] = spawnAmb(kind, vr, false);
    }
  }
  function drawAmb(ctx, d, kind) {
    if (!kind || kind === 'rain') return;
    ctx.save();
    if (kind === 'petals') {
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
    const d = { art, amb: [], signs: [], isles: [], stars: [], masts: [], mastsMid: [], lamps: [], runes: [] };
    for (let i = 0; i < (art.stars || 0); i++) d.stars.push({ x: X0 + rnd() * SPAN, y: rnd() * 600, r: 0.6 + rnd() * 1.6, tw: rnd() * 6 });
    d_puddles = [];
    art.build(d, rnd);
    d.floorL = floorLayer(d.floor || 'tile', rnd);
    d.puddles = d_puddles;
    cache[id] = d;
    return d;
  }

  let lastT = 0;
  function draw(ctx, id, vr, time, cam) {
    const d = prepare(id), art = d.art;
    const dt = clamp(time - lastT, 0, 0.05); lastT = time;
    d_puddles = d.puddles;
    ctx.fillStyle = vgrad(ctx, vr.y0, GROUND, art.sky[0], art.sky[1], art.sky[2]);
    ctx.fillRect(vr.x0 - 10, vr.y0 - 10, vr.x1 - vr.x0 + 20, GROUND - vr.y0 + 20);
    for (const s of d.stars) { ctx.globalAlpha = 0.35 + Math.sin(time * 2 + s.tw) * 0.3; ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x + (cam.x - 800) * 0.95, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    if (art.sun) {
      const [sx, sy, sc] = art.sun, x = sx + (cam.x - 800) * 0.95;
      glowDisc(ctx, x, sy, 600, sc, 0.75);
      ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(x, sy, 66, 0, TAU); ctx.fill();
    }
    if (art.moon) {
      const [mx, my] = art.moon, x = mx + (cam.x - 800) * 0.95;
      glowDisc(ctx, x, my, 280, '#cfd8ff', 0.45);
      ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(x, my, 50, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,170,210,0.35)'; ctx.beginPath(); ctx.arc(x - 14, my - 10, 12, 0, TAU); ctx.arc(x + 16, my + 14, 8, 0, TAU); ctx.fill();
    }
    if (d.nebula) drawLayer(ctx, d.nebula, cam, 0.92);
    if (art.back) art.back(ctx, d, time, vr, cam);
    if (d.far) drawLayer(ctx, d.far, cam, 0.85);
    if (art.afterFar) art.afterFar(ctx, d, time, vr, cam);
    if (d.mid) drawLayer(ctx, d.mid, cam, 0.6);
    if (art.afterMid) art.afterMid(ctx, d, time, vr, cam);
    if (art.amb === 'rain') rainDraw(ctx, d, [0]);
    if (d.rail) { drawLayer(ctx, d.rail, cam, 0.2); }
    if (art.afterRail) art.afterRail(ctx, d, time, vr, cam);
    if (d.near) drawLayer(ctx, d.near, cam, id === 'city' ? 0 : 0.3);
    if (art.front) art.front(ctx, d, time, vr, cam);
    ctx.drawImage(d.floorL.c, X0, 0, SPAN, d.floorL.h);
    if (vr.y1 > GROUND + 260) { ctx.fillStyle = '#000'; ctx.globalAlpha = 0.6; ctx.fillRect(vr.x0, GROUND + 260, vr.x1 - vr.x0, vr.y1 - GROUND - 260); ctx.globalAlpha = 1; }
    floorFx(ctx, id, d, time, vr, cam);
    if (art.amb === 'rain') rainDraw(ctx, d, [1]);
    updateAmb(d, art.amb, vr, dt);
  }

  function floorFx(ctx, id, d, time, vr, cam) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (id === 'dojo') {
      const x = 800 + (cam.x - 800) * 0.95;
      const g = vgrad(ctx, GROUND, GROUND + 160, 'rgba(255,230,170,0.35)', 'rgba(255,230,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 60, GROUND); ctx.lineTo(x + 60, GROUND); ctx.lineTo(x + 260, GROUND + 160); ctx.lineTo(x - 260, GROUND + 160); ctx.closePath(); ctx.fill();
    }
    if (id === 'city') {
      // wet reflections: each sign smears down into the roof, rippling
      const off = (cam.x - 800) * 0.6;
      for (const s of d.signs) {
        const x = s.x + off + s.w / 2;
        if (x < vr.x0 - 50 || x > vr.x1 + 50) continue;
        for (let k = 0; k < 6; k++) {
          const y = GROUND + 6 + k * 18, w = s.w * (0.5 + k * 0.08) + Math.sin(time * 4 + k + s.ph) * 4;
          ctx.fillStyle = rgba(s.c, 0.16 - k * 0.022);
          ctx.fillRect(x - w / 2 + Math.sin(time * 3 + k * 1.3 + s.ph) * 3, y, w, 12);
        }
      }
      const sx = d.screen.x + off + d.screen.w / 2, hue = (time * 30) % 360;
      for (let k = 0; k < 5; k++) { ctx.fillStyle = `hsla(${hue},90%,60%,${0.1 - k * 0.018})`; ctx.fillRect(sx - 100 + Math.sin(time * 3 + k) * 4, GROUND + 8 + k * 20, 200, 14); }
      // puddles catch a bright sheen
      for (const [px, py, w] of d.puddles) { if (px < vr.x0 - w || px > vr.x1 + w) continue; ctx.fillStyle = 'rgba(160,140,255,0.06)'; ctx.beginPath(); ctx.ellipse(px, py, w, 6, 0, 0, TAU); ctx.fill(); }
      // ground mist
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = vgrad(ctx, GROUND - 90, GROUND + 30, 'rgba(120,100,170,0)', 'rgba(120,100,170,0.16)', 'rgba(120,100,170,0)');
      ctx.fillRect(vr.x0, GROUND - 90, vr.x1 - vr.x0, 120);
    }
    if (id === 'crater') {
      ctx.globalAlpha = 0.35 + Math.sin(time * 2) * 0.12;
      Glow.draw(ctx, '#ff5a1c', 800 + (cam.x - 800) * 0.2, GROUND + 60, 900, 0.5);
      ctx.globalAlpha = 1;
    }
    if (id === 'void') { ctx.fillStyle = vgrad(ctx, GROUND, GROUND + 200, 'rgba(155,107,255,0.25)', 'rgba(155,107,255,0)'); ctx.fillRect(vr.x0, GROUND, vr.x1 - vr.x0, 200); }
    if (id === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 20; i++) { const x = ((i * 137 + Math.floor(time * 2) * 61) % 1600), a = Math.max(0, Math.sin(time * 4 + i)); ctx.globalAlpha = a; ctx.fillRect(x, GROUND + 10 + (i * 37) % 120, 2, 2); } ctx.globalAlpha = 1; }
    ctx.restore();
  }

  // after the fighters: near rain, weather particles and a soft out-of-focus frame
  function drawFront(ctx, id, vr, time, cam) {
    const d = prepare(id);
    if (d.art.amb === 'rain') rainDraw(ctx, d, [2]);
    drawAmb(ctx, d, d.art.amb);
    const fc = { dojo: '#24130c', city: '#07060e', temple: '#3a1418', void: '#0a0618', crater: '#120605', forest: '#16301a', snow: '#1c2e52', arena: '#120a18' }[id];
    if (fc) {
      const off = (cam.x - 800) * -0.25;
      ctx.fillStyle = fc; ctx.globalAlpha = 0.92;
      for (const x of [WALL_L - 200, WALL_R + 130]) ctx.fillRect(x + off, vr.y0 - 20, 70, vr.y1 - vr.y0 + 40);
      ctx.globalAlpha = 1;
    }
  }

  // screen space: a colour grade and vignette over everything except the HUD
  function grade(ctx, id, cw, ch) {
    const art = (ART[id] || ART.dojo);
    if (art.grade) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = rgba(art.grade[0], art.grade[1] * 4); ctx.fillRect(0, 0, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
    const v = art.vignette || 0.4;
    const g = ctx.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.55, Math.hypot(cw, ch) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${v})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }

  return { prepare, draw, drawFront, grade };
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
    r.settleCloth();
    rags[def.id] = r;
    return r;
  }
  // draw head and shoulders centred at (x, y) filling roughly `size` px tall
  function drawBig(ctx, def, x, y, size, facing, time, mono) {
    const r = rag(def);
    r.facing = facing;
    r.computeTargets(); r.snapToPose();
    r.settleCloth();
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
