/* =========================================================================
   art_sprites.js — every character, projectile, pickup and effect,
   drawn pixel by pixel at run time.
   ========================================================================= */
'use strict';

const ART = {};

/* =========================================================================
   THE MONK  — 16x16, orange robe, white staff.
   ========================================================================= */
function drawMonk(p, o) {
  o = o || {};
  const bob   = o.bob   || 0;
  const legs  = o.legs  || 'stand';
  const staff = o.staff || 'idle';
  const lean  = o.lean  || 0;

  const R  = C.or3, RD = C.or1, RL = C.or4;
  const SK = C.skin2, SKD = C.skin1, SKL = C.skin3;
  const G  = C.gold3, GD = C.gold1;
  const CR = C.cream3;

  const y = bob, x = lean;

  /* --- head ------------------------------------------------------- */
  p.rect(5 + x, 1 + y, 6, 5, SK);
  p.rect(5 + x, 1 + y, 6, 1, SKL);            // lit scalp
  p.set(10 + x, 2 + y, SKD); p.set(10 + x, 3 + y, SKD);
  p.set(4 + x, 3 + y, SKD);                   // ear
  p.rect(5 + x, 5 + y, 6, 1, SKD);            // jaw shadow
  /* three ordination dots — the monk's marks */
  p.set(6 + x, 2 + y, C.red2); p.set(8 + x, 2 + y, C.red2); p.set(10 - 0 + x, 2 + y, C.red2);
  /* eyes, facing right */
  p.set(7 + x, 4 + y, C.ink); p.set(9 + x, 4 + y, C.ink);
  p.set(7 + x, 3 + y, SKD);  p.set(9 + x, 3 + y, SKD);

  /* --- collar / shoulders ----------------------------------------- */
  p.rect(4 + x, 6 + y, 8, 1, CR);
  p.set(4 + x, 6 + y, C.cream1); p.set(11 + x, 6 + y, C.cream1);

  /* --- robe -------------------------------------------------------- */
  p.rect(4 + x, 7 + y, 8, 3, R);
  p.rect(3 + x, 10 + y, 10, 3, R);
  p.rect(3 + x, 10 + y, 10, 1, G);            // gold sash
  p.rect(3 + x, 11 + y, 10, 1, GD);
  /* folds */
  p.rect(4 + x, 7 + y, 2, 3, RL);
  p.rect(10 + x, 7 + y, 2, 3, RD);
  p.set(6 + x, 12 + y, RD); p.set(9 + x, 12 + y, RD);
  p.set(3 + x, 12 + y, RD); p.set(12 + x, 12 + y, RD);

  /* --- legs / sandals ---------------------------------------------- */
  const foot = (fx, fy, tone) => {
    p.rect(fx, fy, 2, 1, tone || SK);
    p.rect(fx - 1, fy + 1, 3, 1, C.earth2);
  };
  if (legs === 'stand') { foot(5 + x, 13 + y); foot(9 + x, 13 + y); }
  else if (legs === 'walkA') { foot(3 + x, 13 + y); foot(9 + x, 13 + y, SKD); }
  else if (legs === 'walkB') { foot(6 + x, 13 + y); foot(8 + x, 13 + y, SKD); }
  else if (legs === 'walkC') { foot(4 + x, 13 + y, SKD); foot(10 + x, 13 + y); }
  else if (legs === 'air')   { p.rect(4 + x, 12 + y, 3, 2, SK); p.rect(9 + x, 13 + y, 3, 1, SK); p.rect(3 + x, 13 + y, 3, 1, C.earth2); }
  else if (legs === 'kneel') { p.rect(3 + x, 13 + y, 4, 1, C.earth2); p.rect(9 + x, 13 + y, 4, 1, C.earth2); }
  else if (legs === 'dash')  { p.rect(2 + x, 13 + y, 5, 1, C.earth2); p.rect(8 + x, 12 + y, 4, 1, SK); }

  /* --- the white staff --------------------------------------------- */
  const pole = (x0, y0, x1, y1) => {
    p.line(x0, y0, x1, y1, CR);
    p.line(x0 + 1, y0, x1 + 1, y1, C.cream1);
    p.set(x0, y0, C.white);
  };
  if (staff === 'idle')      { pole(13, 1 + y, 13, 14 + y); p.rect(12, 1 + y, 3, 1, G); p.set(13, 4 + y, G); p.set(13, 8 + y, G); }
  else if (staff === 'walk') { pole(13, 2 + y, 12, 14 + y); p.rect(12, 2 + y, 3, 1, G); p.set(13, 6 + y, G); }
  else if (staff === 'air')  { p.line(11, 2 + y, 15, 9 + y, CR); p.line(11, 3 + y, 15, 10 + y, C.cream1); p.rect(10, 1 + y, 2, 2, G); }
  else if (staff === 'back') { p.line(2, 1 + y, 7, 8 + y, CR); p.line(3, 1 + y, 8, 8 + y, C.cream1); p.rect(1, 0 + y, 2, 2, G); }
  else if (staff === 'fwd')  { p.rect(6, 8 + y, 10, 1, CR); p.rect(6, 9 + y, 10, 1, C.cream1); p.rect(14, 7 + y, 2, 3, G); }
  else if (staff === 'down') { p.line(8, 12 + y, 15, 13 + y, CR); p.line(8, 13 + y, 15, 14 + y, C.cream1); p.rect(14, 12 + y, 2, 2, G); }
  else if (staff === 'up')   { pole(11, 0 + y, 11, 9 + y); p.rect(10, 0 + y, 3, 1, G); p.set(11, 3 + y, G); }
  else if (staff === 'dash') { p.rect(2, 6 + y, 13, 1, CR); p.rect(2, 7 + y, 13, 1, C.cream1); p.rect(13, 5 + y, 2, 3, G); }

  return p;
}

function monkTex(scene, key, opts) {
  const p = new Pix(16, 16);
  drawMonk(p, opts);
  p.outline(C.ink);
  p.rim(C.or5, -1, -1);          // rim light from upper-left
  pixToTex(scene, key, p);
}

/* =========================================================================
   ENEMIES
   ========================================================================= */

/* --- 1. Flying demon (sine wave) — 16x16 --------------------------- */
function demonTex(scene, key, wing) {
  const p = new Pix(16, 16);
  const B = C.red2, BD = C.red1, BL = C.red3;
  const wy = [3, 5, 8, 5][wing];
  /* wings */
  p.tri(4, 7, 0, wy, 3, 11, BD);
  p.tri(11, 7, 15, wy, 12, 11, BD);
  p.line(0, wy, 3, 11, C.red3); p.line(15, wy, 12, 11, C.red3);
  p.set(1, wy + 1, C.red0); p.set(14, wy + 1, C.red0);
  /* body */
  p.ellipse(8, 9, 3, 4, B);
  p.ellipse(8, 6, 3, 3, B);
  p.rect(5, 4, 6, 1, BD);
  p.ellipse(8, 8, 2, 3, BL);
  /* horns */
  p.line(5, 4, 4, 1, C.cream2); p.line(10, 4, 11, 1, C.cream2);
  p.set(4, 1, C.cream3); p.set(11, 1, C.cream3);
  /* eyes + maw */
  p.set(6, 6, C.fireHot); p.set(10, 6, C.fireHot);
  p.set(6, 5, C.fire);    p.set(10, 5, C.fire);
  p.rect(7, 8, 3, 1, C.ink);
  p.set(7, 9, C.cream3); p.set(9, 9, C.cream3);
  /* tail */
  p.line(8, 12, 8, 14, BD); p.set(8, 15, C.red3);
  p.outline(C.ink);
  p.rim(C.red4, 0, -1);
  pixToTex(scene, key, p);
}

/* --- 2. Hellhound (ground charger) — 20x14 -------------------------- */
function houndTex(scene, key, mode) {
  const p = new Pix(20, 14);
  const B = C.red1, BL = C.red2, D = C.red0;
  const crouch = mode === 'tell' ? 1 : 0;
  const run = mode === 'run';
  /* body */
  p.ellipse(9, 7 + crouch, 6, 3, B);
  p.rect(4, 5 + crouch, 11, 4, B);
  p.rect(4, 8 + crouch, 11, 1, D);
  /* head */
  p.rect(13, 4 + crouch, 6, 4, B);
  p.rect(17, 6 + crouch, 3, 2, BL);
  p.rect(18, 7 + crouch, 2, 1, C.ink);
  /* jaw teeth */
  p.set(17, 8 + crouch, C.cream3); p.set(19, 8 + crouch, C.cream3);
  /* ears */
  p.tri(13, 4 + crouch, 12, 0 + crouch, 15, 3 + crouch, D);
  p.tri(16, 4 + crouch, 17, 1 + crouch, 18, 4 + crouch, D);
  /* eye */
  p.set(16, 5 + crouch, mode === 'tell' ? C.fireHot : C.fire);
  p.set(15, 5 + crouch, C.fireHot);
  /* mane of flame */
  for (let i = 0; i < 7; i++) {
    const h = 2 + ((i * 5) % 3);
    p.line(6 + i, 4 + crouch, 6 + i, 4 + crouch - h, i % 2 ? C.fire : C.or4);
    p.set(6 + i, 3 + crouch - h, C.fireHot);
  }
  /* legs */
  if (run) {
    p.rect(5, 9 + crouch, 2, 4, D); p.rect(13, 9 + crouch, 2, 3, D);
    p.rect(8, 10 + crouch, 2, 3, B); p.rect(11, 9 + crouch, 2, 4, B);
  } else {
    p.rect(5, 9 + crouch, 2, 4 - crouch, D); p.rect(9, 9 + crouch, 2, 4 - crouch, B);
    p.rect(13, 9 + crouch, 2, 4 - crouch, D);
  }
  /* tail */
  p.line(4, 6 + crouch, 0, 3 + crouch, BL);
  p.set(0, 2 + crouch, C.fire); p.set(1, 3 + crouch, C.or4);
  p.outline(C.ink);
  p.rim(C.red4, 0, -1);
  pixToTex(scene, key, p);
}

/* --- 3. Imp (hopper) — 14x14 ---------------------------------------- */
function impTex(scene, key, phase) {
  const p = new Pix(14, 14);
  const B = C.pur1, BL = C.pur2, D = C.pur0;
  const sq = phase === 'squat';
  const oy = sq ? 2 : 0;
  p.ellipse(7, 8 + oy, 4, 4 - (sq ? 1 : 0), B);
  p.ellipse(7, 5 + oy, 4, 3, B);
  p.ellipse(6, 5 + oy, 2, 2, BL);
  /* horns */
  p.line(4, 3 + oy, 3, 0 + oy, C.cream2); p.line(10, 3 + oy, 11, 0 + oy, C.cream2);
  /* eyes */
  p.set(5, 5 + oy, C.jade3); p.set(9, 5 + oy, C.jade3);
  p.set(5, 6 + oy, C.jade2); p.set(9, 6 + oy, C.jade2);
  /* grin */
  p.rect(6, 7 + oy, 3, 1, C.ink); p.set(6, 8 + oy, C.cream3); p.set(8, 8 + oy, C.cream3);
  /* arms + legs */
  if (sq) { p.rect(2, 10, 3, 2, D); p.rect(9, 10, 3, 2, D); }
  else    { p.rect(2, 9, 2, 4, D); p.rect(10, 9, 2, 4, D); p.rect(1, 6, 2, 3, D); p.rect(11, 6, 2, 3, D); }
  p.outline(C.ink);
  p.rim(C.pur3, 0, -1);
  pixToTex(scene, key, p);
}

/* --- 4. Guardian statue turret — 16x20 ------------------------------ */
function statueTex(scene, key, hot) {
  const p = new Pix(16, 20);
  const S = C.st2, SL = C.st3, SD = C.st1, SH = C.st4;
  /* plinth */
  p.rect(1, 17, 14, 3, SD);
  p.rect(2, 17, 12, 1, S);
  /* body — a stone lion-dog */
  p.rect(3, 8, 10, 9, S);
  p.rect(3, 8, 3, 9, SL);
  p.rect(12, 8, 1, 9, SD);
  /* head */
  p.rect(2, 2, 12, 7, S);
  p.rect(2, 2, 12, 1, SL);
  p.rect(3, 3, 10, 1, SH);
  /* mane curls */
  for (let i = 0; i < 5; i++) { p.set(1, 3 + i * 2, SL); p.set(14, 3 + i * 2, SL); p.set(0, 4 + i * 2, SD); p.set(15, 4 + i * 2, SD); }
  /* ears / horns */
  p.tri(2, 2, 0, 0, 4, 2, SL); p.tri(13, 2, 15, 0, 11, 2, SL);
  /* eyes — glow when charging */
  const eye = hot ? C.fireHot : C.red1;
  p.rect(4, 5, 2, 2, eye); p.rect(10, 5, 2, 2, eye);
  if (hot) { p.set(4, 4, C.fire); p.set(11, 4, C.fire); p.set(4, 7, C.fire); p.set(11, 7, C.fire); }
  /* open maw */
  p.rect(6, 7, 4, 2, hot ? C.fire : C.ink);
  if (hot) { p.rect(6, 7, 4, 1, C.fireHot); }
  p.set(6, 6, C.cream2); p.set(9, 6, C.cream2);
  /* carved gold seal */
  p.rect(6, 11, 4, 4, hot ? C.gold4 : C.gold1);
  p.rect(7, 12, 2, 2, C.st1);
  p.outline(C.ink);
  p.rim(SH, -1, -1);
  pixToTex(scene, key, p);
}

/* --- 5. Armoured brute — 22x22 --------------------------------------- */
function bruteTex(scene, key, mode) {
  const p = new Pix(22, 22);
  const A = C.st2, AL = C.st4, AD = C.st1;
  const R = C.red2, RD = C.red1;
  const slam = mode === 'slam';
  const guard = mode === 'guard';
  const oy = slam ? -1 : 0;

  /* legs */
  p.rect(5, 16, 4, 6, AD); p.rect(12, 16, 4, 6, AD);
  p.rect(4, 20, 6, 2, C.st1); p.rect(11, 20, 6, 2, C.st1);
  /* torso */
  p.rect(4, 7 + oy, 13, 10, R);
  p.rect(4, 7 + oy, 13, 2, C.red3);
  p.rect(4, 15 + oy, 13, 2, RD);
  /* chest plate */
  p.rect(6, 9 + oy, 9, 5, A);
  p.rect(6, 9 + oy, 9, 1, AL);
  p.rect(9, 10 + oy, 3, 3, C.gold2);
  p.set(10, 11 + oy, C.gold4);
  /* pauldrons */
  p.ellipse(4, 8 + oy, 4, 3, A); p.ellipse(17, 8 + oy, 4, 3, A);
  p.ellipse(4, 7 + oy, 3, 2, AL); p.ellipse(17, 7 + oy, 3, 2, AL);
  /* helmet */
  p.rect(6, 1 + oy, 9, 6, A);
  p.rect(6, 1 + oy, 9, 1, AL);
  p.rect(7, 2 + oy, 7, 1, C.st5);
  p.rect(6, 5 + oy, 9, 2, AD);
  p.rect(7, 4 + oy, 3, 1, C.fire); p.rect(12, 4 + oy, 3, 1, C.fire);  /* eye slits */
  p.set(8, 4 + oy, C.fireHot); p.set(13, 4 + oy, C.fireHot);
  /* horn crest */
  p.line(10, 1 + oy, 10, -1 + oy, C.gold3); p.set(10, 0 + oy, C.gold4);
  p.line(6, 1 + oy, 3, -1 + oy, C.gold2); p.line(14, 1 + oy, 17, -1 + oy, C.gold2);

  if (guard) {
    /* raised shield covering the front */
    p.rect(16, 4, 5, 14, C.st3);
    p.rect(16, 4, 5, 1, C.st5);
    p.rect(17, 6, 3, 10, C.red2);
    p.rect(18, 8, 1, 6, C.gold3);
    p.rect(20, 4, 1, 14, C.st1);
  } else if (slam) {
    /* both fists overhead */
    p.rect(2, 0, 4, 4, A); p.rect(16, 0, 4, 4, A);
    p.rect(2, 0, 4, 1, AL); p.rect(16, 0, 4, 1, AL);
  } else {
    p.rect(1, 11, 4, 5, A); p.rect(17, 11, 4, 5, A);
  }
  p.outline(C.ink);
  p.rim(C.st5, -1, -1);
  pixToTex(scene, key, p);
}

/* --- 6. Bat (swarm unit) — 10x8 -------------------------------------- */
function batTex(scene, key, wing) {
  const p = new Pix(10, 8);
  const B = C.pur0, BL = C.pur1;
  const wy = wing ? 1 : 4;
  p.tri(4, 4, 0, wy, 2, 6, B); p.tri(6, 4, 10, wy, 8, 6, B);
  p.line(0, wy, 2, 6, BL); p.line(10, wy, 8, 6, BL);
  p.ellipse(5, 4, 2, 2, C.pur1);
  p.set(3, 1, C.pur1); p.set(7, 1, C.pur1);
  p.set(4, 3, C.fire); p.set(6, 3, C.fire);
  p.outline(C.ink);
  pixToTex(scene, key, p);
}

/* =========================================================================
   MINI-BOSS — the Jade General, 32x34
   ========================================================================= */
function generalTex(scene, key, mode) {
  const p = new Pix(32, 34);
  const J = C.jade1, JL = C.jade2, JD = C.jade0, JH = C.jade3;
  const G = C.gold2, GL = C.gold4;
  const slam = mode === 'slam', throwing = mode === 'throw', hurt = mode === 'hurt';
  const oy = slam ? 2 : 0;

  /* cape */
  p.tri(6, 10, 0, 30, 12, 28, C.red1);
  p.tri(26, 10, 32, 30, 20, 28, C.red1);
  p.rect(6, 10 + oy, 20, 16, C.red2);

  /* legs */
  p.rect(8, 24, 6, 9, JD); p.rect(18, 24, 6, 9, JD);
  p.rect(7, 31, 8, 3, C.st1); p.rect(17, 31, 8, 3, C.st1);
  p.rect(8, 26, 6, 1, JL); p.rect(18, 26, 6, 1, JL);

  /* torso armour */
  p.rect(7, 11 + oy, 18, 14, J);
  p.rect(7, 11 + oy, 18, 2, JL);
  p.rect(7, 23 + oy, 18, 2, JD);
  for (let r = 0; r < 3; r++) p.rect(8, 15 + r * 3 + oy, 16, 1, JD);
  /* belly gem */
  p.ellipse(16, 18 + oy, 3, 3, hurt ? C.red4 : G);
  p.ellipse(16, 17 + oy, 2, 2, hurt ? C.red5 : GL);

  /* pauldrons */
  p.ellipse(6, 12 + oy, 6, 4, J); p.ellipse(26, 12 + oy, 6, 4, J);
  p.ellipse(6, 11 + oy, 5, 3, JL); p.ellipse(26, 11 + oy, 5, 3, JL);
  p.set(2, 12 + oy, G); p.set(29, 12 + oy, G);

  /* helm + mask */
  p.rect(10, 2 + oy, 12, 9, J);
  p.rect(10, 2 + oy, 12, 1, JH);
  p.rect(11, 3 + oy, 10, 1, JL);
  p.rect(10, 8 + oy, 12, 3, JD);
  /* demon mask face */
  p.rect(11, 5 + oy, 4, 2, hurt ? C.red5 : C.fire);
  p.rect(17, 5 + oy, 4, 2, hurt ? C.red5 : C.fire);
  p.set(12, 5 + oy, C.fireHot); p.set(19, 5 + oy, C.fireHot);
  p.rect(13, 9 + oy, 6, 1, C.cream3);
  p.set(13, 10 + oy, C.cream2); p.set(15, 10 + oy, C.cream2); p.set(18, 10 + oy, C.cream2);
  /* crest horns */
  p.line(10, 2 + oy, 6, -1 + oy, G); p.line(21, 2 + oy, 25, -1 + oy, G);
  p.line(16, 2 + oy, 16, -2 + oy, GL);
  p.rect(15, -2 + oy, 3, 1, C.red3);

  /* halberd */
  if (throwing) {
    p.rect(0, 14, 8, 2, C.earth2);
    p.tri(8, 12, 14, 15, 8, 18, C.st4);
  } else if (slam) {
    p.rect(24, 0, 2, 26, C.earth2);
    p.rect(24, 0, 2, 1, G);
    p.tri(22, 22, 30, 26, 22, 30, C.st4);
    p.tri(23, 23, 28, 26, 23, 28, C.st5);
  } else {
    p.rect(27, 2, 2, 30, C.earth2);
    p.rect(27, 2, 2, 1, G);
    p.tri(25, 2, 32, 6, 25, 10, C.st4);
    p.tri(26, 4, 30, 6, 26, 8, C.st5);
    p.rect(26, 12, 4, 1, G);
  }

  p.outline(C.ink);
  p.rim(JH, -1, -1);
  pixToTex(scene, key, p);
}

/* =========================================================================
   FINAL BOSS — 紅龍, the Red Dragon. 104x72, parametric.
   ========================================================================= */
function dragonTex(scene, key, o) {
  o = o || {};
  const wing = o.wing || 0;          // 0..3
  const mouth = o.mouth || 0;        // 0 closed, 1 open, 2 breathing
  const hurt = !!o.hurt;
  const p = new Pix(104, 72);

  const B  = hurt ? C.red4 : C.red2;
  const BD = hurt ? C.red3 : C.red1;
  const BL = hurt ? C.red5 : C.red3;
  const G  = C.gold2, GL = C.gold4;

  /* --- wings (behind) ---------------------------------------------- */
  const wingTop = [4, 12, 26, 12][wing];
  const wingTip = [24, 30, 40, 30][wing];
  const drawWing = (dir) => {
    const ox = dir < 0 ? 44 : 60;
    const tipX = ox + dir * 42;
    p.tri(ox, 24, tipX, wingTop, ox + dir * 10, 46, BD);
    p.tri(ox, 24, tipX, wingTop, ox + dir * 30, wingTip + 18, BD);
    /* membrane ribs */
    for (let i = 1; i <= 3; i++) {
      const fx = ox + dir * (12 * i);
      const fy = wingTop + (wingTip + 14 - wingTop) * (i / 3.4);
      p.line(ox, 24, fx, fy, C.red0);
    }
    /* leading edge + claw */
    p.line(ox, 24, tipX, wingTop, BL);
    p.line(ox, 25, tipX, wingTop + 1, C.red4);
    p.line(tipX, wingTop, tipX + dir * 4, wingTop - 3, C.cream2);
  };
  drawWing(-1); drawWing(1);

  /* --- serpentine body --------------------------------------------- */
  const spine = [[16,52],[26,48],[36,44],[46,40],[56,34],[64,28],[70,22],[74,16]];
  for (let i = spine.length - 1; i >= 0; i--) {
    const [sx, sy] = spine[i];
    const r = 5 + Math.round(i * 0.55);
    p.disc(sx, sy, r, B);
    p.disc(sx, sy - 1, r - 2, BL);
    p.disc(sx + 1, sy + 2, r - 3, BD);
  }
  /* belly scutes */
  for (let i = 0; i < spine.length; i++) {
    const [sx, sy] = spine[i];
    p.rect(sx - 3, sy + 3 + Math.round(i * 0.4), 6, 2, G);
  }
  /* dorsal spines */
  for (let i = 1; i < spine.length; i++) {
    const [sx, sy] = spine[i];
    p.tri(sx - 3, sy - 6, sx, sy - 13, sx + 3, sy - 6, C.gold3);
    p.set(sx, sy - 12, GL);
  }
  /* tail */
  p.line(16, 52, 6, 60, B); p.line(16, 53, 6, 61, BD);
  p.tri(2, 56, 10, 60, 2, 66, C.gold3);

  /* --- forelimb ----------------------------------------------------- */
  p.rect(44, 42, 5, 12, BD);
  p.rect(41, 52, 10, 4, B);
  p.set(41, 56, C.cream2); p.set(44, 56, C.cream2); p.set(47, 56, C.cream2); p.set(50, 56, C.cream2);

  /* --- head --------------------------------------------------------- */
  const hx = 78, hy = 14;
  p.ellipse(hx, hy, 12, 8, B);
  p.ellipse(hx - 2, hy - 2, 10, 5, BL);
  p.rect(hx + 4, hy - 3, 14, 7, B);            // snout
  p.rect(hx + 4, hy - 3, 14, 2, BL);
  p.rect(hx + 4, hy + 3, 14, 1, BD);
  /* nostril */
  p.set(hx + 16, hy - 1, C.ink);
  /* brow + eye */
  p.rect(hx - 4, hy - 6, 9, 2, C.gold3);
  const eye = hurt ? C.white : C.fireHot;
  p.rect(hx + 1, hy - 3, 4, 3, eye);
  p.rect(hx + 2, hy - 2, 2, 1, C.ink);
  p.set(hx + 1, hy - 4, C.fire);
  /* horns */
  p.line(hx - 6, hy - 6, hx - 18, hy - 18, C.cream2);
  p.line(hx - 5, hy - 5, hx - 17, hy - 17, C.cream1);
  p.line(hx - 18, hy - 18, hx - 14, hy - 22, C.cream3);
  p.line(hx - 2, hy - 8, hx - 10, hy - 20, C.cream1);
  /* whiskers */
  p.line(hx + 14, hy + 2, hx + 24, hy + 10, C.gold3);
  p.line(hx + 14, hy + 3, hx + 22, hy + 14, C.gold2);
  p.line(hx + 10, hy + 5, hx + 4, hy + 16, C.gold2);
  /* mane */
  for (let i = 0; i < 6; i++) {
    p.line(hx - 8 - i, hy + 4 + i, hx - 16 - i * 2, hy + 8 + i * 2, C.red0);
  }

  /* jaw / mouth */
  if (mouth === 0) {
    p.rect(hx + 4, hy + 2, 14, 2, BD);
    p.set(hx + 8, hy + 4, C.cream3); p.set(hx + 12, hy + 4, C.cream3); p.set(hx + 16, hy + 4, C.cream3);
  } else {
    const drop = mouth === 2 ? 8 : 5;
    p.rect(hx + 4, hy + 2 + drop, 14, 3, BD);
    p.tri(hx + 4, hy + 2, hx + 18, hy + 1, hx + 18, hy + 2 + drop, C.red0);
    for (let i = 0; i < 4; i++) {
      p.set(hx + 6 + i * 3, hy + 3, C.cream3);
      p.set(hx + 6 + i * 3, hy + 1 + drop, C.cream3);
    }
    if (mouth === 2) {
      p.ellipse(hx + 16, hy + 5, 5, 4, C.fire);
      p.ellipse(hx + 17, hy + 5, 3, 2, C.fireHot);
      p.ellipse(hx + 18, hy + 5, 2, 1, C.fireCore);
    }
  }

  p.outline(C.ink);
  p.rim(C.red5, 0, -1);
  pixToTex(scene, key, p);
}

/* =========================================================================
   PROJECTILES, PICKUPS, EFFECTS
   ========================================================================= */
function buildProjectiles(scene) {
  /* enemy fireball 10x10, 2 frames */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'fireball' + f, 10, 10, p => {
      p.ellipse(5, 5, 4, 4, C.fire);
      p.ellipse(5, 5, 3, 3, C.or4);
      p.ellipse(5, 5, 2, 2, C.fireHot);
      p.set(5, 5, C.fireCore);
      const t = f ? 1 : -1;
      p.line(0, 5 + t, 2, 5, C.or2); p.line(1, 5 - t, 3, 5, C.fire);
      p.outline(C.red0);
    });
  }
  /* dragon fire orb 14x14 */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'dfire' + f, 14, 14, p => {
      p.ellipse(7, 7, 6, 5 + f, C.red3);
      p.ellipse(7, 7, 5, 4, C.fire);
      p.ellipse(7, 7, 3, 3, C.fireHot);
      p.ellipse(7, 7, 1, 1, C.fireCore);
      p.outline(C.red0);
    });
  }
  /* player spirit bolt 16x10 */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'bolt' + f, 16, 10, p => {
      p.ellipse(8, 5, 7, 3 - f * 0 + 1, C.gold2);
      p.ellipse(8, 5, 6, 3, C.gold4);
      p.ellipse(8, 5, 4, 2, C.cream3);
      p.ellipse(9, 5, 2, 1, C.white);
      p.line(0, 5, 3, 5, C.gold3);
      p.line(15, 4, 15, 6, C.white);
      if (f) { p.set(4, 2, C.gold5); p.set(11, 8, C.gold5); }
    });
  }
  /* jade blade 12x12 */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'blade' + f, 12, 12, p => {
      if (f === 0) { p.tri(6, 0, 12, 6, 6, 12, C.jade2); p.tri(6, 0, 0, 6, 6, 12, C.jade1); }
      else { p.tri(0, 6, 6, 0, 12, 6, C.jade2); p.tri(0, 6, 6, 12, 12, 6, C.jade1); }
      p.ellipse(6, 6, 2, 2, C.jade3);
      p.set(6, 6, C.jade4);
      p.outline(C.jade0);
    });
  }
  /* shockwave 20x12 */
  for (let f = 0; f < 3; f++) {
    pixTex(scene, 'shock' + f, 20, 12, p => {
      const h = 4 + f * 3;
      for (let i = 0; i < 20; i++) {
        const t = i / 19;
        const top = 11 - Math.round(Math.sin(t * Math.PI) * h);
        p.line(i, 11, i, top, f === 0 ? C.cream3 : (f === 1 ? C.gold3 : C.or2));
      }
      p.rim(C.gold5, 0, -1);
    });
  }
  /* staff slash arcs 26x26, three combo shapes */
  const arc = (key, a0, a1, r0, r1, col1, col2) => {
    pixTex(scene, key, 26, 26, p => {
      for (let a = a0; a <= a1; a += 2) {
        const rad = a * Math.PI / 180;
        for (let r = r0; r <= r1; r++) {
          const x = 13 + Math.cos(rad) * r, y = 13 + Math.sin(rad) * r;
          const t = (r - r0) / Math.max(1, r1 - r0);
          p.set(Math.round(x), Math.round(y), t < 0.4 ? col1 : (t < 0.75 ? col2 : C.white));
        }
      }
    });
  };
  arc('slash0', -70, 45, 7, 12, C.or2, C.gold4);
  arc('slash1', -45, 70, 7, 12, C.or2, C.gold4);
  arc('slash2', -180, 180, 8, 12, C.red3, C.gold4);
}

function buildPickups(scene) {
  /* wisdom scroll — 12x14, 4-frame spin */
  for (let f = 0; f < 4; f++) {
    const w = [12, 8, 4, 8][f];
    pixTex(scene, 'scroll' + f, 12, 14, p => {
      const x0 = 6 - w / 2;
      p.rect(x0, 1, w, 12, C.cream3);
      p.rect(x0, 1, w, 1, C.cream2);
      p.rect(x0, 12, w, 1, C.cream1);
      if (w > 4) {
        for (let i = 0; i < 4; i++) p.rect(x0 + 1, 3 + i * 2, w - 2, 1, C.cream1);
        p.rect(x0 + 1, 6, w - 2, 2, C.red2);
      }
      /* rollers */
      p.rect(x0 - 1, 0, w + 2, 1, C.gold2);
      p.rect(x0 - 1, 13, w + 2, 1, C.gold2);
      p.set(x0 - 1, 0, C.gold4); p.set(x0 - 1, 13, C.gold4);
      p.outline(C.ink);
    });
  }
  /* golden dragon coin — 12x12, 4-frame spin */
  for (let f = 0; f < 4; f++) {
    const w = [10, 6, 2, 6][f];
    pixTex(scene, 'coin' + f, 12, 12, p => {
      p.ellipse(6, 6, Math.max(1, w / 2), 5, C.gold2);
      p.ellipse(6, 6, Math.max(1, w / 2 - 1), 4, C.gold3);
      if (w >= 6) {
        p.ellipse(6, 5, Math.max(1, w / 2 - 2), 2, C.gold5);
        /* tiny dragon glyph */
        p.set(5, 4, C.gold0); p.set(6, 4, C.gold0); p.set(7, 5, C.gold0);
        p.set(5, 6, C.gold0); p.set(7, 7, C.gold0); p.set(5, 8, C.gold0);
      }
      p.outline(C.gold0);
    });
  }
  /* Dragon Spirit orb — 16x16, 4-frame pulse */
  for (let f = 0; f < 4; f++) {
    pixTex(scene, 'orb' + f, 16, 16, p => {
      const r = 5 + (f % 2);
      p.ring(8, 8, 7, C.gold1);
      p.ellipse(8, 8, r, r, C.red2);
      p.ellipse(8, 8, r - 1, r - 1, C.red3);
      p.ellipse(7, 7, r - 2, r - 2, C.or3);
      p.ellipse(7, 7, Math.max(1, r - 3), Math.max(1, r - 3), C.gold4);
      p.set(6, 6, C.white);
      /* orbiting motes */
      const a = f * Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const ang = a + k * Math.PI / 2;
        p.set(Math.round(8 + Math.cos(ang) * 7), Math.round(8 + Math.sin(ang) * 7), C.gold5);
      }
    });
  }
  /* health pip pickup 10x10 */
  pixTex(scene, 'chi', 10, 10, p => {
    p.ellipse(5, 5, 4, 4, C.jade1);
    p.ellipse(5, 5, 3, 3, C.jade2);
    p.ellipse(4, 4, 2, 2, C.jade3);
    p.set(4, 4, C.jade4);
    p.outline(C.ink);
  });
}

function buildFX(scene) {
  /* plain particle dots */
  pixTex(scene, 'px1', 1, 1, p => p.set(0, 0, C.white));
  pixTex(scene, 'px2', 2, 2, p => p.rect(0, 0, 2, 2, C.white));
  pixTex(scene, 'px3', 3, 3, p => { p.rect(0, 0, 3, 3, C.white); });
  pixTex(scene, 'px4', 4, 4, p => { p.rect(0, 0, 4, 4, C.white); p.set(0, 0, null); p.set(3, 0, null); p.set(0, 3, null); p.set(3, 3, null); });
  /* spark diamond */
  pixTex(scene, 'spark', 7, 7, p => {
    p.line(3, 0, 3, 6, C.white); p.line(0, 3, 6, 3, C.white);
    p.set(3, 3, C.white); p.set(2, 2, C.cream3); p.set(4, 4, C.cream3);
    p.set(4, 2, C.cream3); p.set(2, 4, C.cream3);
  });
  /* soft smoke puff */
  pixTex(scene, 'smoke', 8, 8, p => {
    p.ellipse(4, 4, 3, 3, C.st4);
    p.ellipse(3, 3, 2, 2, C.st5);
    p.set(5, 5, C.st3);
  });
  /* ember */
  pixTex(scene, 'ember', 3, 3, p => { p.set(1, 0, C.or4); p.rect(0, 1, 3, 1, C.fire); p.set(1, 2, C.or2); });
  /* expanding ring */
  pixTex(scene, 'ring', 24, 24, p => { p.ring(12, 12, 10, C.white); p.ring(12, 12, 9, C.cream2); });
  /* soft radial glow (canvas gradient, additive) */
  makeTex(scene, 'glow', 64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,220,150,0.55)');
    g.addColorStop(0.6, 'rgba(255,140,60,0.16)');
    g.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  /* wide soft light cone for lanterns */
  makeTex(scene, 'lightpool', 96, 96, ctx => {
    const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, 'rgba(255,205,120,0.85)');
    g.addColorStop(0.4, 'rgba(240,150,70,0.22)');
    g.addColorStop(1, 'rgba(180,60,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
  });
  /* dust streak for wind */
  pixTex(scene, 'streak', 12, 2, p => {
    p.rect(0, 0, 12, 1, C.cream2); p.rect(2, 1, 8, 1, C.cream1);
  });
  /* impact star */
  pixTex(scene, 'burst', 16, 16, p => {
    for (let a = 0; a < 8; a++) {
      const rad = a * Math.PI / 4;
      p.line(8, 8, Math.round(8 + Math.cos(rad) * 7), Math.round(8 + Math.sin(rad) * 7), a % 2 ? C.gold4 : C.white);
    }
    p.disc(8, 8, 2, C.white);
  });
}

function buildUI(scene) {
  /* monk life icon 12x12 */
  pixTex(scene, 'ui_monk', 12, 12, p => {
    p.ellipse(6, 4, 3, 3, C.skin2);
    p.set(5, 4, C.ink); p.set(7, 4, C.ink);
    p.set(4, 2, C.red2); p.set(6, 2, C.red2); p.set(8, 2, C.red2);
    p.tri(6, 6, 1, 11, 11, 11, C.or3);
    p.rect(2, 10, 9, 1, C.gold3);
    p.outline(C.ink);
  });
  /* chi pip 7x7 */
  pixTex(scene, 'ui_pip', 7, 7, p => {
    p.ellipse(3, 3, 2, 2, C.jade2); p.set(2, 2, C.jade3); p.outline(C.ink);
  });
  pixTex(scene, 'ui_pip_off', 7, 7, p => {
    p.ring(3, 3, 2, C.jade0); p.outline(C.ink);
  });
  /* small scroll icon 9x9 */
  pixTex(scene, 'ui_scroll', 9, 9, p => {
    p.rect(2, 1, 5, 7, C.cream3);
    p.rect(2, 0, 5, 1, C.gold3); p.rect(2, 8, 5, 1, C.gold3);
    p.rect(3, 3, 3, 1, C.red2);
    p.outline(C.ink);
  });
  /* CRT scanlines — 1x3 tile */
  makeTex(scene, 'scan', 4, 3, ctx => {
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(0, 1, 4, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, 2, 4, 1);
  });
  /* aperture-grille tint columns */
  makeTex(scene, 'grille', 3, 1, ctx => {
    ctx.fillStyle = 'rgba(255,60,60,0.055)'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(60,255,60,0.055)'; ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = 'rgba(60,60,255,0.055)'; ctx.fillRect(2, 0, 1, 1);
  });
  /* vignette */
  makeTex(scene, 'vignette', 384, 216, ctx => {
    const g = ctx.createRadialGradient(192, 108, 60, 192, 108, 232);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.80)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 384, 216);
  });
  /* solid 1x1 for tints/flashes */
  pixTex(scene, 'white', 1, 1, p => p.set(0, 0, C.white));
}

/* =========================================================================
   Registration
   ========================================================================= */
ART.sprites = function (scene) {
  /* ---- monk frames ---- */
  monkTex(scene, 'monk_idle0', { staff: 'idle', legs: 'stand' });
  monkTex(scene, 'monk_idle1', { staff: 'idle', legs: 'stand', bob: 1 });
  monkTex(scene, 'monk_walk0', { staff: 'walk', legs: 'walkA' });
  monkTex(scene, 'monk_walk1', { staff: 'walk', legs: 'walkB', bob: -1 });
  monkTex(scene, 'monk_walk2', { staff: 'walk', legs: 'walkC' });
  monkTex(scene, 'monk_walk3', { staff: 'walk', legs: 'walkB', bob: -1 });
  monkTex(scene, 'monk_jump',  { staff: 'air', legs: 'air', bob: -1 });
  monkTex(scene, 'monk_fall',  { staff: 'air', legs: 'air' });
  monkTex(scene, 'monk_land',  { staff: 'walk', legs: 'kneel', bob: 2 });
  monkTex(scene, 'monk_dash',  { staff: 'dash', legs: 'dash', bob: 1 });
  monkTex(scene, 'monk_atk0',  { staff: 'back', legs: 'walkB' });
  monkTex(scene, 'monk_atk1',  { staff: 'fwd',  legs: 'walkA' });
  monkTex(scene, 'monk_atk2',  { staff: 'down', legs: 'walkC' });
  monkTex(scene, 'monk_chg0',  { staff: 'up', legs: 'stand' });
  monkTex(scene, 'monk_chg1',  { staff: 'up', legs: 'stand', bob: -1 });
  monkTex(scene, 'monk_hurt',  { staff: 'air', legs: 'air', lean: -1 });

  /* ---- enemies ---- */
  for (let i = 0; i < 4; i++) demonTex(scene, 'demon' + i, i);
  houndTex(scene, 'hound0', 'idle');
  houndTex(scene, 'hound1', 'run');
  houndTex(scene, 'hound_tell', 'tell');
  impTex(scene, 'imp0', 'stand');
  impTex(scene, 'imp1', 'squat');
  statueTex(scene, 'statue0', false);
  statueTex(scene, 'statue1', true);
  bruteTex(scene, 'brute0', 'guard');
  bruteTex(scene, 'brute1', 'walk');
  bruteTex(scene, 'brute_slam', 'slam');
  batTex(scene, 'bat0', true);
  batTex(scene, 'bat1', false);

  /* ---- bosses ---- */
  generalTex(scene, 'gen0', 'idle');
  generalTex(scene, 'gen1', 'slam');
  generalTex(scene, 'gen2', 'throw');
  generalTex(scene, 'gen_hurt', 'hurt');
  for (let w = 0; w < 4; w++) dragonTex(scene, 'dragon' + w, { wing: w, mouth: 0 });
  dragonTex(scene, 'dragon_open', { wing: 1, mouth: 1 });
  dragonTex(scene, 'dragon_fire', { wing: 1, mouth: 2 });
  dragonTex(scene, 'dragon_hurt', { wing: 2, mouth: 1, hurt: true });

  buildProjectiles(scene);
  buildPickups(scene);
  buildFX(scene);
  buildUI(scene);
};

/* animation registration (needs an active scene with anims manager) */
ART.anims = function (scene) {
  anim(scene, 'monk-idle', ['monk_idle0', 'monk_idle1'], 2);
  anim(scene, 'monk-walk', ['monk_walk0', 'monk_walk1', 'monk_walk2', 'monk_walk3'], 10);
  anim(scene, 'monk-charge', ['monk_chg0', 'monk_chg1'], 12);
  anim(scene, 'demon-fly', ['demon0', 'demon1', 'demon2', 'demon3'], 10);
  anim(scene, 'hound-run', ['hound0', 'hound1'], 12);
  anim(scene, 'imp-hop', ['imp0', 'imp1'], 6);
  anim(scene, 'brute-walk', ['brute0', 'brute1'], 3);
  anim(scene, 'bat-fly', ['bat0', 'bat1'], 14);
  anim(scene, 'gen-idle', ['gen0', 'gen0', 'gen2'], 3);
  anim(scene, 'dragon-fly', ['dragon0', 'dragon1', 'dragon2', 'dragon3'], 7);
  anim(scene, 'scroll-spin', ['scroll0', 'scroll1', 'scroll2', 'scroll3'], 8);
  anim(scene, 'coin-spin', ['coin0', 'coin1', 'coin2', 'coin3'], 10);
  anim(scene, 'orb-pulse', ['orb0', 'orb1', 'orb2', 'orb3'], 8);
  anim(scene, 'fire-spin', ['fireball0', 'fireball1'], 12);
  anim(scene, 'dfire-spin', ['dfire0', 'dfire1'], 12);
  anim(scene, 'bolt-fly', ['bolt0', 'bolt1'], 14);
  anim(scene, 'blade-spin', ['blade0', 'blade1'], 16);
};

window.ART = ART;
window.drawMonk = drawMonk;
