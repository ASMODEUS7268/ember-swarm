(function () {
  'use strict';
  const C = G.CONFIG, U = G.Utils;
  const TAU = Math.PI * 2;

  function baseStats() {
    const P = C.PLAYER, W = C.WEAPON;
    return {
      maxHp: P.maxHp, moveSpeed: P.moveSpeed, magnet: P.magnet, dashCooldown: P.dashCooldown,
      regen: 0, armor: 0,
      damage: W.damage, fireRate: W.fireRate, bulletSpeed: W.bulletSpeed, bulletLife: W.bulletLife,
      projectiles: 1, pierce: 0, bounce: 0, crit: W.crit,
      orbitCount: 0, orbitDamage: 0, novaLevel: 0,
    };
  }

  const xpForLevel = l => Math.round(5 + (l - 1) * 4 + Math.pow(l - 1, 1.5) * 1.2);

  // ---------------------------------------------------------------- Player
  class Player {
    constructor() {
      this.x = 0; this.y = 0;
      this.r = C.PLAYER.radius;
      this.stats = baseStats();
      this.hp = this.stats.maxHp;
      this.level = 1; this.xp = 0; this.xpNext = xpForLevel(1);
      this.upgrades = {};            // upgrade id -> level
      this.invuln = 0; this.hurtFlash = 0; this.dead = false;
      this.dashTime = 0; this.dashCd = 0; this.dashX = 1; this.dashY = 0;
      this.faceX = 1; this.faceY = 0;
      this.fireTimer = 0.3;
      this.orbitAngle = 0; this.novaTimer = 2; this.trailTimer = 0;
    }

    // Damage upgrades scale every weapon, not just the main gun.
    get dmgMul() { return this.stats.damage / C.WEAPON.damage; }

    heal(v) { this.hp = Math.min(this.stats.maxHp, this.hp + v); }

    addXp(v, g) {
      this.xp += v;
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = xpForLevel(this.level);
        g.pendingLevelUps++;
      }
    }

    update(dt, g) {
      const s = this.stats, I = G.Input, P = C.PLAYER;
      const mv = I.axis();
      if (mv.x || mv.y) { this.faceX = mv.x; this.faceY = mv.y; }

      this.dashCd -= dt;
      const wantsDash = I.consume('Space') || I.consume('ShiftLeft') || I.consume('ShiftRight');
      if (wantsDash && this.dashCd <= 0) {
        this.dashX = this.faceX; this.dashY = this.faceY;
        this.dashTime = P.dashTime;
        this.dashCd = s.dashCooldown;
        this.invuln = Math.max(this.invuln, P.dashTime + 0.1); // dashing through bullets is the core skill
        G.Audio.play('dash');
        g.fx.ring(this.x, this.y, 36, '#7ff6ff', 0.25, 2);
      }

      if (this.dashTime > 0) {
        this.dashTime -= dt;
        this.x += this.dashX * P.dashSpeed * dt;
        this.y += this.dashY * P.dashSpeed * dt;
        this.trailTimer -= dt;
        if (this.trailTimer <= 0) { this.trailTimer = 0.02; g.fx.ghost(this.x, this.y, this.r * 0.9, '#2a7f9a'); }
      } else {
        this.x += mv.x * s.moveSpeed * dt;
        this.y += mv.y * s.moveSpeed * dt;
      }

      this.invuln -= dt;
      this.hurtFlash -= dt;
      if (s.regen > 0) this.heal(s.regen * dt);

      this.updateGun(dt, g);
      this.updateOrbit(dt, g);
      this.updateNova(dt, g);
    }

    updateGun(dt, g) {
      this.fireTimer -= dt;
      if (this.fireTimer > 0) return;
      const s = this.stats;
      const target = g.gunTarget(this.x, this.y, s.bulletSpeed * s.bulletLife);
      if (!target) { this.fireTimer = 0; return; }

      // Aim where the target will be when the bullet arrives.
      const t = Math.hypot(target.x - this.x, target.y - this.y) / s.bulletSpeed;
      const aim = Math.atan2(target.y + target.mvy * t - this.y, target.x + target.mvx * t - this.x);
      const n = s.projectiles;
      for (let i = 0; i < n; i++) {
        const a = aim + (i - (n - 1) / 2) * C.WEAPON.spread;
        const crit = Math.random() < s.crit;
        g.bullets.push(new Bullet(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, a, s, crit));
      }
      this.fireTimer += 1 / s.fireRate;
      g.fx.burst(this.x + Math.cos(aim) * this.r, this.y + Math.sin(aim) * this.r, '#7ff6ff', 2, 120, 0.12, 2);
      G.Audio.play('shoot');
    }

    orbitPositions() {
      const n = this.stats.orbitCount, out = [];
      for (let i = 0; i < n; i++) {
        const a = this.orbitAngle + (i * TAU) / n;
        out.push({ x: this.x + Math.cos(a) * 72, y: this.y + Math.sin(a) * 72 });
      }
      return out;
    }

    updateOrbit(dt, g) {
      if (!this.stats.orbitCount) return;
      this.orbitAngle += dt * 2.8;
      const dmg = this.stats.orbitDamage * this.dmgMul, R = 9;
      for (const o of this.orbitPositions()) {
        for (const e of g.hash.query(o.x, o.y, R + 50, g._q)) {
          if (e.dead || g.time - e.orbitHit < 0.4) continue; // per-enemy cooldown
          const rr = R + e.r;
          if (U.dist2(o.x, o.y, e.x, e.y) > rr * rr) continue;
          e.orbitHit = g.time;
          const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1;
          g.damageEnemy(e, dmg, false, dx / d, dy / d, 200);
        }
      }
    }

    updateNova(dt, g) {
      const lvl = this.stats.novaLevel;
      if (!lvl) return;
      this.novaTimer -= dt;
      if (this.novaTimer > 0) return;
      this.novaTimer = 4.2 - 0.45 * (lvl - 1);
      g.nova(this.x, this.y, 130 + 22 * lvl, (18 + 12 * lvl) * this.dmgMul);
    }
  }

  // ---------------------------------------------------------------- Enemy
  class Enemy {
    constructor(type, x, y, hpMul, g) {
      const d = G.ENEMIES[type];
      this.id = g.nextId++;
      this.type = type; this.def = d;
      this.x = x; this.y = y; this.r = d.radius;
      this.maxHp = this.hp = d.hp * hpMul;
      this.speed = d.speed * U.rand(0.9, 1.12);
      this.damage = d.damage;
      this.kx = 0; this.ky = 0;       // knockback velocity, decays over time
      this.mvx = 0; this.mvy = 0;     // intended velocity (used for aim leading)
      this.flash = 0; this.age = 0; this.angle = 0; this.dead = false;
      this.orbitHit = -9;
      this.shootTimer = U.rand(1.2, 2.6);
      this.patternTimer = 2.5; this.patternIdx = 0; this.spiral = null; this.bossIndex = 0;
    }

    update(dt, g) {
      const p = g.player, d = this.def;
      this.age += dt; this.flash -= dt;

      let dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      let mx = dx, my = dy;

      if (d.behavior === 'ranged') {
        // Keep a comfortable distance and strafe, spitting at the player.
        if (dist < 230) { mx = -dx; my = -dy; }
        else if (dist < 330) { const side = this.id % 2 ? 1 : -1; mx = -dy * side; my = dx * side; }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && dist < 520) {
          this.shootTimer = U.rand(2, 2.8);
          // Enemy shots are always warm colours so they never read as XP gems.
          g.enemyShoot(this.x, this.y, Math.atan2(dy, dx), 230, 10, '#ff7a3d');
        }
      } else if (d.behavior === 'boss') {
        this.bossLogic(dt, g);
      }

      // Soft separation so the swarm spreads into a crowd instead of one blob.
      let sx = 0, sy = 0;
      const myMass = d.mass || 1;
      for (const o of g.hash.query(this.x, this.y, this.r + 50, g._q)) {
        if (o === this || o.dead) continue;
        const ox = this.x - o.x, oy = this.y - o.y, rr = this.r + o.r;
        const d2 = ox * ox + oy * oy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const dd = Math.sqrt(d2), oMass = o.def.mass || 1;
        const push = ((rr - dd) / rr) * (oMass / (myMass + oMass));
        sx += (ox / dd) * push; sy += (oy / dd) * push;
      }

      this.mvx = mx * this.speed; this.mvy = my * this.speed;
      this.x += (this.mvx + this.kx + sx * 240) * dt;
      this.y += (this.mvy + this.ky + sy * 240) * dt;
      const kd = Math.exp(-dt * 7); this.kx *= kd; this.ky *= kd;
      this.angle = Math.atan2(my, mx);

      // Enemies press against the player rather than stacking on top.
      if (!p.dead) {
        const pr = (p.r + this.r) * 0.85, px = this.x - p.x, py = this.y - p.y, pd2 = px * px + py * py;
        if (pd2 < pr * pr && pd2 > 0) { const pd = Math.sqrt(pd2); this.x = p.x + (px / pd) * pr; this.y = p.y + (py / pd) * pr; }
      }

      // Stragglers left far behind reappear ahead of the player to keep pressure on.
      if (d.behavior !== 'boss' && dist > g.despawnDist) {
        const pos = g.director.spawnPoint(Math.atan2(p.faceY, p.faceX) + U.rand(-1, 1));
        this.x = pos.x; this.y = pos.y;
      }
    }

    bossLogic(dt, g) {
      const lvl = this.bossIndex;
      if (this.spiral) {
        this.spiral.t -= dt;
        if (this.spiral.t <= 0) {
          this.spiral.t = 0.16; this.spiral.a += 0.22;
          this.fireRing(g, 10, this.spiral.a, 200);
          if (--this.spiral.left <= 0) this.spiral = null;
        }
      }
      this.patternTimer -= dt;
      if (this.patternTimer > 0) return;
      this.patternTimer = Math.max(1.8, 3.4 - lvl * 0.5);
      switch (this.patternIdx++ % 3) {
        case 0: this.fireRing(g, 14 + lvl * 4, Math.random() * TAU, 190 + lvl * 20); break;
        case 1: this.spiral = { left: 5 + lvl, t: 0, a: Math.random() * TAU }; break;
        case 2: {
          const n = 5 + lvl * 2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            g.director.spawn(lvl >= 1 && i % 2 ? 'dart' : 'crawler', { x: this.x + Math.cos(a) * (this.r + 24), y: this.y + Math.sin(a) * (this.r + 24) });
          }
          g.fx.ring(this.x, this.y, this.r + 60, this.def.color, 0.5, 4);
        }
      }
    }

    fireRing(g, n, offset, speed) {
      for (let i = 0; i < n; i++) g.enemyShoot(this.x, this.y, offset + (i * TAU) / n, speed, 14, '#ff5577');
      G.Audio.play('bossShot');
    }
  }

  // ---------------------------------------------------------------- Projectiles & pickups
  class Bullet {
    constructor(x, y, angle, s, crit) {
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * s.bulletSpeed; this.vy = Math.sin(angle) * s.bulletSpeed;
      this.life = s.bulletLife;
      this.r = C.WEAPON.bulletRadius * (crit ? 1.4 : 1);
      this.damage = s.damage * (crit ? C.WEAPON.critMult : 1);
      this.crit = crit;
      this.pierce = s.pierce; this.bounce = s.bounce;
      this.hit = new Set();   // enemy ids already hit, so piercing never double-hits
      this.dead = false;
    }
  }

  class EnemyBullet {
    constructor(x, y, angle, speed, damage, color) {
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
      this.damage = damage; this.color = color;
      this.r = 6; this.life = 4; this.dead = false;
    }
  }

  const GEM_TIERS = [[20, '#ff7dff', 7.5], [5, '#7dff6a', 6], [0, '#4de8ff', 4.5]];

  class Gem {
    constructor(x, y, value) {
      const a = Math.random() * TAU, sp = U.rand(30, 90);
      this.x = x; this.y = y;
      this.sx = Math.cos(a) * sp; this.sy = Math.sin(a) * sp;
      this.pulled = false; this.v = 0; this.dead = false;
      this.phase = Math.random() * TAU;
      this.setValue(value);
    }
    setValue(v) {
      this.value = v;
      for (const [min, color, r] of GEM_TIERS) if (v >= min) { this.color = color; this.r = r; break; }
    }
  }

  class Pickup {
    constructor(x, y, kind) {
      this.x = x; this.y = y; this.kind = kind;
      this.r = 10; this.life = 40; this.pulled = false; this.v = 0; this.dead = false;
    }
  }

  Object.assign(G, { Player, Enemy, Bullet, EnemyBullet, Gem, Pickup, xpForLevel });
})();
