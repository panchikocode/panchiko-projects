/* =========================================================================
   紅龍傳說 / LEGEND OF THE RED DRAGON  (Red Dragon Software, 1994)
   palette.js — the cartridge's colour ROM.

   Anchored in black / dark-red / gold / cream, extended with the tints
   a modern remaster would add: rim lights, embers, jade, stone, sky ramps.
   ========================================================================= */
'use strict';

const C = {
  /* --- core four --------------------------------------------------- */
  black:    '#0b0a0d',
  ink:      '#14090c',
  darkRed:  '#7a1220',
  gold:     '#f2b33d',
  cream:    '#f5e6c8',

  /* --- reds --------------------------------------------------------- */
  red0:     '#2a0a11',
  red1:     '#4d0e18',
  red2:     '#7a1220',
  red3:     '#b5202e',
  red4:     '#e04a3a',
  red5:     '#ff7a5e',

  /* --- oranges / fire ---------------------------------------------- */
  or0:      '#5a2408',
  or1:      '#8a3a12',
  or2:      '#c25218',
  or3:      '#e0662a',
  or4:      '#ff9a3c',
  or5:      '#ffc86a',
  fire:     '#ff5522',
  fireHot:  '#ffcc33',
  fireCore: '#fff3c0',

  /* --- golds -------------------------------------------------------- */
  gold0:    '#6b4a10',
  gold1:    '#9c6c18',
  gold2:    '#b8801f',
  gold3:    '#f2b33d',
  gold4:    '#ffd772',
  gold5:    '#fff0b8',

  /* --- creams / skin ------------------------------------------------ */
  cream0:   '#6b5a3a',
  cream1:   '#a08a62',
  cream2:   '#c9b48c',
  cream3:   '#f5e6c8',
  white:    '#ffffff',
  skin0:    '#8a5426',
  skin1:    '#b8753f',
  skin2:    '#e8b07a',
  skin3:    '#ffd6ab',

  /* --- jade (mini-boss, spirit) ------------------------------------ */
  jade0:    '#0b3a28',
  jade1:    '#17734f',
  jade2:    '#2fae7a',
  jade3:    '#6ff0c0',
  jade4:    '#c8fff0',

  /* --- night / purples --------------------------------------------- */
  night0:   '#080611',
  night1:   '#100c21',
  night2:   '#1a2340',
  night3:   '#35406b',
  night4:   '#5f6b9a',
  pur0:     '#2a1030',
  pur1:     '#4a2a5a',
  pur2:     '#7d4a8f',
  pur3:     '#b47ac8',

  /* --- stone / wall ------------------------------------------------- */
  st0:      '#171519',
  st1:      '#26232a',
  st2:      '#3a3640',
  st3:      '#565060',
  st4:      '#7d768a',
  st5:      '#a89fb0',

  /* --- earth -------------------------------------------------------- */
  earth0:   '#241a12',
  earth1:   '#3d2a1a',
  earth2:   '#5c4128',
  earth3:   '#8a6238',

  /* --- sky ramps per act ------------------------------------------- */
  sky: {
    dawn:  ['#1b1230', '#4a2340', '#a8434a', '#e8834a', '#ffc06a'],
    dusk:  ['#120a22', '#38143a', '#7a1a3a', '#c2412c', '#e8802e'],
    night: ['#04030a', '#0a0a1c', '#141634', '#1f2148', '#2e2a5c'],
    boss:  ['#0a0207', '#1e0410', '#3d0812', '#66101a', '#8f1a22']
  }
};

/* numeric (0xRRGGBB) mirror for Phaser tints / particle tints */
const CN = (() => {
  const out = {};
  const walk = (src, dst) => {
    for (const k in src) {
      const v = src[k];
      if (typeof v === 'string' && v[0] === '#') dst[k] = parseInt(v.slice(1), 16);
      else if (Array.isArray(v)) dst[k] = v.map(s => parseInt(s.slice(1), 16));
      else if (typeof v === 'object') { dst[k] = {}; walk(v, dst[k]); }
    }
    return dst;
  };
  return walk(C, out);
})();

/* helpers -------------------------------------------------------------- */
function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  const f = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function shade(hex, amt) { return mix(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt)); }
function toNum(hex) { return parseInt(hex.slice(1), 16); }

window.C = C; window.CN = CN;
window.mix = mix; window.shade = shade; window.toNum = toNum; window.hex2rgb = hex2rgb; window.rgb2hex = rgb2hex;
