'use strict';
/* =========================================================================
   Audio: every sound is synthesized with WebAudio (no files), in the same
   way as Element Rag. A small step sequencer plays a driving fight track.
   ========================================================================= */

const Sfx = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, comp = null;
  let sfxOn = true, musicOn = true, suspended = false;
  let track = 'menu', timer = null, nextT = 0, stepN = 0;
  const last = {};

  function ensure() {
    if (ac) { if (ac.state === 'suspended' && !suspended) ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0.85; master.connect(comp);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.6 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.22 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 40);
    return true;
  }

  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0, bus = null, at = null) {
    if (!ac) return;
    const t = (at != null ? at : ac.currentTime) + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, filt = 1200, type = 'lowpass', q = 1, delay = 0, sweep = 0, bus = null, at = null) {
    if (!ac) return;
    const t = (at != null ? at : ac.currentTime) + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filt, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, filt * sweep), t + dur);
    const g = ac.createGain();
    env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const S = {
    swish: () => noise(0.09, 0.14, 2600, 'bandpass', 1.2, 0, 0.5),
    swishH: () => noise(0.16, 0.2, 1500, 'bandpass', 1, 0, 0.4),
    hitL: k => { noise(0.07, 0.32, 2200, 'lowpass', 1); tone(180, 0.07, 'square', 0.08, 0.5); },
    hitH: k => { noise(0.16, 0.5, 900, 'lowpass', 1); tone(110, 0.18, 'sine', 0.45, 0.4); noise(0.05, 0.25, 5000, 'highpass', 1); },
    tap: () => { noise(0.04, 0.22, 2600, 'lowpass', 1); tone(260, 0.04, 'square', 0.04, 0.6); },
    block: () => { tone(900, 0.06, 'triangle', 0.12, 0.7); noise(0.06, 0.2, 3800, 'bandpass', 2); },
    break: () => { for (let i = 0; i < 4; i++) tone(1400 - i * 260, 0.08, 'square', 0.06, 0.6, i * 0.04); noise(0.3, 0.3, 2000, 'lowpass'); },
    grab: () => noise(0.08, 0.25, 700, 'lowpass', 1),
    blast: () => { noise(0.2, 0.3, 1600, 'bandpass', 1, 0, 0.4); tone(300, 0.2, 'sine', 0.2, 0.5); },
    ki: () => { tone(520, 0.18, 'sawtooth', 0.06, 2.2); noise(0.2, 0.15, 3000, 'bandpass', 2, 0, 0.5); },
    vanish: () => { tone(1600, 0.08, 'sine', 0.1, 0.3); noise(0.08, 0.15, 6000, 'highpass'); },
    charge: () => { tone(120, 0.8, 'sawtooth', 0.08, 4); noise(0.8, 0.12, 400, 'bandpass', 2, 0, 8); },
    beam: () => { noise(1.2, 0.35, 700, 'lowpass', 1, 0, 2.5); tone(70, 1.2, 'sawtooth', 0.15, 1.4); },
    beamHit: () => noise(0.05, 0.15, 3000, 'bandpass', 1),
    spiral: () => { tone(300, 0.5, 'sawtooth', 0.05, 3); noise(0.5, 0.2, 1800, 'bandpass', 3, 0, 2); },
    drill: () => noise(0.05, 0.18, 4000, 'bandpass', 3),
    pop: () => { tone(700, 0.08, 'sine', 0.15, 0.4); noise(0.12, 0.2, 900, 'lowpass'); },
    whoosh: () => noise(0.4, 0.3, 900, 'bandpass', 1, 0, 3),
    wind: () => noise(0.3, 0.12, 1200, 'bandpass', 1),
    cut: () => noise(0.04, 0.16, 5200, 'bandpass', 2),
    blue: () => { tone(200, 0.6, 'sine', 0.2, 0.4); noise(0.6, 0.15, 500, 'lowpass', 1, 0, 0.3); },
    red: () => { tone(90, 0.3, 'square', 0.15, 0.3); noise(0.35, 0.45, 1400, 'lowpass', 1, 0, 0.3); },
    domain: () => { for (let i = 0; i < 3; i++) tone(220 * (i + 1), 1.4, 'sine', 0.08, 1.01, i * 0.05); noise(1.2, 0.12, 300, 'lowpass', 1, 0, 6); },
    violet: () => { tone(60, 1.2, 'sawtooth', 0.2, 0.6); noise(1.0, 0.5, 600, 'lowpass', 1, 0, 3); },
    slash: () => noise(0.08, 0.28, 4200, 'bandpass', 1.5, 0, 0.5),
    slashH: () => { noise(0.14, 0.38, 3200, 'bandpass', 1.2, 0, 0.4); tone(160, 0.12, 'sine', 0.2, 0.5); },
    flame: () => noise(0.6, 0.3, 700, 'lowpass', 1, 0, 3),
    fang: () => { noise(0.3, 0.35, 2600, 'bandpass', 1, 0, 0.3); tone(220, 0.3, 'sawtooth', 0.06, 0.5); },
    stretch: () => tone(220, 0.25, 'triangle', 0.15, 2.5),
    drum: () => { for (let i = 0; i < 4; i++) { tone(70, 0.25, 'sine', 0.5, 0.6, i * 0.22); noise(0.08, 0.2, 400, 'lowpass', 1, i * 0.22); } },
    boom: () => { tone(48, 1.0, 'sine', 0.7, 0.5); noise(1.0, 0.6, 500, 'lowpass', 1, 0, 0.2); noise(0.2, 0.3, 4000, 'highpass'); },
    flick: () => { noise(0.12, 0.35, 1800, 'bandpass', 1, 0, 0.3); tone(400, 0.08, 'square', 0.06, 0.3); },
    zap: () => { noise(0.14, 0.25, 3200, 'bandpass', 0.8); tone(1200, 0.1, 'square', 0.04, 0.25); },
    stand: () => { tone(330, 0.3, 'triangle', 0.1, 1.5); tone(495, 0.3, 'triangle', 0.06, 1.5, 0.05); },
    clock: () => { for (let i = 0; i < 4; i++) tone(1800, 0.05, 'square', 0.08, 1, i * 0.18); tone(110, 1.2, 'sine', 0.2, 0.4, 0.5); },
    resume: () => { tone(600, 0.2, 'sine', 0.15, 0.3); noise(0.3, 0.3, 1200, 'lowpass'); },
    clash: () => { tone(1200, 0.1, 'triangle', 0.12, 0.5); noise(0.18, 0.3, 2400, 'bandpass', 1); },
    splat: () => { noise(0.2, 0.5, 700, 'lowpass', 1); tone(80, 0.2, 'sine', 0.4, 0.5); },
    counter: () => tone(1500, 0.08, 'square', 0.06, 1.2),
    blackflash: () => { noise(0.4, 0.6, 900, 'lowpass', 1, 0, 0.2); tone(55, 0.6, 'sawtooth', 0.3, 0.5); noise(0.08, 0.4, 7000, 'highpass'); },
    cutin: () => { noise(0.5, 0.25, 600, 'bandpass', 1, 0, 6); tone(330, 0.5, 'sawtooth', 0.06, 2); },
    round: () => { tone(392, 0.18, 'square', 0.08); tone(523, 0.3, 'square', 0.08, 1, 0.16); },
    fight: () => { tone(523, 0.12, 'square', 0.1); tone(784, 0.4, 'square', 0.1, 1, 0.1); noise(0.3, 0.2, 1800, 'bandpass', 1, 0.1); },
    ko: () => { tone(160, 0.8, 'sawtooth', 0.15, 0.4); noise(0.6, 0.4, 900, 'lowpass', 1, 0, 0.3); },
    finish: () => { tone(40, 1.6, 'sine', 0.8, 0.5); noise(1.4, 0.6, 400, 'lowpass', 1, 0, 0.2); noise(0.3, 0.4, 6000, 'highpass'); tone(880, 0.6, 'square', 0.05, 0.5, 0.1); },
    perfect: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'square', 0.07, 1, i * 0.09)); },
    ui: () => tone(660, 0.05, 'triangle', 0.08, 1.2),
    uiBack: () => tone(440, 0.05, 'triangle', 0.08, 0.8),
    coin: () => { tone(988, 0.08, 'square', 0.06); tone(1318, 0.18, 'square', 0.06, 1, 0.07); },
    unlock: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 1, i * 0.08)); },
  };

  function play(name, k) {
    if (!ac || !sfxOn) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < 0.025) return;   // stacks of the same sound in one frame
    last[name] = now;
    const f = S[name];
    if (f) f(k);
  }

  /* ------------------------------------------------------------- music */
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  const TRACKS = {
    menu: { bpm: 100, root: 45, drums: 0.5, prog: [0, 0, -4, -2] },
    fight: { bpm: 148, root: 40, drums: 1, prog: [0, 0, 3, -2] },
    final: { bpm: 164, root: 42, drums: 1.2, prog: [0, -2, 3, 5] },
    win: { bpm: 120, root: 45, drums: 0.6, prog: [0, 5, 7, 5] },
  };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function schedule() {
    if (!ac || suspended) return;
    const tr = TRACKS[track] || TRACKS.menu;
    const sp = 60 / tr.bpm / 4;
    while (nextT < ac.currentTime + 0.12) {
      if (musicOn) beat(tr, stepN, nextT, sp);
      stepN++;
      nextT += sp;
    }
  }
  function beat(tr, n, t, sp) {
    const s16 = n % 16, bar = Math.floor(n / 16) % 4;
    const root = tr.root + tr.prog[bar];
    const d = tr.drums;
    if (d > 0.4) {
      if (s16 === 0 || s16 === 8 || (d > 0.9 && s16 === 10)) { tone(110, 0.12, 'sine', 0.55 * d, 0.35, 0, musicBus, t); }
      if (s16 === 4 || s16 === 12) noise(0.12, 0.22 * d, 1800, 'bandpass', 0.8, 0, 0, musicBus, t);
      if (d > 0.9 && s16 % 2 === 0) noise(0.03, 0.07, 8000, 'highpass', 1, 0, 0, musicBus, t);
    }
    // bass
    if (track === 'menu') {
      if (s16 % 8 === 0) tone(mtof(root), sp * 7, 'triangle', 0.18, 1, 0, musicBus, t);
    } else if (s16 % 2 === 0) {
      const off = [0, 0, 12, 0, 7, 0, 10, 12][(s16 / 2) | 0];
      tone(mtof(root + off), sp * 1.6, 'sawtooth', 0.07, 1, 0, musicBus, t);
    }
    // a lead arpeggio on the off beats of every other bar
    if ((bar % 2 === 1 || track === 'final') && s16 % 3 === 0) {
      const note = root + 24 + SCALE[(n * 5 + bar) % SCALE.length];
      tone(mtof(note), sp * 1.2, 'square', track === 'menu' ? 0.025 : 0.035, 1, 0, musicBus, t);
    }
  }
  function music(kind) { track = kind; }

  function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.6 : 0; }
  function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.22 : 0; }
  function suspend(v) { suspended = v; if (!ac) return; if (v) ac.suspend(); else ac.resume(); }

  return { ensure, play, music, setSfx, setMusic, suspend };
})();
