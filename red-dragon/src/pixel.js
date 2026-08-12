/* =========================================================================
   pixel.js — the procedural pixel foundry.

   Every single graphic in this cartridge is generated here or by the art
   modules that use this API. No image files, no atlases, no fonts.
   ========================================================================= */
'use strict';

/* -------------------------------------------------------------------------
   Pix — a tiny indexed pixel canvas with NES-friendly operations.
   ------------------------------------------------------------------------- */
class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Array(w * h).fill(null);
  }
  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  set(x, y, c) {
    x |= 0; y |= 0;
    if (!this.inside(x, y)) return this;
    this.d[this.idx(x, y)] = c || null;
    return this;
  }
  get(x, y) { return this.inside(x, y) ? this.d[this.idx(x, y)] : null; }

  /** filled rectangle */
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  /** hollow rectangle */
  box(x, y, w, h, c) {
    for (let i = 0; i < w; i++) { this.set(x + i, y, c); this.set(x + i, y + h - 1, c); }
    for (let j = 0; j < h; j++) { this.set(x, y + j, c); this.set(x + w - 1, y + j, c); }
    return this;
  }
  /** bresenham line */
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** thick line (radius r in pixels) */
  fatline(x0, y0, x1, y1, c, r) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      this.disc(x, y, r, c);
    }
    return this;
  }
  /** filled circle */
  disc(cx, cy, r, c) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
      if (i * i + j * j <= r * r + r * 0.5) this.set(cx + i, cy + j, c);
    return this;
  }
  ring(cx, cy, r, c) {
    for (let a = 0; a < 360; a += 4) {
      const rad = a * Math.PI / 180;
      this.set(Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), c);
    }
    return this;
  }
  /** filled ellipse */
  ellipse(cx, cy, rx, ry, c) {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
      const u = i / (rx + 0.001), v = j / (ry + 0.001);
      if (u * u + v * v <= 1.05) this.set(cx + i, cy + j, c);
    }
    return this;
  }
  /** filled triangle */
  tri(ax, ay, bx, by, cx2, cy2, c) {
    const minx = Math.min(ax, bx, cx2), maxx = Math.max(ax, bx, cx2);
    const miny = Math.min(ay, by, cy2), maxy = Math.max(ay, by, cy2);
    const sign = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const d1 = sign(x, y, ax, ay, bx, by);
      const d2 = sign(x, y, bx, by, cx2, cy2);
      const d3 = sign(x, y, cx2, cy2, ax, ay);
      const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      if (!(neg && pos)) this.set(x, y, c);
    }
    return this;
  }

  /** replace every occurrence of one colour */
  swap(from, to) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to;
    return this;
  }
  /** recolour every opaque pixel */
  tintAll(c) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i]) this.d[i] = c;
    return this;
  }

  /** hard 1px outline around every opaque cluster — the NES signature */
  outline(c, diagonal) {
    const copy = this.d.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : copy[y * this.w + x];
    const dirs = diagonal
      ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      : [[1,0],[-1,0],[0,1],[0,-1]];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (at(x, y)) continue;
      for (const [dx, dy] of dirs) {
        if (at(x + dx, y + dy)) { this.set(x, y, c); break; }
      }
    }
    return this;
  }

  /** rim light: opaque pixels whose neighbour in (dx,dy) is empty get `c` */
  rim(c, dx, dy) {
    const copy = this.d.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : copy[y * this.w + x];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!at(x, y)) continue;
      if (!at(x + dx, y + dy)) this.set(x, y, c);
    }
    return this;
  }

  /** vertical gradient applied only to pixels currently equal to `base` */
  ramp(base, top, bottom) {
    let minY = this.h, maxY = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (this.get(x, y) === base) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxY < 0) return this;
    const span = Math.max(1, maxY - minY);
    for (let y = minY; y <= maxY; y++) {
      const col = mix(top, bottom, (y - minY) / span);
      for (let x = 0; x < this.w; x++) if (this.get(x, y) === base) this.set(x, y, col);
    }
    return this;
  }

  /** mirror horizontally (returns a new Pix) */
  flipX() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      p.set(this.w - 1 - x, y, this.get(x, y));
    return p;
  }
  /** stamp another Pix on top */
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) this.set(x + ox, y + oy, c);
    }
    return this;
  }
  clone() { const p = new Pix(this.w, this.h); p.d = this.d.slice(); return p; }

  /** paint rows of a char-map using a char→colour dictionary */
  map(rows, dict, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        this.set(ox + x, oy + y, dict[ch] || null);
      }
    }
    return this;
  }

  draw(ctx) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.d[y * this.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
    return this;
  }
}

/* -------------------------------------------------------------------------
   Texture helpers
   ------------------------------------------------------------------------- */
function makeTex(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h);
  const ctx = t.getContext();
  ctx.imageSmoothingEnabled = false;
  fn(ctx, t);
  t.refresh();
  return t;
}

/** build a texture from a Pix drawing function */
function pixTex(scene, key, w, h, fn) {
  const p = new Pix(w, h);
  fn(p);
  makeTex(scene, key, w, h, ctx => p.draw(ctx));
  return p;
}

/** build a texture from an already-made Pix */
function pixToTex(scene, key, p) {
  makeTex(scene, key, p.w, p.h, ctx => p.draw(ctx));
  return p;
}

/** register a frame-by-frame animation built from separate texture keys */
function anim(scene, key, keys, rate, repeat) {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: keys.map(k => ({ key: k })),
    frameRate: rate,
    repeat: repeat === undefined ? -1 : repeat
  });
}

/* deterministic RNG so the "cartridge" always looks identical ------------- */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================================
   5x7 bitmap font — ASCII 32..95, packed as 7 rows of 5 bits each.
   Rendered into a canvas atlas and handed to Phaser's RetroFont parser.
   ========================================================================= */
const FONT57 = [
  [0,0,0,0,0,0,0],        /*   */ [4,4,4,4,4,0,4],       /* ! */
  [10,10,0,0,0,0,0],      /* " */ [0,10,31,10,31,10,0],  /* # */
  [4,15,20,14,5,30,4],    /* $ */ [25,26,2,4,8,11,19],   /* % */
  [12,18,20,8,21,18,13],  /* & */ [4,4,0,0,0,0,0],       /* ' */
  [2,4,8,8,8,4,2],        /* ( */ [8,4,2,2,2,4,8],       /* ) */
  [0,4,21,14,21,4,0],     /* * */ [0,4,4,31,4,4,0],      /* + */
  [0,0,0,0,0,4,8],        /* , */ [0,0,0,31,0,0,0],      /* - */
  [0,0,0,0,0,12,12],      /* . */ [1,2,2,4,8,8,16],      /* / */
  [14,17,19,21,25,17,14], /* 0 */ [4,12,4,4,4,4,14],     /* 1 */
  [14,17,1,2,4,8,31],     /* 2 */ [31,2,4,2,1,17,14],    /* 3 */
  [2,6,10,18,31,2,2],     /* 4 */ [31,16,30,1,1,17,14],  /* 5 */
  [6,8,16,30,17,17,14],   /* 6 */ [31,1,2,4,8,8,8],      /* 7 */
  [14,17,17,14,17,17,14], /* 8 */ [14,17,17,15,1,2,12],  /* 9 */
  [0,12,12,0,12,12,0],    /* : */ [0,12,12,0,12,4,8],    /* ; */
  [2,4,8,16,8,4,2],       /* < */ [0,0,31,0,31,0,0],     /* = */
  [8,4,2,1,2,4,8],        /* > */ [14,17,1,2,4,0,4],     /* ? */
  [14,17,1,13,21,21,14],  /* @ */ [14,17,17,31,17,17,17],/* A */
  [30,17,17,30,17,17,30], /* B */ [14,17,16,16,16,17,14],/* C */
  [28,18,17,17,17,18,28], /* D */ [31,16,16,30,16,16,31],/* E */
  [31,16,16,30,16,16,16], /* F */ [14,17,16,23,17,17,15],/* G */
  [17,17,17,31,17,17,17], /* H */ [14,4,4,4,4,4,14],     /* I */
  [7,2,2,2,2,18,12],      /* J */ [17,18,20,24,20,18,17],/* K */
  [16,16,16,16,16,16,31], /* L */ [17,27,21,21,17,17,17],/* M */
  [17,25,25,21,19,19,17], /* N */ [14,17,17,17,17,17,14],/* O */
  [30,17,17,30,16,16,16], /* P */ [14,17,17,17,21,18,13],/* Q */
  [30,17,17,30,20,18,17], /* R */ [15,16,16,14,1,1,30],  /* S */
  [31,4,4,4,4,4,4],       /* T */ [17,17,17,17,17,17,14],/* U */
  [17,17,17,17,17,10,4],  /* V */ [17,17,17,21,21,27,17],/* W */
  [17,17,10,4,10,17,17],  /* X */ [17,17,10,4,4,4,4],    /* Y */
  [31,1,2,4,8,16,31],     /* Z */ [14,8,8,8,8,8,14],     /* [ */
  [16,8,8,4,2,2,1],       /* \ */ [14,2,2,2,2,2,14],     /* ] */
  [4,10,17,0,0,0,0],      /* ^ */ [0,0,0,0,0,0,31]       /* _ */
];

const FONT_CHARS = (() => { let s = ''; for (let i = 32; i <= 95; i++) s += String.fromCharCode(i); return s; })();

/**
 * Build a retro bitmap font texture + register it under `key`.
 * Cells are 6x8 (5x7 glyph + 1px advance).
 */
function buildFont(scene, key, colour, shadow) {
  const CW = 6, CH = 8, N = FONT57.length;
  makeTex(scene, key, CW * N, CH, ctx => {
    for (let g = 0; g < N; g++) {
      const rows = FONT57[g], ox = g * CW;
      if (shadow) {
        ctx.fillStyle = shadow;
        for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++)
          if (rows[y] & (1 << (4 - x))) ctx.fillRect(ox + x + 1, y + 1, 1, 1);
      }
      ctx.fillStyle = colour;
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++)
        if (rows[y] & (1 << (4 - x))) ctx.fillRect(ox + x, y, 1, 1);
    }
  });

  const cfg = {
    image: key,
    width: CW, height: CH,
    chars: FONT_CHARS,
    charsPerRow: N,
    'offset.x': 0, 'offset.y': 0,
    'spacing.x': 0, 'spacing.y': 0
  };
  scene.cache.bitmapFont.add(key, Phaser.GameObjects.RetroFont.Parse(scene, cfg));
}

/** convenience: pixel-font text object */
function txt(scene, x, y, str, opts) {
  opts = opts || {};
  const t = scene.add.bitmapText(x, y, opts.font || 'fnt', String(str).toUpperCase(), 8);
  if (opts.tint !== undefined) t.setTint(opts.tint);
  if (opts.origin !== undefined) t.setOrigin(opts.origin, opts.originY === undefined ? opts.origin : opts.originY);
  if (opts.scale) t.setScale(opts.scale);
  t.setLetterSpacing(opts.ls === undefined ? 0 : opts.ls);
  return t;
}

window.Pix = Pix;
window.makeTex = makeTex; window.pixTex = pixTex; window.pixToTex = pixToTex;
window.anim = anim; window.mulberry = mulberry;
window.buildFont = buildFont; window.txt = txt;
