/* =========================================================================
   scenes.js — boot, title, the Wall itself, the HUD, and the end cards.
   ========================================================================= */
'use strict';

const VW = 384, VH = 216;

/* how far past the viewport things keep working. the level is 7392px wide,
   so without these every torch, lantern and enemy on the map animates and
   spits particles every frame, off-screen, forever. */
const CULL = 96;    /* decor */
const SLEEP = VW;   /* enemy AI + physics */

function lerpColor(a, b, t) {
  const A = Phaser.Display.Color.IntegerToColor(a), B = Phaser.Display.Color.IntegerToColor(b);
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(A, B, 100, t * 100);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

const ACT_LOOK = [
  { mtn: 0x9a7a86, wall: 0x7a6070, fog: 0xffbf95, stars: 0.20, clouds: 0.85, moon: 0xffe6a8, amb: 0x2a1520 },
  { mtn: 0x8a5560, wall: 0x5a3644, fog: 0xff9a68, stars: 0.55, clouds: 0.75, moon: 0xffcf7a, amb: 0x2a0d18 },
  { mtn: 0x6a7aa8, wall: 0x3c4472, fog: 0xa4b0e0, stars: 1.00, clouds: 0.30, moon: 0xfff2c0, amb: 0x0c1030 },
  { mtn: 0x9a4038, wall: 0x60181e, fog: 0xff7050, stars: 0.60, clouds: 0.55, moon: 0xff9a6a, amb: 0x2e0408 }
];

/* =========================================================================
   BOOT — mints every texture
   ========================================================================= */
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    const el = document.getElementById('boot');

    /* minting every texture takes a while; do it one stage per frame so the
       browser can still paint, instead of freezing on a dead screen */
    const stages = [
      ['FONT',    () => buildFont(this, 'fnt', C.cream3, C.ink)],
      ['SPRITES', () => ART.sprites(this)],
      ['WORLD',   () => ART_W.all(this)],
      ['ANIMS',   () => ART.anims(this)]
    ];

    let i = 0;
    const step = () => {
      if (i >= stages.length) {
        if (el) el.remove();
        this.scene.start('title');
        return;
      }
      const [label, fn] = stages[i];
      if (el) el.textContent = 'MINTING ' + label + '… ' +
        Math.round(i / stages.length * 100) + '%';
      /* yield one frame so the label above actually reaches the screen */
      this.time.delayedCall(0, () => { fn(); i++; step(); });
    };
    step();
  }
}

/* =========================================================================
   TITLE
   ========================================================================= */
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.cameras.main.setBackgroundColor('#05040a');

    /* sky + stars + moon */
    this.add.image(0, 0, 'sky_night').setOrigin(0).setDisplaySize(VW, VH).setDepth(0);
    this.stars = this.add.tileSprite(0, 0, VW, 150, 'stars').setOrigin(0).setDepth(1).setAlpha(0.9);
    this.add.image(300, 44, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setTint(0xffe6a0).setAlpha(0.5).setDepth(2);
    this.moon = this.add.image(300, 44, 'moon').setDepth(3);
    this.mtn = this.add.tileSprite(0, 96, VW, 110, 'mtn_far').setOrigin(0).setDepth(4).setTint(0x4a4a72);
    this.wall = this.add.tileSprite(0, 128, VW, 96, 'wall_far').setOrigin(0).setDepth(5).setTint(0x2a2a48);
    this.fog = this.add.tileSprite(0, 150, VW, 72, 'fog').setOrigin(0).setDepth(6).setAlpha(0.7);

    /* ground band */
    this.add.rectangle(0, 196, VW, 24, 0x0a0710).setOrigin(0).setDepth(10);
    this.grass = this.add.tileSprite(0, 186, VW, 18, 'grass0').setOrigin(0).setDepth(11);

    /* cartridge label */
    const cart = this.add.image(VW / 2, 96, 'cart').setDepth(12).setScale(1);
    cart.setAlpha(0.97);

    /* the lost title */
    const hz = this.add.image(VW / 2, 66, 'title_hanzi').setDepth(14);
    hz.setScale(1);
    this.tweens.add({ targets: hz, y: 64, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    txt(this, VW / 2, 92, 'LEGEND OF THE RED DRAGON', { origin: 0.5, ls: 1 }).setDepth(14).setTint(CN.gold3);
    txt(this, VW / 2, 106, '- THE MONK OF THE GREAT WALL -', { origin: 0.5 }).setDepth(14).setTint(CN.cream1);
    txt(this, VW / 2, 124, 'RED DRAGON SOFTWARE  SHANGHAI', { origin: 0.5 }).setDepth(14).setTint(CN.red3);
    txt(this, VW / 2, 134, '(C) 1994   FC-8M   NO.RD-001', { origin: 0.5 }).setDepth(14).setTint(CN.cream0);
    txt(this, VW / 2, 148, 'ONLY 5000 CARTRIDGES PRESSED', { origin: 0.5 }).setDepth(14).setTint(CN.cream0);

    this.press = txt(this, VW / 2, 174, 'PRESS  Z  TO START', { origin: 0.5, ls: 1 }).setDepth(15).setTint(CN.gold4);
    txt(this, VW / 2, 190, 'ARROWS MOVE   Z JUMP   X STAFF   C DASH', { origin: 0.5 }).setDepth(15).setTint(CN.cream1);
    txt(this, 4, 204, 'V-CRT   M-SOUND   P-PAUSE', {}).setDepth(15).setTint(CN.cream0).setAlpha(0.65);
    txt(this, VW - 4, 204, 'REMASTER BUILD', { origin: 1 }).setDepth(15).setTint(CN.cream0).setAlpha(0.65);

    /* attract-mode monk strolling the parapet */
    this.monk = this.add.sprite(-20, 186, 'monk_walk0').setDepth(13);
    this.monk.play('monk-walk');

    /* embers */
    this.em = this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: VW }, y: { min: 120, max: VH },
      lifespan: { min: 2200, max: 4200 },
      speedY: { min: -26, max: -8 }, speedX: { min: -10, max: 10 },
      scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 },
      quantity: 1, frequency: 130, blendMode: 'ADD'
    }).setDepth(16);

    /* CRT */
    this.crt = this.add.tileSprite(0, 0, VW, VH, 'scan').setOrigin(0).setDepth(40).setAlpha(0.85);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(41);

    this.tweens.add({ targets: this.press, alpha: 0.05, duration: 480, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: cart, scaleY: 1.005, duration: 3000, yoyo: true, repeat: -1 });

    const go = () => { SND.init(); SND.resume(); SND.stop(); SND.start(); this.cameras.main.fade(420, 0, 0, 0); this.time.delayedCall(440, () => this.scene.start('game', {})); };
    this.input.keyboard.on('keydown-Z', go);
    this.input.keyboard.on('keydown-ENTER', go);
    this.input.keyboard.on('keydown-SPACE', go);
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown-M', () => { SND.setMuted(!SND.muted); });
    this.input.keyboard.on('keydown-V', () => { this.crt.visible = !this.crt.visible; });

    this.time.delayedCall(240, () => { SND.init(); SND.resume(); SND.play('title'); });
    this.t = 0;
  }
  update(_, d) {
    this.t += d / 1000;
    this.stars.tilePositionX += d * 0.004;
    this.fog.tilePositionX += d * 0.012;
    this.grass.tilePositionX += d * 0.02;
    this.monk.x += d * 0.026;
    if (this.monk.x > VW + 20) this.monk.x = -20;
    this.crt.tilePositionY += d * 0.0006;
    this.moon.y = 44 + Math.sin(this.t * 0.5) * 1.5;
  }
}

/* =========================================================================
   GAME
   ========================================================================= */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this.carry = data || {};
  }

  create() {
    const L = this.level = buildLevel();
    this.cam = this.cameras.main;
    this.cam.setBounds(0, 0, L.pxW, L.pxH);
    this.physics.world.setBounds(0, -200, L.pxW, L.pxH + 400);
    this.physics.world.gravity.y = GRAV;

    this.state = {
      score: this.carry.score || 0,
      lives: this.carry.lives === undefined ? 3 : this.carry.lives,
      hp: 3, maxHp: 3,
      combo: 0, comboT: 0, mult: 1,
      scrolls: 0, coins: 0,
      act: 0, spirit: 0
    };
    this.checkpointIdx = this.carry.checkpoint || 0;
    this.introT = 0;
    this.bossActive = null;
    this.gates = [];

    this.buildParallax();
    this.buildWorld();
    this.buildFX();
    this.buildEntities();
    this.buildInput();

    this.scene.launch('hud', { g: this });
    this.hud = this.scene.get('hud');

    const sp = L.checkpoints[this.checkpointIdx] || L.spawn;
    this.player = new Player(this, sp.x, sp.y);
    this.cam.startFollow(this.player, true, 0.12, 0.14);
    this.cam.setDeadzone(48, 40);
    this.cam.setFollowOffset(0, -10);

    this.setupColliders();

    this.cam.fadeIn(400, 0, 0, 0);
    SND.play('level');
    this.actShown = -1;
    this.time.delayedCall(80, () => this.showActCard(0));

    this.events.once('shutdown', () => { this.scene.stop('hud'); });
  }

  /* ------------------------------------------------------------------ */
  buildParallax() {
    const L = this.level;
    this.skies = ['dawn', 'dusk', 'night', 'boss'].map((n, i) =>
      this.add.image(0, 0, 'sky_' + n).setOrigin(0).setDisplaySize(VW, VH)
        .setScrollFactor(0).setDepth(0).setAlpha(i === 0 ? 1 : 0));

    this.stars = this.add.tileSprite(0, 0, VW, 150, 'stars').setOrigin(0)
      .setScrollFactor(0).setDepth(1).setAlpha(0.2);
    this.clouds = this.add.tileSprite(0, 34, VW, 64, 'clouds').setOrigin(0)
      .setScrollFactor(0).setDepth(2).setAlpha(0.85);

    this.moonGlow = this.add.image(288, 40, 'glow').setScrollFactor(0).setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(2.8).setAlpha(0.45).setTint(0xffe0a0);
    this.moon = this.add.image(288, 40, 'moon').setScrollFactor(0).setDepth(3);

    this.mtnFar = this.add.tileSprite(0, 62, VW, 110, 'mtn_far').setOrigin(0)
      .setScrollFactor(0).setDepth(4);
    this.mtnMid = this.add.tileSprite(0, 74, VW, 130, 'mtn_mid').setOrigin(0)
      .setScrollFactor(0).setDepth(5);
    this.wallFar = this.add.tileSprite(0, 106, VW, 96, 'wall_far').setOrigin(0)
      .setScrollFactor(0).setDepth(6);
    this.fogBand = this.add.tileSprite(0, 120, VW, 72, 'fog').setOrigin(0)
      .setScrollFactor(0).setDepth(7).setAlpha(0.55);

    /* level tiles, painted in chunks */
    this.chunks = ART_W.paintLevel(this, 'lvl', L.grid, L.W, L.H, L.actOf, 120);
    this.chunks.forEach(c => this.add.image(c.x, 0, c.key).setOrigin(0).setDepth(20));

    /* foreground */
    this.fogFront = this.add.tileSprite(0, 150, VW, 72, 'fog').setOrigin(0)
      .setScrollFactor(0).setDepth(46).setAlpha(0.30);
    this.grassFront = this.add.tileSprite(0, VH - 16, VW, 18, 'grass0').setOrigin(0)
      .setScrollFactor(0).setDepth(47);
    this.ambient = this.add.rectangle(0, 0, VW, VH, 0x2a1520, 0.16).setOrigin(0)
      .setScrollFactor(0).setDepth(45).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  /* ------------------------------------------------------------------ */
  buildWorld() {
    const L = this.level;
    this.solids = this.physics.add.staticGroup();
    L.solids.forEach(r => {
      const z = this.solids.create(r.x + r.w / 2, r.y + r.h / 2, 'white');
      z.setVisible(false).setDisplaySize(r.w, r.h).refreshBody();
    });
    this.oneways = this.physics.add.staticGroup();
    L.oneways.forEach(r => {
      const z = this.oneways.create(r.x + r.w / 2, r.y + r.h / 2, 'white');
      z.setVisible(false).setDisplaySize(r.w, r.h).refreshBody();
      z.body.checkCollision.down = z.body.checkCollision.left = z.body.checkCollision.right = false;
    });
    /* plank visuals for one-way platforms */
    L.oneways.forEach(r => {
      for (let x = r.x; x < r.x + r.w; x += 16)
        this.add.image(x, r.y, 'tile_plank' + L.actOf(Math.floor(x / 16))).setOrigin(0).setDepth(21);
    });
  }

  /* ------------------------------------------------------------------ */
  buildFX() {
    this._tint = 0xffffff;

    this.emGib = this.add.particles(0, 0, 'px3', {
      lifespan: { min: 260, max: 640 }, speed: { min: 40, max: 170 },
      angle: { min: 200, max: 340 }, gravityY: 420,
      scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 }, emitting: false, tint: 0xffffff
    }).setDepth(38);

    this.emSpark = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 130, max: 330 }, speed: { min: 60, max: 230 },
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
      blendMode: 'ADD', emitting: false, tint: 0xffffff
    }).setDepth(39);

    this.emDust = this.add.particles(0, 0, 'smoke', {
      lifespan: { min: 300, max: 700 }, speed: { min: 12, max: 58 },
      angle: { min: 190, max: 350 },
      scale: { start: 0.8, end: 0.05 }, alpha: { start: 0.55, end: 0 },
      emitting: false, tint: 0xffffff
    }).setDepth(37);

    this.emEmber = this.add.particles(0, 0, 'ember', {
      lifespan: { min: 300, max: 800 }, speed: { min: 5, max: 40 },
      scale: { start: 1, end: 0 }, alpha: { start: 0.95, end: 0 },
      blendMode: 'ADD', emitting: false, tint: 0xffffff
    }).setDepth(39);

    /* ambient floating embers, always on, follows the camera */
    this.emAmbient = this.add.particles(0, 0, 'ember', {
      lifespan: { min: 2600, max: 5200 },
      speedY: { min: -22, max: -5 }, speedX: { min: -14, max: 14 },
      scale: { start: 1, end: 0 }, alpha: { start: 0.65, end: 0 },
      frequency: 110, quantity: 1, blendMode: 'ADD',
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, VW, VH) }
    }).setScrollFactor(0).setDepth(44);

    this.emWind = this.add.particles(0, 0, 'streak', {
      lifespan: { min: 500, max: 900 }, speedX: { min: -180, max: -80 },
      speedY: { min: -12, max: 12 },
      scale: { start: 1, end: 0.4 }, alpha: { start: 0.5, end: 0 },
      emitting: false, tint: 0xd8cbb0
    }).setDepth(43);

    this.chainGfx = this.add.graphics().setDepth(24);
    this.lightLayer = this.add.container(0, 0).setDepth(25);
  }

  /* ------------------------------------------------------------------ */
  buildEntities() {
    const L = this.level;
    this.enemies = this.add.group({ runChildUpdate: false });
    this.eBullets = this.add.group();
    this.pBullets = this.add.group();
    this.pickups = this.add.group();
    this.spikes = this.physics.add.staticGroup();
    this.crumbles = this.physics.add.staticGroup();
    this.breakables = this.physics.add.staticGroup();
    this.lanterns = [];
    this.nests = [];
    this.torches = [];
    this.banners = [];
    this.markers = [];
    this.miniboss = null; this.dragon = null;

    L.ents.forEach(e => {
      const act = L.actOf(Math.floor(e.x / TS));
      switch (e.t) {
        case 'demon':  new Demon(this, e.x, e.y); break;
        case 'hound':  new Hound(this, e.x, e.y); break;
        case 'imp':    new Imp(this, e.x, e.y); break;
        case 'statue': new Statue(this, e.x, e.y); break;
        case 'brute':  new Brute(this, e.x, e.y); break;
        case 'batnest': this.nests.push(new BatNest(this, e.x, e.y)); break;
        case 'general': this.miniboss = new General(this, e.x, e.y); break;
        case 'dragon':  this.dragon = new Dragon(this, e.x, e.y); break;

        case 'scroll': case 'coin': case 'chi': case 'orb':
          new Pickup(this, e.x, e.y, e.t); break;

        case 'spike': {
          const s = this.spikes.create(e.x, e.y, 'tile_spike' + act).setDepth(22);
          s.body.setSize(14, 9);
          s.body.position.set(e.x - 7, e.y - 1);
          break;
        }
        case 'crumble': {
          const c = this.crumbles.create(e.x, e.y, 'tile_crumble' + act).setDepth(22);
          c.homeX = e.x; c.homeY = e.y; c.trig = false;
          break;
        }
        case 'breakable': {
          const b = this.breakables.create(e.x, e.y, 'tile_break' + act).setDepth(22);
          break;
        }
        case 'lantern': {
          const lan = this.add.sprite(e.x, e.y + e.len, 'lantern0').setDepth(26);
          const light = this.add.image(e.x, e.y + e.len + 4, 'lightpool')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(25).setScale(0.75).setAlpha(0.5);
          this.lanterns.push({ s: lan, light, ax: e.x, ay: e.y, len: e.len, ph: Math.random() * 6, f: 0 });
          break;
        }
        case 'torch': {
          const tr = this.add.sprite(e.x, e.y, 'torch0').setDepth(23);
          const lg = this.add.image(e.x, e.y - 2, 'lightpool')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(22).setScale(0.55).setAlpha(0.42);
          this.torches.push({ s: tr, lg, t: Math.random() * 4 });
          break;
        }
        case 'banner': {
          const bn = this.add.sprite(e.x, e.y - 12, 'banner0').setOrigin(0.5, 0).setDepth(23);
          this.banners.push({ s: bn, t: Math.random() * 4 });
          break;
        }
        case 'checkpoint': {
          const m = this.add.sprite(e.x, e.y + 4, 'torch0').setDepth(23).setScale(1.2).setTint(0x556070);
          const g = this.add.image(e.x, e.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(22).setScale(0.7).setAlpha(0.15).setTint(CN.jade2);
          this.markers.push({ s: m, g, x: e.x, on: false });
          break;
        }
      }
    });

    this.windZones = L.zones.filter(z => z.t === 'wind');
    this.triggers = L.zones.filter(z => z.t === 'trigger').map(z => Object.assign({ fired: false }, z));
  }

  /* ------------------------------------------------------------------ */
  buildInput() {
    const K = this.input.keyboard;
    this.keys = K.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
      a: 'A', d: 'D', w: 'W', s: 'S',
      z: 'Z', x: 'X', c: 'C', space: 'SPACE', shift: 'SHIFT'
    });
    /* pause / CRT / mute / quit live in the HUD scene, which keeps
       running while the game scene is paused */
  }

  readInput() {
    const k = this.keys, JD = Phaser.Input.Keyboard.JustDown, JU = Phaser.Input.Keyboard.JustUp;
    return {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      down: k.down.isDown || k.s.isDown,
      jump: k.z.isDown || k.space.isDown || k.up.isDown,
      jumpDown: JD(k.z) || JD(k.space) || JD(k.up),
      attack: k.x.isDown,
      attackDown: JD(k.x),
      attackUp: JU(k.x),
      dashDown: JD(k.c) || JD(k.shift)
    };
  }

  /* ------------------------------------------------------------------ */
  setupColliders() {
    const P = this.player;
    this.physics.add.collider(P, this.solids);
    this.physics.add.collider(P, this.crumbles, (pl, c) => {
      if (!c.trig && pl.body.velocity.y >= 0 && pl.body.bottom <= c.body.top + 8) this.startCrumble(c);
    });
    this.physics.add.collider(P, this.breakables);
    this.physics.add.collider(P, this.oneways, null, (pl, pf) =>
      pl.body.velocity.y >= 0 && pl.dropT <= 0 && pl.body.bottom <= pf.body.top + 8);

    /* winged things ignore the masonry */
    const grounded = e => !e.flying;
    this.physics.add.collider(this.enemies, this.solids, null, grounded);
    this.physics.add.collider(this.enemies, this.crumbles, null, grounded);
    this.physics.add.collider(this.enemies, this.breakables, null, grounded);

    this.physics.add.overlap(P, this.enemies, (pl, e) => {
      if (e.touchDmg > 0) pl.takeHit(e.touchDmg, e.x);
    });
    this.physics.add.overlap(P, this.pickups, (pl, pk) => this.collect(pk));
    this.physics.add.overlap(P, this.eBullets, (pl, b) => {
      if (pl.takeHit(b.dmg, b.x)) b.pop(true);
      else if (pl.dashT > 0 || pl.invuln > 0) { /* phased through */ }
    });
    this.physics.add.overlap(P, this.spikes, (pl, s) => {
      if (pl.takeHit(1, pl.x)) { pl.setVelocityY(-200); }
    });
    this.physics.add.overlap(this.pBullets, this.enemies, (b, e) => {
      if (!b.active || !e.active) return;
      e.hurt(b.dmg, b.x);
      b.pop(true);
    });
    this.physics.add.collider(this.pBullets, this.solids, b => b.pop());
    this.physics.add.collider(this.pBullets, this.breakables, (b, w) => { this.smash(w); b.pop(true); });
    /* shockwaves skate along the parapet instead of colliding with it */
    this.physics.add.collider(this.eBullets, this.solids,
      b => b.pop(), b => b.kind !== 'shock');
  }

  /* =================================================================
     FX helpers used by entities
     ================================================================= */
  /** recolour an emitter right before an explode() — works across 3.6x/3.8x */
  paint(em, colour) {
    this._tint = colour;
    if (em.setParticleTint) em.setParticleTint(colour);
    else if (em.ops && em.ops.tint && em.ops.tint.onChange) em.ops.tint.onChange(colour);
    return em;
  }
  puff(x, y, n, tint) { this.paint(this.emDust, tint || 0xb9ac95).explode(n || 5, x, y); }
  sparks(x, y, dir, tint) {
    this.paint(this.emSpark, tint || CN.gold4).explode(7, x + (dir || 0) * 4, y);
    this.paint(this.emSpark, CN.white).explode(3, x, y);
  }
  trailEmber(x, y, tint, s) { this.paint(this.emEmber, tint || CN.fire).explode(1, x, y); }
  deathBurst(x, y, tint, size) {
    const n = Phaser.Math.Clamp(Math.round((size || 16) / 1.6), 8, 34);
    this.paint(this.emGib, tint).explode(n, x, y);
    this.paint(this.emSpark, CN.fireHot).explode(Math.round(n * 0.6), x, y);
    this.paint(this.emDust, 0x9a8f7a).explode(4, x, y);
    const ring = this.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint).setDepth(39).setScale(0.2);
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.cam.shake(90, 0.003);
  }
  telegraph(x, y, tint) {
    const r = this.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint).setDepth(39).setScale(1.1).setAlpha(0.9);
    this.tweens.add({ targets: r, scale: 0.25, alpha: 0.1, duration: 340, onComplete: () => r.destroy() });
  }
  afterImage(sp) {
    const g = this.add.image(sp.x, sp.y, sp.texture.key).setDepth(39)
      .setFlipX(sp.flipX).setTint(CN.gold4).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
  }
  doubleJumpRing(x, y) {
    const r = this.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(CN.cream3).setDepth(39).setScale(0.25).setAlpha(0.9);
    this.tweens.add({ targets: r, scaleX: 1.0, scaleY: 0.4, alpha: 0, duration: 260, onComplete: () => r.destroy() });
    this.puff(x, y, 4);
  }
  dashBurst(x, y, dir) {
    this.paint(this.emSpark, CN.gold4).explode(10, x - dir * 6, y);
    this.puff(x - dir * 8, y + 6, 6);
  }
  chargeGlow(pl) {
    const g = this.add.image(pl.x, pl.y - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(41).setScale(0.2).setTint(CN.gold5);
    this.tweens.add({ targets: g, scale: 0.75, alpha: 0.2, duration: 420, onComplete: () => g.destroy() });
  }
  slashFX(pl, idx) {
    const dx = idx === 2 ? 0 : pl.facing * 14;
    const s = this.add.image(pl.x + dx, pl.y - 1, 'slash' + idx)
      .setDepth(41).setBlendMode(Phaser.BlendModes.ADD)
      .setFlipX(pl.facing < 0).setAlpha(0.95)
      .setScale(idx === 2 ? 1.15 : 1);
    if (pl.spirit > 0) s.setTint(CN.red5);
    this.tweens.add({ targets: s, alpha: 0, scale: (idx === 2 ? 1.5 : 1.25), duration: 150, onComplete: () => s.destroy() });
  }
  spiritSlashBolt(pl) {
    new Bullet(this, pl.x + pl.facing * 12, pl.y - 2, 'bolt', pl.facing * 240, 0);
  }
  fireBolt(pl) {
    new Bullet(this, pl.x + pl.facing * 12, pl.y - 2, 'bolt', pl.facing * 300, 0);
    SND.blast();
    this.cam.shake(120, 0.005);
    this.paint(this.emSpark, CN.gold5).explode(10, pl.x + pl.facing * 12, pl.y - 2);
    pl.setVelocityX(pl.body.velocity.x - pl.facing * 60);
  }
  spawnBullet(kind, x, y, vx, vy) { return new Bullet(this, x, y, kind, vx, vy); }
  spawnShock(x, y, dir, spd) {
    const b = new Bullet(this, x, y, 'shock', dir * (spd || 120), 0);
    b.body.setAllowGravity(false);
    return b;
  }

  /* melee sweep ------------------------------------------------------ */
  meleeCheck(pl, hit) {
    const rect = new Phaser.Geom.Rectangle(
      pl.x + hit.dx - hit.w / 2, pl.y - hit.h / 2, hit.w, hit.h);

    this.enemies.getChildren().forEach(e => {
      if (!e.active || hit.done.has(e)) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) {
        hit.done.add(e);
        const killed = e.hurt(hit.dmg, pl.x);
        this.cam.shake(killed ? 150 : 70, killed ? 0.006 : 0.0035);
        this.paint(this.emSpark, CN.white).explode(5, e.x, e.y);
      }
    });

    this.breakables.getChildren().forEach(w => {
      if (!w.active || hit.done.has(w)) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, w.getBounds())) {
        hit.done.add(w); this.smash(w);
      }
    });

    /* the staff can bat away incoming fire */
    this.eBullets.getChildren().forEach(b => {
      if (!b.active || hit.done.has(b)) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) {
        hit.done.add(b);
        b.pop(true); SND.clang();
        this.addScore(25);
      }
    });
  }

  smash(w) {
    const act = this.level.actOf(Math.floor(w.x / TS));
    this.deathBurst(w.x, w.y, 0xbba98a, 22);
    this.paint(this.emGib, 0xd8c8a8).explode(14, w.x, w.y);
    SND.breakWall();
    this.cam.shake(200, 0.008);
    w.destroy();
  }

  startCrumble(c) {
    c.trig = true;
    SND.crumble();
    this.puff(c.x, c.y, 5);
    this.tweens.add({ targets: c, x: c.homeX + 1, duration: 45, yoyo: true, repeat: 8 });
    this.time.delayedCall(430, () => {
      if (!c.active) return;
      c.body.enable = false;
      this.puff(c.x, c.y + 6, 8);
      this.tweens.add({
        targets: c, y: c.homeY + 90, alpha: 0, angle: 30, duration: 620,
        onComplete: () => {
          c.setVisible(false);
          this.time.delayedCall(2600, () => {
            if (!c.scene) return;
            c.setPosition(c.homeX, c.homeY).setAlpha(0).setAngle(0).setVisible(true);
            c.body.enable = true; c.trig = false;
            this.tweens.add({ targets: c, alpha: 1, duration: 250 });
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  collect(pk) {
    if (!pk.active) return;
    const s = this.state;
    if (pk.kind === 'scroll') {
      this.bumpCombo();
      this.addScore(100);
      s.scrolls++;
      SND.scroll();
      this.floatText(pk.x, pk.y, '+' + (100 * s.mult), CN.cream3);
      this.paint(this.emSpark, CN.cream3).explode(9, pk.x, pk.y);
    } else if (pk.kind === 'coin') {
      this.addScore(1000);
      s.coins++;
      SND.coin();
      this.floatText(pk.x, pk.y, 'DRAGON COIN', CN.gold4);
      this.paint(this.emSpark, CN.gold4).explode(20, pk.x, pk.y);
      this.cam.flash(160, 90, 70, 20);
    } else if (pk.kind === 'chi') {
      if (this.player.hp < this.player.maxHp) this.player.hp++;
      else this.addScore(300);
      SND.chi();
      this.floatText(pk.x, pk.y, 'CHI', CN.jade3);
      this.paint(this.emSpark, CN.jade3).explode(12, pk.x, pk.y);
    } else if (pk.kind === 'orb') {
      this.player.spirit = 13;
      SND.orb();
      this.onSpiritStart();
      this.floatText(pk.x, pk.y, 'DRAGON SPIRIT', CN.red5);
      this.cam.flash(300, 140, 40, 30);
      this.cam.shake(260, 0.008);
    }
    pk.destroy();
  }

  onSpiritStart() {
    this.player.setTint(0xffd8a0);
    if (!this.spiritGlow) {
      this.spiritGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(39).setScale(0.7).setTint(CN.or4).setAlpha(0.5);
    }
    this.spiritGlow.setVisible(true);
    if (this.hud) this.hud.setSpirit(true);
  }
  onSpiritEnd() {
    this.player.clearTint();
    if (this.spiritGlow) this.spiritGlow.setVisible(false);
    if (this.hud) this.hud.setSpirit(false);
    SND.select();
  }

  bumpCombo() {
    const s = this.state;
    s.combo++; s.comboT = 3.2;
    s.mult = Phaser.Math.Clamp(1 + Math.floor(s.combo / 4), 1, 8);
    if (s.combo > 1) SND.combo(s.combo);
  }
  addScore(n) { this.state.score += Math.round(n * this.state.mult); }

  enemyKilled(e) {
    this.bumpCombo();
    this.addScore(e.scoreValue);
    this.floatText(e.x, e.y - 6, '+' + (e.scoreValue * this.state.mult), CN.gold4);
  }

  floatText(x, y, s, tint) {
    const t = txt(this, x, y, s, { origin: 0.5 }).setDepth(42).setTint(tint || CN.cream3);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 720, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  /* ------------------------------------------------------------------ */
  onPlayerHurt() {
    this.state.combo = 0; this.state.mult = 1;
    this.cam.shake(260, 0.012);
    this.cam.flash(140, 120, 20, 20);
    this.paint(this.emGib, CN.red4).explode(10, this.player.x, this.player.y);
  }

  onPlayerDeath() {
    this.state.combo = 0; this.state.mult = 1;
    this.deathBurst(this.player.x, this.player.y, CN.or3, 30);
    this.cam.shake(400, 0.014);
    SND.hurt();
    this.state.lives--;
    this.time.delayedCall(1100, () => {
      if (this.state.lives <= 0) {
        SND.stop(); SND.gameOver();
        this.cam.fade(700, 0, 0, 0);
        this.time.delayedCall(760, () => {
          this.scene.stop('hud');
          this.scene.start('end', { victory: false, score: this.state.score, stats: this.state });
        });
      } else this.respawn();
    });
  }

  respawn() {
    const cp = this.level.checkpoints[this.checkpointIdx] || this.level.spawn;
    const P = this.player;
    this.cam.fadeOut(220, 0, 0, 0);
    this.time.delayedCall(240, () => {
      P.dead = false;
      P.body.checkCollision.none = false;
      P.hp = P.maxHp;
      P.invuln = 1.6;
      P.spirit = 0; this.onSpiritEnd();
      P.setPosition(cp.x, cp.y);
      P.setVelocity(0, 0);
      P.setAlpha(1);
      /* if a boss fight was in progress, reset it */
      if (this.bossActive) this.resetBoss();
      this.cam.fadeIn(280, 0, 0, 0);
    });
  }

  resetBoss() {
    const b = this.bossActive;
    this.bossActive = null;
    this.hud.hideBoss();
    this.cam.setBounds(0, 0, this.level.pxW, this.level.pxH);
    this.gates.forEach(g => g.destroy()); this.gates = [];
    if (b && b.active) { b.hp = b.maxHp; b.awake = false; b.setActive(false).setVisible(false); b.setPosition(b.spawnX, b.spawnY); }
    /* let the trigger fire again */
    this.triggers.forEach(t => { if (t.id === (b === this.dragon ? 'boss' : 'miniboss')) t.fired = false; });
    SND.play('level');
  }

  /* ------------------------------------------------------------------ */
  showActCard(i) {
    if (this.actShown === i) return;
    this.actShown = i;
    const a = this.level.acts[i];
    this.hud.actCard('ACT ' + ['I', 'II', 'III', 'IV'][i], a.name);
  }

  fireTrigger(tr) {
    tr.fired = true;
    if (tr.id === 'miniboss' && this.miniboss && this.miniboss.hp > 0) {
      this.startBoss(this.miniboss, tr.arena, 'gen_hanzi', 'THE JADE GENERAL', 'KEEPER OF THE 9TH GATE');
    } else if (tr.id === 'boss' && this.dragon && this.dragon.hp > 0) {
      this.startBoss(this.dragon, tr.arena, 'boss_hanzi', 'THE RED DRAGON', 'SEALED BENEATH THE WALL 1368');
    }
  }

  startBoss(boss, arena, hanzi, name, sub) {
    this.bossActive = boss;
    this.introT = 2.6;
    this.cam.setBounds(arena[0], 0, arena[1] - arena[0], this.level.pxH);
    /* seal the arena */
    [arena[0] - 4, arena[1] + 4].forEach(x => {
      const g = this.solids.create(x, this.level.pxH / 2, 'white');
      g.setVisible(false).setDisplaySize(12, this.level.pxH).refreshBody();
      this.gates.push(g);
    });
    boss.wake(arena);
    SND.stop(); SND.roar();
    this.cam.shake(600, 0.01);
    this.hud.bossCard(hanzi, name, sub);
    this.hud.showBoss(name);
    this.time.delayedCall(2500, () => { SND.play('boss'); });
  }

  onMiniBossDead(b) {
    const bx = b ? b.x : this.player.x, by = b ? b.y : this.player.y;
    this.bossActive = null;
    this.miniboss = null;
    this.cam.setBounds(0, 0, this.level.pxW, this.level.pxH);
    this.gates.forEach(g => g.destroy()); this.gates = [];
    this.cam.flash(600, 200, 255, 210);
    this.cam.shake(700, 0.016);
    for (let i = 0; i < 8; i++)
      this.time.delayedCall(i * 90, () => this.deathBurst(
        bx + (Math.random() - 0.5) * 40, by + (Math.random() - 0.5) * 40, CN.jade3, 30));
    this.addScore(3000);
    this.hud.banner('THE JADE GENERAL FALLS');
    SND.stop(); SND.fanfare();
    this.time.delayedCall(2200, () => SND.play('level'));
    /* reward */
    this.time.delayedCall(900, () => {
      new Pickup(this, bx, 150, 'orb');
      new Pickup(this, bx - 26, 150, 'chi');
    });
  }

  onBossDead() {
    this.bossActive = null;
    this.victory = true;
    this.addScore(12000);
    SND.stop();
    this.cam.shake(1600, 0.02);
    for (let i = 0; i < 26; i++) {
      this.time.delayedCall(i * 70, () => {
        const x = this.player.x + (Math.random() - 0.5) * 200;
        const y = 60 + Math.random() * 90;
        this.deathBurst(x, y, i % 2 ? CN.fire : CN.gold4, 34);
        if (i % 4 === 0) { this.cam.flash(180, 255, 180, 90); SND.kill(); }
      });
    }
    this.time.delayedCall(2400, () => {
      this.cam.fade(900, 255, 240, 200);
      this.time.delayedCall(950, () => {
        this.scene.stop('hud');
        this.scene.start('end', { victory: true, score: this.state.score, stats: this.state });
      });
    });
  }

  bossShout(s) { if (this.hud) this.hud.banner(s); }

  /* =================================================================
     UPDATE
     ================================================================= */
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    const P = this.player, L = this.level;
    const sx = this.cam.scrollX, sy = this.cam.scrollY;

    /* ---- input & player ---- */
    if (this.introT > 0) {
      this.introT -= dt;
      P.setVelocityX(P.body.velocity.x * 0.85);
      P.anims.play('monk-idle', true);
    } else if (!P.dead) {
      P.update(dt, this.readInput());
    }

    /* ---- combo timer ---- */
    const S = this.state;
    if (S.comboT > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) { S.combo = 0; S.mult = 1; }
    }
    S.hp = P.hp; S.maxHp = P.maxHp; S.spirit = P.spirit;

    /* ---- act / sky ---- */
    let act = 0;
    for (let i = 0; i < L.acts.length; i++) if (P.x >= L.acts[i].from) act = i;
    const a = L.acts[act];
    let t = Phaser.Math.Clamp((P.x - a.from) / (a.to - a.from), 0, 1);
    let blend = 0, nxt = act;
    if (t > 0.82 && act < L.acts.length - 1) { blend = (t - 0.82) / 0.18; nxt = act + 1; }
    /* every tint below runs lerpColor, which allocates Color objects — only
       redo the whole palette when the act or the blend actually moved */
    const skyKey = act * 1000 + nxt * 100 + Math.round(blend * 64);
    if (skyKey !== this._skyKey) {
      this._skyKey = skyKey;
      this.skies.forEach((s, i) => s.setAlpha(i === act ? 1 - blend : (i === nxt && blend > 0 ? blend : 0)));
      const look = ACT_LOOK[act], lookN = ACT_LOOK[nxt];
      const bl = (k) => lerpColor(look[k], lookN[k], blend);
      const bn = (k) => look[k] + (lookN[k] - look[k]) * blend;
      this.mtnFar.setTint(bl('mtn'));
      this.mtnMid.setTint(lerpColor(look.mtn, lookN.mtn, blend) & 0xbfbfbf);
      this.wallFar.setTint(bl('wall'));
      const fog = bl('fog');
      this.fogBand.setTint(fog);
      this.fogFront.setTint(fog);
      this.stars.setAlpha(bn('stars'));
      this.clouds.setAlpha(bn('clouds'));
      const moon = bl('moon');
      this.moon.setTint(moon);
      this.moonGlow.setTint(moon);
      this.ambient.setFillStyle(bl('amb'), 0.18);
    }
    if (act !== this.actShown) this.showActCard(act);

    /* ---- parallax ---- */
    this.stars.tilePositionX = sx * 0.03;
    this.clouds.tilePositionX = sx * 0.06 + time * 0.002;
    this.mtnFar.tilePositionX = sx * 0.10;
    this.mtnMid.tilePositionX = sx * 0.20;
    this.wallFar.tilePositionX = sx * 0.36;
    this.fogBand.tilePositionX = sx * 0.46 + time * 0.004;
    this.fogFront.tilePositionX = sx * 1.22 + time * 0.008;
    this.grassFront.tilePositionX = sx * 1.15;
    const gf = Math.floor(time / 260) % 3;
    if (gf !== this._grassF) { this._grassF = gf; this.grassFront.setTexture('grass' + gf); }
    this.mtnFar.y = 62 - sy * 0.08;
    this.mtnMid.y = 74 - sy * 0.14;
    this.wallFar.y = 106 - sy * 0.24;
    this.moon.y = 40 - sy * 0.05 + Math.sin(time * 0.0005) * 1.5;
    this.moonGlow.y = this.moon.y;

    /* ---- decor animation (on-screen only) ---- */
    const x0 = sx - CULL, x1 = sx + VW + CULL;
    const f2 = Math.floor(time / 110) % 2;
    const f3 = Math.floor(time / 190) % 3;
    const f2New = f2 !== this._f2, f3New = f3 !== this._f3;
    this._f2 = f2; this._f3 = f3;

    this.torches.forEach(o => {
      if (o.s.x < x0 || o.s.x > x1) return;
      if (f2New) o.s.setTexture('torch' + f2);
      o.lg.setAlpha(0.34 + Math.sin(time * 0.011 + o.t) * 0.1);
    });
    if (f3New) this.banners.forEach(o => {
      if (o.s.x < x0 || o.s.x > x1) return;
      o.s.setTexture('banner' + ((f3 + (o.t | 0)) % 3));
    });

    /* swinging lanterns */
    this.chainGfx.clear();
    this.chainGfx.lineStyle(1, 0x3a2a20, 1);
    this.lanterns.forEach(o => {
      if (o.ax < x0 || o.ax > x1) return;
      const ang = Math.sin(time * 0.0016 + o.ph) * 0.5;
      const lx = o.ax + Math.sin(ang) * o.len;
      const ly = o.ay + Math.cos(ang) * o.len;
      o.s.setPosition(lx, ly).setRotation(ang * 0.6);
      if (f2New) o.s.setTexture('lantern' + f2);
      o.light.setPosition(lx, ly + 2).setAlpha(0.42 + Math.sin(time * 0.009 + o.ph) * 0.1);
      this.chainGfx.lineBetween(o.ax, o.ay, lx, ly - 8);
      this.chainGfx.fillStyle(0x5a4a3a, 1);
      this.chainGfx.fillRect(o.ax - 2, o.ay - 2, 4, 3);
      /* a swinging lantern burns */
      if (!P.dead && Math.abs(P.x - lx) < 10 && Math.abs(P.y - ly) < 12) P.takeHit(1, lx);
      if (Math.random() < 0.06) this.trailEmber(lx, ly + 6, CN.or4);
    });

    /* ---- wind gusts ---- */
    this.windZones.forEach(z => {
      const onScreen = z.x < sx + VW && z.x + z.w > sx;
      if (!P.dead && P.x > z.x && P.x < z.x + z.w && P.y > z.y && P.y < z.y + z.h) {
        P.setVelocityX(P.body.velocity.x + z.dir * 170 * dt);
        if (!P.body.blocked.down) P.setVelocityX(P.body.velocity.x + z.dir * 90 * dt);
      }
      if (onScreen && Math.random() < 0.55) {
        if (this.emWind.setParticleSpeed) this.emWind.setParticleSpeed(z.dir * 150, 0);
        this.emWind.explode(1,
          Math.max(z.x, sx) + Math.random() * Math.min(VW, z.w),
          z.y + Math.random() * z.h);
      }
    });

    /* ---- nests / checkpoints / triggers ---- */
    this.nests.forEach(n => n.update());

    this.markers.forEach((m, i) => {
      if (!m.on && Math.abs(P.x - m.x) < 14) {
        m.on = true; m.s.clearTint(); m.g.setAlpha(0.45).setTint(CN.gold4);
        this.checkpointIdx = i;
        this.hud.banner('SHRINE LIT');
        SND.chi();
        this.paint(this.emSpark, CN.gold4).explode(14, m.x, m.s.y);
      }
      if (m.on) m.g.setAlpha(0.35 + Math.sin(time * 0.006 + i) * 0.12);
    });

    this.triggers.forEach(tr => {
      if (tr.fired) return;
      if (P.x > tr.x && P.x < tr.x + tr.w) this.fireTrigger(tr);
    });

    /* ---- spirit glow follows the monk ---- */
    if (this.spiritGlow && this.spiritGlow.visible) {
      this.spiritGlow.setPosition(P.x, P.y - 2)
        .setAlpha(0.35 + Math.sin(time * 0.02) * 0.15)
        .setScale(0.6 + Math.sin(time * 0.012) * 0.08);
      if (Math.random() < 0.5) this.trailEmber(P.x + (Math.random() - 0.5) * 12, P.y + (Math.random() - 0.5) * 14, CN.gold4);
    }

    /* ---- park enemies that are nowhere near the camera ----
       an inactive sprite is skipped by the update list entirely, so its AI,
       its animation and its ember trail all stop costing anything. bosses
       run their own wake()/sleep cycle and are left alone. */
    const wx0 = sx - SLEEP, wx1 = sx + VW + SLEEP;
    this.enemies.getChildren().forEach(e => {
      if (e.wake) return;
      const asleep = e.x < wx0 || e.x > wx1;
      if (e.asleep === asleep) return;
      e.asleep = asleep;
      e.setActive(!asleep).setVisible(!asleep);
      if (e.body) e.body.enable = !asleep;
    });

    /* ---- housekeeping ---- */
    if (!P.dead && P.y > L.pxH + 24) { P.hp = 0; P.die(); }

    this.eBullets.getChildren().forEach(b => { if (b.active && Math.abs(b.x - P.x) > 420) b.destroy(); });
    this.pBullets.getChildren().forEach(b => { if (b.active && Math.abs(b.x - P.x) > 420) b.destroy(); });
    this.enemies.getChildren().forEach(e => {
      if (e.active && e.y > L.pxH + 40) e.destroy();
    });
  }
}

/* =========================================================================
   HUD  (separate scene, unscrolled)
   ========================================================================= */
class HudScene extends Phaser.Scene {
  constructor() { super('hud'); }
  init(data) { this.g = data.g; this.ready = false; }

  create() {
    this.ready = true;
    const d = 10;

    /* lives */
    this.lifeIcons = [];
    for (let i = 0; i < 5; i++) {
      const im = this.add.image(8 + i * 11, 10, 'ui_monk').setDepth(d).setVisible(i < 3);
      this.lifeIcons.push(im);
    }
    /* chi pips */
    this.pips = [];
    for (let i = 0; i < 3; i++) this.pips.push(this.add.image(9 + i * 8, 22, 'ui_pip').setDepth(d));

    /* score */
    this.scoreLbl = txt(this, VW - 4, 6, 'SCORE', { origin: 1, originY: 0 }).setDepth(d).setTint(CN.cream1);
    this.scoreTxt = txt(this, VW - 4, 15, '0000000', { origin: 1, originY: 0 }).setDepth(d).setTint(CN.gold4);

    /* collectibles */
    this.add.image(VW - 74, 27, 'ui_scroll').setDepth(d);
    this.scrollTxt = txt(this, VW - 66, 24, '00', {}).setDepth(d).setTint(CN.cream2);
    this.add.image(VW - 44, 27, 'coin0').setDepth(d).setScale(0.9);
    this.coinTxt = txt(this, VW - 36, 24, '00', {}).setDepth(d).setTint(CN.gold3);

    /* combo */
    this.comboTxt = txt(this, VW / 2, 30, '', { origin: 0.5 }).setDepth(d).setTint(CN.gold4);
    this.comboBar = this.add.rectangle(VW / 2, 40, 60, 2, CN.gold3).setDepth(d).setVisible(false);

    /* spirit meter */
    this.spiritLbl = txt(this, 8, 32, 'DRAGON SPIRIT', {}).setDepth(d).setTint(CN.red5).setVisible(false);
    this.spiritBar = this.add.rectangle(8, 42, 90, 3, CN.or4).setOrigin(0, 0).setDepth(d).setVisible(false);
    this.spiritBg = this.add.rectangle(7, 41, 92, 5, 0x2a0a10).setOrigin(0, 0).setDepth(d - 1).setVisible(false);

    /* boss bar */
    this.bossName = txt(this, VW / 2, VH - 26, '', { origin: 0.5 }).setDepth(d).setTint(CN.red5).setVisible(false);
    this.bossBg = this.add.rectangle(VW / 2, VH - 15, 244, 8, 0x1a0206).setDepth(d).setVisible(false);
    this.bossBar = this.add.rectangle(VW / 2 - 120, VH - 15, 240, 4, CN.red4).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false);
    this.bossBar2 = this.add.rectangle(VW / 2 - 120, VH - 17, 240, 1, CN.red5).setOrigin(0, 0.5).setDepth(d + 2).setVisible(false);

    /* messages */
    this.bannerTxt = txt(this, VW / 2, 60, '', { origin: 0.5 }).setDepth(d + 4).setTint(CN.gold4).setVisible(false);

    /* act card container */
    this.card = this.add.container(0, 0).setDepth(d + 6).setVisible(false);
    this.cardBg = this.add.rectangle(VW / 2, VH / 2, VW, 54, 0x07050a, 0.92);
    this.cardLine1 = this.add.rectangle(VW / 2, VH / 2 - 27, VW, 1, CN.gold2);
    this.cardLine2 = this.add.rectangle(VW / 2, VH / 2 + 27, VW, 1, CN.gold2);
    this.cardA = txt(this, VW / 2, VH / 2 - 16, '', { origin: 0.5 }).setTint(CN.red4);
    this.cardB = txt(this, VW / 2, VH / 2 - 2, '', { origin: 0.5, scale: 2 }).setTint(CN.gold4);
    this.card.add([this.cardBg, this.cardLine1, this.cardLine2, this.cardA, this.cardB]);

    /* boss intro card */
    this.bcard = this.add.container(0, 0).setDepth(d + 7).setVisible(false);
    this.bcardBg = this.add.rectangle(VW / 2, VH / 2, VW, VH, 0x05030a, 0.9);
    this.bcardHz = this.add.image(VW / 2, VH / 2 - 34, 'boss_hanzi');
    this.bcardName = txt(this, VW / 2, VH / 2 + 6, '', { origin: 0.5, scale: 2 }).setTint(CN.red5);
    this.bcardSub = txt(this, VW / 2, VH / 2 + 28, '', { origin: 0.5 }).setTint(CN.cream1);
    this.bcardTag = txt(this, VW / 2, VH - 20, 'RED DRAGON SOFTWARE 1994', { origin: 0.5 }).setTint(CN.cream0);
    this.bcard.add([this.bcardBg, this.bcardHz, this.bcardName, this.bcardSub, this.bcardTag]);

    /* pause */
    this.pauseTxt = txt(this, VW / 2, VH / 2, 'PAUSED', { origin: 0.5, scale: 2 }).setDepth(d + 8).setTint(CN.cream3).setVisible(false);

    /* CRT overlay */
    this.crt = this.add.tileSprite(0, 0, VW, VH, 'scan').setOrigin(0).setDepth(d + 20).setAlpha(0.9);
    this.grille = this.add.tileSprite(0, 0, VW, VH, 'grille').setOrigin(0).setDepth(d + 21).setAlpha(0.5);
    this.vig = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(d + 22);
    this.crtOn = true;

    /* spirit screen tint */
    this.spiritTint = this.add.rectangle(0, 0, VW, VH, 0xff5a20, 0.10).setOrigin(0)
      .setDepth(d + 15).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);

    /* global keys — this scene never pauses */
    const K = this.input.keyboard;
    K.on('keydown-P', () => {
      const gs = this.scene.get('game');
      if (this.scene.isPaused('game')) { this.scene.resume('game'); this.setPaused(false); SND.select(); }
      else if (gs && gs.scene.isActive()) { this.setPaused(true); this.scene.pause('game'); SND.select(); }
    });
    K.on('keydown-M', () => { SND.setMuted(!SND.muted); this.banner(SND.muted ? 'SOUND OFF' : 'SOUND ON'); });
    K.on('keydown-V', () => this.toggleCrt());
    K.on('keydown-ESC', () => { SND.stop(); this.scene.stop('game'); this.scene.start('title'); });
  }

  toggleCrt() {
    if (!this.ready) return;
    this.crtOn = !this.crtOn;
    this.crt.setVisible(this.crtOn);
    this.grille.setVisible(this.crtOn);
    this.vig.setVisible(this.crtOn);
    SND.select();
  }
  setPaused(p) { if (this.ready) this.pauseTxt.setVisible(p); }

  banner(s) {
    if (!this.ready) return;
    this.bannerTxt.setText(String(s).toUpperCase()).setVisible(true).setAlpha(1).setY(60);
    this.tweens.killTweensOf(this.bannerTxt);
    this.tweens.add({ targets: this.bannerTxt, y: 52, alpha: 0, delay: 900, duration: 600, onComplete: () => this.bannerTxt.setVisible(false) });
  }

  actCard(a, b) {
    if (!this.ready) return;
    this.cardA.setText(a);
    this.cardB.setText(b);
    this.card.setVisible(true).setAlpha(0);
    this.cardBg.scaleY = 0.1;
    this.tweens.add({ targets: this.card, alpha: 1, duration: 220 });
    this.tweens.add({ targets: this.cardBg, scaleY: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({
      targets: this.card, alpha: 0, delay: 1900, duration: 500,
      onComplete: () => this.card.setVisible(false)
    });
  }

  bossCard(hanzi, name, sub) {
    if (!this.ready) return;
    this.bcardHz.setTexture(hanzi);
    this.bcardName.setText(name);
    this.bcardSub.setText(sub);
    this.bcard.setVisible(true).setAlpha(0);
    this.bcardHz.setScale(2.2);
    this.tweens.add({ targets: this.bcard, alpha: 1, duration: 260 });
    this.tweens.add({ targets: this.bcardHz, scale: 1, duration: 700, ease: 'Back.out' });
    this.tweens.add({
      targets: this.bcard, alpha: 0, delay: 1800, duration: 600,
      onComplete: () => this.bcard.setVisible(false)
    });
  }

  showBoss(name) {
    if (!this.ready) return;
    this.bossName.setText(name).setVisible(true);
    this.bossBg.setVisible(true); this.bossBar.setVisible(true); this.bossBar2.setVisible(true);
    this.setBossHp(1);
  }
  setBossHp(f) {
    if (!this.ready) return;
    f = Phaser.Math.Clamp(f, 0, 1);
    this.bossBar.width = 240 * f;
    this.bossBar2.width = 240 * f;
    this.bossBar.fillColor = f > 0.6 ? CN.red4 : (f > 0.3 ? CN.or3 : CN.gold3);
  }
  hideBoss() {
    if (!this.ready) return;
    this.bossName.setVisible(false); this.bossBg.setVisible(false);
    this.bossBar.setVisible(false); this.bossBar2.setVisible(false);
  }
  setSpirit(on) {
    if (!this.ready) return;
    this.spiritLbl.setVisible(on); this.spiritBar.setVisible(on);
    this.spiritBg.setVisible(on); this.spiritTint.setVisible(on);
  }

  update(time, delta) {
    if (!this.ready || !this.g || !this.g.state) return;
    const s = this.g.state;

    /* the HUD only changes on events, so redraw it only when a value moved */
    const score = Math.floor(s.score);
    if (s.lives !== this._lives) {
      this._lives = s.lives;
      this.lifeIcons.forEach((im, i) => im.setVisible(i < Math.max(0, s.lives)));
    }
    if (s.hp !== this._hp) {
      this._hp = s.hp;
      this.pips.forEach((p, i) => p.setTexture(i < s.hp ? 'ui_pip' : 'ui_pip_off'));
    }
    if (score !== this._score) {
      this._score = score;
      this.scoreTxt.setText(String(score).padStart(7, '0'));
    }
    if (s.scrolls !== this._scrolls) {
      this._scrolls = s.scrolls;
      this.scrollTxt.setText(String(s.scrolls).padStart(2, '0'));
    }
    if (s.coins !== this._coins) {
      this._coins = s.coins;
      this.coinTxt.setText(String(s.coins).padStart(2, '0'));
    }

    if (s.combo > 1) {
      this.comboTxt.setText(s.combo + ' HIT  X' + s.mult).setVisible(true);
      this.comboTxt.setScale(1 + Math.min(0.5, s.combo * 0.02));
      this.comboTxt.setTint(s.mult >= 5 ? CN.red5 : CN.gold4);
      this.comboBar.setVisible(true);
      this.comboBar.width = 60 * Phaser.Math.Clamp(s.comboT / 3.2, 0, 1);
    } else { this.comboTxt.setVisible(false); this.comboBar.setVisible(false); }

    if (s.spirit > 0) {
      this.spiritBar.width = 90 * Phaser.Math.Clamp(s.spirit / 13, 0, 1);
      this.spiritTint.setAlpha(0.07 + Math.sin(time * 0.012) * 0.04);
      this.spiritLbl.setAlpha(s.spirit < 3 ? (Math.floor(time / 120) % 2 ? 0.3 : 1) : 1);
    }

    if (this.crtOn) {
      this.crt.tilePositionY -= delta * 0.0009;
      this.grille.alpha = 0.42 + Math.sin(time * 0.02) * 0.05;
    }
  }
}

/* =========================================================================
   END CARDS
   ========================================================================= */
class EndScene extends Phaser.Scene {
  constructor() { super('end'); }
  init(d) { this.victory = d.victory; this.score = d.score || 0; this.stats = d.stats || {}; }
  create() {
    const v = this.victory;
    this.cameras.main.setBackgroundColor(v ? '#140806' : '#05040a');

    this.add.image(0, 0, 'sky_' + (v ? 'boss' : 'night')).setOrigin(0).setDisplaySize(VW, VH).setAlpha(0.65);
    this.stars = this.add.tileSprite(0, 0, VW, 150, 'stars').setOrigin(0).setAlpha(v ? 0.3 : 0.8);
    this.add.image(VW / 2, 84, 'cart').setDepth(5);

    this.add.image(VW / 2, 56, v ? 'victory_hanzi' : 'gameover_hanzi').setDepth(7);

    txt(this, VW / 2, 82, v ? 'VICTORY' : 'GAME OVER', { origin: 0.5, scale: 2 }).setDepth(7)
      .setTint(v ? CN.gold4 : CN.red4);
    txt(this, VW / 2, 102, v ? 'THE RED DRAGON IS SEALED ONCE MORE' : 'THE WALL CLAIMS ANOTHER PILGRIM',
      { origin: 0.5 }).setDepth(7).setTint(CN.cream2);

    txt(this, VW / 2 - 70, 118, 'FINAL SCORE', {}).setDepth(7).setTint(CN.cream1);
    txt(this, VW / 2 + 70, 118, String(Math.floor(this.score)).padStart(7, '0'), { origin: 1, originY: 0 })
      .setDepth(7).setTint(CN.gold4);
    txt(this, VW / 2 - 70, 128, 'WISDOM SCROLLS', {}).setDepth(7).setTint(CN.cream1);
    txt(this, VW / 2 + 70, 128, String(this.stats.scrolls || 0).padStart(3, '0'), { origin: 1, originY: 0 })
      .setDepth(7).setTint(CN.cream3);
    txt(this, VW / 2 - 70, 138, 'DRAGON COINS', {}).setDepth(7).setTint(CN.cream1);
    txt(this, VW / 2 + 70, 138, String(this.stats.coins || 0).padStart(3, '0') + ' / 011', { origin: 1, originY: 0 })
      .setDepth(7).setTint(CN.gold3);

    txt(this, VW / 2, 156, v ? 'THANK YOU FOR PLAYING' : 'CONTINUE?', { origin: 0.5 }).setDepth(7).setTint(CN.cream2);

    this.press = txt(this, VW / 2, 180, 'PRESS  Z', { origin: 0.5 }).setDepth(7).setTint(CN.gold4);
    txt(this, VW / 2, 198, '(C)1994 RED DRAGON SOFTWARE  SHANGHAI', { origin: 0.5 }).setDepth(7).setTint(CN.cream0);
    this.tweens.add({ targets: this.press, alpha: 0.1, duration: 460, yoyo: true, repeat: -1 });

    this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: VW }, y: { min: 100, max: VH },
      lifespan: { min: 2000, max: 4000 },
      speedY: { min: -30, max: -8 }, speedX: { min: -12, max: 12 },
      scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 },
      quantity: 1, frequency: v ? 60 : 200, blendMode: 'ADD'
    }).setDepth(8);

    this.add.tileSprite(0, 0, VW, VH, 'scan').setOrigin(0).setDepth(20).setAlpha(0.9);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(21);

    if (v) SND.fanfare();

    const go = () => {
      SND.stop();
      this.cameras.main.fade(400, 0, 0, 0);
      this.time.delayedCall(420, () => this.scene.start(v ? 'title' : 'game', {}));
    };
    this.input.keyboard.on('keydown-Z', go);
    this.input.keyboard.on('keydown-ENTER', go);
    this.input.keyboard.on('keydown-SPACE', go);
    this.input.keyboard.on('keydown-ESC', () => { SND.stop(); this.scene.start('title'); });
  }
  update(_, d) { this.stars.tilePositionX += d * 0.004; }
}

window.BootScene = BootScene;
window.TitleScene = TitleScene;
window.GameScene = GameScene;
window.HudScene = HudScene;
window.EndScene = EndScene;
window.VW = VW; window.VH = VH;
