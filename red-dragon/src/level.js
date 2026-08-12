/* =========================================================================
   level.js — the Great Wall, tile by tile.

   grid codes: 0 empty | 1 brick(solid) | 2 walkway(solid) |
               3 merlon(decor, walk behind) | 4 pillar(solid) | 5 plank(one-way)
   ========================================================================= */
'use strict';

const TS = 16;                 /* tile size */

function buildLevel() {
  const W = 462, H = 18;
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(0));

  const ents = [];       /* enemies, pickups, hazards, decor */
  const zones = [];      /* wind, triggers */
  const checkpoints = [];

  /* ---------- primitives ---------- */
  const solidCol = (x, top) => { for (let y = top + 1; y < H; y++) grid[y][x] = 1; };

  function ground(x0, w, top) {
    for (let x = x0; x < x0 + w; x++) { grid[top][x] = 2; solidCol(x, top); }
  }
  function merlons(x0, w, top, step) {
    step = step || 3;
    for (let x = x0; x < x0 + w; x += step) if (top - 1 >= 0) grid[top - 1][x] = 3;
  }
  function block(x0, y0, w, h, v) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (grid[y]) grid[y][x] = v;
  }
  function plank(x0, w, y) { for (let x = x0; x < x0 + w; x++) grid[y][x] = 5; }
  function ledge(x0, w, y) { for (let x = x0; x < x0 + w; x++) { grid[y][x] = 2; grid[y + 1][x] = 1; } }

  const E = (t, tx, ty, o) => { ents.push(Object.assign({ t, x: tx * TS + TS / 2, y: ty * TS + TS / 2 }, o || {})); };
  const Epx = (t, px, py, o) => { ents.push(Object.assign({ t, x: px, y: py }, o || {})); };

  const scroll  = (x, y) => E('scroll', x, y);
  const coin    = (x, y) => E('coin', x, y);
  const chi     = (x, y) => E('chi', x, y);
  const orb     = (x, y) => E('orb', x, y);
  const spikes  = (x, w, y) => { for (let i = 0; i < w; i++) E('spike', x + i, y); };
  const crumble = (x, w, y) => { for (let i = 0; i < w; i++) E('crumble', x + i, y); };
  const lantern = (x, y, len) => E('lantern', x, y, { len: len || 34 });
  const torch   = (x, y) => E('torch', x, y);
  const banner  = (x, y) => E('banner', x, y);
  const enemy   = (kind, x, y, o) => E(kind, x, y, o);
  const wind    = (x, y, w, h, dir) => zones.push({ t: 'wind', x: x * TS, y: y * TS, w: w * TS, h: h * TS, dir });
  const trigger = (id, x, y, w, h, o) => zones.push(Object.assign({ t: 'trigger', id, x: x * TS, y: y * TS, w: w * TS, h: h * TS }, o || {}));
  const check   = (x, y) => { checkpoints.push({ x: x * TS + 8, y: y * TS - 12 }); E('checkpoint', x, y - 1); };

  /** a sealed alcove built on the walkway; smash the talisman bricks to loot it */
  function alcove(x, top, loot) {
    const h = 3;
    block(x, top - h, 5, h, 1);
    grid[top - h][x + 0] = 2; grid[top - h][x + 1] = 2; grid[top - h][x + 2] = 2;
    grid[top - h][x + 3] = 2; grid[top - h][x + 4] = 2;
    block(x + 1, top - h + 1, 3, h - 1, 0);           /* hollow interior */
    grid[top - 1][x] = 0; grid[top - 2][x] = 0;       /* doorway, sealed by talismans */
    E('breakable', x, top - 1);
    E('breakable', x, top - 2);
    (loot || []).forEach((k, i) => E(k, x + 1 + i, top - 1));
    torch(x + 5, top - 1);
  }

  /* =====================================================================
     ACT I — DAWN ON THE WALL   (tiles 0 … 119)
     ===================================================================== */
  ground(0, 20, 12); merlons(0, 20, 12);
  check(3, 12);
  torch(6, 11); banner(13, 11);
  scroll(9, 10); scroll(11, 10); scroll(13, 10);
  enemy('demon', 16, 7);
  enemy('imp', 18, 11);

  /* gap 20..23 */
  plank(21, 3, 9);
  scroll(22, 8);
  ground(24, 16, 12); merlons(24, 16, 12);
  enemy('demon', 30, 6);
  enemy('hound', 35, 11);
  scroll(27, 10); scroll(28, 10);
  torch(33, 11);

  /* gap 40..43 */
  ground(44, 16, 11); merlons(44, 16, 11);
  scroll(46, 9);
  alcove(50, 11, ['coin', 'scroll', 'coin']);
  enemy('imp', 57, 10);
  enemy('demon', 58, 5);

  /* gap 60..62 */
  ground(63, 20, 12); merlons(63, 20, 12);
  enemy('statue', 66, 11);
  crumble(72, 3, 9);
  scroll(73, 8);
  enemy('demon', 77, 6);
  enemy('hound', 80, 11);
  banner(70, 11);
  check(68, 12);

  /* gap 83..86 */
  plank(84, 3, 10);
  ground(87, 18, 10); merlons(87, 18, 10);
  chi(88, 8);
  enemy('demon', 92, 5); enemy('demon', 96, 5);
  lantern(94, 4, 40);
  enemy('imp', 100, 9);
  scroll(102, 8); scroll(103, 8);
  torch(99, 9);

  /* gap 105..107 */
  ground(108, 12, 12); merlons(108, 12, 12);
  enemy('hound', 114, 11);
  scroll(117, 10);
  banner(111, 11);

  /* =====================================================================
     ACT II — DUSK PATROL   (tiles 120 … 249)   ends with the Jade General
     ===================================================================== */
  ground(120, 26, 12); merlons(120, 26, 12);
  check(122, 12);
  enemy('statue', 126, 11);
  enemy('hound', 132, 11);
  crumble(135, 4, 9);
  scroll(136, 8); scroll(137, 8);
  enemy('demon', 140, 6); enemy('demon', 143, 7);
  lantern(130, 4, 46); lantern(139, 4, 34);
  torch(128, 11); banner(134, 11);

  /* gap 146..149 */
  ground(150, 21, 12); merlons(150, 12, 12);
  enemy('brute', 156, 11);
  ledge(160, 5, 9);
  scroll(161, 8); scroll(162, 8); coin(163, 8);
  enemy('demon', 166, 5);
  enemy('imp', 168, 11);
  crumble(146, 4, 11);                       /* crumbling bridge over the gap */

  /* gap 171..174 */
  ground(175, 22, 11); merlons(175, 22, 11);
  enemy('statue', 178, 10);
  lantern(182, 3, 44); lantern(187, 3, 44); lantern(192, 3, 44);
  chi(185, 9);
  enemy('hound', 190, 10);
  alcove(193, 11, ['coin', 'coin', 'coin']);
  check(180, 11);

  /* gap 197..201 */
  plank(198, 4, 8);
  scroll(199, 7); scroll(200, 7);
  ground(202, 21, 12); merlons(202, 21, 12);
  wind(202, 6, 21, 6, -1);
  enemy('demon', 206, 6); enemy('demon', 210, 7); enemy('demon', 214, 5);
  enemy('statue', 218, 11);
  enemy('brute', 220, 11);
  scroll(208, 10); scroll(212, 10);
  torch(204, 11); torch(216, 11);

  /* --- Jade General arena 223..248 --- */
  ground(223, 26, 12); merlons(223, 26, 12, 2);
  block(223, 6, 1, 6, 4); block(248, 6, 1, 6, 4);
  banner(226, 11); banner(245, 11);
  torch(228, 11); torch(243, 11);
  trigger('miniboss', 228, 6, 2, 6, { arena: [223 * TS, 249 * TS] });
  enemy('general', 244, 10);
  chi(235, 8);

  /* =====================================================================
     ACT III — NIGHT WATCH   (tiles 250 … 394)
     ===================================================================== */
  ground(249, 24, 12); merlons(249, 24, 12);
  check(251, 12);
  enemy('batnest', 258, 6);
  enemy('imp', 262, 11); enemy('imp', 265, 11);
  scroll(255, 10); scroll(256, 10);
  crumble(268, 4, 9);
  scroll(269, 8); coin(270, 8);
  lantern(260, 3, 50);

  /* gap 273..277 */
  plank(274, 3, 9);
  ground(278, 19, 13); merlons(278, 19, 13);
  enemy('hound', 284, 12); enemy('hound', 290, 12);
  enemy('statue', 294, 12);
  scroll(281, 11); scroll(288, 11);
  torch(286, 12);

  /* shallow spike pit 297..301 — fall in and you can still hop back out */
  ground(297, 5, 14);
  spikes(297, 5, 13);
  ground(302, 21, 12); merlons(302, 21, 12);
  plank(298, 3, 10);
  coin(299, 9);
  enemy('batnest', 306, 6);
  enemy('brute', 312, 11);
  alcove(316, 12, ['coin', 'chi', 'coin']);
  check(304, 12);

  /* gap 323..327 */
  ground(328, 23, 11); merlons(328, 23, 11);
  wind(328, 4, 23, 7, 1);
  ledge(333, 4, 8);
  ledge(340, 4, 5);
  scroll(334, 7); scroll(341, 4); coin(342, 4);
  enemy('demon', 337, 6); enemy('demon', 345, 4);
  enemy('imp', 348, 10);
  lantern(331, 2, 40); lantern(344, 2, 40);
  orb(342, 3);

  /* gap 351..355 */
  plank(352, 4, 9);
  ground(356, 23, 12); merlons(356, 23, 12);
  enemy('statue', 359, 11); enemy('statue', 371, 11);
  enemy('brute', 365, 11);
  enemy('batnest', 368, 5);
  crumble(374, 4, 9);
  scroll(375, 8); scroll(376, 8);
  chi(362, 10);
  check(358, 12);

  /* gap 379..383 */
  ground(384, 11, 12); merlons(384, 11, 12);
  enemy('hound', 389, 11);
  enemy('demon', 392, 6);
  scroll(386, 10); scroll(387, 10); scroll(388, 10);

  /* =====================================================================
     ACT IV — THE RED DRAGON   (tiles 395 … 461)
     ===================================================================== */
  ground(395, 15, 12); merlons(395, 15, 12);
  check(397, 12);
  torch(400, 11); torch(406, 11);
  banner(403, 11);
  chi(404, 10);
  enemy('demon', 407, 6);

  /* the arena — a broad tower platform ringed with pillars */
  ground(410, 50, 12); merlons(410, 50, 12, 2);
  block(410, 4, 2, 8, 4);
  block(458, 4, 2, 8, 4);
  block(409, 4, 1, 9, 4);
  banner(413, 11); banner(455, 11);
  torch(416, 11); torch(452, 11);
  ledge(424, 5, 9);
  ledge(444, 5, 9);
  trigger('boss', 416, 5, 2, 7, { arena: [409 * TS, 460 * TS] });
  enemy('dragon', 445, 5);

  /* --------------------------------------------------------------- */
  const actOf = gx => (gx < 120 ? 0 : gx < 249 ? 1 : gx < 395 ? 2 : 3);

  /* merge solid tiles into row-wide collision rectangles.
     3 = merlon and 4 = pillar are architecture you walk behind, not into. */
  const solids = [], oneways = [];
  const isSolid = v => v === 1 || v === 2;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (isSolid(grid[y][x])) {
        let x2 = x; while (x2 < W && isSolid(grid[y][x2])) x2++;
        solids.push({ x: x * TS, y: y * TS, w: (x2 - x) * TS, h: TS });
        x = x2;
      } else if (grid[y][x] === 5) {
        let x2 = x; while (x2 < W && grid[y][x2] === 5) x2++;
        oneways.push({ x: x * TS, y: y * TS, w: (x2 - x) * TS, h: TS });
        x = x2;
      } else x++;
    }
  }

  return {
    W, H, TS,
    pxW: W * TS, pxH: H * TS,
    grid, ents, zones, checkpoints, solids, oneways, actOf,
    acts: [
      { name: 'DAWN ON THE WALL', from: 0, to: 120 * TS, sky: 'dawn' },
      { name: 'DUSK PATROL', from: 120 * TS, to: 249 * TS, sky: 'dusk' },
      { name: 'NIGHT WATCH', from: 249 * TS, to: 395 * TS, sky: 'night' },
      { name: 'THE RED DRAGON', from: 395 * TS, to: W * TS, sky: 'boss' }
    ],
    spawn: { x: 3 * TS + 8, y: 11 * TS }
  };
}

window.buildLevel = buildLevel;
window.TS = TS;
