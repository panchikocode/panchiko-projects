/* =========================================================================
   art_world.js — tiles, parallax layers, sky ramps, decor, title art.
   Everything painted procedurally at boot.
   ========================================================================= */
'use strict';

/* Per-act stone palettes: dawn, dusk, night, boss arena. */
const ACT_STONE = [
  { m: '#2a2118', a: '#6b5b45', b: '#8a7659', c: '#a89076', d: '#c9b18f', moss: '#4a5a32' },
  { m: '#2a1418', a: '#63483f', b: '#7e5a4c', c: '#9a6d59', d: '#bd8666', moss: '#5a3a2a' },
  { m: '#12141f', a: '#333b52', b: '#454e69', c: '#5b6685', d: '#7885a8', moss: '#26404a' },
  { m: '#180509', a: '#4a1a1c', b: '#631f22', c: '#7d2a28', d: '#9c3a33', moss: '#3a1216' }
];

const ART_W = {};

/* ---------------------------------------------------------------------
   Tile factory — returns a Pix for a given tile kind / act / variant.
   --------------------------------------------------------------------- */
function tilePix(kind, act, v) {
  const P = ACT_STONE[act];
  const p = new Pix(16, 16);
  const rnd = mulberry(kind.charCodeAt(0) * 977 + act * 131 + v * 17);

  const brickBody = (yTop) => {
    p.rect(0, yTop, 16, 16 - yTop, P.a);
    /* two courses of brick with staggered joints */
    for (let row = 0; row < 4; row++) {
      const y = yTop + row * 4;
      if (y >= 16) break;
      const off = (row % 2) ? 0 : 8;
      p.rect(0, y, 16, 3, P.b);
      /* face shading */
      p.rect(0, y, 16, 1, P.c);
      p.rect(0, y + 2, 16, 1, P.a);
      /* mortar */
      p.rect(0, y + 3, 16, 1, P.m);
      p.rect(off, y, 1, 3, P.m);
      p.rect((off + 8) % 16, y, 1, 3, P.m);
      /* speckle */
      for (let s = 0; s < 3; s++) {
        const sx = Math.floor(rnd() * 16), sy = y + Math.floor(rnd() * 3);
        p.set(sx, sy, rnd() > 0.5 ? P.d : P.a);
      }
    }
  };

  switch (kind) {
    case 'brick':
      brickBody(0);
      break;

    case 'top': {
      brickBody(4);
      /* paved walkway cap */
      p.rect(0, 0, 16, 4, P.c);
      p.rect(0, 0, 16, 1, P.d);
      p.rect(0, 3, 16, 1, P.m);
      for (let i = 0; i < 16; i += 5) p.rect((i + v * 2) % 16, 0, 1, 3, P.b);
      /* moss / weathering */
      if (v % 2 === 0) { p.set(3, 1, P.moss); p.set(4, 1, P.moss); p.set(11, 2, P.moss); }
      break;
    }

    case 'merlon': {
      /* crenellation block sitting on the walkway */
      p.rect(0, 6, 16, 10, P.b);
      p.rect(0, 6, 16, 1, P.d);
      p.rect(0, 9, 16, 1, P.m);
      p.rect(0, 13, 16, 1, P.m);
      p.rect(7, 6, 1, 10, P.m);
      /* arrow slit */
      p.rect(7, 10, 2, 4, C.ink);
      p.set(7, 10, P.a);
      break;
    }

    case 'crumble': {
      brickBody(0);
      /* cracks */
      p.line(2, 0, 6, 15, P.m); p.line(3, 0, 7, 15, C.ink);
      p.line(12, 0, 9, 15, P.m);
      p.line(0, 7, 15, 9, P.m);
      p.set(5, 5, C.ink); p.set(10, 11, C.ink); p.set(8, 3, C.ink);
      p.rect(0, 0, 16, 1, C.gold1);   /* warning trim */
      break;
    }

    case 'breakable': {
      brickBody(0);
      /* sealed with a red talisman */
      p.rect(4, 2, 8, 12, C.cream3);
      p.rect(4, 2, 8, 1, C.cream1);
      p.rect(4, 13, 8, 1, C.cream1);
      p.rect(5, 4, 6, 1, C.red2);
      p.rect(5, 6, 6, 1, C.red2);
      p.rect(7, 4, 2, 8, C.red2);
      p.rect(5, 11, 6, 1, C.red2);
      p.set(4, 2, C.gold3); p.set(11, 2, C.gold3);
      p.set(4, 13, C.gold3); p.set(11, 13, C.gold3);
      break;
    }

    case 'spike': {
      /* iron caltrops on a base */
      p.rect(0, 12, 16, 4, P.a);
      p.rect(0, 12, 16, 1, P.b);
      for (let i = 0; i < 4; i++) {
        const x = i * 4 + 2;
        p.tri(x - 2, 12, x, 1, x + 2, 12, C.st3);
        p.line(x, 1, x, 12, C.st5);
        p.line(x - 1, 6, x - 1, 12, C.st2);
        p.set(x, 0, C.white);
        p.set(x + 1, 3, C.st1);
      }
      p.rect(0, 15, 16, 1, C.ink);
      break;
    }

    case 'pillar': {
      p.rect(3, 0, 10, 16, P.b);
      p.rect(3, 0, 2, 16, P.c);
      p.rect(11, 0, 2, 16, P.a);
      for (let y = 2; y < 16; y += 4) p.rect(3, y, 10, 1, P.m);
      break;
    }

    case 'plank': {
      p.rect(0, 0, 16, 6, C.earth2);
      p.rect(0, 0, 16, 1, C.earth3);
      p.rect(0, 5, 16, 1, C.earth0);
      p.rect(4, 0, 1, 6, C.earth1); p.rect(11, 0, 1, 6, C.earth1);
      p.set(2, 2, C.earth1); p.set(13, 3, C.earth1);
      break;
    }
  }
  return p;
}

/* small cache of tile canvases for fast level painting */
function tileCanvas(kind, act, v) {
  const key = kind + act + v;
  if (tileCanvas.cache[key]) return tileCanvas.cache[key];
  const p = tilePix(kind, act, v);
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const ctx = cv.getContext('2d');
  p.draw(ctx);
  tileCanvas.cache[key] = cv;
  return cv;
}
tileCanvas.cache = {};

/* ---------------------------------------------------------------------
   Paint the whole level grid into one big canvas texture.
   grid values: 0 empty | 1 brick | 2 top | 3 merlon | 4 pillar | 5 plank
   --------------------------------------------------------------------- */
ART_W.paintLevel = function (scene, keyBase, grid, W, H, actOf, chunkTiles) {
  chunkTiles = chunkTiles || 120;                 /* 1920px — safe on every GPU */
  const chunks = [];
  for (let c0 = 0; c0 < W; c0 += chunkTiles) {
    const cw = Math.min(chunkTiles, W - c0);
    const key = keyBase + (c0 / chunkTiles);
    makeTex(scene, key, cw * 16, H * 16, ctx => {
      ctx.clearRect(0, 0, cw * 16, H * 16);
      for (let gy = 0; gy < H; gy++) {
        for (let i = 0; i < cw; i++) {
          const gx = c0 + i;
          const t = grid[gy][gx];
          if (!t) continue;
          const act = actOf(gx);
          const v = (gx * 7 + gy * 13) % 4;
          let kind = 'brick';
          if (t === 2) kind = 'top';
          else if (t === 3) kind = 'merlon';
          else if (t === 4) kind = 'pillar';
          else if (t === 5) kind = 'plank';
          ctx.drawImage(tileCanvas(kind, act, v), i * 16, gy * 16);
        }
      }
      /* darken the deep interior so the wall reads as one solid mass */
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createLinearGradient(0, 0, 0, H * 16);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw * 16, H * 16);
      ctx.globalCompositeOperation = 'source-over';
    });
    chunks.push({ key, x: c0 * 16 });
  }
  return chunks;
};

/* ---------------------------------------------------------------------
   Dynamic / decorative tile sprites
   --------------------------------------------------------------------- */
ART_W.decor = function (scene) {
  for (let a = 0; a < 4; a++) {
    pixToTex(scene, 'tile_crumble' + a, tilePix('crumble', a, 0));
    pixToTex(scene, 'tile_break' + a, tilePix('breakable', a, 0));
    pixToTex(scene, 'tile_spike' + a, tilePix('spike', a, 0));
    pixToTex(scene, 'tile_top' + a, tilePix('top', a, 1));
    pixToTex(scene, 'tile_plank' + a, tilePix('plank', a, 0));
  }

  /* hanging lantern, 14x18 — 2 frames of flame */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'lantern' + f, 14, 20, p => {
      p.rect(6, 0, 2, 3, C.earth1);                    /* hook */
      p.rect(3, 3, 8, 1, C.gold2);
      p.ellipse(7, 9, 5, 6, C.red3);
      p.ellipse(7, 9, 4, 5, C.red4);
      p.ellipse(6, 8, 3, 4, C.or3);
      p.ellipse(6, 8, 2, 3, C.or4 );
      /* ribs */
      p.rect(2, 9, 11, 1, C.red1);
      p.line(7, 3, 7, 15, C.red1);
      p.rect(3, 4, 9, 1, C.gold3);
      p.rect(3, 14, 9, 1, C.gold3);
      /* flame core */
      const fh = f ? 3 : 2;
      p.ellipse(7, 9, 2, fh, C.fireHot);
      p.set(7, 9, C.fireCore);
      /* tassel */
      p.rect(6, 15, 2, 3, C.gold2);
      p.rect(5, 18, 4, 2, C.red2);
      p.outline(C.ink);
    });
  }

  /* banner, 12x40 — 3 sway frames */
  for (let f = 0; f < 3; f++) {
    pixTex(scene, 'banner' + f, 14, 40, p => {
      p.rect(0, 0, 14, 2, C.earth1);
      for (let y = 2; y < 38; y++) {
        const s = Math.round(Math.sin(y * 0.22 + f * 2.1) * (1 + y * 0.045));
        p.rect(3 + s, y, 8, 1, C.red2);
        p.set(3 + s, y, C.red1);
        p.set(10 + s, y, C.red3);
        if (y % 8 === 4) p.rect(4 + s, y, 6, 1, C.gold2);
      }
      /* glyph blocks */
      for (let k = 0; k < 3; k++) {
        const y = 8 + k * 10;
        const s = Math.round(Math.sin(y * 0.22 + f * 2.1) * (1 + y * 0.045));
        p.rect(5 + s, y, 4, 1, C.gold4);
        p.rect(6 + s, y + 1, 2, 3, C.gold4);
        p.rect(5 + s, y + 4, 4, 1, C.gold4);
      }
      /* fringe */
      for (let x = 3; x < 11; x += 2) p.rect(x, 38, 1, 2, C.gold3);
      p.outline(C.ink);
    });
  }

  /* wall torch 10x16, 2 frames */
  for (let f = 0; f < 2; f++) {
    pixTex(scene, 'torch' + f, 10, 16, p => {
      p.rect(4, 6, 2, 10, C.earth1);
      p.rect(3, 5, 4, 2, C.st2);
      const h = f ? 5 : 4;
      p.ellipse(5, 4, 3, h - 1, C.fire);
      p.ellipse(5, 4, 2, h - 2, C.or4);
      p.ellipse(5, 3, 1, h - 3, C.fireHot);
      p.set(5, 1, C.fireCore);
      p.outline(C.ink);
    });
  }

  /* foreground grass tuft strip, tileable 64x18, 3 sway frames */
  for (let f = 0; f < 3; f++) {
    pixTex(scene, 'grass' + f, 64, 18, p => {
      const rnd = mulberry(4242);
      for (let i = 0; i < 46; i++) {
        const x = Math.floor(rnd() * 64);
        const h = 5 + Math.floor(rnd() * 11);
        const bend = Math.round(Math.sin(i * 1.7 + f * 2.0) * 2);
        const col = rnd() > 0.55 ? C.earth1 : C.earth0;
        for (let y = 0; y < h; y++) {
          const bx = x + Math.round(bend * (y / h));
          p.set(bx, 17 - y, y > h - 3 ? C.earth2 : col);
        }
      }
      p.rect(0, 16, 64, 2, C.ink);
    });
  }
};

/* ---------------------------------------------------------------------
   Sky ramps, moon, mountains, distant wall, fog, stars
   --------------------------------------------------------------------- */
ART_W.backgrounds = function (scene) {
  const names = ['dawn', 'dusk', 'night', 'boss'];
  names.forEach(n => {
    makeTex(scene, 'sky_' + n, 8, 216, ctx => {
      const ramp = C.sky[n];
      const g = ctx.createLinearGradient(0, 0, 0, 216);
      ramp.forEach((c, i) => g.addColorStop(i / (ramp.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 216);
    });
  });

  /* stars — tileable field */
  makeTex(scene, 'stars', 384, 160, ctx => {
    const rnd = mulberry(7331);
    ctx.clearRect(0, 0, 384, 160);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rnd() * 384), y = Math.floor(rnd() * 160);
      const b = rnd();
      ctx.fillStyle = b > 0.93 ? '#ffffff' : (b > 0.7 ? '#c9d8ff' : '#7a86b8');
      const s = b > 0.93 ? 2 : 1;
      ctx.fillRect(x, y, s, s);
      if (b > 0.97) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  });

  /* moon disc with craters */
  pixTex(scene, 'moon', 48, 48, p => {
    const rnd = mulberry(90210);
    p.ellipse(24, 24, 22, 22, C.gold3);
    p.ellipse(22, 22, 20, 20, C.gold4);
    p.ellipse(20, 20, 16, 16, C.gold5);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 17;
      const x = 24 + Math.cos(a) * r, y = 24 + Math.sin(a) * r;
      p.disc(Math.round(x), Math.round(y), 1 + Math.floor(rnd() * 2), rnd() > 0.5 ? C.gold3 : C.gold2);
    }
    p.rim(C.cream3, -1, -1);
  });

  /* --- mountain silhouettes via midpoint displacement --------------- */
  const ridge = (seed, w, h, rough, base) => {
    const pts = new Array(w).fill(0);
    let step = w - 1, amp = h * 0.55;
    const rnd = mulberry(seed);
    pts[0] = base; pts[w - 1] = base;
    while (step > 1) {
      const half = step >> 1;
      for (let i = half; i < w; i += step) {
        pts[i] = (pts[i - half] + pts[Math.min(w - 1, i + half)]) / 2 + (rnd() - 0.5) * amp;
      }
      amp *= rough; step = half;
    }
    return pts.map(v => Math.max(4, Math.min(h - 2, v)));
  };

  const mountainTex = (key, w, h, seed, colFar, colNear, snow, rough) => {
    makeTex(scene, key, w, h, ctx => {
      ctx.clearRect(0, 0, w, h);
      const r = ridge(seed, w, h, rough || 0.55, h * 0.55);
      for (let x = 0; x < w; x++) {
        const top = Math.round(h - r[x]);
        ctx.fillStyle = colNear;
        ctx.fillRect(x, top, 1, h - top);
        ctx.fillStyle = colFar;
        ctx.fillRect(x, top, 1, 2);
        /* lit western face */
        if (x > 0) {
          const prev = Math.round(h - r[x - 1]);
          if (top < prev) { ctx.fillStyle = colFar; ctx.fillRect(x, top, 1, Math.min(6, prev - top)); }
        }
        if (snow && top < h * 0.34) {
          ctx.fillStyle = snow;
          ctx.fillRect(x, top, 1, 1 + ((x % 3) === 0 ? 2 : 1));
        }
      }
    });
  };

  mountainTex('mtn_far', 512, 110, 1234, '#3a3550', '#221f36', '#6b6a90', 0.52);
  mountainTex('mtn_mid', 512, 130, 8899, '#2a2035', '#171223', '#4a4060', 0.58);

  /* distant Great Wall ribbon with signal towers */
  makeTex(scene, 'wall_far', 512, 96, ctx => {
    ctx.clearRect(0, 0, 512, 96);
    const rnd = mulberry(555);
    const r = ridge(4321, 512, 60, 0.5, 26);
    const base = '#151020', edge = '#241c33';
    for (let x = 0; x < 512; x++) {
      const top = Math.round(70 - r[x] * 0.5);
      ctx.fillStyle = base; ctx.fillRect(x, top, 1, 96 - top);
      ctx.fillStyle = edge; ctx.fillRect(x, top, 1, 2);
      /* crenellations */
      if (x % 6 < 3) { ctx.fillStyle = base; ctx.fillRect(x, top - 3, 1, 3); ctx.fillStyle = edge; ctx.fillRect(x, top - 3, 1, 1); }
    }
    /* towers */
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(28 + rnd() * 460);
      const top = Math.round(70 - r[x] * 0.5) - 22;
      ctx.fillStyle = base; ctx.fillRect(x - 9, top, 18, 34);
      ctx.fillStyle = edge; ctx.fillRect(x - 9, top, 18, 2);
      /* pagoda roof */
      ctx.fillStyle = edge;
      ctx.fillRect(x - 13, top - 4, 26, 3);
      ctx.fillRect(x - 10, top - 7, 20, 3);
      ctx.fillRect(x - 6, top - 10, 12, 3);
      /* lit window */
      ctx.fillStyle = 'rgba(255,170,70,0.85)';
      ctx.fillRect(x - 2, top + 8, 4, 5);
    }
  });

  /* fog band — soft, tileable */
  makeTex(scene, 'fog', 384, 72, ctx => {
    ctx.clearRect(0, 0, 384, 72);
    const rnd = mulberry(202);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 384, y = rnd() * 72, rw = 40 + rnd() * 90, rh = 6 + rnd() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rw / 2);
      g.addColorStop(0, 'rgba(190,180,210,0.13)');
      g.addColorStop(1, 'rgba(190,180,210,0)');
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, rh / (rw / 2)); ctx.beginPath();
      ctx.arc(0, 0, rw / 2, 0, 7); ctx.fill(); ctx.restore();
    }
  });

  /* cloud band for dawn/dusk */
  makeTex(scene, 'clouds', 384, 64, ctx => {
    ctx.clearRect(0, 0, 384, 64);
    const rnd = mulberry(616);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 384, y = 8 + rnd() * 44, w = 30 + rnd() * 70, h = 3 + rnd() * 5;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(60,30,50,0.55)' : 'rgba(90,45,60,0.45)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,170,110,0.20)';
      ctx.fillRect(x, y, w, 1);
    }
  });
};

/* ---------------------------------------------------------------------
   Chinese title glyphs — rasterised from a system font, then hard-
   thresholded onto the pixel grid so they read as 8-bit tiles.
   --------------------------------------------------------------------- */
ART_W.hanzi = function (scene, key, text, size, fillA, fillB, outlineCol) {
  const n = text.length;
  const off = document.createElement('canvas');
  off.width = size * n; off.height = size;
  const c = off.getContext('2d');
  c.clearRect(0, 0, off.width, off.height);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '900 ' + Math.round(size * 0.92) + 'px "Noto Serif TC","Noto Sans TC","Microsoft JhengHei","PMingLiU","SimHei","Yu Gothic",serif';
  for (let i = 0; i < n; i++) c.fillText(text[i], i * size + size / 2, size / 2 + 1);

  const img = c.getImageData(0, 0, off.width, off.height).data;
  const p = new Pix(off.width + 2, off.height + 2);
  for (let y = 0; y < off.height; y++) for (let x = 0; x < off.width; x++) {
    const a = img[(y * off.width + x) * 4 + 3];
    if (a > 105) p.set(x + 1, y + 1, mix(fillA, fillB, y / off.height));
  }
  p.rim(C.gold5, 0, -1);
  p.outline(outlineCol || C.ink, true);
  pixToTex(scene, key, p);
  return p;
};

/* ---------------------------------------------------------------------
   Cartridge label frame used by title / game-over / victory screens.
   --------------------------------------------------------------------- */
ART_W.cartridge = function (scene) {
  const W = 300, H = 168;
  pixTex(scene, 'cart', W, H, p => {
    /* plastic shell */
    p.rect(0, 0, W, H, C.red0);
    p.rect(2, 2, W - 4, H - 4, C.red1);
    p.rect(4, 4, W - 8, H - 8, C.ink);
    /* label paper */
    p.rect(10, 10, W - 20, H - 34, C.cream2);
    p.rect(12, 12, W - 24, H - 38, C.cream3);
    /* label border */
    p.box(12, 12, W - 24, H - 38, C.red2);
    p.box(14, 14, W - 28, H - 42, C.gold2);
    /* corner seals */
    [[16, 16], [W - 22, 16], [16, H - 30], [W - 22, H - 30]].forEach(([x, y]) => {
      p.rect(x, y, 6, 6, C.red2); p.rect(x + 1, y + 1, 4, 4, C.gold3); p.set(x + 2, y + 2, C.red1);
    });
    /* bottom ridges — the cartridge grip */
    for (let x = 20; x < W - 20; x += 6) p.rect(x, H - 20, 3, 12, C.red0);
    p.rect(0, H - 22, W, 1, C.red2);
    p.outline(C.black);
  });
};

/* ---------------------------------------------------------------------
   Boot entry
   --------------------------------------------------------------------- */
ART_W.all = function (scene) {
  ART_W.decor(scene);
  ART_W.backgrounds(scene);
  ART_W.cartridge(scene);
  ART_W.hanzi(scene, 'title_hanzi', '紅龍傳說', 34, C.gold5, C.gold2, C.red1);
  ART_W.hanzi(scene, 'gameover_hanzi', '終', 40, C.red4, C.red2, C.ink);
  ART_W.hanzi(scene, 'victory_hanzi', '勝', 40, C.gold4, C.gold2, C.ink);
  ART_W.hanzi(scene, 'boss_hanzi', '紅龍', 30, C.red5, C.red2, C.ink);
  ART_W.hanzi(scene, 'gen_hanzi', '玉將', 24, C.jade3, C.jade1, C.ink);
};

window.ART_W = ART_W;
window.ACT_STONE = ACT_STONE;
