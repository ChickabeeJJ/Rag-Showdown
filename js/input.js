'use strict';
/* =========================================================================
   Input: keyboard (two layouts), gamepads and touch feed per-side state.
   HumanCtrl turns that state into a fighter's walk input and button
   presses (with double-tap dashes and light+heavy throws).
   ========================================================================= */

const Input = (() => {
  // two key sets. In single-player both drive player 1.
  // player 1: WASD + mouse (left click light, right click heavy), Q / E specials, F super
  const SET_A = {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', Space: 'up', KeyS: 'down',
    KeyQ: 's1', KeyE: 's2', KeyF: 'sup',
  };
  const SET_B = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 'l', Numpad2: 'h', Numpad4: 's1', Numpad5: 's2', Numpad3: 'sup', Numpad6: 'throw',
    Comma: 'l', Period: 'h', Semicolon: 's1', Quote: 's2', Slash: 'sup', Enter: 'throw',
  };
  const sides = [mk(), mk()];
  function mk() { return { left: false, right: false, q: [], lastTap: { left: -9, right: -9 }, lastL: -9, lastH: -9, touchX: 0, pads: {} }; }
  let twoPlayer = false;
  let enabled = false;
  const now = () => performance.now() / 1000;

  function sideFor(code) {
    if (SET_A[code]) return { side: 0, act: SET_A[code] };
    if (SET_B[code]) return { side: twoPlayer ? 1 : 0, act: SET_B[code] };
    return null;
  }

  function push(side, act) {
    const s = sides[side];
    const t = now();
    if (act === 'left' || act === 'right') {
      if (t - s.lastTap[act] < 0.24) s.q.push(act === 'left' ? 'tapL' : 'tapR');
      s.lastTap[act] = t;
      return;
    }
    if (act === 'up') { s.q.push('jump'); return; }
    if (act === 'down') return;
    // light + heavy together is a throw
    if (act === 'l') { if (t - s.lastH < 0.07) { s.q.push('throw'); return; } s.lastL = t; }
    if (act === 'h') { if (t - s.lastL < 0.07) { s.q.push('throw'); return; } s.lastH = t; }
    s.q.push(act);
    if (s.q.length > 10) s.q.shift();
  }

  function keydown(e) {
    const m = sideFor(e.code);
    if (!m) return false;
    const s = sides[m.side];
    if (m.act === 'left' || m.act === 'right') { if (!s[m.act + 'K']) { s[m.act + 'K'] = true; if (enabled) push(m.side, m.act); } }
    else if (!e.repeat && enabled) push(m.side, m.act);
    return true;
  }
  function keyup(e) {
    const m = sideFor(e.code);
    if (!m) return;
    if (m.act === 'left' || m.act === 'right') sides[m.side][m.act + 'K'] = false;
  }
  function clearAll() { for (const s of sides) { s.leftK = s.rightK = false; s.q.length = 0; s.touchX = 0; } }

  /* gamepads: A jump, X light, Y heavy, B special 1, RB special 2, RT super, LB throw */
  const PAD = { 0: 'up', 2: 'l', 3: 'h', 1: 's1', 5: 's2', 7: 'sup', 4: 'throw', 12: 'up' };
  function pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const side = twoPlayer ? Math.min(1, n) : 0;
      n++;
      const s = sides[side];
      const st = s.pads[p.index] || (s.pads[p.index] = { b: {}, x: 0 });
      const ax = Math.abs(p.axes[0] || 0) > 0.45 ? Math.sign(p.axes[0]) : 0;
      const dx = (p.buttons[15] && p.buttons[15].pressed ? 1 : 0) - (p.buttons[14] && p.buttons[14].pressed ? 1 : 0);
      const x = dx || ax;
      if (x !== st.x && x !== 0 && enabled) push(side, x > 0 ? 'right' : 'left');
      st.x = x;
      for (const k in PAD) {
        const b = p.buttons[k];
        const down = !!(b && (b.pressed || b.value > 0.5));
        if (down && !st.b[k] && enabled) push(side, PAD[k]);
        st.b[k] = down;
      }
      if (p.buttons[9] && p.buttons[9].pressed && !st.start) { st.start = true; if (typeof UI !== 'undefined') UI.padStart(); }
      else if (!(p.buttons[9] && p.buttons[9].pressed)) st.start = false;
    }
  }
  function padX(side) {
    let x = 0;
    for (const k in sides[side].pads) x = x || sides[side].pads[k].x;
    return x;
  }

  return {
    keydown, keyup, clearAll, pollPads,
    setTwoPlayer(v) { twoPlayer = v; },
    get twoPlayer() { return twoPlayer; },
    enable(v) { enabled = v; if (!v) for (const s of sides) s.q.length = 0; },
    side: i => sides[i],
    axis(i) { const s = sides[i]; return clamp((s.rightK ? 1 : 0) - (s.leftK ? 1 : 0) || padX(i) || s.touchX, -1, 1); },
    touchPress(act) { if (enabled) push(0, act); },
    // mouse: 0 left = light, 2 right = heavy, 1 middle = super (both clicks together throw)
    mouse(button) { if (!enabled) return; push(0, button === 0 ? 'l' : button === 2 ? 'h' : 'sup'); },
    setTouchX(x) { const s = sides[0]; if (x !== s.touchX && x !== 0 && enabled) push(0, x > 0 ? 'right' : 'left'); s.touchX = x; },
  };
})();

class HumanCtrl {
  constructor(side) { this.side = side; this.human = true; }
  reset() { const s = Input.side(this.side); s.q.length = 0; }
  update(G, f) {
    const s = Input.side(this.side);
    f.input.x = Input.axis(this.side);
    while (s.q.length) {
      let k = s.q.shift();
      if (k === 'tapL' || k === 'tapR') {
        const dir = k === 'tapL' ? -1 : 1;
        const toward = Math.sign(G.opp(f).root.x - f.root.x) || f.facing;
        k = dir === toward ? 'dashF' : 'dashB';
      }
      if (k === 'throw' && f.action && f.action.key === 'l1' && f.action.t < 0.08) { f.action = null; }
      G.press(this.side, k);
    }
  }
}
