'use strict';
/* =========================================================================
   Campaign: eight chapters of six levels, in the spirit of Element Rag's
   stage map. Levels are fast: one round against one to three foes who drop
   in one after another (waves), health carrying over; the sixth is a boss. Beating the fighter
   on a recruit level (3 and 6) unlocks them. Most levels carry a twist,
   so neighbouring fights never play alike. Stars come from the health you
   have left when you win.
   ========================================================================= */

const CHAPTERS = [
  { name: 'SUNSET DOJO', stage: 'dojo', foes: ['ryo', 'mugi', 'kohei', 'homura', 'ryo', 'blaze'], recruit: { 2: 'kohei', 5: 'blaze' } },
  { name: 'SAKURA SHRINE', stage: 'temple', foes: ['homura', 'kohei', 'triblade', 'blaze', 'mugi', 'jin'], recruit: { 2: 'triblade', 5: 'jin' } },
  { name: 'BAMBOO GROVE', stage: 'forest', foes: ['triblade', 'kaze', 'kensei', 'jin', 'ryo', 'ripper'], recruit: { 2: 'kensei', 5: 'ripper' } },
  { name: 'NEON ROOFTOP', stage: 'city', foes: ['ripper', 'jin', 'aoi', 'kohei', 'kensei', 'taro'], recruit: { 2: 'aoi', 5: 'taro' } },
  { name: 'FROST PEAK', stage: 'snow', foes: ['aoi', 'blaze', 'psychic', 'taro', 'triblade', 'monarch'], recruit: { 2: 'psychic', 5: 'monarch' } },
  { name: 'VOID RIFT', stage: 'void', foes: ['monarch', 'psychic', 'aoi', 'ripper', 'kensei', 'titan'], recruit: { 5: 'titan' } },
  { name: 'CRATER PLAINS', stage: 'crater', foes: ['titan', 'blaze', 'monarch', 'taro', 'jin', 'kaze'], recruit: {} },
  { name: 'GRAND ARENA', stage: 'arena', foes: ['psychic', 'titan', 'aoi', 'monarch', 'taro', 'saibo'], recruit: { 5: 'saibo' } },
];
const STARTERS = ['kaze', 'ryo', 'homura', 'mugi'];

const TWISTS = {
  classic: { name: 'CLASSIC', icon: 'swords', desc: 'A straight fight.' },
  giant: { name: 'GIANT FOE', icon: 'crown', desc: 'Your opponent is huge and tougher.' },
  lowgrav: { name: 'LOW GRAVITY', icon: 'up', desc: 'Everyone floats. Juggles last longer.' },
  supers: { name: 'SUPER CLASH', icon: 'burst', desc: 'Both fighters start with a full super meter.' },
  tough: { name: 'IRON WILL', icon: 'shield', desc: 'Your opponent has 50% more health.' },
  frenzy: { name: 'FRENZY', icon: 'haste', desc: 'The whole fight runs faster.' },
  glass: { name: 'GLASS CANNON', icon: 'heart', desc: 'Everyone hits twice as hard.' },
  clock: { name: 'BEAT THE CLOCK', icon: 'clock', desc: 'Win in 40 seconds, or you lose.' },
};
const TWIST_CYCLE = ['giant', 'supers', 'lowgrav', 'tough', 'frenzy', 'glass', 'clock'];

const Campaign = (() => {
  const levels = [];
  CHAPTERS.forEach((ch, c) => {
    ch.foes.forEach((foe, l) => {
      const i = levels.length;
      const boss = l === 5;
      const others = ch.foes.filter(x => x !== foe);
      const extra = k => others[(i + k * 2) % others.length];
      const waves = boss || l === 2 || l === 0 ? [foe] : l === 1 ? [extra(0), foe] : l === 3 ? [extra(1), foe] : [extra(0), extra(1), foe];
      let twist = 'classic';
      if (i >= 2 && !boss && l !== 2) twist = TWIST_CYCLE[(i * 3 + c) % TWIST_CYCLE.length];
      levels.push({
        i, c, l, foe, boss, twist,
        recruit: ch.recruit[l] || null,
        stage: ch.stage,
        lv: Math.min(9, 1 + Math.floor(i / 48 * 8.2) + (boss ? 1 : 0)),
        toWin: 1,
        waves,
        waveHp: boss ? 1.6 : waves.length === 1 ? 0.85 : waves.length === 2 ? 0.6 : 0.5,
        tutorial: i === 0,
        label: `${c + 1}-${l + 1}`,
      });
    });
  });
  const C = { levels, chapters: CHAPTERS };
  C.cleared = i => (Save.data.levels || {})[i] || 0;
  C.unlocked = i => i === 0 || C.cleared(i - 1) > 0;
  C.next = () => { for (const L of levels) if (!C.cleared(L.i)) return L; return levels[levels.length - 1]; };
  C.stars = () => levels.reduce((a, L) => a + C.cleared(L.i), 0);
  C.starsFor = hpFrac => (hpFrac >= 0.7 ? 3 : hpFrac >= 0.35 ? 2 : 1);
  // the opponent for a level, avoiding a mirror match with the player's own fighter
  C.foeFor = (L, me) => {
    if (L.foe !== me || L.recruit) return L.foe;
    const ch = CHAPTERS[L.c].foes;
    return ch.find(x => x !== me) || 'kaze';
  };
  C.chapterDone = c => levels.filter(L => L.c === c).every(L => C.cleared(L.i));
  return C;
})();
