(function () {
  'use strict';
  const C = G.CONFIG, U = G.Utils;

  // Decides what spawns, where and when. Difficulty rises smoothly with time:
  // more enemies per second, more HP, new enemy types, ring waves and bosses.
  class Director {
    constructor(game) {
      this.g = game;
      this.acc = 0;
      this.waveTimer = C.WAVE_INTERVAL;
      this.waveNo = 0;
      this.bossIndex = 0;
    }

    hpMul() { return 1 + (this.g.time / 60) * C.SPAWN.hpPerMinute; }

    update(dt) {
      const g = this.g, t = g.time;
      let rate = C.SPAWN.base + (C.SPAWN.perMinute * t) / 60;
      if (g.boss) rate *= C.SPAWN.bossSlowdown;

      this.acc += rate * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        if (g.enemies.length < C.MAX_ENEMIES) this.spawn(this.pickType(t));
      }

      this.waveTimer -= dt;
      if (this.waveTimer <= 0) { this.waveTimer = C.WAVE_INTERVAL; this.ringWave(); }

      if (this.bossIndex < C.BOSS_TIMES.length && t >= C.BOSS_TIMES[this.bossIndex] && !g.boss) this.spawnBoss();
    }

    pickType(t) {
      const types = Object.keys(G.ENEMIES).filter(k => G.ENEMIES[k].weight > 0 && G.ENEMIES[k].unlockAt <= t);
      return U.weightedPick(types, k => {
        const d = G.ENEMIES[k], growth = d.growth ?? 1;
        return d.weight * (1 + growth * Math.min(2, (t - d.unlockAt) / 180));
      });
    }

    // A point just outside the visible screen.
    spawnPoint(angle) {
      const g = this.g, a = angle ?? Math.random() * Math.PI * 2;
      const dist = Math.hypot(g.w, g.h) / 2 + 50;
      return { x: g.player.x + Math.cos(a) * dist, y: g.player.y + Math.sin(a) * dist };
    }

    spawn(type, pos) {
      pos = pos || this.spawnPoint();
      const e = new G.Enemy(type, pos.x, pos.y, this.hpMul(), this.g);
      this.g.enemies.push(e);
      return e;
    }

    ringWave() {
      const g = this.g;
      this.waveNo++;
      const n = Math.round(16 + g.time / 15);
      const type = g.time > 150 && Math.random() < 0.4 ? 'dart' : 'crawler';
      for (let i = 0; i < n; i++) {
        if (g.enemies.length >= C.MAX_ENEMIES + 60) break;
        this.spawn(type, this.spawnPoint((i / n) * Math.PI * 2));
      }
      g.showBanner(`Волна ${this.waveNo}`, 'Рой окружает!', 2);
      G.Audio.play('wave');
    }

    spawnBoss() {
      const g = this.g, i = this.bossIndex++;
      const e = this.spawn('boss');
      e.maxHp = e.hp = G.ENEMIES.boss.hp * (1 + i * 1.8);
      e.bossIndex = i;
      e.name = G.BOSS_NAMES[i] || 'Босс';
      g.boss = e;
      g.showBanner(e.name, 'Босс приближается', 3);
      g.fx.shake(0.6);
      G.Audio.play('boss');
    }
  }

  G.Director = Director;
})();
