/* =========================================================================
   entities.js — the monk, eight kinds of demon, two bosses,
   projectiles, pickups and hazards.
   ========================================================================= */
'use strict';

const GRAV = 820;

/* =========================================================================
   PLAYER
   ========================================================================= */
class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'monk_idle0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(40);
    this.body.setSize(8, 13).setOffset(4, 3);
    this.body.setMaxVelocity(420, 620);

    this.facing = 1;
    this.maxHp = 3; this.hp = 3;
    this.lives = 3;
    this.jumps = 0; this.maxJumps = 2;
    this.coyote = 0; this.jumpBuf = 0;
    this.dashT = 0; this.dashCd = 0;
    this.invuln = 0;
    this.atkT = 0; this.atkIdx = 0; this.atkWin = 0; this.atkHit = null;
    this.chargeT = 0; this.charged = false;
    this.spirit = 0;
    this.dead = false;
    this.hurtT = 0;
    this.wasOnFloor = false;
    this.dropT = 0;
    this.walkDust = 0;
    this.trail = 0;
  }

  get grounded() { return this.body.blocked.down || this.body.touching.down; }

  update(dt, k) {
    if (this.dead) return;
    const s = this.scene;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    if (this.spirit > 0) {
      this.spirit -= dt;
      if (this.spirit <= 0) { this.spirit = 0; s.onSpiritEnd(); }
    }

    const onFloor = this.grounded;
    if (onFloor) { this.coyote = 0.10; this.jumps = 0; }
    else this.coyote = Math.max(0, this.coyote - dt);

    /* landing puff */
    if (onFloor && !this.wasOnFloor) {
      s.puff(this.x, this.y + 8, 7);
      if (this.body.prev.y - this.body.y < 0) SND.land();
      s.cam.shake(60, 0.0018);
    }
    this.wasOnFloor = onFloor;

    /* ---- dash ---- */
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.setVelocityX(this.facing * 300);
      this.setVelocityY(this.body.velocity.y * 0.82);
      this.trail -= dt;
      if (this.trail <= 0) { this.trail = 0.03; s.afterImage(this); }
      this.setTexture('monk_dash');
      if (this.dashT <= 0) this.setVelocityX(this.facing * 120);
      return;
    }

    /* ---- horizontal ---- */
    const accel = onFloor ? 1500 : 1000;
    const maxSpd = 118 + (this.spirit > 0 ? 14 : 0);
    let ax = 0;
    if (k.left && !k.right) { ax = -accel; this.facing = -1; }
    else if (k.right && !k.left) { ax = accel; this.facing = 1; }

    if (this.atkT > 0 && onFloor) ax *= 0.35;

    if (ax !== 0) {
      this.setVelocityX(Phaser.Math.Clamp(this.body.velocity.x + ax * dt, -maxSpd, maxSpd));
    } else {
      const fr = onFloor ? 1100 : 380;
      const v = this.body.velocity.x;
      this.setVelocityX(Math.abs(v) < fr * dt ? 0 : v - Math.sign(v) * fr * dt);
    }
    this.setFlipX(this.facing < 0);

    /* ---- jump ---- */
    if (k.jumpDown) this.jumpBuf = 0.12;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if (k.down && onFloor && this.dropT <= 0) { this.dropT = 0.22; }

    if (this.jumpBuf > 0) {
      if (onFloor || this.coyote > 0) {
        this.setVelocityY(-262); this.jumps = 1; this.jumpBuf = 0; this.coyote = 0;
        SND.jump(); s.puff(this.x, this.y + 8, 5);
      } else if (this.jumps < this.maxJumps) {
        this.setVelocityY(-238); this.jumps++; this.jumpBuf = 0;
        SND.doubleJump(); s.doubleJumpRing(this.x, this.y + 6);
      }
    }
    /* variable jump height */
    if (!k.jump && this.body.velocity.y < -70) this.setVelocityY(this.body.velocity.y + 900 * dt);

    /* ---- dash input ---- */
    if (k.dashDown && this.dashCd <= 0) {
      this.dashT = 0.17; this.dashCd = 0.52; this.invuln = Math.max(this.invuln, 0.22);
      SND.dash(); s.cam.shake(80, 0.004);
      s.dashBurst(this.x, this.y, this.facing);
      return;
    }

    /* ---- attack / charge ---- */
    if (this.atkT > 0) {
      this.atkT -= dt;
      if (this.atkHit && this.atkT <= this.atkHit.until && this.atkT > this.atkHit.until - 0.14) {
        s.meleeCheck(this, this.atkHit);
      }
      if (this.atkT <= 0) this.atkWin = 0.42;
    } else {
      this.atkWin = Math.max(0, this.atkWin - dt);
      if (k.attack) {
        this.chargeT += dt;
        if (this.chargeT > 0.5 && !this.charged) {
          this.charged = true; SND.charge(); s.chargeGlow(this);
        }
      }
      if (k.attackDown && this.chargeT < 0.05) this.startSwing();
      if (k.attackUp) {
        if (this.charged) { s.fireBolt(this); this.charged = false; }
        this.chargeT = 0;
      }
      if (!k.attack) this.chargeT = 0;
    }

    /* ---- animation ---- */
    if (this.hurtT > 0) { this.setTexture('monk_hurt'); this.anims.stop(); }
    else if (this.atkT > 0) { this.setTexture(['monk_atk0', 'monk_atk1', 'monk_atk2'][this.atkIdx]); this.anims.stop(); }
    else if (this.charged || (this.chargeT > 0.5)) { this.play('monk-charge', true); }
    else if (!onFloor) { this.setTexture(this.body.velocity.y < 0 ? 'monk_jump' : 'monk_fall'); this.anims.stop(); }
    else if (Math.abs(this.body.velocity.x) > 12) { this.play('monk-walk', true); }
    else this.play('monk-idle', true);

    /* running dust */
    if (onFloor && Math.abs(this.body.velocity.x) > 60) {
      this.walkDust -= dt;
      if (this.walkDust <= 0) { this.walkDust = 0.13; s.puff(this.x - this.facing * 4, this.y + 8, 2); }
    }

    /* blink while invulnerable */
    this.setAlpha(this.invuln > 0 ? (Math.floor(this.invuln * 22) % 2 ? 0.35 : 1) : 1);
  }

  startSwing() {
    const spirit = this.spirit > 0;
    this.atkIdx = (this.atkWin > 0) ? (this.atkIdx + 1) % 3 : 0;
    this.atkT = 0.24;
    const reach = this.atkIdx === 2 ? 30 : 24;
    this.atkHit = {
      idx: this.atkIdx,
      until: 0.17,
      w: reach, h: this.atkIdx === 2 ? 30 : 20,
      dx: this.atkIdx === 2 ? 0 : this.facing * 13,
      dmg: (this.atkIdx === 2 ? 2 : 1) + (spirit ? 1 : 0),
      done: new Set()
    };
    SND.swing(this.atkIdx);
    this.scene.slashFX(this, this.atkIdx);
    if (this.atkIdx === 2 && this.grounded) this.setVelocityX(this.facing * 110);
    if (spirit) this.scene.spiritSlashBolt(this);
  }

  takeHit(dmg, fromX) {
    if (this.invuln > 0 || this.dead || this.dashT > 0) return false;
    this.hp -= (dmg || 1);
    this.invuln = 1.25;
    this.hurtT = 0.35;
    this.chargeT = 0; this.charged = false; this.atkT = 0;
    const dir = (this.x < fromX) ? -1 : 1;
    this.setVelocity(dir * 150, -180);
    SND.hurt();
    this.scene.onPlayerHurt();
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.body.setVelocity(0, -260);
    this.body.checkCollision.none = true;
    this.setTexture('monk_hurt');
    this.scene.onPlayerDeath();
  }
}

/* =========================================================================
   ENEMY BASE
   ========================================================================= */
class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, tex, o) {
    super(scene, x, y, tex);
    o = o || {};
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(o.depth || 30);
    this.hp = o.hp || 1;
    this.maxHp = this.hp;
    this.scoreValue = o.score || 100;
    this.touchDmg = o.dmg === undefined ? 1 : o.dmg;
    this.flying = !!o.flying;
    this.deathColour = o.colour || CN.red3;
    this.flashT = 0;
    this.stagger = 0;
    this.spawnX = x; this.spawnY = y;
    this.active_ = true;
    if (this.flying) this.body.setAllowGravity(false);
    scene.enemies.add(this);
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (this.flashT > 0) {
      this.flashT -= d / 1000;
      if (this.flashT <= 0) this.clearTint();
    }
  }

  hurt(dmg, fromX, silent) {
    if (this.hp <= 0) return false;
    this.hp -= dmg;
    this.flashT = 0.09;
    this.setTintFill(0xffffff);
    this.stagger = 0.12;
    this.scene.sparks(this.x, this.y, fromX < this.x ? 1 : -1);
    if (!silent) SND.hit();
    if (this.hp <= 0) { this.die(fromX); return true; }
    if (!this.flying && this.body) this.setVelocityX((this.x - fromX > 0 ? 1 : -1) * 60);
    return false;
  }

  die(fromX) {
    this.scene.enemyKilled(this);
    this.scene.deathBurst(this.x, this.y, this.deathColour, this.width);
    SND.kill();
    this.destroy();
  }
}

/* --- 1. sine-wave flying demon ------------------------------------- */
class Demon extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'demon0', { hp: 1, score: 100, flying: true, colour: CN.red3 });
    this.body.setSize(10, 11).setOffset(3, 4);
    this.t = Math.random() * 6;
    this.baseY = y;
    this.dir = -1;
    this.range = 70 + Math.random() * 40;
    this.play('demon-fly');
    this.emberT = 0;
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    this.t += dt;
    this.x += this.dir * 44 * dt;
    if (this.x < this.spawnX - this.range) this.dir = 1;
    if (this.x > this.spawnX + this.range) this.dir = -1;
    const p = this.scene.player;
    if (p && !p.dead && Math.abs(p.x - this.x) < 150) this.baseY += Phaser.Math.Clamp(p.y - 18 - this.baseY, -22 * dt, 22 * dt);
    this.y = this.baseY + Math.sin(this.t * 3.1) * 22;
    this.setFlipX(this.dir > 0);
    this.emberT -= dt;
    if (this.emberT <= 0) { this.emberT = 0.14; this.scene.trailEmber(this.x, this.y + 6, CN.red3); }
  }
}

/* --- 2. hellhound: charges along the ground ------------------------- */
class Hound extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'hound0', { hp: 2, score: 150, colour: CN.red2 });
    this.body.setSize(17, 11).setOffset(2, 3);
    this.state_ = 'patrol';
    this.tmr = 0;
    this.dir = -1;
    this.play('hound-run');
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    const p = this.scene.player;
    this.tmr -= dt;
    if (this.stagger > 0) { this.stagger -= dt; return; }

    if (this.state_ === 'patrol') {
      this.setVelocityX(this.dir * 34);
      this.play('hound-run', true);
      if (this.body.blocked.left) this.dir = 1;
      if (this.body.blocked.right) this.dir = -1;
      if (p && !p.dead && Math.abs(p.y - this.y) < 40 && Math.abs(p.x - this.x) < 130) {
        this.dir = p.x < this.x ? -1 : 1;
        this.state_ = 'tell'; this.tmr = 0.5;
        this.setTexture('hound_tell'); this.anims.stop();
        this.setVelocityX(0);
        this.scene.telegraph(this.x, this.y - 12, CN.fire);
      }
    } else if (this.state_ === 'tell') {
      this.setVelocityX(0);
      this.setTint(this.tmr % 0.16 < 0.08 ? 0xffcc55 : 0xffffff);
      this.flashT = 0.05;
      if (this.tmr <= 0) { this.state_ = 'charge'; this.tmr = 1.15; SND.fire(); this.clearTint(); }
    } else if (this.state_ === 'charge') {
      this.setVelocityX(this.dir * 205);
      this.play('hound-run', true);
      this.scene.trailEmber(this.x - this.dir * 8, this.y + 3, CN.fire);
      if (this.tmr <= 0 || this.body.blocked.left || this.body.blocked.right) {
        this.state_ = 'rest'; this.tmr = 0.7; this.setVelocityX(0);
      }
    } else {
      this.setVelocityX(0);
      this.setTexture('hound0'); this.anims.stop();
      if (this.tmr <= 0) this.state_ = 'patrol';
    }
    this.setFlipX(this.dir < 0);      /* the hound is drawn facing right */
  }
}

/* --- 3. imp: hops toward the monk ----------------------------------- */
class Imp extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'imp0', { hp: 1, score: 120, colour: CN.pur2 });
    this.body.setSize(9, 10).setOffset(2, 4);
    this.tmr = Math.random();
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    this.tmr -= dt;
    const p = this.scene.player;
    if (this.body.blocked.down) {
      this.setTexture(this.tmr < 0.28 ? 'imp1' : 'imp0');
      this.setVelocityX(this.body.velocity.x * 0.85);
      if (this.tmr <= 0) {
        const dir = (p && !p.dead && Math.abs(p.x - this.x) < 190) ? Math.sign(p.x - this.x) || 1 : (Math.random() < 0.5 ? -1 : 1);
        this.setVelocity(dir * 92, -250);
        this.tmr = 1.05 + Math.random() * 0.5;
        this.setFlipX(dir < 0);
        this.scene.puff(this.x, this.y + 6, 3);
      }
    } else this.setTexture('imp0');
  }
}

/* --- 4. guardian statue: fireball turret ---------------------------- */
class Statue extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 2, 'statue0', { hp: 5, score: 250, dmg: 1, colour: CN.st4 });
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(13, 18).setOffset(2, 2);
    this.tmr = 1.4 + Math.random();
    this.hot = false;
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    const p = this.scene.player;
    if (!p || p.dead) return;
    if (Math.abs(p.x - this.x) > 210) return;
    this.tmr -= dt;
    if (!this.hot && this.tmr < 0.55) {
      this.hot = true; this.setTexture('statue1');
      this.scene.telegraph(this.x, this.y - 4, CN.fire);
    }
    if (this.tmr <= 0) {
      this.hot = false; this.setTexture('statue0');
      this.tmr = 2.1 + Math.random() * 0.6;
      const dir = Math.sign(p.x - this.x) || 1;
      this.setFlipX(dir < 0);
      const ang = Phaser.Math.Angle.Between(this.x, this.y - 2, p.x, p.y);
      this.scene.spawnBullet('fire', this.x + dir * 9, this.y - 2,
        Math.cos(ang) * 118, Math.sin(ang) * 118);
      SND.fire();
    }
  }
}

/* --- 5. armoured brute: shielded, slams ----------------------------- */
class Brute extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 4, 'brute0', { hp: 7, score: 500, colour: CN.st4 });
    this.body.setSize(15, 20).setOffset(4, 2);
    this.state_ = 'walk';
    this.tmr = 2.0;
    this.dir = -1;
  }
  /** frontal blows ring off the shield unless the brute is recovering */
  hurt(dmg, fromX) {
    const front = Math.sign(fromX - this.x) === this.dir;
    if (this.state_ !== 'recover' && front) {
      SND.clang();
      this.scene.sparks(this.x + this.dir * 10, this.y, this.dir, 0xffffff);
      this.flashT = 0.06; this.setTintFill(0xbcd2ff);
      return false;
    }
    return super.hurt(dmg, fromX);
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    const p = this.scene.player;
    this.tmr -= dt;
    if (this.state_ === 'walk') {
      if (p && !p.dead) this.dir = Math.sign(p.x - this.x) || this.dir;
      this.setVelocityX(this.dir * 26);
      this.play('brute-walk', true);
      this.setFlipX(this.dir < 0);
      if (p && !p.dead && Math.abs(p.x - this.x) < 46 && this.tmr <= 0) {
        this.state_ = 'tell'; this.tmr = 0.62;
        this.setTexture('brute_slam'); this.anims.stop();
        this.setVelocityX(0);
        this.scene.telegraph(this.x, this.y - 16, CN.fire);
      }
    } else if (this.state_ === 'tell') {
      this.setVelocityX(0);
      if (this.tmr <= 0) {
        this.state_ = 'recover'; this.tmr = 1.05;
        this.scene.cam.shake(220, 0.011);
        SND.hit(); SND.crumble();
        this.scene.spawnShock(this.x - 12, this.y + 9, -1);
        this.scene.spawnShock(this.x + 12, this.y + 9, 1);
        this.scene.puff(this.x, this.y + 10, 12);
      }
    } else {
      this.setVelocityX(0);
      this.setTexture('brute1'); this.anims.stop();
      /* vulnerable: pulsing red rim */
      this.setTint(0xffbbbb); this.flashT = 0.05;
      if (this.tmr <= 0) { this.state_ = 'walk'; this.tmr = 2.4; this.clearTint(); }
    }
  }
}

/* --- 6. bats: a swarm that erupts when disturbed -------------------- */
class Bat extends Enemy {
  constructor(scene, x, y, i) {
    super(scene, x, y, 'bat0', { hp: 1, score: 60, flying: true, colour: CN.pur2 });
    this.body.setSize(6, 5).setOffset(2, 2);
    this.t = i * 1.2;
    this.i = i;
    this.mode = 'swarm';
    this.tmr = 1.0 + i * 0.35;
    this.play('bat-fly');
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    this.t += dt; this.tmr -= dt;
    const p = this.scene.player;
    if (this.mode === 'swarm') {
      const cx = this.spawnX + Math.cos(this.t * 1.5 + this.i) * 34;
      const cy = this.spawnY + Math.sin(this.t * 2.2 + this.i) * 20;
      this.x += (cx - this.x) * Math.min(1, dt * 5);
      this.y += (cy - this.y) * Math.min(1, dt * 5);
      if (this.tmr <= 0 && p && !p.dead && Math.abs(p.x - this.x) < 190) {
        this.mode = 'dive'; this.tmr = 1.5;
        const a = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
        this.dvx = Math.cos(a) * 150; this.dvy = Math.sin(a) * 150;
      }
    } else {
      this.x += this.dvx * dt; this.y += this.dvy * dt;
      this.dvy += 60 * dt;
      if (this.tmr <= 0) { this.mode = 'swarm'; this.tmr = 1.6 + Math.random(); this.spawnX = this.x; this.spawnY = this.y; }
    }
    this.setFlipX(p && p.x < this.x);
  }
}

class BatNest {
  constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; this.done = false; }
  update() {
    if (this.done) return;
    const p = this.scene.player;
    if (!p || p.dead) return;
    if (Math.abs(p.x - this.x) < 165) {
      this.done = true;
      for (let i = 0; i < 6; i++) new Bat(this.scene, this.x + (i - 3) * 6, this.y + (i % 2) * 8, i);
      this.scene.puff(this.x, this.y, 10, CN.pur1);
      SND.fire();
    }
  }
}

/* =========================================================================
   MINI-BOSS — the Jade General
   ========================================================================= */
class General extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y - 6, 'gen0', { hp: 26, score: 3000, dmg: 1, colour: CN.jade2, depth: 34 });
    this.body.setSize(20, 30).setOffset(6, 4);
    this.setOrigin(0.5, 0.5);
    this.state_ = 'wait';
    this.tmr = 0;
    this.dir = -1;
    this.awake = false;
    this.arena = null;
    this.setActive(false).setVisible(false);
    this.body.enable = false;
  }
  wake(arena) {
    this.arena = arena;
    this.awake = true;
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.state_ = 'idle'; this.tmr = 0.9;
  }
  hurt(dmg, fromX) {
    if (!this.awake) return false;
    const r = super.hurt(dmg, fromX);
    if (!r) { this.setTexture('gen_hurt'); this.flashT = 0.12; }
    this.scene.hud.setBossHp(this.hp / this.maxHp);
    return r;
  }
  die(fromX) {
    this.scene.hud.hideBoss();
    this.scene.onMiniBossDead(this);
    super.die(fromX);
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (!this.awake) return;
    const dt = d / 1000;
    const p = this.scene.player;
    this.tmr -= dt;
    if (p && !p.dead && this.state_ !== 'dash') this.dir = Math.sign(p.x - this.x) || this.dir;
    this.setFlipX(this.dir < 0);

    switch (this.state_) {
      case 'idle':
        if (this.body.blocked.down) this.setVelocityX(this.body.velocity.x * 0.8);
        this.setTexture('gen0');
        if (this.tmr <= 0) {
          const r = Math.random();
          if (r < 0.38) { this.state_ = 'jump'; this.tmr = 0.45; this.setTexture('gen1'); this.scene.telegraph(this.x, this.y - 22, CN.jade3); }
          else if (r < 0.72) { this.state_ = 'throw'; this.tmr = 0.5; this.setTexture('gen2'); this.scene.telegraph(this.x, this.y - 10, CN.jade3); }
          else { this.state_ = 'predash'; this.tmr = 0.45; this.setTexture('gen2'); this.scene.telegraph(this.x, this.y, CN.fire); }
        }
        break;
      case 'jump':
        if (this.tmr <= 0) {
          this.setVelocity(this.dir * 105, -330);
          this.state_ = 'slam'; this.tmr = 2;
          SND.swing(1);
        }
        break;
      case 'slam':
        this.setTexture('gen1');
        if (this.body.blocked.down && this.body.velocity.y >= 0 && this.tmr < 1.85) {
          this.scene.cam.shake(300, 0.016);
          SND.hit(); SND.crumble();
          this.scene.spawnShock(this.x - 16, this.y + 16, -1, 150);
          this.scene.spawnShock(this.x + 16, this.y + 16, 1, 150);
          this.scene.puff(this.x, this.y + 16, 16, CN.jade2);
          this.state_ = 'idle'; this.tmr = 0.8;
        }
        if (this.tmr <= 0) { this.state_ = 'idle'; this.tmr = 0.7; }
        break;
      case 'throw':
        if (this.tmr <= 0) {
          for (let i = -1; i <= 1; i++) {
            this.scene.spawnBullet('blade', this.x + this.dir * 14, this.y - 6,
              this.dir * 135, i * 62 - 20);
          }
          SND.swing(2);
          this.state_ = 'idle'; this.tmr = 0.85;
        }
        break;
      case 'predash':
        this.setVelocityX(0);
        if (this.tmr <= 0) { this.state_ = 'dash'; this.tmr = 0.85; SND.dash(); }
        break;
      case 'dash':
        this.setVelocityX(this.dir * 230);
        this.scene.trailEmber(this.x, this.y + 8, CN.jade2);
        if (this.arena) {
          if (this.x < this.arena[0] + 30) { this.x = this.arena[0] + 30; this.dir = 1; }
          if (this.x > this.arena[1] - 30) { this.x = this.arena[1] - 30; this.dir = -1; }
        }
        if (this.tmr <= 0) { this.state_ = 'idle'; this.tmr = 0.75; this.setVelocityX(0); }
        break;
    }
  }
}

/* =========================================================================
   FINAL BOSS — 紅龍, the Red Dragon
   ========================================================================= */
class Dragon extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'dragon0', { hp: 46, score: 12000, dmg: 2, flying: true, colour: CN.red4, depth: 36 });
    this.body.setSize(56, 34).setOffset(40, 4);
    this.state_ = 'sleep';
    this.tmr = 0;
    this.dir = -1;
    this.awake = false;
    this.phase = 1;
    this.arena = null;
    this.homeY = y;
    this.t = 0;
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.play('dragon-fly');
  }
  wake(arena) {
    this.arena = arena;
    this.awake = true;
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.state_ = 'hover'; this.tmr = 1.2;
  }
  hurt(dmg, fromX) {
    if (!this.awake) return false;
    const r = super.hurt(dmg, fromX);
    if (!r) { this.setTexture('dragon_hurt'); this.anims.stop(); this.flashT = 0.1; }
    this.scene.hud.setBossHp(this.hp / this.maxHp);
    const ph = this.hp > this.maxHp * 0.62 ? 1 : (this.hp > this.maxHp * 0.3 ? 2 : 3);
    if (ph !== this.phase) { this.phase = ph; this.onPhase(); }
    return r;
  }
  onPhase() {
    SND.roar();
    this.scene.cam.shake(700, 0.014);
    this.scene.cam.flash(220, 140, 20, 20);
    this.scene.bossShout('PHASE ' + this.phase);
    for (let i = 0; i < 3; i++) this.scene.deathBurst(this.x - 20 + i * 20, this.y, CN.fire, 40);
  }
  die(fromX) {
    this.scene.hud.hideBoss();
    this.scene.onBossDead(this);
    this.destroy();
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (!this.awake) return;
    const dt = d / 1000;
    this.t += dt;
    this.tmr -= dt;
    const p = this.scene.player;
    const A = this.arena || [0, 99999];
    if (this.flashT <= 0 && this.state_ !== 'breathe' && this.state_ !== 'wind') this.play('dragon-fly', true);
    this.setFlipX(this.dir < 0);      /* the dragon is drawn head-right */

    const speedMul = this.phase === 1 ? 1 : (this.phase === 2 ? 1.25 : 1.55);

    switch (this.state_) {
      case 'hover': {
        const tx = p ? Phaser.Math.Clamp(p.x - this.dir * 90, A[0] + 60, A[1] - 60) : this.x;
        this.x += Phaser.Math.Clamp(tx - this.x, -70 * dt * speedMul, 70 * dt * speedMul);
        this.y = this.homeY + Math.sin(this.t * 1.6) * 14;
        if (p && !p.dead) this.dir = Math.sign(p.x - this.x) || this.dir;
        if (this.tmr <= 0) {
          const r = Math.random();
          if (this.phase >= 3 && r < 0.3) { this.state_ = 'rain'; this.tmr = 0.6; }
          else if (r < 0.42) { this.state_ = 'wind'; this.tmr = 0.75; this.setTexture('dragon_open'); this.anims.stop(); this.scene.telegraph(this.x + this.dir * 40, this.y, CN.fire); }
          else if (r < 0.72) { this.state_ = 'predive'; this.tmr = 0.55; }
          else if (this.phase >= 2) { this.state_ = 'summon'; this.tmr = 0.6; this.setTexture('dragon_open'); this.anims.stop(); }
          else { this.state_ = 'wind'; this.tmr = 0.7; this.setTexture('dragon_open'); this.anims.stop(); }
        }
        break;
      }
      case 'wind':                       /* wind-up before the fire breath */
        this.y = this.homeY + Math.sin(this.t * 1.6) * 8;
        if (this.tmr <= 0) { this.state_ = 'breathe'; this.tmr = this.phase >= 2 ? 1.4 : 1.05; this.shotT = 0; SND.roar(); }
        break;
      case 'breathe': {
        this.setTexture('dragon_fire'); this.anims.stop();
        this.shotT -= dt;
        if (this.shotT <= 0) {
          this.shotT = 0.085;
          const mx = this.x + this.dir * 46, my = this.y + 6;
          const spread = (Math.random() - 0.5) * 26;
          this.scene.spawnBullet('dfire', mx, my, this.dir * (150 + Math.random() * 55), spread);
          this.scene.trailEmber(mx, my, CN.fire);
          SND.fire();
        }
        if (this.tmr <= 0) { this.state_ = 'hover'; this.tmr = 1.0 / speedMul; }
        break;
      }
      case 'predive':
        this.y += (this.homeY - 16 - this.y) * Math.min(1, dt * 5);
        if (p) this.dir = Math.sign(p.x - this.x) || this.dir;
        this.scene.telegraph(this.x, this.y, CN.red5);
        if (this.tmr <= 0) { this.state_ = 'dive'; this.tmr = 1.6; this.diveY = p ? p.y - 8 : this.homeY + 40; SND.swing(2); }
        break;
      case 'dive':
        this.x += this.dir * 210 * dt * speedMul;
        this.y += (this.diveY - this.y) * Math.min(1, dt * 4);
        this.scene.trailEmber(this.x - this.dir * 30, this.y + 8, CN.fire);
        if (this.x < A[0] + 50) { this.x = A[0] + 50; this.dir = 1; this.state_ = 'climb'; this.tmr = 0.9; }
        if (this.x > A[1] - 50) { this.x = A[1] - 50; this.dir = -1; this.state_ = 'climb'; this.tmr = 0.9; }
        if (this.tmr <= 0) { this.state_ = 'climb'; this.tmr = 0.9; }
        break;
      case 'climb':
        this.y += (this.homeY - this.y) * Math.min(1, dt * 3);
        if (this.tmr <= 0) { this.state_ = 'hover'; this.tmr = 0.8 / speedMul; }
        break;
      case 'summon':
        if (this.tmr <= 0) {
          for (let i = 0; i < 3; i++) {
            const dx = (i - 1) * 46;
            const dmn = new Demon(this.scene, this.x + dx, this.y + 24);
            dmn.baseY = this.y + 30;
            this.scene.puff(this.x + dx, this.y + 24, 8, CN.red3);
          }
          SND.roar();
          this.state_ = 'hover'; this.tmr = 0.9;
        }
        break;
      case 'rain': {
        this.y += ((A ? this.homeY - 34 : this.homeY) - this.y) * Math.min(1, dt * 4);
        const tx = Phaser.Math.Clamp((p ? p.x : this.x), A[0] + 60, A[1] - 60);
        this.x += Phaser.Math.Clamp(tx - this.x, -120 * dt, 120 * dt);
        this.shotT = (this.shotT || 0) - dt;
        if (this.shotT <= 0) {
          this.shotT = 0.22;
          this.scene.spawnBullet('dfire', this.x + (Math.random() - 0.5) * 60, this.y + 20, (Math.random() - 0.5) * 40, 90);
          SND.fire();
        }
        if (this.tmr <= -2.6) { this.state_ = 'hover'; this.tmr = 0.7; }
        break;
      }
    }
  }
}

/* =========================================================================
   PROJECTILES
   ========================================================================= */
class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind, vx, vy) {
    const tex = { fire: 'fireball0', dfire: 'dfire0', blade: 'blade0', bolt: 'bolt0', shock: 'shock0' }[kind];
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.setDepth(35);
    this.body.setAllowGravity(kind === 'shock');
    this.setVelocity(vx, vy);
    this.life = kind === 'shock' ? 1.4 : 3.4;
    this.dmg = kind === 'dfire' ? 1 : 1;
    this.friendly = (kind === 'bolt');
    this.emT = 0;

    if (kind === 'fire') { this.play('fire-spin'); this.body.setCircle(4, 1, 1); }
    else if (kind === 'dfire') { this.play('dfire-spin'); this.body.setCircle(5, 2, 2); this.setBlendMode(Phaser.BlendModes.ADD); }
    else if (kind === 'blade') { this.play('blade-spin'); this.body.setCircle(5, 1, 1); }
    else if (kind === 'bolt') {
      this.play('bolt-fly'); this.body.setSize(14, 8).setOffset(1, 1);
      this.setBlendMode(Phaser.BlendModes.ADD); this.setFlipX(vx < 0);
      this.dmg = 3;
    } else if (kind === 'shock') {
      this.body.setSize(18, 10).setOffset(1, 2);
      this.body.setAllowGravity(false);
      this.setOrigin(0.5, 1);
      this.animT = 0;
    }
    (this.friendly ? scene.pBullets : scene.eBullets).add(this);
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;
    this.life -= dt;
    if (this.kind === 'shock') {
      this.animT = (this.animT || 0) + dt;
      this.setTexture('shock' + Math.min(2, Math.floor(this.animT * 7) % 3));
      this.setAlpha(Phaser.Math.Clamp(this.life, 0, 1));
    }
    this.emT -= dt;
    if (this.emT <= 0 && this.kind !== 'shock') {
      this.emT = 0.05;
      this.scene.trailEmber(this.x, this.y,
        this.kind === 'bolt' ? CN.gold4 : (this.kind === 'blade' ? CN.jade2 : CN.fire), 0.5);
    }
    if (this.life <= 0) this.pop();
  }
  pop(big) {
    if (!this.scene) return;
    this.scene.deathBurst(this.x, this.y,
      this.kind === 'blade' ? CN.jade2 : (this.kind === 'bolt' ? CN.gold4 : CN.fire), big ? 22 : 12);
    this.destroy();
  }
}

/* =========================================================================
   PICKUPS
   ========================================================================= */
class Pickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind) {
    const tex = { scroll: 'scroll0', coin: 'coin0', chi: 'chi', orb: 'orb0' }[kind];
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.kind = kind;
    this.setDepth(28);
    this.body.setAllowGravity(false);
    this.baseY = y;
    this.t = Math.random() * 6;
    if (kind === 'scroll') this.play('scroll-spin');
    if (kind === 'coin') this.play('coin-spin');
    if (kind === 'orb') { this.play('orb-pulse'); this.setBlendMode(Phaser.BlendModes.ADD); }
    scene.pickups.add(this);

    /* every pickup carries its own little glow */
    this.glow = scene.add.image(x, y, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(27)
      .setScale(kind === 'orb' ? 0.55 : 0.3)
      .setTint(kind === 'coin' ? CN.gold4 : (kind === 'chi' ? CN.jade2 : (kind === 'orb' ? CN.red4 : CN.cream3)))
      .setAlpha(0.5);
  }
  preUpdate(t, d) {
    super.preUpdate(t, d);
    this.t += d / 1000;
    this.y = this.baseY + Math.sin(this.t * 2.6) * 2.5;
    if (this.glow) {
      this.glow.x = this.x; this.glow.y = this.y;
      this.glow.setAlpha(0.35 + Math.sin(this.t * 4) * 0.16);
    }
  }
  destroy(f) { if (this.glow) { this.glow.destroy(); this.glow = null; } super.destroy(f); }
}

window.Player = Player;
window.Enemy = Enemy;
window.Demon = Demon; window.Hound = Hound; window.Imp = Imp;
window.Statue = Statue; window.Brute = Brute; window.Bat = Bat; window.BatNest = BatNest;
window.General = General; window.Dragon = Dragon;
window.Bullet = Bullet; window.Pickup = Pickup;
window.GRAV = GRAV;
