'use strict';
const ICON_PATHS = {
  wind: '<path d="M3 8.5h10.5a3 3 0 1 0-3-3M3 12.5h14.5a3 3 0 1 1-3 3M3 16.5h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  fire: '<path d="M12.6 2.2c.7 3.6 5.4 5.9 5.4 11.3a6 6 0 0 1-12 0c0-3.2 1.9-4.7 2.6-7.4 1.6 1.2 2.4 3 2.3 5 1.6-1.5 2.3-4.9 1.7-8.9z" fill="currentColor"/>',
  water: '<path d="M12 2.6C9.2 7 6 10.4 6 14.3a6 6 0 0 0 12 0c0-3.9-3.2-7.3-6-11.7z" fill="currentColor"/><path d="M9.3 14.5a2.8 2.8 0 0 0 2.4 2.8" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linecap="round"/>',
  earth: '<path d="M2.5 19.5 8.4 9.7l3.6 4.8 3.2-4.4 6.3 9.4z" fill="currentColor"/><path d="M8.4 9.7l1.6 6.3M15.2 10.1l-.9 5.4" stroke="rgba(0,0,0,.3)" stroke-width="1.4"/>',
  frost: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.6 3.8 12 6.2l2.4-2.4M9.6 20.2 12 17.8l2.4 2.4M4.2 10.4l3.3-.9-.9-3.3M19.8 13.6l-3.3.9.9 3.3M4.2 13.6l3.3.9-.9 3.3M19.8 10.4l-3.3-.9.9-3.3"/></g>',
  lightning: '<path d="M13.4 2 4.6 13.6h6.2L9.6 22l9.8-12.4h-6.3z" fill="currentColor"/>',
  nature: '<path d="M20.5 3.5C10.8 3.4 4.2 8.3 4.2 15.6c0 1.5.3 2.9.9 4.1 1.4-5.2 5.1-8.9 10.4-11.2-4.4 3.1-7.2 6.9-8.4 11.6 8.5.6 13.6-5.6 13.4-16.6z" fill="currentColor"/>',
  void: '<path d="M12 12.2m-2 0a2 2 0 1 1 4 0a4 4 0 1 1-8 0a6 6 0 1 1 12 0a8 8 0 1 1-16 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
  light: '<circle cx="12" cy="12" r="4.3" fill="currentColor"/><g stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6M5 5l1.9 1.9M17.1 17.1 19 19M5 19l1.9-1.9M17.1 6.9 19 5"/></g>',
  steel: '<path d="M12 2.5 19 6v6c0 4.6-3 8-7 9.5C8 20 5 16.6 5 12V6z" fill="currentColor"/><path d="M12 6v12M8.5 9.5h7" stroke="rgba(0,0,0,.35)" stroke-width="1.8"/>',
  venom: '<path d="M12 2.5C9 7 6.5 10.3 6.5 14a5.5 5.5 0 0 0 11 0c0-3.7-2.5-7-5.5-11.5z" fill="currentColor"/><circle cx="10" cy="14.5" r="1.6" fill="rgba(0,0,0,.35)"/><circle cx="13.6" cy="16.6" r="1.1" fill="rgba(0,0,0,.35)"/>',
  arcane: '<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z" fill="currentColor"/>',
  crystal: '<path d="M12 2 18.5 8 12 22 5.5 8z" fill="currentColor"/><path d="M5.5 8h13M12 2 9.5 8 12 22l2.5-14L12 2" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.3"/>',
  gravity: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-25 12 12)"/>',
  echo: '<path d="M4 9.5v5M8 7v10M12 4.5v15M16 7v10M20 9.5v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  dragon: '<path d="M3 13c2.5-1 4-3.5 4.5-6.5 1.5 1.8 2.6 2.4 4.5 2.3 2.4 0 4.5-1.5 6-3.8.4 2.6 0 5-1.3 7l3.3 1.5-3.8 1.4c-1.4 3.6-4.7 6.1-8.7 6.1-2.3 0-3.9-.6-5.5-1.8l2.7-.9z" fill="currentColor"/><circle cx="15.2" cy="11.2" r="1.2" fill="rgba(0,0,0,.4)"/>',
  sand: '<path d="M2 17c3-3 6-3 9 0s6 3 11 0v4H2z" fill="currentColor"/><path d="M4 11c2.5-2 5-2 7.5 0s5 2 8.5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="5.5" r="1.4" fill="currentColor"/><circle cx="13" cy="4" r="1.1" fill="currentColor"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/>',
  smoke: '<path d="M3.5 16.5A3.8 3.8 0 0 1 7.5 12.6a5 5 0 0 1 9.6.9 3.3 3.3 0 0 1-.4 6.5H7a3.5 3.5 0 0 1-3.5-3.5z" fill="currentColor"/><path d="M8.5 9.5c-1.2-1.6.8-2.6-.3-4.8M13 9c-1.2-1.6.8-2.6-.3-4.8M17 10c-.9-1.2.6-2-.2-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  spirit: '<path d="M12 2.5c4 0 7 3 7 7.5v10.5l-2.3-1.6-2.3 1.6-2.4-1.6-2.4 1.6-2.3-1.6L5 20.5V10c0-4.5 3-7.5 7-7.5z" fill="currentColor"/><circle cx="9.5" cy="10" r="1.4" fill="rgba(0,0,0,.4)"/><circle cx="14.5" cy="10" r="1.4" fill="rgba(0,0,0,.4)"/>',
  crimson: '<path d="M12 3c-3.4 4.7-6 8-6 11.2a6 6 0 0 0 12 0C18 11 15.4 7.7 12 3z" fill="currentColor"/><path d="M9 4.5 5 2.5M15 4.5l4-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.3 14.5a2.8 2.8 0 0 0 2.4 2.8" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linecap="round"/>',
  moon: '<path d="M15.5 3a9 9 0 1 0 5.5 14.5A7.5 7.5 0 0 1 15.5 3z" fill="currentColor"/>',
  tempo: '<path d="M9 18V5.5l11-2.5v12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="6.3" cy="18" rx="3.3" ry="2.6" fill="currentColor"/><ellipse cx="17.3" cy="15.5" rx="3.3" ry="2.6" fill="currentColor"/><path d="M9 9l11-2.5" stroke="currentColor" stroke-width="2.2"/>',
  slime: '<path d="M4 19c-1.5 0-2-1.2-1-2.6C4.8 13.8 5.5 6 12 6s7.2 7.8 9 10.4c1 1.4.5 2.6-1 2.6z" fill="currentColor"/><circle cx="9.3" cy="13" r="1.4" fill="rgba(0,0,0,.4)"/><circle cx="14.7" cy="13" r="1.4" fill="rgba(0,0,0,.4)"/><path d="M8.5 9.5c.8-1.2 2-1.8 3.5-1.8" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.4" stroke-linecap="round"/>',
  shadow: '<path d="M12 2.5c3 2.5 7 4 7 10.5 0 4.5-3.2 8.5-7 8.5s-7-4-7-8.5C5 6.5 9 5 12 2.5z" fill="currentColor"/><path d="M8.5 12.5l2.3 1.2M15.5 12.5l-2.3 1.2" stroke="rgba(255,255,255,.75)" stroke-width="1.8" stroke-linecap="round"/>',
  midas: '<path d="M3.5 18.5h17l1-10-5 3.6L12 5l-4.5 7.1-5-3.6z" fill="currentColor"/><circle cx="12" cy="14.5" r="1.8" fill="rgba(0,0,0,.25)"/><path d="M3.5 21h17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  time: '<path d="M6.5 2.5h11M6.5 21.5h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7.5 3c0 4.5 4.5 6.5 4.5 9s-4.5 4.5-4.5 9h9c0-4.5-4.5-6.5-4.5-9s4.5-4.5 4.5-9z" fill="currentColor"/><path d="M9.5 19.5h5l-2.5-3z" fill="rgba(0,0,0,.3)"/>',
  rubber: '<path d="M4 15c0-5 3-8 6-8 2 0 3 1.5 3 3s-1 2.5-3 2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="17" cy="12" r="4.5" fill="currentColor"/><path d="M13 12.5c-1 0-2 .5-3 0" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  joker: '<rect x="5" y="3" width="11" height="15" rx="2" fill="currentColor" opacity=".55" transform="rotate(-12 10 10)"/><rect x="8" y="5" width="11" height="15" rx="2" fill="currentColor"/><path d="M13.5 9.5c-1-1.5-3-.8-3 .8 0 1.6 3 3.6 3 3.6s3-2 3-3.6c0-1.6-2-2.3-3-.8z" fill="rgba(0,0,0,.4)"/>',
  puppet: '<path d="M5 2.5v6M12 2.5v4.5M19 2.5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 8.5h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="10.5" r="2.3" fill="currentColor"/><path d="M12 12.8v5M12 14l-4-3.5M12 14l4-3.5M12 17.8l-2.5 3.7M12 17.8l2.5 3.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gadget: '<path d="M12 3.5 14 4l.6 2.1 2 1 2-.9 1.4 1.4-.9 2 1 2 2.1.6v2l-2.1.6-1 2 .9 2-1.4 1.4-2-.9-2 1-.6 2.1h-2l-.6-2.1-2-1-2 .9-1.4-1.4.9-2-1-2L2 14v-2l2.1-.6 1-2-.9-2 1.4-1.4 2 .9 2-1L10 4z" fill="currentColor"/><circle cx="12" cy="13" r="3.2" fill="rgba(0,0,0,.35)"/>',
  glitch: '<path d="M3 3h8v4H7v4H3z" fill="currentColor"/><path d="M13 3h8v8h-4V7h-4z" fill="currentColor" opacity=".7"/><path d="M3 13h4v4h4v4H3z" fill="currentColor" opacity=".7"/><path d="M15 13h6v8h-8v-4h2z" fill="currentColor"/><path d="M1 11.5h9M14 11.5h9" stroke="currentColor" stroke-width="1.6"/>',
  none: '<path d="M7 10.5V7a1.5 1.5 0 0 1 3 0v3M10 10V5.5a1.5 1.5 0 0 1 3 0V10M13 10V6.5a1.5 1.5 0 0 1 3 0v5M7 10.5a1.5 1.5 0 0 0-3 0V13a7 7 0 0 0 7 7h1a6 6 0 0 0 6-6v-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
/* =========================================================================
   Icons (24x24, currentColor). UI glyphs plus one glyph per move.
   Any element with data-icon="name" is filled in by Icons.hydrate().
   ========================================================================= */

const Icons = (() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor"';
  const P = {
    // ui
    heart: `<path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20.5 9c0 6-8.5 11.5-8.5 11.5z" ${F}/>`,
    gem: `<path d="M6.5 3.5h11l4 5.2L12 21 2.5 8.7z" ${F}/><path d="M2.5 8.7h19M9 3.5 7.8 8.7 12 21l4.2-12.3L15 3.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.3"/>`,
    star: `<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" ${F}/>`,
    pause: `<path d="M8.5 5v14M15.5 5v14" ${S} stroke-width="3.4"/>`,
    play: `<path d="M7 4.5v15l12.5-7.5z" ${F}/>`,
    back: `<path d="M15 5l-7 7 7 7" ${S} stroke-width="3"/>`,
    gear: `<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" ${S}/><path d="M10.3 2.8h3.4l.6 2.6 2 1.1 2.5-.9 1.7 2.9-1.9 1.8v2.3l1.9 1.8-1.7 2.9-2.5-.9-2 1.1-.6 2.6h-3.4l-.6-2.6-2-1.1-2.5.9-1.7-2.9 1.9-1.8v-2.3L3.5 8.5l1.7-2.9 2.5.9 2-1.1z" ${S} stroke-width="1.9"/>`,
    infinity: `<path d="M12 12c-2-2.6-3.5-4-5.5-4a4 4 0 0 0 0 8c2 0 3.5-1.4 5.5-4zm0 0c2 2.6 3.5 4 5.5 4a4 4 0 0 0 0-8c-2 0-3.5 1.4-5.5 4z" ${S} stroke-width="2.6"/>`,
    book: `<path d="M12 6.5C9.5 4.6 6.5 4 3 4.3v14.2c3.5-.3 6.5.3 9 2.2 2.5-1.9 5.5-2.5 9-2.2V4.3c-3.5-.3-6.5.3-9 2.2z" ${F}/><path d="M12 6.5v14" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/><path d="M5.5 8.5c1.8 0 3.4.3 4.5.9M5.5 11.5c1.8 0 3.4.3 4.5.9" stroke="rgba(0,0,0,.25)" stroke-width="1.3" fill="none"/>`,
    hammer: `<path d="M13.5 3.5 20.5 10.5 18 13 15.8 10.8 6 20.6a1.8 1.8 0 0 1-2.6-2.6L13.2 8.2 11 6z" ${F}/>`,
    lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.4" ${F}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>`,
    crown: `<path d="M3 18.5h18l1-11-5.5 4.2L12 4.5l-4.5 7.2L2 7.5z" ${F}/>`,
    skull: `<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.2 3 5.3V20h10v-3.7c1.7-1.1 3-2.7 3-5.3a8 8 0 0 0-8-8z" ${F}/><circle cx="8.8" cy="11.5" r="2" fill="#1a1424"/><circle cx="15.2" cy="11.5" r="2" fill="#1a1424"/>`,
    up: `<path d="M12 19V6M6 11.5 12 5.5l6 6" ${S} stroke-width="3"/>`,
    restart: `<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.5H9" ${S} stroke-width="2.6"/>`,
    home: `<path d="M3 11.2 12 3.5l9 7.7V20.5H14.5v-6h-5v6H3z" ${F}/>`,
    map: `<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20" ${S}/>`,
    next: `<path d="M5 12h13M13 6l6 6-6 6" ${S} stroke-width="2.8"/>`,
    sound: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" ${F}/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" ${S}/>`,
    music: `<path d="M9 17.5V5.5l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="17.5" r="2.8" ${F}/><circle cx="17.5" cy="15.5" r="2.8" ${F}/>`,
    shake: `<path d="M7 5.5h10v13H7zM3.5 8v8M20.5 8v8" ${S}/>`,
    hash: `<path d="M9 4 7.5 20M16.5 4 15 20M4.5 9h16M3.5 15h16" ${S}/>`,
    rotate: `<rect x="7" y="2.5" width="10" height="19" rx="2.5" ${S}/><path d="M2.5 15a9.5 9.5 0 0 0 6 6.5M21.5 9a9.5 9.5 0 0 0-6-6.5" ${S}/>`,
    close: `<path d="M6 6l12 12M18 6 6 18" ${S} stroke-width="3"/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7" ${S} stroke-width="3"/>`,
    plus: `<path d="M12 5v14M5 12h14" ${S} stroke-width="3"/>`,
    sword: `<path d="M19.5 3.5 10 13M19.5 3.5v4l-8 8M19.5 3.5h-4l-8 8M6.5 13.5l4 4M4 20l3.5-3.5" ${S}/>`,
    shieldUi: `<path d="M12 2.8 4.5 5.6v6c0 4.6 3.2 8.4 7.5 9.6 4.3-1.2 7.5-5 7.5-9.6v-6z" ${F}/>`,
    swirl: `<path d="M12 12m-1.5 0a1.5 1.5 0 1 1 3 0a3 3 0 1 1-6 0a4.6 4.6 0 1 1 9.2 0a6.3 6.3 0 1 1-12.6 0" ${S}/>`,
    wing: `<path d="M3 15c4-1 7-4 9-9 1 4 0 7-2 9 3 0 6-1 9-3-1 4-5 7-10 7-2.5 0-4.5-1.5-6-4z" ${F}/>`,
    anchor: `<circle cx="12" cy="5" r="2.2" ${S}/><path d="M12 7.2V21M7.5 11h9M4 14c0 4 3.6 7 8 7s8-3 8-7" ${S}/>`,
    target: `<circle cx="12" cy="12" r="8" ${S}/><circle cx="12" cy="12" r="3.5" ${F}/>`,
    trophy: `<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" ${F}/><path d="M7 5.5H3.5v1.5A3.5 3.5 0 0 0 7 10.5M17 5.5h3.5v1.5a3.5 3.5 0 0 1-3.5 3.5" ${S} stroke-width="2"/><path d="M12 13.5v3.5M8 20.5h8M9.5 17h5v3.5h-5z" ${S} stroke-width="2"/>`,
    swords: `<path d="M3.5 3.5 14 14M20.5 3.5 10 14" ${S} stroke-width="2.6"/><path d="M3.5 3.5h3.5M3.5 3.5V7M20.5 3.5H17M20.5 3.5V7" ${S} stroke-width="2.2"/><path d="m12.5 16.5 4 4M11.5 16.5l-4 4M15 13l-2.5 3.5M9 13l2.5 3.5" ${S} stroke-width="2.4"/>`,
    clock: `<circle cx="12" cy="12" r="8.6" ${S} stroke-width="2.2"/><path d="M12 7v5l3.5 2.2" ${S} stroke-width="2.4"/>`,
    scroll: `<path d="M6 3.5h11.5a2.5 2.5 0 0 1 2.5 2.5v1H17v11.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V17H6z" ${F}/><path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h4" stroke="rgba(0,0,0,.35)" stroke-width="1.7" stroke-linecap="round"/>`,
    token: `<circle cx="12" cy="12" r="9" ${F}/><circle cx="12" cy="12" r="6.2" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.5"/><path d="m12 7.6 1.3 2.8 3 .4-2.2 2.1.6 3L12 14.4l-2.7 1.5.6-3-2.2-2.1 3-.4z" fill="rgba(0,0,0,.32)"/>`,
    search: `<circle cx="10.5" cy="10.5" r="6.5" ${S} stroke-width="2.6"/><path d="m15.5 15.5 5 5" ${S} stroke-width="2.8"/>`,
    ranks: `<path d="M3.5 20.5V14h5v6.5zM9.5 20.5V8h5v12.5zM15.5 20.5v-9h5v9z" ${F}/><path d="m12 2.2.9 1.9 2 .3-1.5 1.4.4 2L12 6.9l-1.8.9.4-2-1.5-1.4 2-.3z" ${F}/>`,
    snowman: `<circle cx="12" cy="16.5" r="5.2" ${F}/><circle cx="12" cy="8.6" r="3.6" ${F}/><path d="M8.3 4.6h7.4M9.6 4.6V1.8h4.8v2.8" ${S} stroke-width="2"/>`,
    shop: `<path d="M4.2 3.5h15.6l1.7 5.6a2.55 2.55 0 0 1-4.85.95 2.55 2.55 0 0 1-4.65 0 2.55 2.55 0 0 1-4.65 0A2.55 2.55 0 0 1 2.5 9.1z" ${F}/><path d="M9.1 3.8l-.7 6.6M14.9 3.8l.7 6.6" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><path d="M4.6 12.4v8.1h14.8v-8.1" ${S}/><rect x="9.6" y="14.6" width="4.8" height="5.9" rx=".7" ${F}/>`,
    gift: `<rect x="3.5" y="9" width="17" height="11.5" rx="1.5" ${F}/><rect x="2.5" y="6.5" width="19" height="4" rx="1" ${F}/><path d="M12 6.5v14" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M12 6.5C10 3 6.5 3 7 5.2c.3 1.3 2.6 1.3 5 1.3 2.4 0 4.7 0 5-1.3.5-2.2-3-2.2-5 1.3z" ${S} stroke-width="1.8"/>`,
    bot: `<rect x="4" y="7.5" width="16" height="12" rx="3.5" ${F}/><path d="M12 7.5V4M12 3.5h.01" ${S} stroke-width="2.4"/><circle cx="9" cy="13" r="1.7" fill="rgba(0,0,0,.45)"/><circle cx="15" cy="13" r="1.7" fill="rgba(0,0,0,.45)"/><path d="M2 12.5v3M22 12.5v3" ${S} stroke-width="2.2"/>`,
    user: `<circle cx="12" cy="8" r="4.3" ${F}/><path d="M3.5 21c.8-4.6 4.2-7 8.5-7s7.7 2.4 8.5 7z" ${F}/>`,
    flame: ICON_PATHS.fire,
    bitburst: `<rect x="12" y="8" width="8" height="8" ${F}/><rect x="6" y="9" width="4" height="4" ${F} opacity=".7"/><rect x="2" y="13" width="3" height="3" ${F} opacity=".45"/><rect x="7" y="15" width="3" height="3" ${F} opacity=".55"/><path d="M14 10h4v4h-4z" fill="rgba(0,0,0,.3)"/>`,
    cutpaste: `<rect x="3" y="3" width="13" height="13" ${S} stroke-width="2" stroke-dasharray="3 2.4"/><path d="M11 11h10v10H11z" ${F}/><path d="M14 14h4M14 17h3" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linecap="round"/>`,
    fatal: `<rect x="2.5" y="4" width="19" height="16" rx="2" ${F}/><path d="M2.5 8.5h19" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/><circle cx="18.5" cy="6.3" r="1.1" fill="rgba(0,0,0,.45)"/><path d="M12 11v4.2M12 17.4v.2" stroke="rgba(0,0,0,.55)" stroke-width="2.2" stroke-linecap="round"/>`,
    // moves
    breath: `<path d="M3 12c3-1 4.5-3 5-5.5 1 2 1 3.5.5 5 2-1 3.5-3.5 3.5-6 3 2.5 4 6 3 9 1-.5 2-1.6 2.5-3 1.4 2.5 1.6 5.2.5 7.5A8 8 0 0 1 3 12z" ${F}/>`,
    dive: `<path d="M12 2.5v12M7 10l5 5 5-5" ${S} stroke-width="3"/><path d="M3 21h18" ${S} stroke-width="2.6"/><path d="M5 18.5l2-2.5M19 18.5 17 16" ${S} stroke-width="2"/>`,
    dragon: `<path d="M2.5 16c3 0 4-3 6.5-3s3 3 5.5 3 3-2.5 5-3l2 1.5-2 1c-1.5 3-3.5 4.5-6 4.5-3 0-4-2.5-6-2.5-1.8 0-3 .8-5 .5z" ${F}/><path d="M17 12.5c.5-2.5 2.5-4 4.5-4.2M15 12.5c-.5-3 .5-5.5 3-7" ${S} stroke-width="1.8"/>`,
    pillars: `<path d="M4 21V12c0-2 1.5-3 1.5-5 1.5 1.5 2 3 2 4.5V21zM10 21V8c0-2.5 2-4 2-6.5 2 2 2.5 4 2.5 6V21zM16.5 21v-7c0-1.6 1.2-2.4 1.2-4 1.3 1.2 1.8 2.4 1.8 3.6V21z" ${F}/>`,
    orbit: `<circle cx="12" cy="12" r="3" ${F}/><ellipse cx="12" cy="12" rx="9.5" ry="5" ${S} stroke-width="1.8" opacity=".7"/><path d="m20 9.2.8 1.8 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2zM5 12.5l.6 1.3 1.4.2-1 .9.3 1.4L5 15.6l-1.3.7.3-1.4-1-.9 1.4-.2z" ${F}/>`,
    magnet: `<path d="M5 3.5h4.5v8a2.5 2.5 0 0 0 5 0v-8H19v8a7 7 0 0 1-14 0z" ${F}/><path d="M5 7h4.5M14.5 7H19" stroke="rgba(0,0,0,.35)" stroke-width="2.2"/>`,
    swarm: `<g ${F}><ellipse cx="7" cy="8" rx="3" ry="2"/><ellipse cx="16" cy="6" rx="2.6" ry="1.8"/><ellipse cx="17" cy="15" rx="3" ry="2"/><ellipse cx="8" cy="17" rx="2.6" ry="1.8"/></g><g fill="currentColor" opacity=".5"><ellipse cx="6" cy="5.8" rx="2" ry="1.1"/><ellipse cx="15.2" cy="4" rx="1.8" ry="1"/><ellipse cx="16" cy="12.8" rx="2" ry="1.1"/><ellipse cx="7.2" cy="15" rx="1.8" ry="1"/></g>`,
    halo: `<ellipse cx="12" cy="12" rx="9.5" ry="4.5" ${S} stroke-width="3"/><path d="M19 7.5 21.5 5M5 16.5 2.5 19" ${S} stroke-width="2"/>`,
    crystal: `<path d="M13 2 19 8l-7 14L5 8z" ${F}/><path d="M5 8h14M13 2l-2.5 6L12 22" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1.3"/>`,
    prism: `<path d="M9 22V6l3-4 3 4v16z" ${F}/><path d="M3 9h4M3 13h4M17 9l4-2M17 13l4 2" ${S} stroke-width="2"/>`,
    mine: `<path d="M3 20h18" ${S}/><path d="M5 20 7 14l4-4 4 3 3-2 1 9z" ${F}/><path d="M7 14l4 2 4-3" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.3"/><circle cx="17.5" cy="5" r="1.6" ${F}/><path d="M17.5 1.5v1M21 5h-1M14 5h1M19.9 2.6l-.7.7M15.1 2.6l.7.7" ${S} stroke-width="1.5"/>`,
    hook: `<path d="M6 3v10a5 5 0 0 0 10 0v-2" ${S} stroke-width="3"/><path d="m12.5 12 3.5-3.5 3.5 3.5" ${S} stroke-width="3"/><circle cx="6" cy="3" r="2" ${F}/>`,
    antigrav: `<path d="M3 20h18" ${S}/><path d="M12 17V5M8 9l4-4 4 4" ${S} stroke-width="2.6"/><circle cx="6" cy="13" r="1.8" ${F}/><circle cx="18" cy="11" r="1.6" ${F}/>`,
    crush: `<path d="M2 18h20v4H2z" ${F}/><path d="M12 2v11M7.5 9 12 13.5 16.5 9M5 4v5M19 4v5" ${S} stroke-width="2.6"/>`,
    sonic: `<path d="M5 8a6 6 0 0 1 0 8M10 5a10 10 0 0 1 0 14M15 2.5a14 14 0 0 1 0 19" ${S} stroke-width="2.6"/>`,
    resonance: `<circle cx="12" cy="12" r="3" ${F}/><circle cx="12" cy="12" r="6.5" ${S} stroke-width="2"/><circle cx="12" cy="12" r="10" ${S} stroke-width="1.6" stroke-dasharray="3 3"/>`,
    rewind: `<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" ${S} stroke-width="2.6"/><path d="M12 8v4.5l3 2" ${S} stroke-width="2.4"/>`,
    bubble: `<circle cx="12" cy="12" r="9.3" ${F} opacity=".38"/><circle cx="12" cy="12" r="9.3" ${S} stroke-width="2.4"/><path d="M7 10.4a5.4 5.4 0 0 1 3.6-3.8" ${S} stroke-width="2.8"/>`,
    updraft: `<path d="M12 21.5V9" ${S} stroke-width="3.2"/><path d="M5.5 12 12 4.5l6.5 7.5z" ${F}/><path d="M3 18c2-1.2 3.5-1.2 5 0M16 18c2-1.2 3.5-1.2 5 0" ${S} stroke-width="2.4"/>`,
    palm: `<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.7 7-6.5 7-2.4 0-4-1.2-5.3-3.4L3.4 13a1.6 1.6 0 0 1 2.7-1.6z" ${F}/><path d="M19 9h3M19.5 5.5 22 4M19.5 12.5 22 14" ${S} stroke-width="1.6"/>`,
    tornado: `<path d="M2.5 3.5h19l-2.4 3.6H4.9zM5.8 8.7h13.6l-2.5 3.4H8.3zM8.4 13.7h8.8l-2 3.2h-4.8zM10.4 18.5h4.6l-2 3.3z" ${F}/>`,
    cyclone: `<path d="M12.5 12.4c-.6-1.3 1.1-2.4 2.3-1.4 1.6 1.4.4 4.3-2 4.4-3.3.2-4.8-3.9-2.6-6.4 2.7-3.1 8.3-2 9.3 2.4M4 9.5c.2-3 2.3-5.3 5-6" ${S} stroke-width="2.8"/><path d="M3 15.5c1.5 3.4 5 5.6 9 5.4" ${S} stroke-width="2.8"/>`,
    fireball: `<circle cx="14" cy="10" r="5.5" ${F}/><path d="M9.5 13.5 3 20M10.5 16 6 21.5M8 11 2.5 15" ${S} stroke-width="2"/>`,
    dash: `<path d="M10.5 4 21 12l-10.5 8v-4.6H7V8.6h3.5z" ${F}/><path d="M2.5 8.6h2.2M2.5 15.4h2.2M1.8 12h3" ${S} stroke-width="2.4"/>`,
    burst: `<path d="m12 2 2.2 6 6.3-1.8-4.1 5 4.6 4.6-6.4-.6L12 22l-2.6-6.8-6.4.6 4.6-4.6-4.1-5L9.8 8z" ${F}/>`,
    whip: `<path d="M3 20.5c3-1 5-3.2 6-6.2s3-7 8.2-8.2" ${S} stroke-width="3.2"/><path d="M19.5 1.8c-1.6 2.2-2.6 3.6-2.6 5a2.6 2.6 0 0 0 5.2 0c0-1.4-1-2.8-2.6-5z" ${F}/>`,
    wave: `<path d="M2 21.5V17c3 0 4.5-2 5.6-5C9.2 7.6 11.8 4 16.5 4 19.8 4 22 6.2 22 9c0 2.6-2 4.4-4.3 4.4-2 0-3.4-1.4-3.4-3.2 0-1.2.7-2.2 1.8-2.6-3 .1-4.5 3-5.4 6C9.6 17.4 8.4 19.8 6.6 21.5z" ${F}/>`,
    shield: `<path d="M12 2.5 4 5.5v6.2c0 4.8 3.4 8.6 8 9.8 4.6-1.2 8-5 8-9.8V5.5z" ${F}/><path d="M12 5.4v13.4" stroke="rgba(0,0,0,.28)" stroke-width="2.2"/>`,
    fist: `<rect x="3.5" y="4.5" width="17" height="12.5" rx="3.5" ${F}/><path d="M8 4.5v5.5M12 4.5v5.5M16 4.5v5.5M3.5 12.5h6.5" stroke="rgba(0,0,0,.35)" stroke-width="1.8" fill="none"/><path d="M7 16.5v5h10v-5" ${F}/>`,
    boulder: `<path d="M6 7.5 11 4l6 1.5 3.5 5-1 6.5L14 21l-6.5-1L3.5 15l.5-5z" ${F}/><path d="M9 10l3 2 4-1M12 12l-1 5" stroke="rgba(0,0,0,.3)" stroke-width="1.5" fill="none"/>`,
    quake: `<path d="M2 15.5h20V21H2z" ${F}/><path d="M12.5 15.5 10.5 18l2.4 1-1.6 2" stroke="rgba(0,0,0,.45)" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M12 2.5v8.5M7.8 7.6 12 11.8l4.2-4.2" ${S} stroke-width="3"/>`,
    shards: `<path d="M2 16 17.5 7.8l-2.3 4.8zM3 21.6l17-5.3-3.3 3.8zM4 10.4 18.2 2l-2 4.3z" ${F}/>`,
    snow: ICON_PATHS.frost,
    lance: `<path d="M3 21 14.5 9.5" ${S} stroke-width="3.6"/><path d="M11.8 7.2 21.8 2.2l-5 10z" ${F}/>`,
    bolt: ICON_PATHS.lightning,
    blink: `<circle cx="6.3" cy="17.7" r="3.3" ${F} opacity=".45"/><circle cx="17.5" cy="6.5" r="4" ${F}/><path d="M9 15 13.8 10.2" ${S} stroke-width="2.8" stroke-dasharray="2.2 2.8"/>`,
    storm: `<path d="M6.5 12a4.5 4.5 0 0 1 .7-8.9A6 6 0 0 1 18 5a3.5 3.5 0 0 1 0 7z" ${F}/><path d="M10 13.5 8 18h3l-1.5 4.5M16 13.5 14.5 17h2.5L16 20" ${S} stroke-width="2"/>`,
    vine: `<path d="M4 21.5c0-6 4-8 8-9s7-4 7-9.5" ${S} stroke-width="3"/><path d="M8.6 15.4c-3 .2-5-1.4-5.4-4 3-.2 5 1.4 5.4 4zM15.2 8.6c-.3-3 1.2-5 3.8-5.6.3 3-1.2 5-3.8 5.6z" ${F}/>`,
    snare: `<path d="M3 20h18" ${S}/><path d="M5 20l1.5-7L8 20M10 20l2-10 2 10M16 20l1.5-7 1.5 7" ${F}/><circle cx="12" cy="6" r="2.5" ${F}/>`,
    heal: `<path d="M12 21c-5-3-8-6.5-8-10.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 8 2.5c0 4-3 7.5-8 10.5z" ${F}/><path d="M12 11v6M9 14h6" stroke="rgba(0,0,0,.35)" stroke-width="2.2" stroke-linecap="round"/>`,
    orb: `<circle cx="12" cy="12" r="6" ${F}/><path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5M12 21.5A9.5 9.5 0 0 1 2.5 12" ${S} stroke-width="2.6"/>`,
    rift: `<path d="M12.2 12.4c-.7-1.2.6-2.6 2-1.8 1.8 1-.1 4.4-2.8 4-3.4-.5-3.7-5.3-.8-7 3.7-2.2 8.6.4 8.4 4.8-.3 5.5-6.6 8.4-11.3 5.6" ${S} stroke-width="3"/>`,
    blade: `<path d="M21.5 2.5 22 4 11.6 16.4 7.6 12.4 20 2z" ${F}/><path d="M5.6 11.6l6.8 6.8" ${S} stroke-width="3"/><path d="M8.4 16.4 3 21.8" ${S} stroke-width="3.6"/>`,
    sunblade: `<path d="M21.5 2.5 22 4 11.6 16.4 7.6 12.4 20 2z" ${F}/><path d="M5.6 11.6l6.8 6.8" ${S} stroke-width="3"/><path d="M8.4 16.4 3 21.8" ${S} stroke-width="3.6"/><circle cx="6" cy="6" r="2.1" ${F}/><path d="M6 1.4v1.2M6 9.4v1.2M1.4 6h1.2M9.4 6h1.2M2.8 2.8l.8.8M8.4 8.4l.8.8M2.8 9.2l.8-.8M8.4 3.6l.8-.8" ${S} stroke-width="1.5"/>`,
    shadowstep: `<path d="M15 3a8.5 8.5 0 1 0 6.5 14A7 7 0 0 1 15 3z" ${F}/><path d="M1.8 8.5h5M1 12.5h5.5M2.2 16.5h4" ${S} stroke-width="2.4"/>`,
    grit: `<circle cx="6" cy="16" r="2.2" ${F}/><circle cx="11" cy="11" r="2.6" ${F}/><circle cx="17" cy="7" r="3" ${F}/><circle cx="12.5" cy="18" r="1.5" ${F}/><circle cx="19" cy="14" r="1.6" ${F}/><path d="M2 21 7.5 15.5" ${S} stroke-width="2"/>`,
    dune: `<path d="M1.5 20c3-6 6.5-9 10.5-9s7 3 10.5 9z" ${F}/><path d="M6 8.5c2-2 4-2 6 0M13 5.5c1.5-1.5 3-1.5 4.5 0" ${S} stroke-width="2"/>`,
    sandstorm: `<path d="M3 6h13M5 10.5h15M2.5 15h12M6 19.5h11" ${S} stroke-width="2.6"/><circle cx="19.5" cy="6" r="1.5" ${F}/><circle cx="18" cy="15" r="1.3" ${F}/>`,
    magmafist: `<rect x="3.5" y="6.5" width="16" height="11.5" rx="3.5" ${F}/><path d="M8 6.5v5M12 6.5v5M16 6.5v5" stroke="rgba(0,0,0,.35)" stroke-width="1.8"/><path d="M8 18.5l1.5 3M12.5 18.5v3.5M16.5 18.5l-1 3" ${S} stroke-width="2"/><path d="M11 1.5c.5 1.3-.6 2-.6 3a1.2 1.2 0 0 0 2.4 0c0-1-1-1.6-1.8-3z" ${F}/>`,
    vents: `<path d="M2 21h20" ${S}/><path d="M4 21c0-4 2-6 2-10 1.5 2 2 4 2 6v4zM10 21c0-6 2-9 2-14 2 3 2.5 6 2.5 9v5zM17 21c0-3 1.5-5 1.5-8 1.3 1.5 2 3 2 5v3z" ${F}/>`,
    eruption: `<path d="M3 21 8 12h8l5 9z" ${F}/><path d="M12 10V2M7.5 8 5 3.5M16.5 8 19 3.5" ${S} stroke-width="2.4"/><circle cx="12" cy="13.5" r="1.8" fill="rgba(0,0,0,.3)"/>`,
    jab: `<path d="M3 12h7" ${S} stroke-width="2.2"/><path d="M2 8h5M2 16h5" ${S} stroke-width="1.6" opacity=".6"/><rect x="10" y="7" width="10" height="10" rx="3" ${F}/><path d="M13.5 7v4M17 7v4" stroke="rgba(0,0,0,.3)" stroke-width="1.6"/>`,
    smokebomb: `<circle cx="10" cy="14" r="7" ${F}/><path d="M14.5 8.5 17 6" ${S} stroke-width="2.4"/><path d="M18 3.5c1 .5 1.5 1.5 1 2.5M20.5 6c-.5 1-1.5 1.5-2.5 1" ${S} stroke-width="1.6"/><circle cx="7.5" cy="12" r="1.6" fill="rgba(255,255,255,.45)"/>`,
    vanish: `<circle cx="15" cy="5.5" r="2.5" ${F}/><path d="M15 8.5v6l3 6M15 11l3.5 2M15 14.5l-3.5 5" ${S} stroke-width="2.4"/><path d="M2 9h6M3 13h5M2 17h6" ${S} stroke-width="2" stroke-dasharray="2 2"/>`,
    wisp: `<path d="M14 3a6 6 0 0 1 0 12c-3 0-5 2-7 5-1-4 0-8 2.5-11A6 6 0 0 1 14 3z" ${F}/><circle cx="13" cy="8.5" r="1.3" fill="rgba(0,0,0,.35)"/><circle cx="16" cy="8.5" r="1.3" fill="rgba(0,0,0,.35)"/>`,
    phase: `<path d="M5 3h7v18H5z" ${F} opacity=".4"/><path d="M12 3h7v18h-7z" ${F}/><path d="M2.5 12h9M8.5 8.5l3.5 3.5-3.5 3.5" ${S} stroke-width="2.4"/>`,
    spiritbloom: `<path d="M12 3c2.6 2.6 3.4 6 2.6 9.6L12 15.5l-2.6-2.9C8.6 9 9.4 5.6 12 3z" ${F}/><path d="M3 9.5c3.6 0 6.5 2 8 5.7l-.4 3.3C6.3 18 3.4 14.6 3 9.5zM21 9.5c-3.6 0-6.5 2-8 5.7l.4 3.3c4.3-.5 7.2-3.9 7.6-9z" ${F} opacity=".8"/><path d="M5 21h14" ${S} stroke-width="2"/>`,
    lash: `<path d="M3 21c3-1 4.5-4 5-7.5S10 6 16 4" ${S} stroke-width="3"/><path d="M18 2.5c-1.5 2-2.3 3.3-2.3 4.4a2.3 2.3 0 0 0 4.6 0c0-1.1-.8-2.4-2.3-4.4z" ${F}/><path d="M7 12l-2.5-1M9.5 8 7.5 6.5" ${S} stroke-width="1.6"/>`,
    thorns: `<path d="M2.5 20 14 8.5" ${S} stroke-width="2.4"/><path d="M14 8.5l2-6 1.5 4.5 4.5 1.5-6 2z" ${F}/><path d="M6 13.5 4 12M9 10.5 8 8.5M8.5 16l-.5 2.5" ${S} stroke-width="1.6"/>`,
    bloodnova: `<path d="M12 4c-2.3 3.2-4 5.5-4 7.6a4 4 0 0 0 8 0c0-2.1-1.7-4.4-4-7.6z" ${F}/><path d="M3 12h2.5M18.5 12H21M5.5 5.5l1.8 1.8M18.5 5.5l-1.8 1.8M5.5 18.5l1.8-1.8M18.5 18.5l-1.8-1.8" ${S} stroke-width="2"/>`,
    plasmashot: `<circle cx="16" cy="12" r="4.5" ${F}/><path d="M11.5 12H2M11.8 9.5 5 7M11.8 14.5 5 17" ${S} stroke-width="2"/><circle cx="16" cy="12" r="1.8" fill="rgba(255,255,255,.6)"/>`,
    arcdash: `<path d="M10.5 4 21 12l-10.5 8v-4.6H7V8.6h3.5z" ${F}/><path d="M2 6.5l2.5 2-2 2 2.5 2-2 2 2.5 2" ${S} stroke-width="1.8"/>`,
    plasmarain: `<path d="M3 5h18" ${S} stroke-width="2.6"/><path d="M6 8v8M12 8v12M18 8v6" ${S} stroke-width="2.8"/><circle cx="6" cy="18" r="2" ${F}/><circle cx="18" cy="16.5" r="2" ${F}/>`,
    crescent: `<path d="M20 4C11 4 4 9 3 20c3-6 8.5-10 17-11z" ${F}/><path d="M17.5 5.5 21 2" ${S} stroke-width="2"/>`,
    moondisc: `<circle cx="12" cy="12" r="8.5" ${S} stroke-width="2.6"/><path d="M14 6.5a5.5 5.5 0 1 0 3.5 9.8A4.6 4.6 0 0 1 14 6.5z" ${F}/>`,
    moonbeams: `<path d="M16 2.5a4.5 4.5 0 1 0 3.5 7.2 3.7 3.7 0 0 1-3.5-7.2z" ${F}/><path d="M5 9v12M10 12v9M15 14v7" ${S} stroke-width="2.6"/>`,
    glass: `<path d="M3 20 9 4l3 9z" ${F}/><path d="M13 21l4-12 4 7z" ${F} opacity=".7"/><path d="M9 4 7 11" stroke="rgba(255,255,255,.6)" stroke-width="1.3"/>`,
    mirrorstep: `<rect x="9" y="2.5" width="6" height="19" rx="1.5" ${F}/><circle cx="5" cy="8" r="2" ${F} opacity=".5"/><circle cx="19" cy="8" r="2" ${F}/><path d="M5 11v6M19 11v6" ${S} stroke-width="2.4"/>`,
    mirrorshell: `<path d="M12 2.5 20 7v6.5c0 4.2-3.3 7.3-8 8.5-4.7-1.2-8-4.3-8-8.5V7z" ${F}/><path d="M8 9.5 13 7M8 13.5l8-4.5M10 17l5-3" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round"/>`,
    feathers: `<path d="M20 3C12 4 7 9 5 17l2 1C9 12 13 7.5 20 3z" ${F}/><path d="M16 9c-4 1.5-6.5 4.5-8 9.5" ${S} stroke-width="1.4" opacity=".5"/><path d="M3 21l3-3" ${S} stroke-width="2.4"/>`,
    rebirth: `<path d="M12 21.5c-4-1.5-7-4.5-7-8.5 0-3 2-5 2-8 2 1.5 3 3 3 5 .7-2.5 2-4 2-7.5 2.5 2 5 5.5 5 10.5 0 4-2.5 7-5 8.5z" ${F}/><path d="M9 15a3 3 0 0 0 6 0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.8"/>`,
    firebird: `<path d="M12 22 9 15 2 13l5-2-3-6 6 3 2-6 2 6 6-3-3 6 5 2-7 2z" ${F}/>`,
    starlance: `<path d="M3 21 15 9" ${S} stroke-width="3"/><path d="m18 2 1.2 3.3L22.5 6.5l-3.3 1.2L18 11l-1.2-3.3L13.5 6.5l3.3-1.2z" ${F}/>`,
    blackstar: `<circle cx="12" cy="12" r="4.5" ${F}/><circle cx="12" cy="12" r="8" ${S} stroke-width="1.8" stroke-dasharray="3 2.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" ${S} stroke-width="2"/>`,
    supernova: `<circle cx="12" cy="12" r="3.6" ${F}/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5M4.5 4.5l3.5 3.5M16 16l3.5 3.5M4.5 19.5 8 16M16 8l3.5-3.5" ${S} stroke-width="2.2"/>`,
    soundwave: `<circle cx="5" cy="12" r="2.6" ${F}/><path d="M9.5 7.5a6.5 6.5 0 0 1 0 9M13.5 4.5a11 11 0 0 1 0 15M17.5 2a15 15 0 0 1 0 20" ${S} stroke-width="2.2"/>`,
    piano: `<path d="M2.5 9h12c3.5 0 6.5 1.5 7 5H2.5z" ${F}/><path d="M3.5 9 14 4.5l.8 1.2L5.5 9z" ${F}/><rect x="2.5" y="14" width="19" height="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 14v2.6M8 14v2.6M11 14v2.6M14 14v2.6M17 14v2.6" stroke="currentColor" stroke-width="1"/><path d="M4.5 17v4M19 17v4" ${S} stroke-width="2"/>`,
    rhythm: `<path d="M3.5 3v18M9.5 3v18M15.5 3v18M21.5 3" ${S} stroke-width="1.4" opacity=".55"/><rect x="4.5" y="5" width="4" height="2.6" rx="1" ${F}/><rect x="10.5" y="10" width="4" height="2.6" rx="1" ${F}/><rect x="16.5" y="7" width="4" height="2.6" rx="1" ${F}/><rect x="4.5" y="14" width="4" height="2.6" rx="1" ${F}/><path d="M2 19h20" ${S} stroke-width="2.4"/>`,
    slimeball: `<path d="M12 4c4.5 0 8 3.5 8 8 0 4-3 7.5-8 7.5S4 16 4 12c0-4.5 3.5-8 8-8z" ${F}/><circle cx="20" cy="5" r="2" ${F}/><circle cx="4" cy="4.5" r="1.5" ${F}/><path d="M8.5 9a4 4 0 0 1 3-2" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6" stroke-linecap="round"/>`,
    bouncepad: `<path d="M3 20h18" ${S}/><path d="M4 19c0-3 3.5-5 8-5s8 2 8 5z" ${F}/><path d="M12 11V3M8.5 6.5 12 3l3.5 3.5" ${S} stroke-width="2.4"/>`,
    engulf: `<circle cx="12" cy="12" r="9" ${F} opacity=".35"/><circle cx="12" cy="12" r="9" ${S} stroke-width="2"/><circle cx="12" cy="9.5" r="2" ${F}/><path d="M12 11.5v4M9.5 13.5h5M12 15.5l-2 2.5M12 15.5l2 2.5" ${S} stroke-width="1.6"/>`,
    claw: `<path d="M5 3c3 4 4 9 3 16M10.5 2.5c2.5 5 3 10 1.5 17M16 3c2 5 2 10 0 16" ${S} stroke-width="2.6"/>`,
    grasp: `<path d="M2 21h20" ${S}/><path d="M6.5 21V12l-1.5-4M9.5 21V10l-.5-5.5M12.5 21V10.5l1-5.5M15.5 21v-8l2.5-3.5" ${S} stroke-width="2.4"/>`,
    nightmare: `<path d="M12 2.5a8 8 0 0 0-8 8c0 3 1.5 5 3 6.2V21l2.5-1.5L12 21l2.5-1.5L17 21v-4.3c1.5-1.2 3-3.2 3-6.2a8 8 0 0 0-8-8z" ${F}/><path d="M8 10.5l2.5 1.5L8 13.5M16 10.5 13.5 12l2.5 1.5" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6" stroke-linejoin="round"/>`,
    goldfist: `<rect x="3.5" y="6" width="16" height="11.5" rx="3.5" ${F}/><path d="M8 6v5M12 6v5M16 6v5" stroke="rgba(0,0,0,.35)" stroke-width="1.8"/><path d="m20 2 .7 1.6 1.6.7-1.6.7L20 6.6l-.7-1.6-1.6-.7 1.6-.7z" ${F}/><path d="M7 17.5v4h9v-4" ${F}/>`,
    goldtouch: `<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.7 7-6.5 7-2.4 0-4-1.2-5.3-3.4L3.4 13a1.6 1.6 0 0 1 2.7-1.6z" ${F}/><path d="m20 15 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" ${F}/>`,
    coins: `<circle cx="14.6" cy="9.4" r="6.6" ${F} opacity=".5"/><circle cx="14.6" cy="9.4" r="6.6" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/><circle cx="9.6" cy="14.4" r="7.4" ${F}/><circle cx="9.6" cy="14.4" r="5.2" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><path d="m9.6 11 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="rgba(0,0,0,.32)"/><path d="M4.6 12.4a5.4 5.4 0 0 1 3.2-3.1" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.5" stroke-linecap="round"/>`,
    clockhand: `<circle cx="12" cy="12" r="9" ${S} stroke-width="2"/><path d="M12 12 7.5 7.5" ${S} stroke-width="2.8"/><path d="M12 12h5.5" ${S} stroke-width="2"/><circle cx="12" cy="12" r="1.8" ${F}/>`,
    haste: `<circle cx="14" cy="13" r="7.5" ${S} stroke-width="2"/><path d="M14 9v4l2.5 2" ${S} stroke-width="2"/><path d="M2 8h4M1.5 12h4M2 16h4" ${S} stroke-width="2"/><path d="M12 2.5h4" ${S} stroke-width="2.4"/>`,
    timestop: `<circle cx="12" cy="12" r="9.3" ${S} stroke-width="2.2"/><rect x="8" y="7.5" width="3" height="9" rx="1" ${F}/><rect x="13" y="7.5" width="3" height="9" rx="1" ${F}/>`,
    stretch: `<path d="M3 13c3 0 4-3 7-3s4 4 7 4" ${S} stroke-width="3"/><circle cx="19" cy="14" r="3.4" ${F}/><path d="M3 9.5v7" ${S} stroke-width="2.4"/>`,
    slingshot: `<path d="M6 21v-8L3 4.5M6 13l3-8.5" ${S} stroke-width="2.6"/><path d="M3 4.5c4 4 8 5 12 4" ${S} stroke-width="1.6"/><circle cx="17.5" cy="7.5" r="3.2" ${F}/><path d="M14 13.5l6 6M17 17.5l3-1" ${S} stroke-width="2"/>`,
    bounceback: `<circle cx="12" cy="13" r="5" ${F}/><path d="M4 21h16" ${S}/><path d="M3 9.5a9 9 0 0 1 4-5M21 9.5a9 9 0 0 0-4-5" ${S} stroke-width="2"/><path d="M5.5 2.5 7 4.5 4.8 5.5M18.5 2.5 17 4.5l2.2 1" ${S} stroke-width="1.6"/>`,
    cards: `<rect x="4" y="4" width="10" height="14" rx="2" ${F} opacity=".5" transform="rotate(-14 9 11)"/><rect x="9" y="6" width="10" height="14" rx="2" ${F}/><path d="M14 10.5c-.8-1.3-2.6-.7-2.6.7s2.6 3.1 2.6 3.1 2.6-1.7 2.6-3.1-1.8-2-2.6-.7z" fill="rgba(0,0,0,.4)"/>`,
    dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="4" ${F}/><circle cx="8" cy="8" r="1.6" fill="rgba(0,0,0,.45)"/><circle cx="12" cy="12" r="1.6" fill="rgba(0,0,0,.45)"/><circle cx="16" cy="16" r="1.6" fill="rgba(0,0,0,.45)"/><circle cx="16" cy="8" r="1.6" fill="rgba(0,0,0,.45)"/><circle cx="8" cy="16" r="1.6" fill="rgba(0,0,0,.45)"/>`,
    slots: `<rect x="2.5" y="5" width="16" height="14" rx="2.5" ${F}/><rect x="4.5" y="8" width="3.6" height="8" rx="1" fill="rgba(255,255,255,.75)"/><rect x="8.9" y="8" width="3.6" height="8" rx="1" fill="rgba(255,255,255,.75)"/><rect x="13.3" y="8" width="3.6" height="8" rx="1" fill="rgba(255,255,255,.75)"/><path d="M20.5 7v6" ${S} stroke-width="2"/><circle cx="20.5" cy="6" r="1.8" ${F}/>`,
    needles: `<path d="M3 20 17 6M7 21 21 7" ${S} stroke-width="2.2"/><path d="M17 6l2.5-2.5M21 7l1-1" ${S} stroke-width="1.4"/><path d="M3 20c-1-2 1-4 3-3" ${S} stroke-width="1.3"/>`,
    strings: `<path d="M3 3h18" ${S} stroke-width="2.4"/><path d="M6 3v7M12 3v4M18 3v7" ${S} stroke-width="1.2"/><circle cx="12" cy="9" r="2.2" ${F}/><path d="M12 11.2v5M12 13l-6-3M12 13l6-3M12 16.2l-3 5M12 16.2l3 5" ${S} stroke-width="2"/>`,
    tether: `<circle cx="5" cy="6" r="2.5" ${F}/><circle cx="19" cy="18" r="2.5" ${F}/><path d="M6.5 8c2 6 9 3 11 8" ${S} stroke-width="2" stroke-dasharray="3 2.5"/><path d="M2 21l4-4M6 21H2v-4" ${S} stroke-width="1.8"/>`,
    nailgun: `<path d="M3 8h13l2 2v3H9l-1 7H4l1-7H3z" ${F}/><path d="M18 11.5h4M19 8.5l2.5-1.5M19 14.5l2.5 1.5" ${S} stroke-width="1.8"/>`,
    grapple: `<path d="M3 21 15 9" ${S} stroke-width="2" stroke-dasharray="3 2.5"/><path d="M15 9l2-6M15 9l6-2M15 9l5 3.5M15 9l1.5 5.5" ${S} stroke-width="2.4"/>`,
    jetpack: `<rect x="6" y="3" width="5" height="12" rx="2" ${F}/><rect x="13" y="3" width="5" height="12" rx="2" ${F}/><path d="M8.5 15c-1 2.5 0 4.5 0 6.5M15.5 15c-1 2.5 0 4.5 0 6.5" ${S} stroke-width="2"/><path d="M11 7h2" ${S}/>`,
    beam: `<circle cx="5.5" cy="12" r="3.6" ${F}/><path d="M9 8.5h13v7H9z" ${F} opacity=".55"/><path d="M9 12h13" ${S} stroke-width="3"/>`,
    sun: ICON_PATHS.light,
    saw: `<path d="M12 2l2 3 3.5-1 .5 3.6 3.4 1.3-1.8 3.1 1.8 3.1-3.4 1.3-.5 3.6-3.5-1-2 3-2-3-3.5 1-.5-3.6L2.6 15l1.8-3.1L2.6 8.9 6 7.6l.5-3.6L10 5z" ${F}/><circle cx="12" cy="12" r="3" fill="rgba(0,0,0,.35)"/>`,
    spit: `<path d="M5 19c3-1 5-4 6-8" ${S}/><path d="M15 4c-2 3-3.5 5-3.5 7a3.5 3.5 0 0 0 7 0c0-2-1.5-4-3.5-7z" ${F}/>`,
    cloud: `<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.75 4.75 0 0 1 17.5 18z" ${F}/><circle cx="10" cy="14" r="1.3" fill="rgba(0,0,0,.35)"/><circle cx="14" cy="13" r="1" fill="rgba(0,0,0,.35)"/>`,
    meteor: `<circle cx="15" cy="15" r="5" ${F}/><path d="M11 11 4 4M13 9.5 8 3M9.5 13 3 8" ${S}/>`,

    /* ---- one glyph per move: every skill button has its own, drawn to match the move ---- */
    // a fist punching up, ki flaring off the knuckles
    kiupper: `<path d="M12.5 1.5c1.9 2.2 3.3 3.8 3.3 5.9a3.3 3.3 0 0 1-6.6 0c0-1.1.5-2 1.2-2.8.2.9.7 1.5 1.3 1.8-.1-1.6.1-3.1.8-4.9z" ${F} opacity=".75"/><rect x="7.5" y="11" width="10" height="8.5" rx="2.6" ${F}/><path d="M10.5 11v3.6M14 11v3.6" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M9 19.5V23h7v-3.5" ${F}/>`,
    // three of you: one solid, two afterimages
    clones: `<g ${F} opacity=".38"><circle cx="5.5" cy="9" r="2.6"/><path d="M1.5 19.5a4 4 0 0 1 8 0z"/><circle cx="18.5" cy="9" r="2.6"/><path d="M14.5 19.5a4 4 0 0 1 8 0z"/></g><circle cx="12" cy="7.5" r="3.3" ${F}/><path d="M6.6 21a5.4 5.4 0 0 1 10.8 0z" ${F}/><path d="M9 7h6" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    // a curved four-blade shuriken with its hub
    shuriken: `<path d="M12 1.8c1.6 3 1.8 5.6.9 8.1l9.3 2.1c-3 1.6-5.6 1.8-8.1.9L12 22.2c-1.6-3-1.8-5.6-.9-8.1L1.8 12c3-1.6 5.6-1.8 8.1-.9z" ${F}/><circle cx="12" cy="12" r="2.1" fill="rgba(0,0,0,.4)"/>`,
    // a red orb bursting outward
    redburst: `<circle cx="12" cy="12" r="4.4" ${F}/><circle cx="12" cy="12" r="8.6" ${S} stroke-width="1.8" stroke-dasharray="2.4 3"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" ${S} stroke-width="2"/>`,
    // an opened psychic eye radiating power
    psyburst: `<path d="M2 12s3.8-6.2 10-6.2S22 12 22 12s-3.8 6.2-10 6.2S2 12 2 12z" ${F}/><circle cx="12" cy="12" r="3.3" fill="rgba(0,0,0,.45)"/><circle cx="13.1" cy="10.9" r="1" ${F}/><path d="M12 1v2.6M5 2.8l1.4 2.2M19 2.8 17.6 5M12 23v-2.6M5 21.2 6.4 19M19 21.2 17.6 19" ${S} stroke-width="1.9"/>`,
    // a flip that turns over a breaking wave
    tideflip: `<path d="M5.5 17.5a7.6 7.6 0 1 1 12.8-8.6" ${S} stroke-width="2.6"/><path d="M19.6 4.2 18.4 9l-4.8-1.1" ${S} stroke-width="2.4"/><path d="M3 22c1.4-2.6 3.6-3.6 6-2.4 1.4.7 2.6.4 3.4-.8-.2 2.5-2.4 3.9-4.8 3.2z" ${F}/>`,
    // water rushing forward
    riverrush: `<path d="M2 7.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0M2 12c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0M2 16.5c1.8-1.5 3.6-1.5 5.4 0s3.6 1.5 5.4 0" ${S} stroke-width="2"/><path d="M15 5.5 22 12l-7 6.5z" ${F}/>`,
    // a total eclipse: the dark disc and its corona
    eclipse: `<circle cx="12" cy="12" r="7.4" ${F}/><circle cx="13.2" cy="10.9" r="6" fill="rgba(0,0,0,.6)"/><path d="M12 1.2v2.2M12 20.6v2.2M1.2 12h2.2M20.6 12h2.2M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5" ${S} stroke-width="1.8"/>`,
    // a crescent blade rising
    crescentup: `<path d="M4.5 21c.6-7.4 4.6-13 11.4-17-3.2 4.8-4.6 10.3-3.6 17z" ${F}/><path d="M19 22V9.5M15.6 13 19 9.5l3.4 3.5" ${S} stroke-width="2.3"/>`,
    // a blur of fists
    barrage: `<g ${F}><rect x="1.5" y="8" width="6.5" height="8" rx="2" opacity=".3"/><rect x="6.5" y="7" width="7" height="9" rx="2.2" opacity=".6"/><rect x="12" y="5.5" width="10" height="11.5" rx="3"/></g><path d="M15.5 5.5v4.2M19 5.5v4.2" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12 13.5h4" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    // a fan of fists
    hundredfists: `<g ${F}><rect x="9" y="1.5" width="7.5" height="7" rx="2.2" transform="rotate(-24 12 12)"/><rect x="11.5" y="8.5" width="9" height="7.5" rx="2.4"/><rect x="9" y="15.5" width="7.5" height="7" rx="2.2" transform="rotate(24 12 12)"/></g><path d="M2 12h7M3 7.5h5M3 16.5h5" ${S} stroke-width="1.8" opacity=".7"/>`,
    // one giant fist with a glint
    giantfist: `<rect x="2.5" y="5.5" width="16" height="13" rx="3.8" ${F}/><path d="M6.8 5.5v5.2M10.8 5.5v5.2M14.8 5.5v5.2M2.5 13.5h6" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-width="1.8"/><path d="M20.5 2.5v4M18.5 4.5h4" ${S} stroke-width="1.8"/><path d="M6 18.5V22h9v-3.5" ${F}/>`,
    // a flick of the fingers that pops the air
    flick: `<path d="M1.5 9.4h5.6a2.6 2.6 0 0 1 0 5.2H1.5z" ${F}/><path d="M4.5 9.4v5.2" stroke="rgba(0,0,0,.3)" stroke-width="1.4"/><ellipse cx="12.6" cy="12" rx="1.7" ry="3.8" ${S} stroke-width="2"/><ellipse cx="18.8" cy="12" rx="2.3" ry="6.2" ${S} stroke-width="2"/>`,
    // a fist cracking the air open
    smash: `<path d="M12 .8l1.4 4.6 3.6-3-.6 4.7 4.6-1.4-2.6 4 4.8 1.3-4.4 2 3 3.6-4.7-.5 1.2 4.6-3.8-2.8L12 23.2l-1.3-4.7-3.8 2.8 1.2-4.6-4.7.5 3-3.6-4.4-2 4.8-1.3-2.6-4 4.6 1.4L7 2.4l3.6 3z" ${F} opacity=".4"/><rect x="7" y="7.5" width="10" height="8.5" rx="2.6" ${F}/><path d="M10.3 7.5v3.4M13.7 7.5v3.4" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M8.6 16v3h6.8v-3" ${F}/>`,
    // one serious punch inside its impact lines
    seriouspunch: `<path d="M12 1v3.5M12 19.5V23M1 12h3.5M19.5 12H23M4.2 4.2l2.5 2.5M17.3 17.3l2.5 2.5M4.2 19.8l2.5-2.5M17.3 6.7l2.5-2.5" ${S} stroke-width="1.6"/><rect x="7.2" y="7" width="9.6" height="8.2" rx="2.5" ${F}/><path d="M10.4 7v3.2M13.6 7v3.2M7.2 12.4h4" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M8.8 15.2V18h6.4v-2.8" ${F}/>`,
    // a casual uppercut: a lazy swoosh and a fist
    casualup: `<path d="M3.5 21c0-5.5 2.5-10 7-13" ${S} stroke-width="2" stroke-dasharray="2.5 2.5"/><rect x="11" y="3" width="9" height="8" rx="2.4" ${F}/><path d="M14 3v3.2M17 3v3.2" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12.4 11v3.5h6.2V11" ${F}/><path d="M22 14.5c0 1-.6 1.6-1.3 1.6s-1.3-.6-1.3-1.6c0-.8 1.3-2.6 1.3-2.6s1.3 1.8 1.3 2.6z" ${F} opacity=".7"/>`,
    // ghost flame dashing forward
    spiritrush: `<path d="M14 3.5c3.6 0 6.5 2.8 6.5 6.8v9.7l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-9.7c0-4 2.9-6.8 6.5-6.8z" ${F}/><circle cx="12.4" cy="10" r="1.3" fill="rgba(0,0,0,.4)"/><circle cx="16.4" cy="10" r="1.3" fill="rgba(0,0,0,.4)"/><path d="M1.5 9h4.5M2.5 13h3.5M1.5 17h4.5" ${S} stroke-width="1.8"/>`,
    // a pointed finger loosing a spirit shot
    finger: `<path d="M3.5 21.5v-5.2l7.8-7.8a1.6 1.6 0 0 1 2.3 2.3l-3.4 3.4 2 2a2.2 2.2 0 0 1 0 3.1l-2.3 2.2z" ${F}/><path d="M19 2.5l.9 2.6 2.6.9-2.6.9L19 9.5l-.9-2.6-2.6-.9 2.6-.9z" ${F}/><path d="M13.5 9.5 16.5 6.5" ${S} stroke-width="1.8" stroke-dasharray="1.6 2"/>`,
    // a chainsaw revving
    chainsaw: `<rect x="1.5" y="7" width="7.5" height="10" rx="2.2" ${F}/><path d="M9 9h10.5a3 3 0 0 1 0 6H9z" ${F}/><path d="M10 9l1.2-1.6L12.4 9l1.2-1.6L14.8 9 16 7.4 17.2 9l1.2-1.6L19.6 9M10 15l1.2 1.6L12.4 15l1.2 1.6 1.2-1.6 1.2 1.6 1.2-1.6 1.2 1.6 1.2-1.6" ${S} stroke-width="1.4"/><path d="M3.5 7V4.5h4" ${S} stroke-width="1.8"/>`,
    // a saw blade cutting upward
    sawup: `<path d="M12 10.5l1.7 2.3 2.8-.8.4 2.9 2.7 1.1-1.5 2.5 1.5 2.5H5.4l1.5-2.5-1.5-2.5 2.7-1.1.4-2.9 2.8.8z" ${F}/><circle cx="12" cy="18" r="2.2" fill="rgba(0,0,0,.4)"/><path d="M12 9V1.5M8.5 5 12 1.5 15.5 5" ${S} stroke-width="2.3"/>`,
    // a huge hand closing on you
    bighand: `<path d="M4 10.5c0-1.2.9-2 2-2h11c1.6 0 3 1.3 3 3v3.5c0 3-2.4 5.5-5.5 5.5h-5A5.5 5.5 0 0 1 4 15z" ${F}/><path d="M6 8.5c0-3 .5-5.5 2-5.5s2 2.5 2 5.5M10 8.5c0-3.5.6-6 2-6s2 2.5 2 6M14 8.5c0-3 .5-5 2-5s1.8 2 1.8 5" ${S} stroke-width="2.4"/><path d="M8 14h8" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    // the colossus: broad shoulders, power rising
    colossus: `<circle cx="12" cy="6" r="2.8" ${F}/><path d="M2.5 14.5c0-3.4 2.3-5.5 5.3-5.5h8.4c3 0 5.3 2.1 5.3 5.5v2.3h-3.4V22H5.9v-5.2H2.5z" ${F}/><path d="M12 10.5v5M8 13.5l4 2 4-2" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M4 5.5 2.5 3M20 5.5 21.5 3" ${S} stroke-width="1.8"/>`,
    // two fists brought down like a hammer
    hammerfist: `<rect x="6" y="1.5" width="12" height="9" rx="2.8" ${F}/><path d="M12 1.5v9M9 1.5v3.5M15 1.5v3.5" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M12 12.5v4M9.5 14.5 12 17l2.5-2.5" ${S} stroke-width="2.2"/><path d="M2 21h20" ${S} stroke-width="2.4"/><path d="M12 21l-2-2.4M12 21l2.2-2.6M7.5 21l-1.4-1.8M16.5 21l1.4-1.8" ${S} stroke-width="1.5"/>`,
    // a fist with a hundred strikes streaking ahead of it
    rapidjab: `<rect x="1.5" y="7" width="8.5" height="10" rx="2.6" ${F}/><path d="M4.5 7v3.6M7.5 7v3.6" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M11.5 8h6M11.5 12h8M11.5 16h6" ${S} stroke-width="1.8"/><circle cx="19.8" cy="8" r="1.4" ${F}/><circle cx="22" cy="12" r="1.4" ${F}/><circle cx="19.8" cy="16" r="1.4" ${F}/>`,
    // seven stars, the dipper
    sevenstar: `<path d="M2.5 6.5l5 2 4.5-.5 3.5 3 1 5.5 4.5 2-2 3.5M16.5 16.5l-4.5 1.5" ${S} stroke-width="1.4" opacity=".7"/><g ${F}><circle cx="2.5" cy="6.5" r="1.7"/><circle cx="7.5" cy="8.5" r="1.7"/><circle cx="12" cy="8" r="1.7"/><circle cx="15.5" cy="11" r="1.7"/><circle cx="16.5" cy="16.5" r="1.9"/><circle cx="21" cy="18.5" r="1.7"/><circle cx="12" cy="18" r="1.7"/></g>`,
    // a boot driven forward on a jet of flame
    firekick: `<path d="M9 3h5v8.5l5.5 1.4c1.6.4 2.6 1.8 2.6 3.4V20H9z" ${F}/><path d="M9 16h13" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M7.5 12C5 13 3 11.5 2 9c1.6.8 2.6.4 3-.8-1.7-1.6-1.6-3.6.2-5.2-.1 2 .9 3.2 2.3 3.6z" ${F} opacity=".75"/><path d="M7.5 18c-2.2.6-4-.4-5-2.4 1.4.5 2.3.2 2.7-.8" ${F} opacity=".55"/>`,
    // a spinning ring of flame
    firespin: `<path d="M19.5 12a7.5 7.5 0 1 1-4.4-6.8" ${S} stroke-width="3"/><path d="M15.5 2c2.6 1.4 4 3.2 4 5.4a2.6 2.6 0 0 1-5.2 0c0-.9.5-1.6 1-2.2.1.6.4 1.1.8 1.4 0-1.6-.3-2.9-.6-4.6z" ${F}/><path d="M8 13.5c0-2 1.6-3.4 2.4-4.8.8 1.4 2.4 2.8 2.4 4.8a2.4 2.4 0 0 1-4.8 0z" ${F}/>`,
    // three blades sweeping upward
    triplerise: `<g ${F}><path d="M12 22 10.6 7.5 12 1.5l1.4 6z"/><path d="M12 22 5.6 9.6 4.8 3.6l3.6 5z" opacity=".75"/><path d="M12 22 18.4 9.6l.8-6-3.6 5z" opacity=".75"/></g><path d="M8.5 19.5h7" ${S} stroke-width="2.4"/>`,
    // a folding fan
    fan: `<path d="M12 21 2.3 10.2a14 14 0 0 1 19.4 0z" ${F}/><path d="M12 21 5.4 6.6M12 21 9.4 5.2M12 21l2.6-15.8M12 21l6.6-14.4" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="12" cy="21" r="1.6" ${F}/>`,
    // a sakura blossom held up as a veil
    veil: `<g ${F}><path d="M12 11.6c-2.2-1.6-2.8-4.6-1.4-7.6l.7 1.2.7-1.2c1.4 3 .8 6-1.4 7.6z" transform="rotate(0 12 12)"/><path d="M12 11.6c-2.2-1.6-2.8-4.6-1.4-7.6l.7 1.2.7-1.2c1.4 3 .8 6-1.4 7.6z" transform="rotate(72 12 12)"/><path d="M12 11.6c-2.2-1.6-2.8-4.6-1.4-7.6l.7 1.2.7-1.2c1.4 3 .8 6-1.4 7.6z" transform="rotate(144 12 12)"/><path d="M12 11.6c-2.2-1.6-2.8-4.6-1.4-7.6l.7 1.2.7-1.2c1.4 3 .8 6-1.4 7.6z" transform="rotate(216 12 12)"/><path d="M12 11.6c-2.2-1.6-2.8-4.6-1.4-7.6l.7 1.2.7-1.2c1.4 3 .8 6-1.4 7.6z" transform="rotate(288 12 12)"/></g><circle cx="12" cy="12" r="1.8" fill="rgba(0,0,0,.35)"/><circle cx="12" cy="12" r="10.5" ${S} stroke-width="1.4" opacity=".55"/>`,
    // a storm of petals
    petalstorm: `<path d="M12 12.5a2 2 0 1 1 2-2 4 4 0 1 1-4 4 6 6 0 1 1 6-6" ${S} stroke-width="2"/><g ${F}><ellipse cx="4.5" cy="5" rx="1.4" ry="2.4" transform="rotate(-30 4.5 5)"/><ellipse cx="20" cy="17.5" rx="1.4" ry="2.4" transform="rotate(40 20 17.5)"/><ellipse cx="5" cy="19.5" rx="1.2" ry="2.1" transform="rotate(70 5 19.5)"/><ellipse cx="20.5" cy="4.5" rx="1.1" ry="2" transform="rotate(20 20.5 4.5)"/></g>`,
    // a faceted icicle spear
    icicle: `<path d="M2.5 2.5 9 4.8 21.8 21.8 4.8 9z" ${F}/><path d="M2.5 2.5l8.8 8.8M9 4.8l-2.3 4.4" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M17 4.5l1.2 2.2M20.5 8.5l-2.3-.2" ${S} stroke-width="1.6"/>`,
    // glacier spikes bursting up out of the ground
    glacier: `<path d="M1.5 21.5 5 12l2.4 4.4L11 3l3.2 10.5 2.4-5L22.5 21.5z" ${F}/><path d="M11 3l-.6 11M5 12l.3 6.5M16.6 8.5l.8 8" stroke="rgba(0,0,0,.32)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    // a record on the deck and the tonearm
    turntable: `<circle cx="10.5" cy="12.5" r="8.5" ${F}/><circle cx="10.5" cy="12.5" r="5.6" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/><circle cx="10.5" cy="12.5" r="2.4" fill="rgba(0,0,0,.4)"/><path d="M20.5 2.5V12l-4.2 4.2" ${S} stroke-width="2.2"/><circle cx="20.5" cy="2.8" r="1.6" ${F}/>`,
    // jump: a leap off the ground
    jump: `<path d="M6 12.5 12 6.5l6 6M6 18l6-6 6 6" ${S} stroke-width="2.8"/><path d="M4 22h16" ${S} stroke-width="1.8" opacity=".6"/>`,
    // the training dummy
    dummy: `<circle cx="12" cy="5" r="3" ${F}/><path d="M4 9.5h16" ${S} stroke-width="2.6"/><path d="M8.5 9.5h7v8h-7z" ${F}/><circle cx="12" cy="13.5" r="2" fill="rgba(0,0,0,.35)"/><path d="M12 17.5V22M8 22h8" ${S} stroke-width="2.4"/>`,
  };
  function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || ICON_PATHS[name] || ''}</svg>`; }
  function hydrate(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.hydrated === el.dataset.icon) return;
      el.innerHTML = svg(el.dataset.icon);
      el.dataset.hydrated = el.dataset.icon;
    });
  }
  return { svg, hydrate };
})();
